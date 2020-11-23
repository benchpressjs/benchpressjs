use crate::{
    generate::templates,
    parse::{
        expression::Expression,
        tree::Instruction,
        Span,
    },
};

use std::collections::HashSet;

/// generate code for a body
/// recursively applied to If and Iter children
fn gen_body<'a, 'b>(
    entry: Vec<Instruction<Span<'a>>>,
    top: bool,
    mut block_names: &'b mut HashSet<&'a str>,
) -> (String, Vec<String>) {
    if entry.is_empty() {
        return ("\"\"".to_string(), Vec::new());
    }

    let mut blocks: Vec<String> = Vec::new();

    let output = entry
        .into_iter()
        .map(|elem| match elem {
            // output a string literal in JS
            Instruction::Text(value) => json::stringify(json::from(*value.fragment())),
            // output a ternary in JS
            Instruction::If { subject, body, alt } => {
                let (b, mut b_blocks) = gen_body(body, top, &mut block_names);
                let (a, mut a_blocks) = gen_body(alt, top, &mut block_names);

                blocks.append(&mut b_blocks);
                blocks.append(&mut a_blocks);

                // if an "if not" reverse the ternary
                let (expr, neg) = if let Expression::Negative { expr, .. } = subject {
                    (*expr, true)
                } else {
                    (subject, false)
                };

                templates::if_else(neg, &templates::expression(expr), &b, &a)
            }
            // output a call to `iter` in JS
            Instruction::Iter {
                depth,
                subject,
                body,
                alt,
            } => {
                let subject_raw = *subject.span().fragment();

                let block = templates::iter(
                    depth,
                    &templates::expression(subject),
                    &gen_body(body, false, &mut HashSet::new()).0,
                    &gen_body(alt, false, &mut HashSet::new()).0,
                );

                // if top level, pull out into a block method
                if top && !block_names.contains(subject_raw) {
                    let out = templates::block_call(subject_raw);
                    blocks.push(templates::block(subject_raw, &block));
                    block_names.insert(subject_raw);

                    out
                } else {
                    block
                }
            }
            // generate an escape call and guard expression
            Instruction::InterpEscaped(subject) => {
                format!("{}({})", templates::ESCAPE, templates::expression(subject))
            }
            // generate a guard expression
            Instruction::InterpRaw(subject) => templates::expression(subject).into(),
        })
        .filter(|x| !x.is_empty())
        .collect::<Vec<String>>();

    (templates::concat(&output), blocks)
}

/// generate code from parser output
pub fn generate(input: Vec<Instruction<Span>>) -> String {
    let (body, blocks) = gen_body(input, true, &mut HashSet::new());

    templates::wrapper(&body, &blocks)
}
