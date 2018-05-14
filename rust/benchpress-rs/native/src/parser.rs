use token::Token;

#[derive(Debug, PartialEq, Clone, Eq, Hash)]
pub enum MetaToken {
    Text { source: String },
    Escaped { raw: String, subject: Vec<Token> },
    Raw { raw: String, subject: Vec<Token> },
    IfStart { raw: String, neg: bool, test: Vec<Token> },
    IterStart { raw: String, subject: Vec<Token> },
    Else { raw: String },
    End { raw: String, subject: Vec<Token> },
    EOF,
}
impl ToString for MetaToken {
    fn to_string(&self) -> String {
        match self {
            &MetaToken::Text { ref source } => source.to_string(),
            &MetaToken::Escaped { ref raw, subject: _ } => raw.to_string(),
            &MetaToken::Raw { ref raw, subject: _ } => raw.to_string(),
            &MetaToken::IfStart { ref raw, neg: _, test: _ } => raw.to_string(),
            &MetaToken::IterStart { ref raw, subject: _ } => raw.to_string(),
            &MetaToken::Else { ref raw } => raw.to_string(),
            &MetaToken::End { ref raw, subject: _ } => raw.to_string(),
            &MetaToken::EOF => String::new(),
        }
    }
}

use std::iter::Iterator;
use std::iter::Peekable;

use itertools::Itertools;

// collect individual tokens into meta tokens
pub fn first_pass(input: Vec<Token>) -> Vec<MetaToken> {
    let mut output: Vec<MetaToken> = Vec::new();

    let mut iter = input.into_iter().peekable();

    while let Some(outer) = iter.next() {
        match outer {
            Token::Text(source) => {
                let mut text = String::from(source.as_ref());

                let parts = iter.take_while_ref(|x| match x {
                    &Token::Text(_) => true,
                    _ => false,
                }).map(|x| match x {
                    Token::Text(s) => s,
                    _ => String::new(),
                }).collect::<Vec<String>>().join("");

                text.push_str(parts.as_ref());

                if text.len() > 0 {
                    output.push(MetaToken::Text { source: text });
                }
            },
            
            Token::BlockOpen(open_text) => {
                let keyword = iter.next().unwrap();
                match keyword {
                    Token::If(ref orig_text) | Token::Iter(ref orig_text) |
                    Token::Else(ref orig_text) | Token::End(ref orig_text) => {
                        let neg: bool = match iter.peek() {
                            Some(&Token::Bang) => {
                                iter.next();
                                true
                            },
                            _ => false,
                        };

                        let parts: Vec<Token> = iter.take_while_ref(|x| match x {
                            &Token::Identifier(_) | &Token::LegacyHelper |
                            &Token::LeftParen | &Token::RightParen |
                            &Token::StringLiteral(_) | &Token::Comma | &Token::Space => true,
                            _ => false,
                        }).collect();

                        let rest_text = parts.clone().into_iter().map(|x| x.to_string()).collect::<String>();

                        match iter.next() {
                            Some(Token::BlockClose(close_text)) => match keyword {
                                Token::If(_) => output.push(MetaToken::IfStart {
                                    raw: format!("{} {} {} {}", open_text, orig_text, rest_text, close_text),
                                    neg: neg,
                                    test: parts.into_iter().filter(|x| match x {
                                        &Token::Space => false,
                                        _ => true,
                                    }).collect(),
                                }),
                                Token::Iter(_) => {
                                    output.push(MetaToken::IterStart {
                                        raw: format!("{} {} {} {}", open_text, orig_text, rest_text, close_text),
                                        subject: parts.into_iter().filter(|x| match x {
                                            &Token::Space => false,
                                            _ => true,
                                        }).collect(),
                                    });
                                },
                                Token::Else(_) => output.push(MetaToken::Else {
                                    raw: format!("{} {} {} {}", open_text, orig_text, rest_text, close_text)
                                }),
                                Token::End(_) => output.push(MetaToken::End {
                                    raw: format!("{} {} {} {}", open_text, orig_text, rest_text, close_text),
                                    subject: parts.into_iter().filter(|x| match x {
                                        &Token::Space => false,
                                        _ => true,
                                    }).collect()
                                }),

                                _ => (),
                            },
                            Some(tok) => output.push(MetaToken::Text {
                                source: format!("{} {} {} {}", open_text, orig_text, rest_text, tok.to_string())
                            }),
                            None => (),
                        }
                    },

                    _ => output.push(MetaToken::Text {
                        source: open_text,
                    }),
                }
            },

            Token::RawOpen | Token::EscapedOpen => {
                let parts: Vec<Token> = iter.take_while_ref(|x| match x {
                    &Token::Identifier(_) | &Token::LegacyHelper |
                    &Token::LeftParen | &Token::RightParen |
                    &Token::StringLiteral(_) | &Token::Comma | &Token::Space => true,
                    _ => false,
                }).collect();

                let rest_text = parts.clone().into_iter().map(|x| x.to_string()).collect::<String>();

                match (&outer, iter.next()) {
                    (&Token::RawOpen, Some(Token::RawClose)) => 
                        output.push(MetaToken::Raw {
                            raw: format!("{{{{{}}}}}", rest_text),
                            subject: parts.into_iter().filter(|x| match x {
                                &Token::Space => false,
                                _ => true,
                            }).collect(),
                        }),
                    (&Token::EscapedOpen, Some(Token::EscapedClose)) => 
                        output.push(MetaToken::Escaped {
                            raw: format!("{{{}}}", rest_text),
                            subject: parts.into_iter().filter(|x| match x {
                                &Token::Space => false,
                                _ => true,
                            }).collect(),
                        }),

                    (_, Some(inner)) => output.push(MetaToken::Text {
                        source: format!("{}{}{}", outer.to_string(), rest_text, inner.to_string()),
                    }),
                    (_, None) => output.push(MetaToken::Text {
                        source: format!("{}{}", outer.to_string(), rest_text),
                    }),
                }
            },

            _ => output.push(MetaToken::Text {
                source: outer.to_string(),
            }),
        }
    }

    output
}

use std::collections::HashSet;

pub fn starts_with(full: &Vec<Token>, part: &Vec<Token>) -> bool {
    if part.len() > full.len() {
        return false;
    }

    for i in 0..part.len() {
        if full[i] != part[i] {
            return false;
        }
    }

    true
}

pub fn fix_extra_tokens(input: Vec<MetaToken>) -> Vec<MetaToken> {
    let mut remove: HashSet<MetaToken> = HashSet::new();
    let mut expected_subjects: Vec<Vec<Token>> = Vec::new();

    let mut starts_count: u16 = 0;
    let mut ends_count: u16 = 0;

    // try to find a Close with no corresponding Open
    for index in 0..input.len() {
        let elem = &input[index];

        match elem {
            &MetaToken::IfStart { raw: _, neg: _, test: ref subject } | 
            &MetaToken::IterStart { raw: _, ref subject } => {
                expected_subjects.push(subject.clone());
                starts_count += 1;
            },
            &MetaToken::End { raw: _, ref subject } => {
                ends_count += 1;

                if let Some(expected_subject) = expected_subjects.pop() {
                    if subject.len() > 0 && !starts_with(&expected_subject, subject) {
                        remove.insert(elem.clone());
                        expected_subjects.push(expected_subject);
                    } else {
                        // search for an end within close proximity
                        // that has the expected subject
                        for i in (index + 1)..input.len() {
                            let ahead = &input[i];
                            match ahead {
                                &MetaToken::IfStart { raw: _, neg: _, test: _ } |
                                &MetaToken::IterStart { raw: _, subject: _ } => {
                                    break;
                                },
                                &MetaToken::End { raw: _, subject: ref ahead_subject } => {
                                    if ahead_subject.clone() == expected_subject {
                                        // found one ahead, so remove the current one
                                        remove.insert(elem.clone());
                                        expected_subjects.push(expected_subject);

                                        break;
                                    }
                                },
                                _ => (),
                            }
                        }
                    }
                } else {
                    remove.insert(elem.clone());
                }
            },
            _ => (),
        }
    }

    if ends_count > starts_count {
        let mut diff = ends_count - starts_count;

        println!("Found extra token(s):");

        let output = input.into_iter().map(|x| if remove.contains(&x) && diff > 0 {
            println!("{}", x.to_string());

            diff -= 1;
            MetaToken::Text { source: x.to_string() }
        } else { x }).collect::<Vec<MetaToken>>();

        println!("These tokens will be passed through as text, but you should remove them to prevent issues in the future.");

        output
    } else {
        input
    }
}

#[derive(Debug, PartialEq, Clone)]
pub enum Expression {
    HelperExpression { helper_name: String, args: Vec<Expression> },
    PathExpression { path: Vec<String> },
    StringLiteral { value: String },
}

#[derive(Debug, PartialEq, Clone)]
pub enum Control {
    Text { source: String },
    If { neg: bool, test: Expression, body: Vec<Control>, alt: Vec<Control> },
    Iter { suffix: u16, subject_raw: String, subject: Expression, body: Vec<Control>, alt: Vec<Control> },
    Escaped { subject: Expression },
    Raw { subject: Expression },
}

fn generate_expression(iter: &mut Peekable<IntoIter<Token>>, base: Vec<String>, suffix: u16) -> Option<Expression> {
    let one = iter.next();
    let two = match iter.peek() {
        Some(thing) => Some(thing.clone()),
        None => None,
    };

    match (one, two) {
        (Some(Token::Identifier(ref name)), Some(Token::LeftParen)) |
        (Some(Token::LegacyHelper), Some(Token::Identifier(ref name))) => {
            iter.next();
            let mut args: Vec<Expression> = Vec::new();

            loop {
                let (skip, done): (bool, bool) = match iter.peek() {
                    Some(&Token::Comma) => (true, false),
                    Some(&Token::RightParen) => (true, true),
                    Some(_) => (false, false),
                    None => (false, true),
                };

                if skip {
                    iter.next();
                }
                if done {
                    break;
                }

                if let Some(arg) = generate_expression(iter.by_ref(), base.clone(), suffix) {
                    args.push(arg);
                }
            }

            Some(Expression::HelperExpression {
                helper_name: name.to_string(),
                args,
            })
        },
        (Some(Token::StringLiteral(value)), None) |
        (Some(Token::StringLiteral(value)), Some(Token::Comma)) |
        (Some(Token::StringLiteral(value)), Some(Token::RightParen)) => Some(Expression::StringLiteral {
            value
        }),
        (Some(Token::Identifier(value)), None) |
        (Some(Token::Identifier(value)), Some(Token::Comma)) |
        (Some(Token::Identifier(value)), Some(Token::RightParen)) => {
            let path: Vec<String> = paths::split(value);

            Some(Expression::PathExpression { path: paths::resolve(base, path) })
        },
        _ => None,
    }
}

use std::vec::IntoIter;
use paths;

// build the tree
pub fn second_pass(
    input: &mut Peekable<IntoIter<MetaToken>>,
    base: Vec<String>,
    suffix: u16,
) -> (Vec<Control>, MetaToken) {
    let mut output: Vec<Control> = Vec::new();

    let mut last: MetaToken = MetaToken::EOF;

    while let Some(tok) = input.next() {
        match tok {
            MetaToken::Text { source } => output.push(Control::Text { source }),
            MetaToken::Escaped { ref raw, ref subject } |
            MetaToken::Raw { ref raw, ref subject } => if let Some(subject) = generate_expression(
                &mut subject.clone().into_iter().peekable(),
                base.clone(),
                suffix
            ) {
                match tok {
                    MetaToken::Raw { raw: _, subject: _ } => output.push(Control::Raw { subject }),
                    MetaToken::Escaped { raw: _, subject: _ } => output.push(Control::Escaped { subject }),
                    _ => (),
                }
            } else {
                output.push(Control::Text { source: raw.to_string() });
            },
            MetaToken::IfStart { raw, neg, test } => {
                if let Some(test) = generate_expression(
                    &mut test.into_iter().peekable(),
                    base.clone(),
                    suffix
                ) {
                    let (body, last) = second_pass(input.by_ref(), base.clone(), suffix);

                    let alt = match last {
                        MetaToken::Else { raw: _ } => {
                            let (a, _) = second_pass(input.by_ref(), base.clone(), suffix);
                            a
                        },
                        _ => Vec::new(),
                    };

                    output.push(Control::If {
                        neg,
                        test,
                        body,
                        alt,
                    });
                } else {
                    output.push(Control::Text {
                        source: raw
                    });
                }
            },
            MetaToken::IterStart { raw, subject } => {
                if let Some(subject) = generate_expression(
                    &mut subject.into_iter().peekable(),
                    base.clone(),
                    suffix
                ) {
                    let path = match subject {
                        Expression::PathExpression { ref path } => path.clone(),
                        _ => Vec::new(),
                    };

                    let (body, last) = second_pass(input.by_ref(), paths::iter_element(path.clone(), suffix), suffix + 1);

                    let alt = match last {
                        MetaToken::Else { raw: _ } => {
                            let (a, _) = second_pass(input.by_ref(), paths::iter_element(path.clone(), suffix), suffix + 1);
                            a
                        },
                        _ => Vec::new(),
                    };

                    output.push(Control::Iter {
                        suffix,
                        subject_raw: path.join("."),
                        subject,
                        body,
                        alt,
                    });
                } else {
                    output.push(Control::Text {
                        source: raw
                    });
                }
            },
            MetaToken::Else { raw: _ } | MetaToken::End { raw: _, subject: _ } => {
                last = tok;
                break;
            },
            _ => (),
        }
    }

    (output, last)
}

