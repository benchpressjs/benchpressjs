use crate::{
    console::warn,
    parse::{
        expression::{
            expression,
            Expression,
            Keyword,
        },
        ws,
        Span,
        SpanExt,
    },
};
use nom::{
    branch::alt,
    bytes::complete::{
        tag,
        take_until,
    },
    combinator::{
        consumed,
        map,
        recognize,
    },
    error::ParseError,
    sequence::{
        delimited,
        pair,
    },
    IResult,
    Offset,
    Slice,
};

#[derive(Debug, PartialEq, Eq, Clone, Hash)]
pub enum Token<S> {
    // Template text passed through
    Text(S),
    // `{obj.prop}`
    InterpEscaped { span: S, expr: Expression<S> },
    // `{{obj.prop}}`
    InterpRaw { span: S, expr: Expression<S> },
    // `{{{ if condition }}}`
    If { span: S, subject: Expression<S> },
    // `{{{ each arr }}}`
    Each { span: S, subject: Expression<S> },
    // `{{{ else }}}`
    Else { span: S },
    // `{{{ end }}}`
    End { span: S, subject_raw: S },
    // `<!-- IF condition -->`
    LegacyIf { span: S, subject: Expression<S> },
    // `<!-- BEGIN arr -->`
    LegacyBegin { span: S, subject: Expression<S> },
    // `<!-- ELSE -->`
    LegacyElse { span: S },
    // `<!-- END -->` or `<!-- ENDIF -->` or
    // `<!-- END subject -->` or `<!-- ENDIF subject -->`
    LegacyEnd { span: S, subject_raw: S },
}

impl<'a> Token<Span<'a>> {
    pub fn span(&self) -> Span<'a> {
        match self {
            Token::Text(span) => *span,
            Token::InterpEscaped { span, .. } => *span,
            Token::InterpRaw { span, .. } => *span,
            Token::If { span, .. } => *span,
            Token::Each { span, .. } => *span,
            Token::Else { span, .. } => *span,
            Token::End { span, .. } => *span,
            Token::LegacyIf { span, .. } => *span,
            Token::LegacyBegin { span, .. } => *span,
            Token::LegacyElse { span, .. } => *span,
            Token::LegacyEnd { span, .. } => *span,
        }
    }
}

fn interp_escaped(input: Span) -> IResult<Span, Token<Span>> {
    map(
        consumed(delimited(tag("{"), ws(expression), tag("}"))),
        |(span, expr)| Token::InterpEscaped { span, expr },
    )(input)
}

fn interp_raw(input: Span) -> IResult<Span, Token<Span>> {
    map(
        consumed(delimited(tag("{{"), ws(expression), tag("}}"))),
        |(span, expr)| Token::InterpRaw { span, expr },
    )(input)
}

fn new_each(input: Span) -> IResult<Span, Token<Span>> {
    map(
        consumed(delimited(
            pair(tag("{{{"), ws(tag("each"))),
            ws(expression),
            tag("}}}"),
        )),
        |(span, subject)| Token::Each { span, subject },
    )(input)
}

fn new_if(input: Span) -> IResult<Span, Token<Span>> {
    map(
        consumed(delimited(
            pair(tag("{{{"), ws(tag("if"))),
            ws(expression),
            tag("}}}"),
        )),
        |(span, subject)| Token::If { span, subject },
    )(input)
}

fn new_else(input: Span) -> IResult<Span, Token<Span>> {
    map(
        recognize(delimited(tag("{{{"), ws(tag("else")), tag("}}}"))),
        |span| Token::Else { span },
    )(input)
}

fn trim_end(input: Span) -> Span {
    input.slice(..(input.trim_end().len()))
}

fn new_end(input: Span) -> IResult<Span, Token<Span>> {
    map(
        consumed(delimited(
            pair(tag("{{{"), ws(tag("end"))),
            ws(take_until("}")),
            tag("}}}"),
        )),
        |(span, subject)| Token::End {
            span,
            subject_raw: trim_end(subject),
        },
    )(input)
}

fn legacy_begin(input: Span) -> IResult<Span, Token<Span>> {
    map(
        consumed(delimited(
            pair(tag("<!--"), ws(tag("BEGIN"))),
            ws(expression),
            tag("-->"),
        )),
        |(span, subject)| Token::LegacyBegin { span, subject },
    )(input)
}

fn legacy_if(input: Span) -> IResult<Span, Token<Span>> {
    map(
        consumed(delimited(
            pair(tag("<!--"), ws(tag("IF"))),
            ws(expression),
            tag("-->"),
        )),
        |(span, subject)| Token::LegacyIf {
            span,
            subject: {
                // Handle legacy IF helpers being passed @root as implicit first argument
                if let Expression::LegacyHelper {
                    span,
                    name,
                    mut args,
                } = subject
                {
                    args.insert(
                        0,
                        Expression::Keyword {
                            span: args.first()
                                .map_or_else(|| span.slice(span.len()..), |x| x.span().slice(..0)),
                            keyword: Keyword::Root,
                        },
                    );

                    Expression::LegacyHelper { span, name, args }
                } else {
                    subject
                }
            },
        },
    )(input)
}

fn legacy_else(input: Span) -> IResult<Span, Token<Span>> {
    map(
        recognize(delimited(tag("<!--"), ws(tag("ELSE")), tag("-->"))),
        |span| Token::LegacyElse { span },
    )(input)
}

fn legacy_end(input: Span) -> IResult<Span, Token<Span>> {
    map(
        consumed(delimited(
            pair(tag("<!--"), ws(alt((tag("ENDIF"), tag("END"))))),
            ws(take_until("-->")),
            tag("-->"),
        )),
        |(span, subject)| Token::LegacyEnd {
            span,
            subject_raw: trim_end(subject),
        },
    )(input)
}

fn token(input: Span) -> IResult<Span, Token<Span>> {
    alt((
        interp_escaped,
        interp_raw,
        new_each,
        new_if,
        new_else,
        new_end,
        legacy_begin,
        legacy_if,
        legacy_else,
        legacy_end,
    ))(input)
}

static PATTERNS: &[&str] = &[
    // 0        1       2      3        4      5    6      7       8        9        10
    "\\{{{", "\\{{", "\\{", "\\<!--", "{{{", "{{", "{", "<!--", "@key", "@value", "@index",
];

use std::sync::LazyLock;
use aho_corasick::{
    AhoCorasick,
    AhoCorasickBuilder,
    MatchKind,
};

static TOKEN_START: LazyLock<AhoCorasick> = LazyLock::new(|| {
    AhoCorasickBuilder::new()
        .match_kind(MatchKind::LeftmostFirst)
        .build(PATTERNS)
        .unwrap()
});

#[rustfmt::skip::macros(warn)]
pub fn tokens(mut input: Span) -> IResult<Span, Vec<Token<Span>>> {
    let mut tokens = vec![];
    let mut index = 0;

    while index < input.len() {
        // skip to the next `{` or `<!--`
        if let Some(i) = TOKEN_START.find(input.slice(index..).fragment()) {
            // If this is an opener, step to it
            if matches!(i.pattern().as_u32(), 4..=7) {
                index += i.start();

                let slice = input.slice(index..);
                match token(slice) {
                    // Not a match, step to the next character
                    Err(nom::Err::Error(_)) => {
                        let syntax_warning = |closer: &str| {
                            let (line, column, padding) = slice.get_line_column_padding();

                            // restrict search to end of line
                            let consumed_line_end = line.len() - line.offset(slice.fragment());
                            let consumed_line = slice.slice(..consumed_line_end);

                            let span = consumed_line.find(closer).map_or_else(
                                || consumed_line,
                                |end| consumed_line.slice(..(end + closer.len())),
                            );

                            warn!("[benchpress] warning: probable template syntax error");
                            warn!("     --> {}:{}:{}",
                                span.extra.filename, span.location_line(), column);
                            warn!("      |");
                            warn!("{:>5} | {}", span.location_line(), line);
                            warn!("      | {}{} this looks like a template token, but a parse error caused it to be passed through as text",
                                padding, "^".repeat(span.len()));
                            warn!("      | help: if this is supposed to be literal text, escape it like `\\{span}`");
                            warn!("      | note: This will become an error in the future.\n");
                        };

                        match i.pattern().as_u32() {
                            // {{{ => }}}
                            4 => syntax_warning("}}}"),
                            // {{ => }}
                            5 => syntax_warning("}}"),
                            // <!-- => -->
                            7 => {
                                // try to make sure this looks like a template token
                                // <!-- IF, <!-- ELSE, <!-- ENDIF, <!-- BEGIN, <!-- END
                                let slice = slice.slice(4..).trim_start();
                                let alike = slice
                                    .strip_prefix("IF")
                                    .or_else(|| slice.strip_prefix("ELSE"))
                                    .or_else(|| slice.strip_prefix("ENDIF"))
                                    .or_else(|| slice.strip_prefix("BEGIN"))
                                    .is_some_and(|rest| {
                                        rest.starts_with(|c: char| c.is_whitespace())
                                    });
                                if alike {
                                    syntax_warning("-->")
                                }
                            }
                            _ => (),
                        };

                        while {
                            // do-while
                            index += i.end() - i.start();
                            !input.is_char_boundary(index)
                        } {}
                    }
                    Ok((rest, tok)) => {
                        // Token returned what it was sent, this shouldn't happen
                        if rest == input {
                            return Err(nom::Err::Error(nom::error::Error::from_error_kind(
                                rest,
                                nom::error::ErrorKind::SeparatedList,
                            )));
                        }

                        // Add text before the token
                        if index > 0 {
                            tokens.push(Token::Text(input.slice(..index)));
                        }
                        // Add token
                        tokens.push(tok);

                        // Advance to after the token
                        input = rest;
                        index = 0;
                    }
                    // Pass through other errors
                    Err(e) => return Err(e),
                }
            // If this is an escaped opener, skip it
            } else if matches!(i.pattern().as_u32(), 0..=3) {
                let start = index + i.start();
                let length = i.end() - i.start();

                // Add text before the escaper character
                if start > 0 {
                    tokens.push(Token::Text(input.slice(..start)));
                }
                // Advance to after the escaper character
                input = input.slice((start + 1)..);
                // Step to after the escaped sequence
                index = length - 1;
            // If this is `@key`, `@value`, `@index`
            } else {
                // if matches!(i.pattern(), 8..=10)
                let start = index + i.start();
                let end = index + i.end();
                let span = input.slice(start..end);
                let (_, expr) = expression(span)?;

                let (line, column, padding) = span.get_line_column_padding();
                warn!("[benchpress] warning: keyword outside an interpolation token is deprecated");
                warn!("     --> {}:{}:{}",
                    span.extra.filename, span.location_line(), column);
                warn!("      |");
                warn!("{:>5} | {}", span.location_line(), line);
                warn!("      | {}{} help: wrap this in curly braces: `{{{}}}`",
                    padding, "^".repeat(span.len()), span);
                warn!("      | note: This will become an error in v3.0.0\n");

                // Add text before the token
                if start > 0 {
                    tokens.push(Token::Text(input.slice(..start)));
                }
                // Add token
                tokens.push(Token::InterpEscaped { span, expr });

                // Advance to after the token
                input = input.slice(end..);
                index = 0;
            }
        } else {
            // no tokens found, break out
            index = input.len();
            break;
        }
    }

    if index > 0 {
        tokens.push(Token::Text(input.slice(..index)));
    }

    Ok((input.slice(input.len()..), tokens))
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::parse::{
        path::PathPart,
        test::{
            assert_eq_unspan,
            sp,
        },
    };

    impl<'a> Token<Span<'a>> {
        pub fn span_to_str(self) -> Token<&'a str> {
            match self {
                Token::Text(span) => Token::Text(*span.fragment()),
                Token::InterpEscaped { span, expr } => Token::InterpEscaped {
                    span: *span.fragment(),
                    expr: expr.span_to_str(),
                },
                Token::InterpRaw { span, expr } => Token::InterpRaw {
                    span: *span.fragment(),
                    expr: expr.span_to_str(),
                },
                Token::If { span, subject } => Token::If {
                    span: *span.fragment(),
                    subject: subject.span_to_str(),
                },
                Token::Each { span, subject } => Token::Each {
                    span: *span.fragment(),
                    subject: subject.span_to_str(),
                },
                Token::Else { span } => Token::Else {
                    span: *span.fragment(),
                },
                Token::End { span, subject_raw } => Token::End {
                    span: *span.fragment(),
                    subject_raw: *subject_raw.fragment(),
                },
                Token::LegacyIf { span, subject } => Token::LegacyIf {
                    span: *span.fragment(),
                    subject: subject.span_to_str(),
                },
                Token::LegacyBegin { span, subject } => Token::LegacyBegin {
                    span: *span.fragment(),
                    subject: subject.span_to_str(),
                },
                Token::LegacyElse { span } => Token::LegacyElse {
                    span: *span.fragment(),
                },
                Token::LegacyEnd { span, subject_raw } => Token::LegacyEnd {
                    span: *span.fragment(),
                    subject_raw: *subject_raw.fragment(),
                },
            }
        }
    }

    fn span_to_str<'a>(
        res: IResult<Span<'a>, Token<Span<'a>>>,
    ) -> IResult<&'a str, Token<&'a str>> {
        match res {
            Ok((rest, tok)) => Ok((*rest.fragment(), tok.span_to_str())),
            Err(err) => Err(
                err.map(|nom::error::Error { input, code }| nom::error::Error {
                    input: *input.fragment(),
                    code,
                }),
            ),
        }
    }

    #[test]
    fn test_comments() {
        // actual offending code from issue63
        tokens(sp(
            "<!--<p>⚠️ Forum Maintenance: Feb 6th, 8am - 14pm (UTC+2)</p>-->",
        ))
        .unwrap();

        // some fuzzing just to make sure
        for n in 0..8 {
            let comment = format!("<!--{}⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️-->", " ".repeat(n));
            tokens(sp(&comment)).unwrap();

            for sbraces in 1..=3 {
                for ebraces in 1..=3 {
                    let input = format!(
                        "{}{}⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️{}",
                        "{".repeat(sbraces),
                        " ".repeat(n),
                        "}".repeat(ebraces)
                    );
                    tokens(sp(&input)).unwrap();
                }
            }
        }
    }

    #[test]
    fn test_interp_escaped() {
        assert_eq_unspan!(
            interp_escaped(sp("{prop}")),
            Ok((
                "",
                Token::InterpEscaped {
                    span: "{prop}",
                    expr: Expression::Path {
                        span: "prop",
                        path: vec![PathPart::Part("prop")]
                    }
                }
            ))
        );
        assert_eq_unspan!(
            interp_escaped(sp("{ call() } stuff")),
            Ok((
                " stuff",
                Token::InterpEscaped {
                    span: "{ call() }",
                    expr: Expression::Helper {
                        span: "call()",
                        name: "call",
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_interp_raw() {
        assert_eq_unspan!(
            interp_raw(sp("{{prop}}")),
            Ok((
                "",
                Token::InterpRaw {
                    span: "{{prop}}",
                    expr: Expression::Path {
                        span: "prop",
                        path: vec![PathPart::Part("prop")]
                    }
                }
            ))
        );
        assert_eq_unspan!(
            interp_raw(sp("{{ call() }} stuff")),
            Ok((
                " stuff",
                Token::InterpRaw {
                    span: "{{ call() }}",
                    expr: Expression::Helper {
                        span: "call()",
                        name: "call",
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_new_if() {
        assert_eq_unspan!(
            new_if(sp("{{{if abc}}}")),
            Ok((
                "",
                Token::If {
                    span: "{{{if abc}}}",
                    subject: Expression::Path {
                        span: "abc",
                        path: vec![PathPart::Part("abc")]
                    }
                }
            ))
        );
        assert_eq_unspan!(
            new_if(sp("{{{ if call() }}}")),
            Ok((
                "",
                Token::If {
                    span: "{{{ if call() }}}",
                    subject: Expression::Helper {
                        span: "call()",
                        name: "call",
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_new_each() {
        assert_eq_unspan!(
            new_each(sp("{{{each abc.def}}}")),
            Ok((
                "",
                Token::Each {
                    span: "{{{each abc.def}}}",
                    subject: Expression::Path {
                        span: "abc.def",
                        path: vec![PathPart::Part("abc"), PathPart::Part("def")]
                    }
                }
            ))
        );
        assert_eq_unspan!(
            new_each(sp("{{{ each call() }}}")),
            Ok((
                "",
                Token::Each {
                    span: "{{{ each call() }}}",
                    subject: Expression::Helper {
                        span: "call()",
                        name: "call",
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_new_else() {
        assert_eq_unspan!(
            new_else(sp("{{{else}}}")),
            Ok(("", Token::Else { span: "{{{else}}}" }))
        );
        assert_eq_unspan!(
            new_else(sp("{{{ else }}}")),
            Ok((
                "",
                Token::Else {
                    span: "{{{ else }}}"
                }
            ))
        );
    }

    #[test]
    fn test_new_end() {
        assert_eq_unspan!(
            new_end(sp("{{{end}}}")),
            Ok((
                "",
                Token::End {
                    span: "{{{end}}}",
                    subject_raw: ""
                }
            ))
        );
        assert_eq_unspan!(
            new_end(sp("{{{ end }}}")),
            Ok((
                "",
                Token::End {
                    span: "{{{ end }}}",
                    subject_raw: ""
                }
            ))
        );
    }

    #[test]
    fn test_legacy_if() {
        assert_eq_unspan!(
            legacy_if(sp("<!--IF abc-->")),
            Ok((
                "",
                Token::LegacyIf {
                    span: "<!--IF abc-->",
                    subject: Expression::Path {
                        span: "abc",
                        path: vec![PathPart::Part("abc")]
                    }
                }
            ))
        );
        assert_eq_unspan!(
            legacy_if(sp("<!-- IF call() -->")),
            Ok((
                "",
                Token::LegacyIf {
                    span: "<!-- IF call() -->",
                    subject: Expression::Helper {
                        span: "call()",
                        name: "call",
                        args: vec![]
                    }
                }
            ))
        );
        assert_eq_unspan!(
            legacy_if(sp("<!--IF function.bar, a, b -->")),
            Ok((
                "",
                Token::LegacyIf {
                    span: "<!--IF function.bar, a, b -->",
                    subject: Expression::LegacyHelper {
                        span: "function.bar, a, b",
                        name: "bar",
                        args: vec![
                            Expression::Keyword {
                                span: "",
                                keyword: Keyword::Root,
                            },
                            Expression::Path {
                                span: "a",
                                path: vec![PathPart::Part("a")]
                            },
                            Expression::Path {
                                span: "b",
                                path: vec![PathPart::Part("b")]
                            },
                        ]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_legacy_begin() {
        assert_eq_unspan!(
            legacy_begin(sp("<!--BEGIN abc.def-->")),
            Ok((
                "",
                Token::LegacyBegin {
                    span: "<!--BEGIN abc.def-->",
                    subject: Expression::Path {
                        span: "abc.def",
                        path: vec![PathPart::Part("abc"), PathPart::Part("def")]
                    }
                }
            ))
        );
        assert_eq_unspan!(
            legacy_begin(sp("<!-- BEGIN call() -->")),
            Ok((
                "",
                Token::LegacyBegin {
                    span: "<!-- BEGIN call() -->",
                    subject: Expression::Helper {
                        span: "call()",
                        name: "call",
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_legacy_else() {
        assert_eq_unspan!(
            legacy_else(sp("<!--ELSE-->")),
            Ok((
                "",
                Token::LegacyElse {
                    span: "<!--ELSE-->"
                }
            ))
        );
        assert_eq_unspan!(
            legacy_else(sp("<!-- ELSE -->")),
            Ok((
                "",
                Token::LegacyElse {
                    span: "<!-- ELSE -->"
                }
            ))
        );
    }

    #[test]
    fn test_legacy_end() {
        assert_eq_unspan!(
            legacy_end(sp("<!--END-->")),
            Ok((
                "",
                Token::LegacyEnd {
                    span: "<!--END-->",
                    subject_raw: ""
                }
            ))
        );
        assert_eq_unspan!(
            legacy_end(sp("<!--END abc.def-->")),
            Ok((
                "",
                Token::LegacyEnd {
                    span: "<!--END abc.def-->",
                    subject_raw: "abc.def"
                }
            ))
        );
        assert_eq_unspan!(
            legacy_end(sp("<!-- END -->")),
            Ok((
                "",
                Token::LegacyEnd {
                    span: "<!-- END -->",
                    subject_raw: ""
                }
            ))
        );
        assert_eq_unspan!(
            legacy_end(sp("<!-- ENDIF call() -->")),
            Ok((
                "",
                Token::LegacyEnd {
                    span: "<!-- ENDIF call() -->",
                    subject_raw: "call()"
                }
            ))
        );
    }

    #[test]
    fn test_tokens() {
        fn span_to_str<'a>(
            res: IResult<Span<'a>, Vec<Token<Span<'a>>>>,
        ) -> IResult<&'a str, Vec<Token<&'a str>>> {
            match res {
                Ok((rest, tok)) => Ok((
                    *rest.fragment(),
                    tok.into_iter().map(|t| t.span_to_str()).collect(),
                )),
                Err(err) => Err(
                    err.map(|nom::error::Error { input, code }| nom::error::Error {
                        input: *input.fragment(),
                        code,
                    }),
                ),
            }
        }

        assert_eq_unspan!(
            tokens(
                sp("before {{{ if abc }}} we do one thing {{{ else }}} we do another {{{ end }}} other stuff")
            ),
            Ok((
                "",
                vec![
                    Token::Text("before "),
                    Token::If {
                        span: "{{{ if abc }}}",
                        subject: Expression::Path { span: "abc", path: vec![PathPart::Part("abc")] }
                    },
                    Token::Text(" we do one thing "),
                    Token::Else { span: "{{{ else }}}" },
                    Token::Text(" we do another "),
                    Token::End {
                        span: "{{{ end }}}",
                        subject_raw: ""
                    },
                    Token::Text(" other stuff"),
                ]
            ))
        );

        assert_eq_unspan!(
            tokens(sp(
                "{{{ if abc }}} we do one thing {{{ else }}} we do another {{{ end }}} other stuff"
            )),
            Ok((
                "",
                vec![
                    Token::If {
                        span: "{{{ if abc }}}",
                        subject: Expression::Path {
                            span: "abc",
                            path: vec![PathPart::Part("abc")]
                        }
                    },
                    Token::Text(" we do one thing "),
                    Token::Else {
                        span: "{{{ else }}}"
                    },
                    Token::Text(" we do another "),
                    Token::End {
                        span: "{{{ end }}}",
                        subject_raw: ""
                    },
                    Token::Text(" other stuff"),
                ]
            ))
        );

        assert_eq_unspan!(
            tokens(sp("before {{{ each abc }}} for each thing {{{ end }}}")),
            Ok((
                "",
                vec![
                    Token::Text("before "),
                    Token::Each {
                        span: "{{{ each abc }}}",
                        subject: Expression::Path {
                            span: "abc",
                            path: vec![PathPart::Part("abc")]
                        }
                    },
                    Token::Text(" for each thing "),
                    Token::End {
                        span: "{{{ end }}}",
                        subject_raw: ""
                    },
                ]
            ))
        );

        assert_eq_unspan!(
            tokens(sp("{{{ each abc }}} for each thing {{{ end }}}")),
            Ok((
                "",
                vec![
                    Token::Each {
                        span: "{{{ each abc }}}",
                        subject: Expression::Path {
                            span: "abc",
                            path: vec![PathPart::Part("abc")]
                        }
                    },
                    Token::Text(" for each thing "),
                    Token::End {
                        span: "{{{ end }}}",
                        subject_raw: ""
                    },
                ]
            ))
        );

        assert_eq_unspan!(
            tokens(sp("{{{ each *abc }}} for each thing {{{ end }}}")),
            Ok((
                "",
                vec![
                    Token::Text("{{{ each *abc }}} for each thing "),
                    Token::End {
                        span: "{{{ end }}}",
                        subject_raw: ""
                    },
                ]
            ))
        );

        let program = "before \\{{{ each abc }}} for each thing \\{{{ end }}}";
        let source = sp(program);
        assert_eq_unspan!(
            tokens(source),
            Ok((
                "",
                vec![
                    Token::Text("before "),
                    Token::Text("{{{ each abc }}} for each thing "),
                    Token::Text("{{{ end }}}"),
                ]
            ))
        );
    }
}
