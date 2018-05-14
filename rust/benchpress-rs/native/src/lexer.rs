use token::Token;

// just extract block openers, block closers, and interpolation from the main text
pub fn first_pass(input: String) -> Vec<Token> {
    let mut output: Vec<Token> = Vec::new();

    let source = format!("{}  ", input);
    let mut current = String::new();
    let mut next = String::new();

    for ch in source.chars() {
        match (next.as_ref(), ch) {
            // escaped opens
            ("\\", '<') | ("\\<", '!') | ("\\<!", '-') | ("\\<!-", '-') |
            ("\\", '{') | ("\\{", '{') | ("\\{{", '{')  => next.push(ch),

            ("\\<!--", _) | ("\\{{{", _) |
            ("\\{", _) | ("\\{{", _) => {
                let escaped: String = next[1..].to_string();
                output.push(Token::Text(format!("{}{}", current, escaped)));

                next = ch.to_string();
                current = String::new();
            },

            // <!--, -->, {, {{, {{{, }, }}, }}}
            ("", '<') | ("", '-') | ("", '{') | ("", '}') |
            ("<", '!') | ("<!", '-') | ("<!-", '-') |
            ("-", '-') | ("--", '>') |
            ("{", '{') | ("{{", '{') |
            ("}", '}') | ("}}", '}') => next.push(ch),

            ("{{{", _) | ("<!--", _) => {
                output.push(Token::Text(current));
                output.push(Token::BlockOpen(next));

                next = ch.to_string();
                current = String::new();
            },
            ("}}}", _) | ("-->", _) => {
                output.push(Token::Unknown(current));
                output.push(Token::BlockClose(next));

                next = ch.to_string();
                current = String::new();
            },

            ("{{", _) => {
                output.push(Token::Text(current));
                output.push(Token::RawOpen);

                next = ch.to_string();
                current = String::new();
            },
            ("}}", _) => {
                output.push(Token::Unknown(current));
                output.push(Token::RawClose);
                
                next = ch.to_string();
                current = String::new();
            },
            ("{", _) => {
                output.push(Token::Text(current));
                output.push(Token::EscapedOpen);

                next = ch.to_string();
                current = String::new();
            },
            ("}", _) => {
                output.push(Token::Unknown(current));
                output.push(Token::EscapedClose);
                
                next = ch.to_string();
                current = String::new();
            },

            _ => {
                current.push_str(next.as_ref());
                next = ch.to_string();
            },
        }
    }
    current.push_str(next.as_ref());
    output.push(Token::Text(current));

    output
}

fn is_simple_char(ch: char) -> bool {
    ch.is_alphabetic() || ch.is_numeric() || match ch {
        '@' | '/' | '_' | ':' | '\\' | '-' | '.' => true,
        _ => false,
    }
}

fn lex_expression(input: String) -> Option<Vec<Token>> {
    let mut iter = input.chars().peekable();

    let mut output: Vec<Token> = Vec::new();
    let mut valid = true;

    while let Some(ch) = iter.next() {
        match ch {
            '"' => {
                let mut literal = String::new();

                while let Some(&c) = iter.peek() {
                    match c {
                        '\\' => {
                            // push the backslash and the escaped char
                            literal.push(iter.next().unwrap());
                            literal.push(iter.next().unwrap());
                        },
                        '"' => {
                            iter.next();
                            break;
                        },
                        _ => literal.push(iter.next().unwrap()),
                    }
                }

                output.push(Token::StringLiteral(literal));
            },
            ' ' => output.push(Token::Space),
            '!' => output.push(Token::Bang),
            '(' => output.push(Token::LeftParen),
            ')' => output.push(Token::RightParen),
            ',' => output.push(Token::Comma),
            _ => {
                if is_simple_char(ch) {
                    let mut name = ch.to_string();

                    while let Some(&c) = iter.peek() {
                        if is_simple_char(c) {
                            name.push(iter.next().unwrap());
                        } else {
                            break;
                        }
                    }

                    if name.starts_with("function.") {
                        name = name[9..].to_string();
                        output.push(Token::LegacyHelper);
                    }

                    output.push(Token::Identifier(name));
                } else {
                    valid = false;
                    break;
                }
            },
        }
    }

    if input.len() > 0 && valid {
        Some(output)
    } else {
        None
    }
}

fn lex_block(input: String) -> Option<Vec<Token>> {
    let mut output: Vec<Token> = Vec::new();

    let mut iter = input.trim().splitn(2, ' ');

    match iter.next() {
        Some(keyword) => match keyword {
            "if" | "IF" |
            "each" | "BEGIN" |
            "end" | "END" | "ENDIF" => {
                match keyword {
                    "if" | "IF" => output.push(Token::If(String::from(keyword))),
                    "each" | "BEGIN" => output.push(Token::Iter(String::from(keyword))),
                    "end" | "END" | "ENDIF" => output.push(Token::End(String::from(keyword))),
                    _ => (),
                }

                let mut valid = true;
                
                if let Some(subject) = iter.next() {
                    let exp = lex_expression(String::from(subject));

                    match exp {
                        Some(mut tokens) => {
                            output.append(&mut tokens);
                        },
                        None => {
                            valid = false;
                        },
                    }
                }

                if valid {
                    Some(output)
                } else {
                    None
                }
            },
            "else" | "ELSE" => {
                output.push(Token::Else(String::from(keyword)));

                match iter.next() {
                    Some(_) => None,
                    None => Some(output),
                }
            },

            _ => None,
        },
        None => None,
    }

}

// lex the Unknown parts
pub fn second_pass(input: Vec<Token>) -> Vec<Token> {
    let mut output: Vec<Token> = Vec::new();

    let mut iter = input.into_iter();

    while let Some(tok) = iter.next() {
        match tok {
            Token::BlockOpen(open_og) => {
                let mut valid = true;
                let mut pulled = String::from(open_og.as_ref());

                match iter.next() {
                    Some(Token::Unknown(block)) => {
                        pulled.push_str(block.as_ref());

                        match iter.next() {
                            Some(Token::BlockClose(close_og)) => {
                                pulled.push_str(close_og.as_ref());
                                // we have an Unknown sandwiched between an open and close
                                if let Some(mut tokens) = lex_block(block) {
                                    output.push(Token::BlockOpen(open_og));
                                    output.append(&mut tokens);
                                    output.push(Token::BlockClose(close_og));
                                } else { valid = false; }
                            },
                            Some(tok) => {
                                pulled.push_str(tok.to_string().as_ref());
                                valid = false;
                            },
                            None => {
                                valid = false;
                            }
                        }
                    },
                    Some(tok) => {
                        pulled.push_str(tok.to_string().as_ref());
                        valid = false;
                    },
                    None => {
                        valid = false;
                    }
                }

                if !valid {
                    output.push(Token::Text(pulled));
                }
            },
            Token::EscapedOpen => {
                let mut valid = true;
                let mut pulled = String::from("{");

                match iter.next() {
                    Some(Token::Unknown(expression)) => {
                        pulled.push_str(expression.as_ref());

                        match iter.next() {
                            Some(Token::EscapedClose) => {
                                pulled.push_str("}");

                                // we have an Unknown sandwiched between an open and close
                                if let Some(mut tokens) = lex_expression(expression) {
                                    output.push(tok);
                                    output.append(&mut tokens);
                                    output.push(Token::EscapedClose);
                                } else { valid = false; }
                            },
                            Some(tok) => {
                                pulled.push_str(tok.to_string().as_ref());
                                valid = false;
                            },
                            None => {
                                valid = false;
                            }
                        }
                    },
                    Some(tok) => {
                        pulled.push_str(tok.to_string().as_ref());
                        valid = false;
                    },
                    None => {
                        valid = false;
                    }
                }

                if !valid {
                    output.push(Token::Text(pulled));
                }
            },
            Token::RawOpen => {
                let mut valid = true;
                let mut pulled = String::from("{{");

                match iter.next() {
                    Some(Token::Unknown(expression)) => {
                        pulled.push_str(expression.as_ref());

                        match iter.next() {
                            Some(Token::RawClose) => {
                                pulled.push_str("}");

                                // we have an Unknown sandwiched between an open and close
                                if let Some(mut tokens) = lex_expression(expression) {
                                    output.push(tok);
                                    output.append(&mut tokens);
                                    output.push(Token::RawClose);
                                } else { valid = false; }
                            },
                            Some(tok) => {
                                pulled.push_str(tok.to_string().as_ref());
                                valid = false;
                            },
                            None => {
                                valid = false;
                            }
                        }
                    },
                    Some(tok) => {
                        pulled.push_str(tok.to_string().as_ref());
                        valid = false;
                    },
                    None => {
                        valid = false;
                    }
                }

                if !valid {
                    output.push(Token::Text(pulled));
                }
            },

            _ => output.push(tok),
        }
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn string_lit() {
        assert_eq!(
            lex_expression("\"\\\\ \\ \"".to_string()),
            Some(vec![Token::StringLiteral(r"\\ \ ".to_string())])
        );
    }
}
