use crate::parse::{
    path::{
        PathBuf,
        PathPart,
    },
    ws,
    Span,
};
use nom::{
    branch::alt,
    bytes::complete::{
        is_a,
        is_not,
        tag,
        take,
    },
    character::complete::{
        alpha1,
        alphanumeric1,
    },
    combinator::{
        consumed,
        map,
        map_res,
        opt,
        recognize,
    },
    multi::{
        many0,
        many0_count,
        many1_count,
        separated_list0,
        separated_list1,
    },
    sequence::{
        delimited,
        pair,
        preceded,
        tuple,
    },
    IResult,
    Slice,
};

#[derive(Debug, PartialEq, Eq, Hash, Clone)]
pub enum Keyword {
    // @root
    Root,
    // @key
    Key,
    // @index
    Index,
    // @value
    Value,
    // @first
    First,
    // @last
    Last,
    // @true
    True,
    // @false
    False,
}

#[derive(Debug, PartialEq, Eq, Hash, Clone)]
pub enum Expression<S> {
    // "this \"works\" as you'd expect"
    StringLiteral(S),
    // @value, @first, etc
    Keyword {
        span: S,
        keyword: Keyword,
    },
    // a.b.c.d
    Path {
        span: S,
        path: PathBuf<S>,
    },
    // !expr
    Negative {
        span: S,
        expr: Box<Expression<S>>,
    },
    // name(arg0, arg1, arg2, ...)
    Helper {
        span: S,
        name: S,
        args: Vec<Expression<S>>,
    },
    // function.name, arg0, arg1, arg2, ...
    LegacyHelper {
        span: S,
        name: S,
        args: Vec<Expression<S>>,
    },
    // a.b == "foo"
    Equ {
        span: S,
        lhs: Box<Expression<S>>,
        rhs: Box<Expression<S>>,
    },
    // a.b != "bar"
    Neq {
        span: S,
        lhs: Box<Expression<S>>,
        rhs: Box<Expression<S>>,
    },
    // a.b && cond
    And {
        span: S,
        lhs: Box<Expression<S>>,
        rhs: Box<Expression<S>>,
    },
    // yes || something.else
    Or {
        span: S,
        lhs: Box<Expression<S>>,
        rhs: Box<Expression<S>>,
    },
}

impl<'a> Expression<Span<'a>> {
    pub fn span(&self) -> Span<'a> {
        match self {
            Expression::StringLiteral(span)
            | Expression::Keyword { span, .. }
            | Expression::Path { span, .. }
            | Expression::Negative { span, .. }
            | Expression::Helper { span, .. }
            | Expression::LegacyHelper { span, .. }
            | Expression::Equ { span, .. }
            | Expression::Neq { span, .. }
            | Expression::And { span, .. }
            | Expression::Or { span, .. } => *span,
        }
    }
}

fn string_literal(input: Span) -> IResult<Span, Expression<Span>> {
    map(
        recognize(delimited(
            tag("\""),
            many0_count(alt((preceded(tag("\\"), take(1_usize)), is_not("\\\"")))),
            tag("\""),
        )),
        Expression::StringLiteral,
    )(input)
}

pub fn keyword(input: Span) -> IResult<Span, Expression<Span>> {
    fn word(input: Span) -> IResult<Span, Span> {
        alpha1(input)
    }

    map_res(consumed(preceded(tag("@"), word)), |(span, ident)| {
        let keyword = match *ident.fragment() {
            "root" => Keyword::Root,
            "key" => Keyword::Key,
            "index" => Keyword::Index,
            "value" => Keyword::Value,
            "first" => Keyword::First,
            "last" => Keyword::Last,
            "true" => Keyword::True,
            "false" => Keyword::False,
            _ => return Err("Invalid keyword"),
        };

        Ok(Expression::Keyword { span, keyword })
    })(input)
}

fn identifier(input: Span) -> IResult<Span, Span> {
    let (rest, res): (Span, Span) =
        recognize(many1_count(alt((alphanumeric1, is_a("_-:@/")))))(input)?;
    // exclude `-->` from being recognized as part of an expression path
    if res.ends_with("--") && rest.starts_with('>') {
        let split = res.len() - 2;
        Ok((input.slice(split..), input.slice(..split)))
    } else {
        Ok((rest, res))
    }
}

fn path(input: Span) -> IResult<Span, Expression<Span>> {
    map(
        consumed(pair(
            many0(map(alt((tag("./"), tag("../"))), PathPart::Part)),
            separated_list1(tag("."), map(identifier, PathPart::Part)),
        )),
        |(span, (mut first, mut second))| {
            first.append(&mut second);
            Expression::Path { span, path: first }
        },
    )(input)
}

fn negative(input: Span) -> IResult<Span, Expression<Span>> {
    map(
        consumed(preceded(ws(tag("!")), expression)),
        |(span, expr)| Expression::Negative {
            span,
            expr: Box::new(expr),
        },
    )(input)
}

fn helper(input: Span) -> IResult<Span, Expression<Span>> {
    map(
        consumed(pair(
            identifier,
            delimited(
                tag("("),
                separated_list0(tag(","), ws(expression)),
                tag(")"),
            ),
        )),
        |(span, (name, args))| Expression::Helper { span, name, args },
    )(input)
}

fn legacy_helper(input: Span) -> IResult<Span, Expression<Span>> {
    map(
        consumed(pair(
            preceded(tag("function."), identifier),
            opt(preceded(
                ws(tag(",")),
                separated_list0(ws(tag(",")), expression),
            )),
        )),
        |(span, (name, args))| Expression::LegacyHelper {
            span,
            name,
            args: args.unwrap_or_else(|| {
                // Handle legacy helpers without args being implicitly passed `@value`
                vec![Expression::Keyword {
                    span: span.slice(span.len()..),
                    keyword: Keyword::Value,
                }]
            }),
        },
    )(input)
}

fn binary<'a, F>(
    op: &'static str,
    f: F,
) -> impl FnMut(Span<'a>) -> IResult<Span<'a>, Expression<Span<'a>>>
where
    F: Fn(Span<'a>, Expression<Span<'a>>, Expression<Span<'a>>) -> Expression<Span<'a>>,
{
    map(
        consumed(tuple((
            tag("("),
            ws(expression),
            tag(op),
            ws(expression),
            tag(")"),
        ))),
        move |(span, (_, lhs, _, rhs, _))| f(span, lhs, rhs),
    )
}

pub fn expression(input: Span) -> IResult<Span, Expression<Span>> {
    // This order is important
    alt((
        negative,
        legacy_helper,
        helper,
        string_literal,
        keyword,
        path,
        binary("==", |span, lhs, rhs| Expression::Equ {
            span,
            lhs: Box::new(lhs),
            rhs: Box::new(rhs),
        }),
        binary("!=", |span, lhs, rhs| Expression::Neq {
            span,
            lhs: Box::new(lhs),
            rhs: Box::new(rhs),
        }),
        binary("&&", |span, lhs, rhs| Expression::And {
            span,
            lhs: Box::new(lhs),
            rhs: Box::new(rhs),
        }),
        binary("||", |span, lhs, rhs| Expression::Or {
            span,
            lhs: Box::new(lhs),
            rhs: Box::new(rhs),
        }),
    ))(input)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::parse::test::{
        assert_eq,
        assert_eq_unspan,
        sp,
    };

    #[test]
    fn test_string_literal() {
        let src = sp(r#""help" "#);
        assert_eq!(
            string_literal(src),
            Ok((src.slice(6..), Expression::StringLiteral(src.slice(..6))))
        );
        let src = sp(r#""he said \"no!\"" "#);
        assert_eq!(
            string_literal(src),
            Ok((src.slice(17..), Expression::StringLiteral(src.slice(..17))))
        );
        let src = sp("\"\\\\ \\ \"");
        assert_eq!(
            string_literal(src),
            Ok((src.slice(7..), Expression::StringLiteral(src.slice(..7))))
        );
    }

    impl<'a> Expression<Span<'a>> {
        pub fn span_to_str(self) -> Expression<&'a str> {
            match self {
                Expression::StringLiteral(span) => Expression::StringLiteral(*span.fragment()),
                Expression::Keyword { span, keyword } => Expression::Keyword {
                    span: *span.fragment(),
                    keyword,
                },
                Expression::Path { span, path } => Expression::Path {
                    span: *span.fragment(),
                    path: path.into_iter().map(|p| p.span_to_str()).collect(),
                },
                Expression::Negative { span, expr } => Expression::Negative {
                    span: *span.fragment(),
                    expr: Box::new(expr.span_to_str()),
                },
                Expression::Helper { span, name, args } => Expression::Helper {
                    span: *span.fragment(),
                    name: *name.fragment(),
                    args: args.into_iter().map(|a| a.span_to_str()).collect(),
                },
                Expression::LegacyHelper { span, name, args } => Expression::LegacyHelper {
                    span: *span.fragment(),
                    name: *name.fragment(),
                    args: args.into_iter().map(|a| a.span_to_str()).collect(),
                },
                Expression::Equ { span, lhs, rhs } => Expression::Equ {
                    span: *span.fragment(),
                    lhs: Box::new(lhs.span_to_str()),
                    rhs: Box::new(rhs.span_to_str()),
                },
                Expression::Neq { span, lhs, rhs } => Expression::Neq {
                    span: *span.fragment(),
                    lhs: Box::new(lhs.span_to_str()),
                    rhs: Box::new(rhs.span_to_str()),
                },
                Expression::And { span, lhs, rhs } => Expression::And {
                    span: *span.fragment(),
                    lhs: Box::new(lhs.span_to_str()),
                    rhs: Box::new(rhs.span_to_str()),
                },
                Expression::Or { span, lhs, rhs } => Expression::Or {
                    span: *span.fragment(),
                    lhs: Box::new(lhs.span_to_str()),
                    rhs: Box::new(rhs.span_to_str()),
                },
            }
        }
    }

    fn span_to_str<'a>(
        res: IResult<Span<'a>, Expression<Span<'a>>>,
    ) -> IResult<&'a str, Expression<&'a str>> {
        match res {
            Ok((rest, expr)) => Ok((*rest.fragment(), expr.span_to_str())),
            Err(err) => Err(
                err.map(|nom::error::Error { input, code }| nom::error::Error {
                    input: *input.fragment(),
                    code,
                }),
            ),
        }
    }

    #[test]
    fn test_path() {
        assert_eq_unspan!(
            path(sp("a.b.c, what")),
            Ok((
                ", what",
                Expression::Path {
                    span: "a.b.c",
                    path: vec![
                        PathPart::Part("a"),
                        PathPart::Part("b"),
                        PathPart::Part("c")
                    ]
                }
            ))
        );

        assert_eq_unspan!(
            path(sp("./../abc.def")),
            Ok((
                "",
                Expression::Path {
                    span: "./../abc.def",
                    path: vec![
                        PathPart::Part("./"),
                        PathPart::Part("../"),
                        PathPart::Part("abc"),
                        PathPart::Part("def")
                    ]
                }
            ))
        );
    }

    #[test]
    fn test_keyword() {
        assert_eq_unspan!(
            keyword(sp("@value.c")),
            Ok((
                ".c",
                Expression::Keyword {
                    span: "@value",
                    keyword: Keyword::Value
                }
            ))
        );
        assert!(keyword(sp("@keyframes")).is_err());
    }

    #[test]
    fn test_negative() {
        assert_eq_unspan!(
            negative(sp("!a ")),
            Ok((
                " ",
                Expression::Negative {
                    span: "!a",
                    expr: Box::new(Expression::Path {
                        span: "a",
                        path: vec![PathPart::Part("a")]
                    })
                }
            ))
        )
    }

    #[test]
    fn test_binary() {
        assert_eq_unspan!(
            expression(sp("(@value == a.b)")),
            Ok((
                "",
                Expression::Equ {
                    span: "(@value == a.b)",
                    lhs: Box::new(Expression::Keyword {
                        span: "@value",
                        keyword: Keyword::Value
                    }),
                    rhs: Box::new(Expression::Path {
                        span: "a.b",
                        path: vec![PathPart::Part("a"), PathPart::Part("b")]
                    })
                }
            ))
        );

        assert_eq_unspan!(
            expression(sp("((@value == a.b) != @true)")),
            Ok((
                "",
                Expression::Neq {
                    span: "((@value == a.b) != @true)",
                    lhs: Box::new(Expression::Equ {
                        span: "(@value == a.b)",
                        lhs: Box::new(Expression::Keyword {
                            span: "@value",
                            keyword: Keyword::Value
                        }),
                        rhs: Box::new(Expression::Path {
                            span: "a.b",
                            path: vec![PathPart::Part("a"), PathPart::Part("b")]
                        })
                    }),
                    rhs: Box::new(Expression::Keyword {
                        span: "@true",
                        keyword: Keyword::True
                    })
                }
            ))
        );
    }

    #[test]
    fn test_helper() {
        assert_eq_unspan!(
            helper(sp("foo(bar, a.b , k) ")),
            Ok((
                " ",
                Expression::Helper {
                    span: "foo(bar, a.b , k)",
                    name: "foo",
                    args: vec![
                        Expression::Path {
                            span: "bar",
                            path: vec![PathPart::Part("bar")]
                        },
                        Expression::Path {
                            span: "a.b",
                            path: vec![PathPart::Part("a"), PathPart::Part("b")]
                        },
                        Expression::Path {
                            span: "k",
                            path: vec![PathPart::Part("k")]
                        }
                    ]
                }
            ))
        )
    }

    #[test]
    fn test_legacy_helper() {
        assert_eq_unspan!(
            legacy_helper(sp("function.foo, bar, a.b, k hf s sgfd")),
            Ok((
                " hf s sgfd",
                Expression::LegacyHelper {
                    span: "function.foo, bar, a.b, k",
                    name: "foo",
                    args: vec![
                        Expression::Path {
                            span: "bar",
                            path: vec![PathPart::Part("bar")]
                        },
                        Expression::Path {
                            span: "a.b",
                            path: vec![PathPart::Part("a"), PathPart::Part("b")]
                        },
                        Expression::Path {
                            span: "k",
                            path: vec![PathPart::Part("k")]
                        }
                    ]
                }
            ))
        );

        assert_eq_unspan!(
            legacy_helper(sp("function.foo")),
            Ok((
                "",
                Expression::LegacyHelper {
                    span: "function.foo",
                    name: "foo",
                    args: vec![Expression::Keyword {
                        span: "",
                        keyword: Keyword::Value
                    }]
                }
            ))
        );
    }

    #[test]
    fn test_expression() {
        assert_eq_unspan!(
            expression(sp("foo(bar, a.b, function.bar, \"boom\")")),
            Ok((
                "",
                Expression::Helper {
                    span: "foo(bar, a.b, function.bar, \"boom\")",
                    name: "foo",
                    args: vec![
                        Expression::Path {
                            span: "bar",
                            path: vec![PathPart::Part("bar")]
                        },
                        Expression::Path {
                            span: "a.b",
                            path: vec![PathPart::Part("a"), PathPart::Part("b")]
                        },
                        Expression::LegacyHelper {
                            span: "function.bar, \"boom\"",
                            name: "bar",
                            args: vec![Expression::StringLiteral("\"boom\"")]
                        }
                    ]
                }
            ))
        );

        assert_eq_unspan!(
            expression(sp("!foo(bar, a.b)")),
            Ok((
                "",
                Expression::Negative {
                    span: "!foo(bar, a.b)",
                    expr: Box::new(Expression::Helper {
                        span: "foo(bar, a.b)",
                        name: "foo",
                        args: vec![
                            Expression::Path {
                                span: "bar",
                                path: vec![PathPart::Part("bar")]
                            },
                            Expression::Path {
                                span: "a.b",
                                path: vec![PathPart::Part("a"), PathPart::Part("b")]
                            },
                        ]
                    })
                }
            ))
        );
    }
}
