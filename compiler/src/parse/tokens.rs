use crate::{
    console::warn,
    parse::{
        expression::{
            expression,
            Expression,
        },
        path::PathPart,
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
    Slice,
};

#[derive(Debug, PartialEq, Eq, Clone, Hash)]
pub enum Token<'a> {
    // Template text passed through
    Text(Span<'a>),
    // `{obj.prop}`
    InterpEscaped {
        span: Span<'a>,
        expr: Expression<'a>,
    },
    // `{{obj.prop}}`
    InterpRaw {
        span: Span<'a>,
        expr: Expression<'a>,
    },
    // `{{{ if condition }}}`
    If {
        span: Span<'a>,
        subject: Expression<'a>,
    },
    // `{{{ each arr }}}`
    Each {
        span: Span<'a>,
        subject: Expression<'a>,
    },
    // `{{{ else }}}`
    Else {
        span: Span<'a>,
    },
    // `{{{ end }}}`
    End {
        span: Span<'a>,
    },
    // `<!-- IF condition -->`
    LegacyIf {
        span: Span<'a>,
        subject: Expression<'a>,
    },
    // `<!-- BEGIN arr -->`
    LegacyBegin {
        span: Span<'a>,
        subject: Expression<'a>,
    },
    // `<!-- ELSE -->`
    LegacyElse {
        span: Span<'a>,
    },
    // `<!-- END -->` or `<!-- ENDIF -->` or
    // `<!-- END subject -->` or `<!-- ENDIF subject -->`
    LegacyEnd {
        span: Span<'a>,
        subject_raw: Span<'a>,
    },
}

impl<'a> Token<'a> {
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

fn interp_escaped(input: Span) -> IResult<Span, Token<'_>> {
    map(
        consumed(delimited(tag("{"), ws(expression), tag("}"))),
        |(span, expr)| Token::InterpEscaped { span, expr },
    )(input)
}

fn interp_raw(input: Span) -> IResult<Span, Token<'_>> {
    map(
        consumed(delimited(tag("{{"), ws(expression), tag("}}"))),
        |(span, expr)| Token::InterpRaw { span, expr },
    )(input)
}

fn new_each(input: Span) -> IResult<Span, Token<'_>> {
    map(
        consumed(delimited(
            pair(tag("{{{"), ws(tag("each"))),
            ws(expression),
            tag("}}}"),
        )),
        |(span, subject)| Token::Each { span, subject },
    )(input)
}

fn new_if(input: Span) -> IResult<Span, Token<'_>> {
    map(
        consumed(delimited(
            pair(tag("{{{"), ws(tag("if"))),
            ws(expression),
            tag("}}}"),
        )),
        |(span, subject)| Token::If { span, subject },
    )(input)
}

fn new_else(input: Span) -> IResult<Span, Token<'_>> {
    map(
        recognize(delimited(tag("{{{"), ws(tag("else")), tag("}}}"))),
        |span| Token::Else { span },
    )(input)
}

fn new_end(input: Span) -> IResult<Span, Token<'_>> {
    map(
        recognize(delimited(tag("{{{"), ws(tag("end")), tag("}}}"))),
        |span| Token::End { span },
    )(input)
}

fn legacy_begin(input: Span) -> IResult<Span, Token<'_>> {
    map(
        consumed(delimited(
            pair(tag("<!--"), ws(tag("BEGIN"))),
            ws(expression),
            tag("-->"),
        )),
        |(span, subject)| Token::LegacyBegin { span, subject },
    )(input)
}

fn legacy_if(input: Span) -> IResult<Span, Token<'_>> {
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
                        Expression::Path {
                            span: args
                                .get(0)
                                .map_or_else(|| span.slice(span.len()..), |x| x.span().slice(..0)),
                            path: vec![PathPart::Part(Span::new_extra("@root", input.extra))],
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

fn legacy_else(input: Span) -> IResult<Span, Token<'_>> {
    map(
        recognize(delimited(tag("<!--"), ws(tag("ELSE")), tag("-->"))),
        |span| Token::LegacyElse { span },
    )(input)
}

fn trim_end(input: Span) -> Span {
    input.slice(..(input.trim_end().len()))
}

fn legacy_end(input: Span) -> IResult<Span, Token<'_>> {
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

fn token(input: Span) -> IResult<Span, Token<'_>> {
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
    "\\{{{", "\\{{", "\\{", "\\<!--", "{", "<!--", "@key", "@value", "@index",
];

use aho_corasick::{
    AhoCorasick,
    AhoCorasickBuilder,
    MatchKind,
};
lazy_static::lazy_static! {
    static ref TOKEN_START: AhoCorasick = AhoCorasickBuilder::new().auto_configure(PATTERNS).match_kind(MatchKind::LeftmostFirst).build(PATTERNS);
}

#[rustfmt::skip::macros(warn)]
pub fn tokens(mut input: Span) -> IResult<Span, Vec<Token<'_>>> {
    let mut tokens = vec![];
    let mut index = 0;

    while index < input.len() {
        // skip to the next `{` or `<!--`
        if let Some(i) = TOKEN_START.find(input.slice(index..).fragment()) {
            // If this is an opener, step to it
            if matches!(i.pattern(), 4..=5) {
                index += i.start();
            // If this is an escaped opener, skip it
            } else if matches!(i.pattern(), 0..=3) {
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
                continue;
            // If this is `@key`, `@value`, `@index`
            } else {
                // if matches!(i.pattern(), 6..=8)
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
                warn!("      | note: This will become an error in the v3.0.0\n");

                // Add text before the token
                if start > 0 {
                    tokens.push(Token::Text(input.slice(..start)));
                }
                // Add token
                tokens.push(Token::InterpEscaped { span, expr });

                // Advance to after the token
                input = input.slice(end..);
                index = 0;
                continue;
            }
        } else {
            // no tokens found, break out
            index = input.len();
            break;
        }

        match token(input.slice(index..)) {
            // Not a match, step to the next character
            Err(nom::Err::Error(_)) => {
                // do-while
                while {
                    index += 1;
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
        test::sp,
    };
    use pretty_assertions::assert_eq;

    #[test]
    fn test_interp_escaped() {
        assert_eq!(
            interp_escaped(sp("{prop}")),
            Ok((
                sp(""),
                Token::InterpEscaped {
                    span: sp("{prop}"),
                    expr: Expression::Path {
                        span: sp("prop"),
                        path: vec![PathPart::Part(sp("prop"))]
                    }
                }
            ))
        );
        assert_eq!(
            interp_escaped(sp("{ call() } stuff")),
            Ok((
                sp(" stuff"),
                Token::InterpEscaped {
                    span: sp("{ call() }"),
                    expr: Expression::Helper {
                        span: sp("call()"),
                        name: sp("call"),
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_interp_raw() {
        assert_eq!(
            interp_raw(sp("{{prop}}")),
            Ok((
                sp(""),
                Token::InterpRaw {
                    span: sp("{{prop}}"),
                    expr: Expression::Path {
                        span: sp("prop"),
                        path: vec![PathPart::Part(sp("prop"))]
                    }
                }
            ))
        );
        assert_eq!(
            interp_raw(sp("{{ call() }} stuff")),
            Ok((
                sp(" stuff"),
                Token::InterpRaw {
                    span: sp("{{ call() }}"),
                    expr: Expression::Helper {
                        span: sp("call()"),
                        name: sp("call"),
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_new_if() {
        assert_eq!(
            new_if(sp("{{{if abc}}}")),
            Ok((
                sp(""),
                Token::If {
                    span: sp("{{{if abc}}}"),
                    subject: Expression::Path {
                        span: sp("abc"),
                        path: vec![PathPart::Part(sp("abc"))]
                    }
                }
            ))
        );
        assert_eq!(
            new_if(sp("{{{ if call() }}}")),
            Ok((
                sp(""),
                Token::If {
                    span: sp("{{{ if call() }}}"),
                    subject: Expression::Helper {
                        span: sp("call()"),
                        name: sp("call"),
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_new_each() {
        assert_eq!(
            new_each(sp("{{{each abc.def}}}")),
            Ok((
                sp(""),
                Token::Each {
                    span: sp("{{{each abc.def}}}"),
                    subject: Expression::Path {
                        span: sp("abc.def"),
                        path: vec![PathPart::Part(sp("abc")), PathPart::Part(sp("def"))]
                    }
                }
            ))
        );
        assert_eq!(
            new_each(sp("{{{ each call() }}}")),
            Ok((
                sp(""),
                Token::Each {
                    span: sp("{{{ each call() }}}"),
                    subject: Expression::Helper {
                        span: sp("call()"),
                        name: sp("call"),
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_new_else() {
        assert_eq!(
            new_else(sp("{{{else}}}")),
            Ok((
                sp(""),
                Token::Else {
                    span: sp("{{{else}}}")
                }
            ))
        );
        assert_eq!(
            new_else(sp("{{{ else }}}")),
            Ok((
                sp(""),
                Token::Else {
                    span: sp("{{{ else }}}")
                }
            ))
        );
    }

    #[test]
    fn test_new_end() {
        assert_eq!(
            new_end(sp("{{{end}}}")),
            Ok((
                sp(""),
                Token::End {
                    span: sp("{{{end}}}")
                }
            ))
        );
        assert_eq!(
            new_end(sp("{{{ end }}}")),
            Ok((
                sp(""),
                Token::End {
                    span: sp("{{{ end }}}")
                }
            ))
        );
    }

    #[test]
    fn test_legacy_if() {
        assert_eq!(
            legacy_if(sp("<!--IF abc-->")),
            Ok((
                sp(""),
                Token::LegacyIf {
                    span: sp("<!--IF abc-->"),
                    subject: Expression::Path {
                        span: sp("abc"),
                        path: vec![PathPart::Part(sp("abc"))]
                    }
                }
            ))
        );
        assert_eq!(
            legacy_if(sp("<!-- IF call() -->")),
            Ok((
                sp(""),
                Token::LegacyIf {
                    span: sp("<!-- IF call() -->"),
                    subject: Expression::Helper {
                        span: sp("call()"),
                        name: sp("call"),
                        args: vec![]
                    }
                }
            ))
        );
        assert_eq!(
            legacy_if(sp("<!--IF function.bar, a, b -->")),
            Ok((
                sp(""),
                Token::LegacyIf {
                    span: sp("<!--IF function.bar, a, b -->"),
                    subject: Expression::LegacyHelper {
                        span: sp("function.bar, a, b"),
                        name: sp("bar"),
                        args: vec![
                            Expression::Path {
                                span: sp(""),
                                path: vec![PathPart::Part(sp("@root"))]
                            },
                            Expression::Path {
                                span: sp("a"),
                                path: vec![PathPart::Part(sp("a"))]
                            },
                            Expression::Path {
                                span: sp("b"),
                                path: vec![PathPart::Part(sp("b"))]
                            },
                        ]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_legacy_begin() {
        assert_eq!(
            legacy_begin(sp("<!--BEGIN abc.def-->")),
            Ok((
                sp(""),
                Token::LegacyBegin {
                    span: sp("<!--BEGIN abc.def-->"),
                    subject: Expression::Path {
                        span: sp("abc.def"),
                        path: vec![PathPart::Part(sp("abc")), PathPart::Part(sp("def"))]
                    }
                }
            ))
        );
        assert_eq!(
            legacy_begin(sp("<!-- BEGIN call() -->")),
            Ok((
                sp(""),
                Token::LegacyBegin {
                    span: sp("<!-- BEGIN call() -->"),
                    subject: Expression::Helper {
                        span: sp("call()"),
                        name: sp("call"),
                        args: vec![]
                    }
                }
            ))
        );
    }

    #[test]
    fn test_legacy_else() {
        assert_eq!(
            legacy_else(sp("<!--ELSE-->")),
            Ok((
                sp(""),
                Token::LegacyElse {
                    span: sp("<!--ELSE-->")
                }
            ))
        );
        assert_eq!(
            legacy_else(sp("<!-- ELSE -->")),
            Ok((
                sp(""),
                Token::LegacyElse {
                    span: sp("<!-- ELSE -->")
                }
            ))
        );
    }

    #[test]
    fn test_legacy_end() {
        assert_eq!(
            legacy_end(sp("<!--END-->")),
            Ok((
                sp(""),
                Token::LegacyEnd {
                    span: sp("<!--END-->"),
                    subject_raw: sp("")
                }
            ))
        );
        assert_eq!(
            legacy_end(sp("<!--END abc.def-->")),
            Ok((
                sp(""),
                Token::LegacyEnd {
                    span: sp("<!--END abc.def-->"),
                    subject_raw: sp("abc.def")
                }
            ))
        );
        assert_eq!(
            legacy_end(sp("<!-- END -->")),
            Ok((
                sp(""),
                Token::LegacyEnd {
                    span: sp("<!-- END -->"),
                    subject_raw: sp("")
                }
            ))
        );
        assert_eq!(
            legacy_end(sp("<!-- ENDIF call() -->")),
            Ok((
                sp(""),
                Token::LegacyEnd {
                    span: sp("<!-- ENDIF call() -->"),
                    subject_raw: sp("call()")
                }
            ))
        );
    }

    #[test]
    fn test_tokens() {
        assert_eq!(
            tokens(
                sp("before {{{ if abc }}} we do one thing {{{ else }}} we do another {{{ end }}} other stuff")
            ),
            Ok((
                sp(""),
                vec![
                    Token::Text(sp("before ")),
                    Token::If {
                        span: sp("{{{ if abc }}}"),
                        subject: Expression::Path { span: sp("abc"), path: vec![PathPart::Part(sp("abc"))] }
                    },
                    Token::Text(sp(" we do one thing ")),
                    Token::Else { span: sp("{{{ else }}}") },
                    Token::Text(sp(" we do another ")),
                    Token::End { span: sp("{{{ end }}}") },
                    Token::Text(sp(" other stuff")),
                ]
            ))
        );

        assert_eq!(
            tokens(sp(
                "{{{ if abc }}} we do one thing {{{ else }}} we do another {{{ end }}} other stuff"
            )),
            Ok((
                sp(""),
                vec![
                    Token::If {
                        span: sp("{{{ if abc }}}"),
                        subject: Expression::Path {
                            span: sp("abc"),
                            path: vec![PathPart::Part(sp("abc"))]
                        }
                    },
                    Token::Text(sp(" we do one thing ")),
                    Token::Else {
                        span: sp("{{{ else }}}")
                    },
                    Token::Text(sp(" we do another ")),
                    Token::End {
                        span: sp("{{{ end }}}")
                    },
                    Token::Text(sp(" other stuff")),
                ]
            ))
        );

        assert_eq!(
            tokens(sp("before {{{ each abc }}} for each thing {{{ end }}}")),
            Ok((
                sp(""),
                vec![
                    Token::Text(sp("before ")),
                    Token::Each {
                        span: sp("{{{ each abc }}}"),
                        subject: Expression::Path {
                            span: sp("abc"),
                            path: vec![PathPart::Part(sp("abc"))]
                        }
                    },
                    Token::Text(sp(" for each thing ")),
                    Token::End {
                        span: sp("{{{ end }}}")
                    },
                ]
            ))
        );

        assert_eq!(
            tokens(sp("{{{ each abc }}} for each thing {{{ end }}}")),
            Ok((
                sp(""),
                vec![
                    Token::Each {
                        span: sp("{{{ each abc }}}"),
                        subject: Expression::Path {
                            span: sp("abc"),
                            path: vec![PathPart::Part(sp("abc"))]
                        }
                    },
                    Token::Text(sp(" for each thing ")),
                    Token::End {
                        span: sp("{{{ end }}}")
                    },
                ]
            ))
        );

        assert_eq!(
            tokens(sp("{{{ each /abc }}} for each thing {{{ end }}}")),
            Ok((
                sp(""),
                vec![
                    Token::Text(sp("{{{ each /abc }}} for each thing ")),
                    Token::End {
                        span: sp("{{{ end }}}")
                    },
                ]
            ))
        );

        let program = "before \\{{{ each abc }}} for each thing \\{{{ end }}}";
        let source = Span::new_extra(
            program,
            crate::parse::FileInfo {
                filename: "",
                full_source: program,
            },
        );
        assert_eq!(
            tokens(source),
            Ok((
                sp(""),
                vec![
                    Token::Text(sp("before ")),
                    Token::Text(sp("{{{ each abc }}} for each thing ")),
                    Token::Text(sp("{{{ end }}}")),
                ]
            ))
        );
    }
}
