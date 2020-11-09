use crate::{
    console::warn,
    parse::{
        expression::Expression,
        path::{
            resolve,
            Path,
            PathBuf,
            PathPart,
        },
        tokens::Token,
        GetLine,
        Span,
    },
};
use std::collections::HashSet;

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum Instruction<'a> {
    // Template text passed through
    Text(Span<'a>),
    // `{obj.prop}`
    InterpEscaped(Expression<'a>),
    // `{{obj.prop}}`
    InterpRaw(Expression<'a>),
    If {
        subject: Expression<'a>,
        body: Vec<Instruction<'a>>,
        alt: Vec<Instruction<'a>>,
    },
    Iter {
        depth: u32,
        subject_raw: Span<'a>,
        subject: Expression<'a>,
        body: Vec<Instruction<'a>>,
        alt: Vec<Instruction<'a>>,
    },
}

/// in a case where there are extra End tokens
/// try to match them to Ifs or Iters
/// and remove the extra ones
#[rustfmt::skip::macros(warn)]
pub fn fix_extra_tokens(input: Vec<Token>) -> Vec<Token> {
    let mut remove: HashSet<Token> = HashSet::new();
    let mut expected_subjects: Vec<&str> = Vec::new();

    let mut starts_count: u16 = 0;
    let mut ends_count: u16 = 0;

    // try to find a Close with no corresponding Open
    for index in 0..input.len() {
        let elem = &input[index];

        match elem {
            // for an Open, add the subject to the stack of expected subjects
            Token::LegacyIf { subject_raw, .. }
            | Token::LegacyBegin { subject_raw, .. }
            | Token::If { subject_raw, .. }
            | Token::Each { subject_raw, .. } => {
                expected_subjects.push(subject_raw);
                starts_count += 1;
            }
            Token::LegacyEnd { .. } | Token::End { .. } => {
                ends_count += 1;

                if let Some(expected_subject) = expected_subjects.pop() {
                    let bad_match = if let Token::LegacyEnd { subject_raw, .. } = elem {
                        !expected_subject.starts_with(subject_raw.fragment())
                    } else {
                        false
                    };

                    if bad_match {
                        // doesn't start with what we expect, so remove it
                        remove.insert(elem.clone());
                        expected_subjects.push(expected_subject);
                    } else {
                        // search for an end within close proximity
                        // that has the expected subject
                        for ahead in input.iter().skip(index + 1) {
                            match ahead {
                                Token::LegacyIf { .. }
                                | Token::LegacyBegin { .. }
                                | Token::If { .. }
                                | Token::Each { .. } => {
                                    break;
                                }
                                Token::LegacyEnd { subject_raw, .. } => {
                                    if subject_raw.fragment() == &expected_subject {
                                        // found one ahead, so remove the current one
                                        remove.insert(elem.clone());
                                        expected_subjects.push(expected_subject);

                                        break;
                                    }
                                }
                                _ => (),
                            }
                        }
                    }
                } else {
                    // no subject expected, so remove it
                    remove.insert(elem.clone());
                }
            }
            _ => (),
        }
    }

    // remove the number of instructions that are extra
    if ends_count > starts_count {
        let mut diff = ends_count - starts_count;

        warn!("[benchpress] warning: found extra tokens");

        let output: Vec<Token> = input
            .into_iter()
            .map(|tok| {
                if remove.contains(&tok) && diff > 0 {
                    let span = tok.span();
                    warn!("     --> {}:{}:{} ",
                        span.extra.filename, span.location_line(), span.get_utf8_column());
                    warn!("      |");
                    warn!("{:>5} | {}", span.location_line(), span.get_line());
                    warn!("      | {}{} help: remove the token or make it an unambiguous comment",
                        " ".repeat(span.get_utf8_column() - 1), "^".repeat(span.len()));

                    diff -= 1;
                    // replace removed instructions with their source Text
                    Token::Text(tok.span())
                } else {
                    tok
                }
            })
            .collect();

        warn!("      = note: These tokens will be passed through as text, but this will become an error in the future.\n");

        output
    } else {
        input
    }
}

fn resolve_expression_paths<'a, 'b>(base: Path<'a, 'b>, expr: Expression<'a>) -> Expression<'a> {
    match expr {
        s @ Expression::StringLiteral(_) => s,
        Expression::Path(path) => Expression::Path(resolve(base, path)),
        Expression::Negative { span, expr } => Expression::Negative {
            span,
            expr: Box::new(resolve_expression_paths(base, *expr)),
        },
        Expression::Helper { span, name, args } => Expression::Helper {
            span,
            name,
            args: args
                .into_iter()
                .map(|x| resolve_expression_paths(base, x))
                .collect(),
        },
        Expression::LegacyHelper { span, name, args } => Expression::LegacyHelper {
            span,
            name,
            args: args
                .into_iter()
                .map(|x| resolve_expression_paths(base, x))
                .collect(),
        },
    }
}

#[derive(Debug)]
pub struct TreeError;

#[rustfmt::skip::macros(warn)]
pub fn tree<'a, 'b, I>(
    depth: u32,
    base: Path<'a, 'b>,
    input: &mut I,
    output: &mut Vec<Instruction<'a>>,
) -> Result<Option<Token<'a>>, TreeError>
where
    I: Iterator<Item = Token<'a>> + Clone,
{
    let mixed_warning = |open_token: &str, open_span: Span, close: Token| {
        let (open_syntax, close_syntax, close_token, close_span) = match close {
            Token::LegacyElse { span, .. } => ("modern", "legacy", "else", span),
            Token::LegacyEnd { span, .. } => ("modern", "legacy", "end", span),
            Token::Else { span, .. } => ("legacy", "modern", "else", span),
            Token::End { span, .. } => ("legacy", "modern", "end", span),
            _ => unreachable!(),
        };

        warn!("[benchpress] warning: mixing token types is deprecated");
        warn!("     --> {}:{}:{}",
            open_span.extra.filename, open_span.location_line(), open_span.get_utf8_column());
        warn!("      |");
        warn!("{:>5} | {}", open_span.location_line(), open_span.get_line());
        warn!("      | {}{} `{}` started with {} syntax",
            " ".repeat(open_span.get_utf8_column() - 1), "^".repeat(open_span.len()),
            open_token, open_syntax);
        warn!("     ::: {}:{}:{} ",
            open_span.extra.filename, close_span.location_line(), close_span.get_utf8_column());
        warn!("      |");
        warn!("{:>5} | {}", close_span.location_line(), close_span.get_line());
        warn!("      | {}{} but {} syntax used for `{}`",
            " ".repeat(close_span.get_utf8_column() - 1), "^".repeat(close_span.len()), close_syntax, close_token);
        warn!("      | note: Migrate all to modern syntax. This will become an error in the future.\n");
    };

    while let Some(tok) = input.next() {
        output.push(match tok {
            // convert a text token to a text instruction
            Token::Text(value) => Instruction::Text(value),
            // convert token to expression
            // generate expression
            Token::InterpEscaped { expr, .. } => {
                Instruction::InterpEscaped(resolve_expression_paths(base, expr))
            }
            Token::InterpRaw { expr, .. } => {
                Instruction::InterpRaw(resolve_expression_paths(base, expr))
            }
            // create an if-then-else instruction
            Token::If { span, subject, .. } => {
                let mut body = vec![];
                let mut alt = vec![];

                match tree(depth, base, input, &mut body)? {
                    Some(els @ Token::Else { .. }) | Some(els @ Token::LegacyElse { .. }) => {
                        if let Token::LegacyElse { .. } = els {
                            mixed_warning("if", span, els)
                        }

                        // consume the end after the else
                        match tree(depth, base, input, &mut alt)? {
                            Some(Token::End { .. }) => {}
                            Some(end @ Token::LegacyEnd { .. }) => mixed_warning("if", span, end),
                            _ => return Err(TreeError),
                        }
                    }
                    Some(Token::End { .. }) => {}
                    Some(end @ Token::LegacyEnd { .. }) => mixed_warning("if", span, end),
                    _ => return Err(TreeError),
                }

                Instruction::If {
                    subject: resolve_expression_paths(base, subject),
                    body,
                    alt,
                }
            }
            // create an iteration intruction
            Token::Each {
                span,
                subject,
                subject_raw,
            } => {
                let mut body = vec![];
                let mut alt = vec![];

                let subject = resolve_expression_paths(base, subject);
                let base: PathBuf = if let Expression::Path(base) = &subject {
                    let mut base = base.clone();
                    if let Some(last) = base.last_mut() {
                        last.with_depth(depth)
                    }
                    base
                } else {
                    base.to_vec()
                };

                match tree(depth + 1, &base, input, &mut body)? {
                    Some(els @ Token::Else { .. }) | Some(els @ Token::LegacyElse { .. }) => {
                        if let Token::LegacyElse { .. } = els {
                            mixed_warning("each", span, els)
                        }

                        // consume the end after the else
                        match tree(depth, &base, input, &mut alt)? {
                            Some(Token::End { .. }) => {}
                            Some(end @ Token::LegacyEnd { .. }) => mixed_warning("each", span, end),
                            _ => return Err(TreeError),
                        }
                    }
                    Some(Token::End { .. }) => {}
                    Some(end @ Token::LegacyEnd { .. }) => mixed_warning("each", span, end),
                    _ => return Err(TreeError),
                }

                Instruction::Iter {
                    depth,
                    subject_raw,
                    subject,
                    body,
                    alt,
                }
            }
            // create an if-then-else instruction
            Token::LegacyIf { span, subject, .. } => {
                let mut body = vec![];
                let mut alt = vec![];
                match tree(depth, base, input, &mut body)? {
                    Some(els @ Token::LegacyElse { .. }) | Some(els @ Token::Else { .. }) => {
                        if let Token::Else { .. } = els {
                            mixed_warning("IF", span, els)
                        }

                        // consume the end after the else
                        match tree(depth, base, input, &mut alt)? {
                            Some(Token::LegacyEnd { .. }) => {}
                            Some(end @ Token::End { .. }) => mixed_warning("IF", span, end),
                            _ => return Err(TreeError),
                        }
                    }
                    Some(Token::LegacyEnd { .. }) => {}
                    Some(end @ Token::End { .. }) => mixed_warning("IF", span, end),
                    _ => return Err(TreeError),
                }

                Instruction::If {
                    subject: resolve_expression_paths(base, subject),
                    body,
                    alt,
                }
            }
            // create an iteration intruction
            Token::LegacyBegin {
                span,
                subject,
                subject_raw,
            } => {
                let normal = |input: &mut I, subject| {
                    let mut body = vec![];
                    let mut alt = vec![];

                    let subject = resolve_expression_paths(base, subject);
                    let base: PathBuf = if let Expression::Path(base) = &subject {
                        let mut base = base.clone();
                        if let Some(last) = base.last_mut() {
                            last.with_depth(depth)
                        }
                        base
                    } else {
                        base.to_vec()
                    };

                    match tree(depth + 1, &base, input, &mut body)? {
                        Some(els @ Token::LegacyElse { .. }) | Some(els @ Token::Else { .. }) => {
                            if let Token::Else { .. } = els {
                                mixed_warning("BEGIN", span, els)
                            }

                            // consume the end after the else
                            match tree(depth, &base, input, &mut alt)? {
                                Some(Token::LegacyEnd { .. }) => {}
                                Some(end @ Token::End { .. }) => mixed_warning("BEGIN", span, end),
                                _ => return Err(TreeError),
                            }
                        }
                        Some(Token::LegacyEnd { .. }) => {}
                        Some(end @ Token::End { .. }) => mixed_warning("BEGIN", span, end),
                        _ => return Err(TreeError),
                    }

                    Ok(Instruction::Iter {
                        depth,
                        subject_raw,
                        subject,
                        body,
                        alt,
                    })
                };

                // Handle legacy `<!-- BEGIN stuff -->` working for top-level `stuff` and implicitly `./stuff`
                match &subject {
                    Expression::Path(path)
                        if depth > 0 && path.first().map_or(false, |s| {
                            // Not a relative path or keyword
                            !s.inner().starts_with(&['.', '@'] as &[char])
                        }) =>
                    {
                        warn!("[benchpress] warning: output bloat due to ambiguous inner BEGIN");
                        warn!("     --> {}:{}:{}",
                            span.extra.filename, span.location_line(), span.get_utf8_column());
                        warn!("      |");
                        warn!("{:>5} | {}",
                            span.location_line(), span.get_line());
                        warn!("      | {}{} `{subject}` could refer to the top-level value `{subject}` or the `.{subject}` property of the current element, so compiler must emit code for both cases",
                            " ".repeat(span.get_utf8_column() - 1), "^".repeat(span.len()), subject = subject_raw);
                        warn!("      | note: Migrate to modern syntax to avoid the ambiguity. This will become an error in the future.\n");

                        // Path is absolute, so create a branch for both `./subject` and `subject`
                        let mut relative_path =
                            vec![PathPart::Part(Span::new_extra("./", span.extra))];
                        relative_path.extend_from_slice(path);
                        let relative_subject = Expression::Path(relative_path);

                        Instruction::If {
                            subject: resolve_expression_paths(base, relative_subject.clone()),
                            body: vec![normal(&mut input.clone(), relative_subject)?],
                            alt: vec![normal(input, subject)?],
                        }
                    }
                    _ => normal(input, subject)?,
                }
            }
            tok => return Ok(Some(tok)),
        });
    }

    Ok(None)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::parse::{
        path::PathPart,
        test::sp,
        FileInfo,
    };
    use pretty_assertions::assert_eq;

    #[test]
    fn test_fix_extra_tokens() {
        let program = "{{{ each abc }}} for each thing <!-- END foo -->{{{ end }}}";
        let source = Span::new_extra(
            program,
            FileInfo {
                filename: "",
                full_source: program,
            },
        );
        let (_, tokens) = crate::parse::tokens::tokens(source).unwrap();

        assert_eq!(
            fix_extra_tokens(tokens),
            vec![
                Token::Each {
                    span: sp("{{{ each abc }}}"),
                    subject_raw: sp("abc"),
                    subject: Expression::Path(vec![PathPart::Part(sp("abc"))])
                },
                Token::Text(sp(" for each thing ")),
                Token::Text(sp("<!-- END foo -->")),
                Token::End {
                    span: sp("{{{ end }}}")
                },
            ]
        );
    }

    #[test]
    fn test_tree() {
        let mut input = vec![
            Token::Each {
                span: sp("{{{ each abc }}}"),
                subject_raw: sp("abc"),
                subject: Expression::Path(vec![PathPart::Part(sp("abc"))]),
            },
            Token::Text(sp(" for each thing ")),
            Token::End {
                span: sp("{{{ end }}}"),
            },
        ]
        .into_iter();

        let mut output = vec![];

        assert!(tree(0, &[], &mut input, &mut output).is_ok());

        assert_eq!(
            output,
            vec![Instruction::Iter {
                depth: 0,
                subject_raw: sp("abc"),
                subject: Expression::Path(vec![PathPart::Part(sp("abc"))]),
                body: vec![Instruction::Text(sp(" for each thing ")),],
                alt: vec![],
            }]
        );
    }

    #[test]
    fn test_tree_deep() {
        let mut input = vec![
            Token::Each {
                span: sp("{{{ each abc }}}"),
                subject_raw: sp("abc"),
                subject: Expression::Path(vec![PathPart::Part(sp("abc"))]),
            },
            Token::Text(sp(" before inner ")),
            Token::Each {
                span: sp("{{{ each ./inner }}}"),
                subject_raw: sp("./inner"),
                subject: Expression::Path(vec![
                    PathPart::Part(sp("./")),
                    PathPart::Part(sp("inner")),
                ]),
            },
            Token::InterpEscaped {
                span: sp("{abc.inner.prop}"),
                expr: Expression::Path(vec![
                    PathPart::Part(sp("abc")),
                    PathPart::Part(sp("inner")),
                    PathPart::Part(sp("prop")),
                ]),
            },
            Token::End {
                span: sp("{{{ end }}}"),
            },
            Token::Text(sp(" after inner ")),
            Token::End {
                span: sp("{{{ end }}}"),
            },
        ]
        .into_iter();

        let mut output = vec![];

        assert!(tree(0, &[], &mut input, &mut output).is_ok());

        assert_eq!(
            output,
            vec![Instruction::Iter {
                depth: 0,
                subject_raw: sp("abc"),
                subject: Expression::Path(vec![PathPart::Part(sp("abc"))]),
                body: vec![
                    Instruction::Text(sp(" before inner ")),
                    Instruction::Iter {
                        depth: 1,
                        subject_raw: sp("./inner"),
                        subject: Expression::Path(vec![
                            PathPart::PartDepth(sp("abc"), 0),
                            PathPart::Part(sp("inner"))
                        ]),
                        body: vec![Instruction::InterpEscaped(Expression::Path(vec![
                            PathPart::PartDepth(sp("abc"), 0),
                            PathPart::PartDepth(sp("inner"), 1),
                            PathPart::Part(sp("prop"))
                        ]))],
                        alt: vec![]
                    },
                    Instruction::Text(sp(" after inner ")),
                ],
                alt: vec![],
            }]
        );
    }

    #[test]
    fn test_nested_legacy_iter() {
        let mut input = vec![
            Token::Each {
                span: sp("{{{ each abc }}}"),
                subject_raw: sp("abc"),
                subject: Expression::Path(vec![PathPart::Part(sp("abc"))]),
            },
            Token::Text(sp(" before inner ")),
            Token::LegacyBegin {
                span: sp("<!-- BEGIN inner -->"),
                subject_raw: sp("inner"),
                subject: Expression::Path(vec![PathPart::Part(sp("inner"))]),
            },
            Token::InterpEscaped {
                span: sp("{abc.inner.prop}"),
                expr: Expression::Path(vec![
                    PathPart::Part(sp("abc")),
                    PathPart::Part(sp("inner")),
                    PathPart::Part(sp("prop")),
                ]),
            },
            Token::LegacyEnd {
                span: sp("<!-- END inner -->"),
                subject_raw: sp("inner"),
            },
            Token::Text(sp(" after inner ")),
            Token::End {
                span: sp("{{{ end }}}"),
            },
        ]
        .into_iter();

        let mut output = vec![];

        assert!(tree(0, &[], &mut input, &mut output).is_ok());

        assert_eq!(
            output,
            vec![Instruction::Iter {
                depth: 0,
                subject_raw: sp("abc"),
                subject: Expression::Path(vec![PathPart::Part(sp("abc"))]),
                body: vec![
                    Instruction::Text(sp(" before inner ")),
                    Instruction::If {
                        subject: Expression::Path(vec![
                            PathPart::PartDepth(sp("abc"), 0),
                            PathPart::Part(sp("inner"))
                        ]),
                        body: vec![Instruction::Iter {
                            depth: 1,
                            subject_raw: sp("inner"),
                            subject: Expression::Path(vec![
                                PathPart::PartDepth(sp("abc"), 0),
                                PathPart::Part(sp("inner"))
                            ]),
                            body: vec![Instruction::InterpEscaped(Expression::Path(vec![
                                PathPart::PartDepth(sp("abc"), 0),
                                PathPart::PartDepth(sp("inner"), 1),
                                PathPart::Part(sp("prop"))
                            ]))],
                            alt: vec![]
                        }],
                        alt: vec![Instruction::Iter {
                            depth: 1,
                            subject_raw: sp("inner"),
                            subject: Expression::Path(vec![PathPart::Part(sp("inner"))]),
                            body: vec![Instruction::InterpEscaped(Expression::Path(vec![
                                PathPart::Part(sp("abc")),
                                PathPart::Part(sp("inner")),
                                PathPart::Part(sp("prop"))
                            ]))],
                            alt: vec![],
                        }]
                    },
                    Instruction::Text(sp(" after inner ")),
                ],
                alt: vec![],
            }]
        );
    }
}
