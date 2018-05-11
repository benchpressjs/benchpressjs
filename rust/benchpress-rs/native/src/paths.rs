pub fn iter_element(base: Vec<String>, suffix: u16) -> Vec<String> {
    let mut new_path = base.clone();
    let last_s = match new_path.pop() {
        Some(last) => last.to_string(),
        None => String::new(),
    };
    let last: &str = last_s.as_ref();

    new_path.push(String::from(format!("{}[{}]", last, suffix)));

    new_path
}

pub fn relative(base_path: Vec<String>, rel: Vec<String>) -> Vec<String> {
    let mut base = base_path.clone();

    if base.len() == 0 {
        let mut output = rel.clone();
        output.retain(|f| !f.ends_with("./"));
        output
    } else {
        let mut iter = rel.into_iter().peekable();

        match iter.peek().unwrap().as_ref() {
            "../" | "./" => {
                iter.next();
            },
            _ => (),
        }

        while let Some(part) = iter.next() {
            match part.as_ref() {
                "../" => {
                    base.pop();
                },
                _ => {
                    base.push(part);
                },
            }
        }

        base
    }
}

pub fn split(rel: String) -> Vec<String> {
    let mut iter = rel.chars();
    let mut prev = String::new();

    let mut output: Vec<String> = Vec::new();

    while let Some(cur) = iter.next() {
        match (prev.as_ref(), cur) {
            (".", '.') => {
                prev.push(cur);
            },
            (".", '/') | ("..", '/') => {
                prev.push(cur);
                output.push(prev);
                prev = String::new();
            },
            (_, '.') => {
                if prev.len() > 0 {
                    output.push(prev);
                }
                prev = String::new();
                prev.push(cur);
            },
            (".", _) => {
                prev = String::new();
                prev.push(cur);
            },
            _ => prev.push(cur),
        }
    }

    output.push(prev);

    output
}

/// Resolve a full path from base path and relative path
pub fn resolve(base: Vec<String>, rel: Vec<String>) -> Vec<String> {
    if let Some(b_part) = rel.clone().get(0) {
        if b_part.to_string().ends_with("./") {
            return relative(base, rel);
        }

        if b_part.as_str() == "@value" {
            return base;
        }
    }

    // otherwise we have to figure out if this is something like
    // BEGIN a.b.c
    // `- {a.b.c.d}
    // or if it's an absolute path
    let mut found = false;
    let mut rel_start = 0;
    let mut base_len = 0;

    for l in (1..(rel.len() + 1)).rev() {
        // slide through array from end to start until a match is found
        if base.len() < l {
            continue;
        }

        for j in (0..(base.len() - l + 1)).rev() {
            // check every element from (j) to (j + l) for equality
            // if not equal, break right away
            for i in 0..l {
                let b_part = &base[j + i];

                let b_part_fixed = if b_part.ends_with("]") {
                    match b_part.get(0..b_part.len() - 3) {
                        Some(fixed) => fixed.to_string(),
                        None => String::new(),
                    }
                } else { b_part.clone() };

                let r_part = rel[i].clone();

                if b_part_fixed == r_part {
                    found = true;

                    if i == l - 1 {
                        rel_start = l;
                        base_len = j + l;
                    }
                } else {
                    found = false;
                    break;
                }
            }

            if found {
                break;
            }
        }

        if found {
            break;
        }
    }

    if found {
        let mut output: Vec<String> = base[0..base_len].to_vec();
        output.append(&mut rel.clone()[rel_start..].to_vec());

        output
    } else {
        // assume its an absolute path
        rel
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_test() {
        assert_eq!(
            split("../../thing".to_string()), 
            vec!["../".to_string(), "../".to_string(), "thing".to_string()]
        );
    }

    #[test]
    fn rel_test() {
        assert_eq!(
            relative(vec![], vec!["../".to_string(), "../".to_string(), "thing".to_string()]),
            vec!["thing".to_string()]
        );
    }
}
