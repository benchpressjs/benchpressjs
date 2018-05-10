use parser::Control;
use templates;

use json;

use std::collections::HashSet;

pub fn gen_body(entry: Vec<Control>, top: bool, mut block_names: HashSet<String>) -> (String, Vec<String>) {
    if entry.len() == 0 {
        return (String::from("\"\""), Vec::new())
    }

    let mut blocks: Vec<String> = Vec::new();

    let output = entry.into_iter().map(|elem| match elem {
        Control::Text { source } => {
            json::stringify(json::from(source))
        },
        Control::If { neg, test, body, alt } => {
            let (b, mut b_blocks) = gen_body(body, top, block_names.clone());
            let (a, mut a_blocks) = gen_body(alt, top, block_names.clone());

            blocks.append(&mut b_blocks);
            blocks.append(&mut a_blocks);

            templates::if_else(
                neg,
                templates::expression(test),
                b,
                a
            )
        },
        Control::Iter { subject_raw, suffix, subject, body, alt } => {
            if top && !block_names.contains(&subject_raw) {
                block_names.insert(subject_raw.clone());
            }

            let block = templates::iter(
                suffix,
                templates::expression(subject),
                gen_body(body, false, HashSet::new()).0,
                gen_body(alt, false, HashSet::new()).0
            );

            if top && !block_names.contains(&subject_raw) {
                blocks.push(templates::block(subject_raw.clone(), block));
                templates::block_call(subject_raw)
            } else {
                block
            }
        },
        Control::Escaped { subject } => {
            format!("{}({})", templates::ESCAPE, templates::expression(subject))
        },
        Control::Raw { subject } => templates::expression(subject),
    }).filter(|x| x.len() > 0).collect::<Vec<String>>();

    (templates::concat(output), blocks)
}

pub fn generate(input: Vec<Control>) -> String {
    let (body, blocks) = gen_body(input, true, HashSet::new());

    templates::wrapper(body, blocks)
}
