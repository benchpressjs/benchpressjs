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
    character::complete::alphanumeric1,
    combinator::{
        consumed,
        map,
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
    },
    IResult,
    Slice,
};

#[derive(Debug, PartialEq, Eq, Hash, Clone)]
pub enum Expression<'a> {
    // "this \"works\" as you'd expect"
    StringLiteral(Span<'a>),
    // a.b.c.d
    Path(PathBuf<'a>),
    // !expr
    Negative {
        span: Span<'a>,
        expr: Box<Expression<'a>>,
    },
    // name(arg0, arg1, arg2, ...)
    Helper {
        span: Span<'a>,
        name: Span<'a>,
        args: Vec<Expression<'a>>,
    },
    // function.name, arg0, arg1, arg2, ...
    LegacyHelper {
        span: Span<'a>,
        name: Span<'a>,
        args: Vec<Expression<'a>>,
    },
}

fn string_literal(input: Span) -> IResult<Span, Expression<'_>> {
    map(
        recognize(delimited(
            tag("\""),
            many0_count(alt((preceded(tag("\\"), take(1_usize)), is_not("\\\"")))),
            tag("\""),
        )),
        Expression::StringLiteral,
    )(input)
}

fn identifier(input: Span) -> IResult<Span, Span> {
    let (rest, res): (Span, Span) =
        recognize(many1_count(alt((alphanumeric1, is_a("_-:@")))))(input)?;
    // exclude `-->` from being recognized as part of an expression path
    if res.ends_with("--") && rest.starts_with('>') {
        let split = res.len() - 2;
        Ok((input.slice(split..), input.slice(..split)))
    } else {
        Ok((rest, res))
    }
}

fn path(input: Span) -> IResult<Span, Expression<'_>> {
    alt((
        map(
            alt((
                tag("@root"),
                tag("@key"),
                tag("@index"),
                tag("@value"),
                tag("@first"),
                tag("@last"),
            )),
            |s: Span| Expression::Path(vec![PathPart::Part(s)]),
        ),
        map(
            pair(
                many0(map(alt((tag("./"), tag("../"))), PathPart::Part)),
                separated_list1(tag("."), map(identifier, PathPart::Part)),
            ),
            |(mut first, mut second)| {
                first.append(&mut second);
                Expression::Path(first)
            },
        ),
    ))(input)
}

fn negative(input: Span) -> IResult<Span, Expression<'_>> {
    map(
        consumed(preceded(ws(tag("!")), expression)),
        |(span, expr)| Expression::Negative {
            span,
            expr: Box::new(expr),
        },
    )(input)
}

fn helper(input: Span) -> IResult<Span, Expression<'_>> {
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

fn legacy_helper(input: Span) -> IResult<Span, Expression<'_>> {
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
                vec![Expression::Path(vec![PathPart::Part(Span::new_extra(
                    "@value",
                    input.extra,
                ))])]
            }),
        },
    )(input)
}

pub fn expression(input: Span) -> IResult<Span, Expression<'_>> {
    // This order is important
    alt((negative, legacy_helper, helper, string_literal, path))(input)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::parse::test::sp;
    use pretty_assertions::assert_eq;

    #[test]
    fn test_string_literal() {
        let src = Span::new_extra(r#""help" "#, Default::default());
        assert_eq!(
            string_literal(src),
            Ok((src.slice(6..), Expression::StringLiteral(src.slice(..6))))
        );
        let src = Span::new_extra(r#""he said \"no!\"" "#, Default::default());
        assert_eq!(
            string_literal(src),
            Ok((src.slice(17..), Expression::StringLiteral(src.slice(..17))))
        );
        let src = Span::new_extra("\"\\\\ \\ \"", Default::default());
        assert_eq!(
            string_literal(src),
            Ok((src.slice(7..), Expression::StringLiteral(src.slice(..7))))
        );
    }

    #[test]
    fn test_path() {
        assert_eq!(
            path(sp("a.b.c, what")),
            Ok((
                sp(", what"),
                Expression::Path(vec![
                    PathPart::Part(sp("a")),
                    PathPart::Part(sp("b")),
                    PathPart::Part(sp("c"))
                ])
            ))
        );

        assert_eq!(
            path(sp("@value.c")),
            Ok((
                sp(".c"),
                Expression::Path(vec![PathPart::Part(sp("@value"))])
            ))
        );

        assert_eq!(
            path(sp("./../abc.def")),
            Ok((
                sp(""),
                Expression::Path(vec![
                    PathPart::Part(sp("./")),
                    PathPart::Part(sp("../")),
                    PathPart::Part(sp("abc")),
                    PathPart::Part(sp("def"))
                ])
            ))
        );
    }

    #[test]
    fn test_negative() {
        assert_eq!(
            negative(sp("!a ")),
            Ok((
                sp(" "),
                Expression::Negative {
                    span: sp("!a"),
                    expr: Box::new(Expression::Path(vec![PathPart::Part(sp("a"))]))
                }
            ))
        )
    }

    #[test]
    fn test_helper() {
        assert_eq!(
            helper(sp("foo(bar, a.b , k) ")),
            Ok((
                sp(" "),
                Expression::Helper {
                    span: sp("foo(bar, a.b , k)"),
                    name: sp("foo"),
                    args: vec![
                        Expression::Path(vec![PathPart::Part(sp("bar"))]),
                        Expression::Path(vec![PathPart::Part(sp("a")), PathPart::Part(sp("b"))]),
                        Expression::Path(vec![PathPart::Part(sp("k"))])
                    ]
                }
            ))
        )
    }

    #[test]
    fn test_legacy_helper() {
        assert_eq!(
            legacy_helper(sp("function.foo, bar, a.b, k hf s sgfd")),
            Ok((
                sp(" hf s sgfd"),
                Expression::LegacyHelper {
                    span: sp("function.foo, bar, a.b, k"),
                    name: sp("foo"),
                    args: vec![
                        Expression::Path(vec![PathPart::Part(sp("bar"))]),
                        Expression::Path(vec![PathPart::Part(sp("a")), PathPart::Part(sp("b"))]),
                        Expression::Path(vec![PathPart::Part(sp("k"))])
                    ]
                }
            ))
        );

        assert_eq!(
            legacy_helper(sp("function.foo")),
            Ok((
                sp(""),
                Expression::LegacyHelper {
                    span: sp("function.foo"),
                    name: sp("foo"),
                    args: vec![Expression::Path(vec![PathPart::Part(sp("@value"))])]
                }
            ))
        );
    }

    #[test]
    fn test_expression() {
        assert_eq!(
            expression(sp("foo(bar, a.b, function.bar, \"boom\")")),
            Ok((
                sp(""),
                Expression::Helper {
                    span: sp("foo(bar, a.b, function.bar, \"boom\")"),
                    name: sp("foo"),
                    args: vec![
                        Expression::Path(vec![PathPart::Part(sp("bar"))]),
                        Expression::Path(vec![PathPart::Part(sp("a")), PathPart::Part(sp("b"))]),
                        Expression::LegacyHelper {
                            span: sp("function.bar, \"boom\""),
                            name: sp("bar"),
                            args: vec![Expression::StringLiteral(sp("\"boom\""))]
                        }
                    ]
                }
            ))
        );

        assert_eq!(
            expression(sp("!foo(bar, a.b)")),
            Ok((
                sp(""),
                Expression::Negative {
                    span: sp("!foo(bar, a.b)"),
                    expr: Box::new(Expression::Helper {
                        span: sp("foo(bar, a.b)"),
                        name: sp("foo"),
                        args: vec![
                            Expression::Path(vec![PathPart::Part(sp("bar"))]),
                            Expression::Path(vec![
                                PathPart::Part(sp("a")),
                                PathPart::Part(sp("b"))
                            ]),
                        ]
                    })
                }
            ))
        );
    }
}
