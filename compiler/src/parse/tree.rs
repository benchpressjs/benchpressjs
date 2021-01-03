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
        Span,
        SpanExt,
    },
};
use std::collections::HashSet;

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum Instruction<S> {
    // Template text passed through
    Text(S),
    // `{obj.prop}`
    InterpEscaped(Expression<S>),
    // `{{obj.prop}}`
    InterpRaw(Expression<S>),
    If {
        subject: Expression<S>,
        body: Vec<Instruction<S>>,
        alt: Vec<Instruction<S>>,
    },
    Iter {
        depth: u32,
        subject: Expression<S>,
        body: Vec<Instruction<S>>,
        alt: Vec<Instruction<S>>,
    },
}

/// in a case where there are extra End tokens
/// try to match them to Ifs or Iters
/// and remove the extra ones
#[rustfmt::skip::macros(warn)]
pub fn fix_extra_tokens<'a>(input: Vec<Token<Span<'a>>>) -> Vec<Token<Span<'a>>> {
    let mut remove: HashSet<Token<Span<'a>>> = HashSet::new();
    let mut expected_subjects: Vec<&str> = Vec::new();

    let mut starts_count: u16 = 0;
    let mut ends_count: u16 = 0;

    // try to find a Close with no corresponding Open
    for index in 0..input.len() {
        let elem = &input[index];

        match elem {
            // for an Open, add the subject to the stack of expected subjects
            Token::LegacyIf { subject, .. }
            | Token::LegacyBegin { subject, .. }
            | Token::If { subject, .. }
            | Token::Each { subject, .. } => {
                let subject_raw = *subject.span().fragment();

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

        let output: Vec<Token<Span>> = input
            .into_iter()
            .map(|tok| {
                if diff > 0 && remove.contains(&tok) {
                    let span = tok.span();
                    let (line, column, padding) = span.get_line_column_padding();
                    warn!("     --> {}:{}:{}",
                        span.extra.filename, span.location_line(), column);
                    warn!("      |");
                    warn!("{:>5} | {}", span.location_line(), line);
                    warn!("      | {}{} help: remove the token or make it an unambiguous comment",
                        padding, "^".repeat(span.len()));

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

fn resolve_expression_paths<'a, 'b>(
    base: Path<'b, Span<'a>>,
    expr: Expression<Span<'a>>,
) -> Expression<Span<'a>> {
    match expr {
        s @ Expression::StringLiteral(_) => s,
        k @ Expression::Keyword { .. } => k,
        Expression::Path { span, path } => Expression::Path {
            span,
            path: resolve(base, path),
        },
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
        Expression::Equ { span, lhs, rhs } => Expression::Equ {
            span,
            lhs: Box::new(resolve_expression_paths(base, *lhs)),
            rhs: Box::new(resolve_expression_paths(base, *rhs)),
        },
        Expression::Neq { span, lhs, rhs } => Expression::Neq {
            span,
            lhs: Box::new(resolve_expression_paths(base, *lhs)),
            rhs: Box::new(resolve_expression_paths(base, *rhs)),
        },
        Expression::And { span, lhs, rhs } => Expression::And {
            span,
            lhs: Box::new(resolve_expression_paths(base, *lhs)),
            rhs: Box::new(resolve_expression_paths(base, *rhs)),
        },
        Expression::Or { span, lhs, rhs } => Expression::Or {
            span,
            lhs: Box::new(resolve_expression_paths(base, *lhs)),
            rhs: Box::new(resolve_expression_paths(base, *rhs)),
        },
    }
}

#[derive(Debug)]
pub struct TreeError;

#[rustfmt::skip::macros(warn)]
pub fn tree<'a, 'b, I>(
    depth: u32,
    base: Path<'b, Span<'a>>,
    input: &mut I,
    output: &mut Vec<Instruction<Span<'a>>>,
) -> Result<Option<Token<Span<'a>>>, TreeError>
where
    I: Iterator<Item = Token<Span<'a>>> + Clone,
{
    let mixed_warning = |open_token: &str, open_span: Span, close: Token<Span>| {
        let (open_syntax, close_syntax, close_token, close_span) = match close {
            Token::LegacyElse { span, .. } => ("modern", "legacy", "ELSE", span),
            Token::LegacyEnd { span, .. } => (
                "modern",
                "legacy",
                if span.contains("ENDIF") {
                    "ENDIF"
                } else {
                    "END"
                },
                span,
            ),
            Token::Else { span, .. } => ("legacy", "modern", "else", span),
            Token::End { span, .. } => ("legacy", "modern", "end", span),
            _ => unreachable!(),
        };

        let (open_line, open_column, open_padding) = open_span.get_line_column_padding();
        let (close_line, close_column, close_padding) = close_span.get_line_column_padding();
        warn!("[benchpress] warning: mixing token types is deprecated");
        warn!("     --> {}:{}:{}",
            open_span.extra.filename, open_span.location_line(), open_column);
        warn!("      |");
        warn!("{:>5} | {}", open_span.location_line(), open_line);
        warn!("      | {}{} `{}` started with {} syntax",
            open_padding, "^".repeat(open_span.len()),
            open_token, open_syntax);
        warn!("     ::: {}:{}:{}",
            open_span.extra.filename, close_span.location_line(), close_column);
        warn!("      |");
        warn!("{:>5} | {}", close_span.location_line(), close_line);
        warn!("      | {}{} but {} syntax used for `{}`",
            close_padding, "^".repeat(close_span.len()), close_syntax, close_token);
        warn!("      | note: Migrate all to modern syntax. This will become an error in v3.0.0\n");
    };

    let missing_warning = |open_span: Span, closer: &str| {
        let (open_line, open_column, open_padding) = open_span.get_line_column_padding();
        warn!("[benchpress] warning: block not terminated");
        warn!("     --> {}:{}:{}",
            open_span.extra.filename, open_span.location_line(), open_column);
        warn!("      |");
        warn!("{:>5} | {}", open_span.location_line(), open_line);
        warn!("      | {}{} block started here, but was not terminated before EOF",
            open_padding, "^".repeat(open_span.len()));
        warn!("      | note: Add an `{}` to terminate the block. This will become an error in v3.0.0\n",
            closer);
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
                            None => missing_warning(span, "{{{ end }}}"),
                            _ => return Err(TreeError),
                        }
                    }
                    Some(Token::End { .. }) => {}
                    Some(end @ Token::LegacyEnd { .. }) => mixed_warning("if", span, end),
                    None => missing_warning(span, "{{{ end }}}"),
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
            } => {
                let mut body = vec![];
                let mut alt = vec![];

                let subject = resolve_expression_paths(base, subject);
                let base: PathBuf<Span> = if let Expression::Path { path: base, .. } = &subject {
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
                            None => missing_warning(span, "{{{ end }}}"),
                            _ => return Err(TreeError),
                        }
                    }
                    Some(Token::End { .. }) => {}
                    Some(end @ Token::LegacyEnd { .. }) => mixed_warning("each", span, end),
                    None => missing_warning(span, "{{{ end }}}"),
                    _ => return Err(TreeError),
                }

                Instruction::Iter {
                    depth,
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
                            None => missing_warning(span, "<!-- END -->"),
                            _ => return Err(TreeError),
                        }
                    }
                    Some(Token::LegacyEnd { .. }) => {}
                    Some(end @ Token::End { .. }) => mixed_warning("IF", span, end),
                    None => missing_warning(span, "<!-- END -->"),
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
            } => {
                let normal = |input: &mut I, subject| {
                    let mut body = vec![];
                    let mut alt = vec![];

                    let subject = resolve_expression_paths(base, subject);
                    let base: PathBuf<Span> = if let Expression::Path { path: base, .. } = &subject {
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
                                None => missing_warning(span, "<!-- END -->"),
                                _ => return Err(TreeError),
                            }
                        }
                        Some(Token::LegacyEnd { .. }) => {}
                        Some(end @ Token::End { .. }) => mixed_warning("BEGIN", span, end),
                        None => missing_warning(span, "<!-- END -->"),
                        _ => return Err(TreeError),
                    }

                    Ok(Instruction::Iter {
                        depth,
                        subject,
                        body,
                        alt,
                    })
                };

                // Handle legacy `<!-- BEGIN stuff -->` working for top-level `stuff` and implicitly `./stuff`
                match &subject {
                    Expression::Path { path, span }
                        if depth > 0 && path.first().map_or(false, |s| {
                            // Not a relative path or keyword
                            !s.inner().starts_with(&['.', '@'] as &[char])
                        }) =>
                    {
                        let (line, column, padding) = span.get_line_column_padding();
                        warn!("[benchpress] warning: output bloat due to ambiguous inner BEGIN");
                        warn!("     --> {}:{}:{}",
                            span.extra.filename, span.location_line(), column);
                        warn!("      |");
                        warn!("{:>5} | {}",
                            span.location_line(), line);
                        warn!("      | {}{} `{subject}` could refer to the top-level value `{subject}` or the `.{subject}` property of the current element, so compiler must emit code for both cases",
                            padding, "^".repeat(span.len()), subject = subject.span());
                        warn!("      | note: Migrate to modern syntax to avoid the ambiguity. This will become an error in the future.\n");

                        // Path is absolute, so create a branch for both `./subject` and `subject`
                        let mut relative_path =
                            vec![PathPart::Part(Span::new_extra("./", span.extra))];
                        relative_path.extend_from_slice(path);
                        let relative_subject = Expression::Path { path: relative_path, span: *span };

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
        test::{
            assert_eq_unspan,
            sp,
        },
    };

    impl<'a> Instruction<Span<'a>> {
        pub fn span_to_str(self) -> Instruction<&'a str> {
            match self {
                Instruction::Text(span) => Instruction::Text(*span.fragment()),
                Instruction::InterpEscaped(expr) => Instruction::InterpEscaped(expr.span_to_str()),
                Instruction::InterpRaw(expr) => Instruction::InterpRaw(expr.span_to_str()),
                Instruction::If { subject, body, alt } => Instruction::If {
                    subject: subject.span_to_str(),
                    body: body.into_iter().map(|i| i.span_to_str()).collect(),
                    alt: alt.into_iter().map(|i| i.span_to_str()).collect(),
                },
                Instruction::Iter {
                    depth,
                    subject,
                    body,
                    alt,
                } => Instruction::Iter {
                    depth,
                    subject: subject.span_to_str(),
                    body: body.into_iter().map(|i| i.span_to_str()).collect(),
                    alt: alt.into_iter().map(|i| i.span_to_str()).collect(),
                },
            }
        }
    }

    #[test]
    fn test_fix_extra_tokens() {
        fn span_to_str<'a>(tokens: Vec<Token<Span<'a>>>) -> Vec<Token<&'a str>> {
            tokens.into_iter().map(|t| t.span_to_str()).collect()
        }

        let program = "{{{ each abc }}} for each thing <!-- END foo -->{{{ end }}}";
        let source = sp(program);
        let (_, tokens) = crate::parse::tokens::tokens(source).unwrap();

        assert_eq_unspan!(
            fix_extra_tokens(tokens),
            vec![
                Token::Each {
                    span: "{{{ each abc }}}",
                    subject: Expression::Path {
                        span: "abc",
                        path: vec![PathPart::Part("abc")]
                    }
                },
                Token::Text(" for each thing "),
                Token::Text("<!-- END foo -->"),
                Token::End {
                    span: "{{{ end }}}"
                },
            ]
        );
    }

    fn span_to_str<'a>(tree: Vec<Instruction<Span<'a>>>) -> Vec<Instruction<&'a str>> {
        tree.into_iter().map(|i| i.span_to_str()).collect()
    }

    #[test]
    fn test_tree() {
        let mut input = vec![
            Token::Each {
                span: sp("{{{ each abc }}}"),
                subject: Expression::Path {
                    span: sp("abc"),
                    path: vec![PathPart::Part(sp("abc"))],
                },
            },
            Token::Text(sp(" for each thing ")),
            Token::End {
                span: sp("{{{ end }}}"),
            },
        ]
        .into_iter();

        let mut output = vec![];

        assert!(tree(0, &[], &mut input, &mut output).is_ok());

        assert_eq_unspan!(
            output,
            vec![Instruction::Iter {
                depth: 0,
                subject: Expression::Path {
                    span: "abc",
                    path: vec![PathPart::Part("abc")]
                },
                body: vec![Instruction::Text(" for each thing "),],
                alt: vec![],
            }]
        );
    }

    #[test]
    fn test_tree_deep() {
        let mut input = vec![
            Token::Each {
                span: sp("{{{ each abc }}}"),
                subject: Expression::Path {
                    span: sp("abc"),
                    path: vec![PathPart::Part(sp("abc"))],
                },
            },
            Token::Text(sp(" before inner ")),
            Token::Each {
                span: sp("{{{ each ./inner }}}"),
                subject: Expression::Path {
                    span: sp("./inner"),
                    path: vec![PathPart::Part(sp("./")), PathPart::Part(sp("inner"))],
                },
            },
            Token::InterpEscaped {
                span: sp("{abc.inner.prop}"),
                expr: Expression::Path {
                    span: sp("abc.inner.prop"),
                    path: vec![
                        PathPart::Part(sp("abc")),
                        PathPart::Part(sp("inner")),
                        PathPart::Part(sp("prop")),
                    ],
                },
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

        assert_eq_unspan!(
            output,
            vec![Instruction::Iter {
                depth: 0,
                subject: Expression::Path {
                    span: "abc",
                    path: vec![PathPart::Part("abc")]
                },
                body: vec![
                    Instruction::Text(" before inner "),
                    Instruction::Iter {
                        depth: 1,
                        subject: Expression::Path {
                            span: "./inner",
                            path: vec![PathPart::PartDepth("abc", 0), PathPart::Part("inner")]
                        },
                        body: vec![Instruction::InterpEscaped(Expression::Path {
                            span: "abc.inner.prop",
                            path: vec![
                                PathPart::PartDepth("abc", 0),
                                PathPart::PartDepth("inner", 1),
                                PathPart::Part("prop")
                            ]
                        })],
                        alt: vec![]
                    },
                    Instruction::Text(" after inner "),
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
                subject: Expression::Path {
                    span: sp("abc"),
                    path: vec![PathPart::Part(sp("abc"))],
                },
            },
            Token::Text(sp(" before inner ")),
            Token::LegacyBegin {
                span: sp("<!-- BEGIN inner -->"),
                subject: Expression::Path {
                    span: sp("inner"),
                    path: vec![PathPart::Part(sp("inner"))],
                },
            },
            Token::InterpEscaped {
                span: sp("{abc.inner.prop}"),
                expr: Expression::Path {
                    span: sp("abc.inner.prop"),
                    path: vec![
                        PathPart::Part(sp("abc")),
                        PathPart::Part(sp("inner")),
                        PathPart::Part(sp("prop")),
                    ],
                },
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

        assert_eq_unspan!(
            output,
            vec![Instruction::Iter {
                depth: 0,
                subject: Expression::Path {
                    span: "abc",
                    path: vec![PathPart::Part("abc")]
                },
                body: vec![
                    Instruction::Text(" before inner "),
                    Instruction::If {
                        subject: Expression::Path {
                            span: "inner",
                            path: vec![PathPart::PartDepth("abc", 0), PathPart::Part("inner")]
                        },
                        body: vec![Instruction::Iter {
                            depth: 1,
                            subject: Expression::Path {
                                span: "inner",
                                path: vec![PathPart::PartDepth("abc", 0), PathPart::Part("inner")]
                            },
                            body: vec![Instruction::InterpEscaped(Expression::Path {
                                span: "abc.inner.prop",
                                path: vec![
                                    PathPart::PartDepth("abc", 0),
                                    PathPart::PartDepth("inner", 1),
                                    PathPart::Part("prop")
                                ]
                            })],
                            alt: vec![]
                        }],
                        alt: vec![Instruction::Iter {
                            depth: 1,
                            subject: Expression::Path {
                                span: "inner",
                                path: vec![PathPart::Part("inner")]
                            },
                            body: vec![Instruction::InterpEscaped(Expression::Path {
                                span: "abc.inner.prop",
                                path: vec![
                                    PathPart::Part("abc"),
                                    PathPart::Part("inner"),
                                    PathPart::Part("prop")
                                ]
                            })],
                            alt: vec![],
                        }]
                    },
                    Instruction::Text(" after inner "),
                ],
                alt: vec![],
            }]
        );
    }
}
