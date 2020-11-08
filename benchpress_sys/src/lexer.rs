use crate::token::{Token, TokenPos};

/// iterate a slice over a string
/// the slice can be varying sizes and vary in position
#[derive(Debug, Clone)]
struct StringSlicer<'a> {
    source: &'a str,
    len: usize,
    start: usize,
    end: usize,
}

impl<'a> StringSlicer<'a> {
    fn new(input: &'a str) -> StringSlicer<'a> {
        let mut out = StringSlicer {
            source: input,
            len: input.len(),
            start: 0,
            end: 0,
        };
        out.reset();

        out
    }

    /// get current slice
    fn slice(&self) -> String {
        self.source[self.start..self.end].to_string()
    }

    /// reset slice to length of 1
    fn reset(&mut self) {
        self.end = self.start + 1;
        if self.end > self.len {
            self.end = self.len;
        } else {
            while !self.source.is_char_boundary(self.end) && self.end < self.len {
                self.end += 1;
            }
        }
    }

    /// move the beginning right one, reset length to 1
    fn step(&mut self) {
        self.start = self.end;
        self.reset();
    }

    /// step by `inc` units
    fn step_by(&mut self, inc: usize) {
        self.grow_by(inc - 1);
        self.step();
    }

    /// increment right end of slice, keeping the beginning in place
    fn grow(&mut self) {
        while {
            self.end += 1;
            !self.source.is_char_boundary(self.end) && self.end < self.len
        } {}
    }

    /// grow by `inc` units
    fn grow_by(&mut self, inc: usize) {
        if self.end + inc > self.len {
            self.end = self.len;
        } else {
            for _ in 0..inc {
                self.grow();
            }
        }
    }

    /// see character directly following slice
    fn suffix(&self) -> Option<char> {
        match self
            .source
            .get(self.end..=self.end)
            .map(|x| x.chars().next())
        {
            Some(Some(ch)) => Some(ch),
            _ => None,
        }
    }

    /// check if slice is followed by the given string
    fn followed_by(&self, target: &str) -> bool {
        if let Some(substr) = self.source.get(self.end..(self.end + target.len())) {
            substr == target
        } else {
            false
        }
    }

    /// step until current slice is not a single space
    fn skip_spaces(&mut self) {
        while self.slice() == " " {
            self.step();
        }
    }
}

fn is_simple_char(ch: char) -> bool {
    ch.is_alphabetic() || ch.is_numeric() || matches!(ch, '@' | '/' | '_' | ':' | '\\' | '-' | '.')
}

/// lex an expression from the current slice position
/// return an option of the token vector representing the expression
fn lex_expression(slicer: &mut StringSlicer) -> Option<Vec<TokenPos>> {
    let mut output: Vec<TokenPos> = Vec::new();

    slicer.skip_spaces();

    let slice = slicer.slice();
    match slice.as_str() {
        // string literals
        "\"" => {
            let start = slicer.start;
            slicer.step();

            loop {
                let mut string_lit = slicer.slice();

                match string_lit.chars().last() {
                    // grow to include backslash and escaped char
                    Some('\\') => slicer.grow_by(2),
                    // finish the string
                    Some('"') => {
                        // skip last character
                        string_lit.pop();

                        slicer.step();
                        return Some(vec![TokenPos {
                            start,
                            end: slicer.start,
                            tok: Token::StringLiteral(string_lit),
                        }]);
                    }
                    Some(_) => slicer.grow(),
                    None => return None,
                }
            }
        }
        // if not ...
        "!" => {
            output.push(TokenPos {
                start: slicer.start,
                end: slicer.end,
                tok: Token::Bang,
            });
            slicer.step();

            if let Some(mut sub_expr) = lex_expression(slicer) {
                output.append(&mut sub_expr);
            } else {
                return None;
            }
        }
        // identifier or helper
        _ => {
            if slice.chars().all(|ch| ch != '-' && is_simple_char(ch)) {
                // collect simple chars for identifier
                while !slicer.slice().is_empty() {
                    if let Some(suffix) = slicer.suffix() {
                        if is_simple_char(suffix) {
                            slicer.grow();
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }

                let sub_slice = slicer.slice();
                // legacy helper call
                if let Some(helper_name) = sub_slice.strip_prefix("function.") {
                    output.push(TokenPos {
                        start: slicer.start,
                        end: slicer.start + 9,
                        tok: Token::LegacyHelper,
                    });
                    output.push(TokenPos {
                        start: slicer.start + 9,
                        end: slicer.end,
                        tok: Token::Identifier(helper_name.to_string()),
                    });

                    slicer.step();
                    slicer.skip_spaces();

                    // get arguments
                    while slicer.slice() == "," {
                        output.push(TokenPos {
                            start: slicer.start,
                            end: slicer.end,
                            tok: Token::Comma,
                        });
                        slicer.step();

                        if let Some(mut arg) = lex_expression(slicer) {
                            output.append(&mut arg);
                        }
                        // allow a trailing comma

                        slicer.skip_spaces();
                    }
                } else {
                    let name = sub_slice;
                    output.push(TokenPos {
                        start: slicer.start,
                        end: slicer.end,
                        tok: Token::Identifier(name),
                    });

                    slicer.step();
                    slicer.skip_spaces();

                    // helper call
                    if slicer.slice() == "(" {
                        output.push(TokenPos {
                            start: slicer.start,
                            end: slicer.end,
                            tok: Token::LeftParen,
                        });

                        // get arguments
                        while {
                            slicer.step();

                            if let Some(mut arg) = lex_expression(slicer) {
                                output.append(&mut arg);
                            }
                            // allow a trailing comma

                            slicer.skip_spaces();

                            if slicer.slice() == "," {
                                output.push(TokenPos {
                                    start: slicer.start,
                                    end: slicer.end,
                                    tok: Token::Comma,
                                });
                                true
                            } else {
                                false
                            }
                        } {}

                        if slicer.slice() == ")" {
                            output.push(TokenPos {
                                start: slicer.start,
                                end: slicer.end,
                                tok: Token::RightParen,
                            });
                            slicer.step();
                        } else {
                            return None;
                        }
                    }
                }
            } else {
                return None;
            }
        }
    }

    slicer.skip_spaces();

    Some(output)
}

/// lex a block (`if expr`, `each expr`, `else`, `end`)
fn lex_block(slicer: &mut StringSlicer, legacy: bool) -> Option<Vec<TokenPos>> {
    let mut output: Vec<TokenPos> = Vec::new();

    slicer.skip_spaces();
    slicer.grow_by(2);

    let slice = slicer.slice();
    match slice.as_str() {
        // if tokens
        "if " | "IF " => {
            if legacy && slice != "IF " {
                return None;
            }

            output.push(TokenPos {
                start: slicer.start,
                end: slicer.end - 1,
                tok: Token::If,
            });
            slicer.step();
            slicer.skip_spaces();

            if let Some(mut expr) = lex_expression(slicer) {
                output.append(&mut expr);
            } else {
                return None;
            }
        }
        // iterator tokens
        "eac" | "BEG" => {
            if if !legacy && slice == "eac" && slicer.followed_by("h ") {
                slicer.grow();
                true
            } else if legacy && slice == "BEG" && slicer.followed_by("IN ") {
                slicer.grow_by(2);
                true
            } else {
                false
            } {
                output.push(TokenPos {
                    start: slicer.start,
                    end: slicer.end,
                    tok: Token::Iter,
                });
                slicer.step();
                slicer.skip_spaces();

                if let Some(mut expr) = lex_expression(slicer) {
                    output.append(&mut expr);
                } else {
                    return None;
                }
            } else {
                return None;
            }
        }
        // end tokens
        "end" | "END" => {
            if legacy && slice != "END" || !legacy && slice != "end" {
                return None;
            }

            if slice == "END" && slicer.followed_by("IF") {
                slicer.grow_by(2);
            }

            output.push(TokenPos {
                start: slicer.start,
                end: slicer.end,
                tok: Token::End,
            });
            slicer.step();
            slicer.skip_spaces();

            if let Some(mut expr) = lex_expression(slicer) {
                output.append(&mut expr);
            }
            // end subject is optional
        }
        // else tokens
        "els" | "ELS" => {
            if match slice.as_str() {
                "els" => !legacy && slicer.followed_by("e"),
                // "ELS"
                _ => legacy && slicer.followed_by("E"),
            } {
                slicer.grow();
                output.push(TokenPos {
                    start: slicer.start,
                    end: slicer.end,
                    tok: Token::Else,
                });
                slicer.step();
            } else {
                return None;
            }
        }
        _ => {
            return None;
        }
    }

    slicer.skip_spaces();

    Some(output)
}

/// lex the input string into Tokens
pub fn lex(input: &str) -> Vec<TokenPos> {
    let mut output: Vec<TokenPos> = vec![];
    let mut slicer = StringSlicer::new(input);
    let length = slicer.len;

    loop {
        let slice = slicer.slice();

        match slice.as_str() {
            // escaped opens
            "\\" => {
                if let Some(target) = ["<!--", "{{{", "{{", "{"]
                    .iter()
                    .find(|x| slicer.followed_by(x))
                {
                    let len = target.len();

                    slicer.step();
                    output.push(TokenPos {
                        start: slicer.start,
                        end: slicer.start + len,
                        tok: Token::Text((*target).to_string()),
                    });
                    slicer.step_by(len);
                } else {
                    slicer.grow();
                }
            }
            // escaped or raw mustache
            "{" | "{{" => {
                if slicer.followed_by("{") {
                    slicer.grow();
                } else {
                    let start = slicer.start;
                    let orig_end = slicer.end;

                    let mut copy = slicer.clone();
                    copy.step();

                    let valid = if let Some(mut tokens) = lex_expression(&mut copy) {
                        let closer = match slice.as_str() {
                            "{" => "}",
                            // "{{"
                            _ => {
                                copy.grow();
                                "}}"
                            }
                        }
                        .to_string();

                        if copy.slice() == closer {
                            let (open_token, close_token) = match slice.as_str() {
                                "{" => (
                                    TokenPos {
                                        start,
                                        end: orig_end,
                                        tok: Token::EscapedOpen,
                                    },
                                    TokenPos {
                                        start: copy.start,
                                        end: copy.end,
                                        tok: Token::EscapedClose,
                                    },
                                ),
                                // "{{"
                                _ => (
                                    TokenPos {
                                        start,
                                        end: orig_end,
                                        tok: Token::RawOpen,
                                    },
                                    TokenPos {
                                        start: copy.start,
                                        end: copy.end,
                                        tok: Token::RawClose,
                                    },
                                ),
                            };

                            output.push(open_token);
                            output.append(&mut tokens);
                            output.push(close_token);

                            slicer.step_by(copy.end - orig_end + 1);

                            true
                        } else {
                            false
                        }
                    } else {
                        false
                    };

                    if !valid {
                        output.push(TokenPos {
                            start: slicer.start,
                            end: slicer.end,
                            tok: Token::Text(slice),
                        });
                        slicer.step();
                    }
                }
            }
            // modern or legacy block
            "<!--" | "{{{" => {
                let start = slicer.start;
                let orig_end = slicer.end;

                let mut copy = slicer.clone();
                copy.step();

                let legacy = slice == "<!--";

                let valid = if let Some(mut tokens) = lex_block(&mut copy, legacy) {
                    let closer_len = 3;

                    let closer = if legacy { "-->" } else { "}}}" };

                    copy.grow_by(2);

                    if copy.slice() == closer {
                        output.push(TokenPos {
                            start,
                            end: orig_end,
                            tok: Token::BlockOpen,
                        });
                        output.append(&mut tokens);
                        output.push(TokenPos {
                            start: copy.start,
                            end: copy.end,
                            tok: Token::BlockClose,
                        });

                        slicer.step_by(copy.end + closer_len - orig_end - 2);

                        true
                    } else {
                        false
                    }
                } else {
                    false
                };

                if !valid {
                    output.push(TokenPos {
                        start: slicer.start,
                        end: slicer.end,
                        tok: Token::Text(slice),
                    });
                    slicer.step();
                }
            }
            // text
            _ => {
                // start of an instruction
                if slicer.followed_by("\\") || slicer.followed_by("{") || slicer.followed_by("<!--")
                {
                    output.push(TokenPos {
                        start: slicer.start,
                        end: slicer.end,
                        tok: Token::Text(slice),
                    });
                    slicer.step();
                } else {
                    slicer.grow();
                }
            }
        }

        // add the last piece of text
        if slicer.end >= length {
            slicer.end = length;

            output.push(TokenPos {
                start: slicer.start,
                end: slicer.end,
                tok: Token::Text(slicer.slice()),
            });
            break;
        }
    }

    let len = output.len();
    if len <= 1 {
        return output;
    }

    // collapse subsequent Text tokens
    let mut iter = output.into_iter();
    let first = iter.next().unwrap();

    let (last, mut collapsed) = iter.fold(
        (first, Vec::with_capacity(len)),
        |(prev, mut collapsed), current| match (prev, current) {
            (
                TokenPos {
                    start,
                    tok: Token::Text(a),
                    ..
                },
                TokenPos {
                    end,
                    tok: Token::Text(b),
                    ..
                },
            ) => (
                TokenPos {
                    start,
                    end,
                    tok: Token::Text(format!("{}{}", a, b)),
                },
                collapsed,
            ),
            (prev, current) => {
                if if let TokenPos {
                    tok: Token::Text(val),
                    ..
                } = &prev
                {
                    !val.is_empty()
                } else {
                    true
                } {
                    collapsed.push(prev);
                }

                (current, collapsed)
            }
        },
    );

    if if let TokenPos {
        tok: Token::Text(val),
        ..
    } = &last
    {
        !val.is_empty()
    } else {
        true
    } {
        collapsed.push(last);
    }

    collapsed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn to_tokens(from: Option<Vec<TokenPos>>) -> Vec<Token> {
        from.unwrap()
            .into_iter()
            .map(|TokenPos { tok, .. }| tok)
            .collect()
    }

    // lex expression tests
    #[test]
    fn string_lit() {
        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new("\"\\\\ \\ \""))),
            vec![Token::StringLiteral(r"\\ \ ".to_string())]
        );

        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new(
                "\"help me to save myself\""
            ))),
            vec![Token::StringLiteral("help me to save myself".to_string())]
        );

        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new(
                "function.caps, \"help me to save myself\""
            ))),
            vec![
                Token::LegacyHelper,
                Token::Identifier("caps".to_string()),
                Token::Comma,
                Token::StringLiteral("help me to save myself".to_string())
            ]
        );
    }

    #[test]
    fn bang() {
        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new("!name_of"))),
            vec![Token::Bang, Token::Identifier("name_of".to_string()),]
        );

        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new(
                "!name_of extra stuff"
            ))),
            vec![Token::Bang, Token::Identifier("name_of".to_string()),]
        );

        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new(" ! rooms.private"))),
            vec![Token::Bang, Token::Identifier("rooms.private".to_string()),]
        );
    }

    #[test]
    fn identifier() {
        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new("name_of"))),
            vec![Token::Identifier("name_of".to_string())]
        );
    }

    #[test]
    fn legacy_helper() {
        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new(
                "function.helper_name , arg1, arg2"
            ))),
            vec![
                Token::LegacyHelper,
                Token::Identifier("helper_name".to_string()),
                Token::Comma,
                Token::Identifier("arg1".to_string()),
                Token::Comma,
                Token::Identifier("arg2".to_string()),
            ]
        );
    }

    #[test]
    fn modern_helper() {
        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new(
                "helper_name(arg1, arg2 , )"
            ))),
            vec![
                Token::Identifier("helper_name".to_string()),
                Token::LeftParen,
                Token::Identifier("arg1".to_string()),
                Token::Comma,
                Token::Identifier("arg2".to_string()),
                Token::Comma,
                Token::RightParen,
            ]
        );

        assert_eq!(
            to_tokens(lex_expression(&mut StringSlicer::new(
                "helper_name() after stuff"
            ))),
            vec![
                Token::Identifier("helper_name".to_string()),
                Token::LeftParen,
                Token::RightParen,
            ]
        );
    }

    // lex block tests
    #[test]
    fn if_block() {
        assert_eq!(
            to_tokens(lex_block(&mut StringSlicer::new("if abc"), false)),
            vec![Token::If, Token::Identifier("abc".to_string()),]
        );

        assert_eq!(
            to_tokens(lex_block(&mut StringSlicer::new("IF foo.bar"), true)),
            vec![Token::If, Token::Identifier("foo.bar".to_string()),]
        );

        assert_eq!(
            to_tokens(lex_block(&mut StringSlicer::new("if !valid(stuff)"), false)),
            vec![
                Token::If,
                Token::Bang,
                Token::Identifier("valid".to_string()),
                Token::LeftParen,
                Token::Identifier("stuff".to_string()),
                Token::RightParen,
            ]
        );

        assert_eq!(
            to_tokens(lex_block(
                &mut StringSlicer::new("IF foo.bar extra stuff"),
                true
            )),
            vec![Token::If, Token::Identifier("foo.bar".to_string()),]
        );
    }

    #[test]
    fn iter_block() {
        assert_eq!(
            to_tokens(lex_block(&mut StringSlicer::new("each abc"), false)),
            vec![Token::Iter, Token::Identifier("abc".to_string()),]
        );

        assert_eq!(
            to_tokens(lex_block(&mut StringSlicer::new("BEGIN foo.bar"), true)),
            vec![Token::Iter, Token::Identifier("foo.bar".to_string()),]
        );

        assert_eq!(
            to_tokens(lex_block(
                &mut StringSlicer::new("each valid(stuff)"),
                false
            )),
            vec![
                Token::Iter,
                Token::Identifier("valid".to_string()),
                Token::LeftParen,
                Token::Identifier("stuff".to_string()),
                Token::RightParen,
            ]
        );

        assert_eq!(
            to_tokens(lex_block(
                &mut StringSlicer::new("BEGIN foo.bar extra stuff"),
                true
            )),
            vec![Token::Iter, Token::Identifier("foo.bar".to_string()),]
        );
    }

    #[test]
    fn end_block() {
        assert_eq!(
            to_tokens(lex_block(&mut StringSlicer::new("end abc"), false)),
            vec![Token::End, Token::Identifier("abc".to_string()),]
        );

        assert_eq!(
            to_tokens(lex_block(&mut StringSlicer::new("ENDIF foo.bar"), true)),
            vec![Token::End, Token::Identifier("foo.bar".to_string()),]
        );

        assert_eq!(
            to_tokens(lex_block(&mut StringSlicer::new("END valid(stuff)"), true)),
            vec![
                Token::End,
                Token::Identifier("valid".to_string()),
                Token::LeftParen,
                Token::Identifier("stuff".to_string()),
                Token::RightParen,
            ]
        );

        assert_eq!(
            to_tokens(lex_block(
                &mut StringSlicer::new("ENDIF foo.bar extra stuff"),
                true
            )),
            vec![Token::End, Token::Identifier("foo.bar".to_string()),]
        );
    }

    #[test]
    fn legacy_block() {
        assert_eq!(
            lex_block(&mut StringSlicer::new("END valid(stuff)"), false),
            None
        );
    }

    // test that the lexer can handle unicode inputs
    static UNICODE_START: u16 = 0x0020;
    static UNICODE_END: u16 = 0x26FF;

    #[test]
    fn unicode() {
        let mut text = String::new();

        for i in UNICODE_START..UNICODE_END {
            if let Ok(ch) = String::from_utf16(&[i]) {
                text.push_str(&ch);
            }
        }

        assert_eq!(lex(&text)[0].tok, Token::Text(text));
    }
}
