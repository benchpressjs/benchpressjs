/// append the iterator suffix
pub fn iter_element(base: &[String], suffix: u16) -> Vec<String> {
    let mut new_path = base.to_vec();
    let last = match new_path.pop() {
        Some(last) => last,
        None => String::new(),
    };

    new_path.push(format!("{}[{}]", last, suffix));

    new_path
}

/// resolve a relative path against a given base path
pub fn relative(base: &[String], rel: &[String]) -> Vec<String> {
    if base.is_empty() {
        let mut output = rel.to_vec();
        output.retain(|f| !f.ends_with("./"));

        output
    } else {
        let mut output = base.to_vec();
        let mut iter = rel.iter().peekable();

        match iter.peek().unwrap().as_str() {
            "../" | "./" => {
                iter.next();
            }
            _ => (),
        }

        for part in iter {
            match part.as_str() {
                "../" => {
                    output.pop();
                }
                _ => {
                    output.push(part.to_string());
                }
            }
        }

        output
    }
}

/// split a path string into a vector
pub fn split(rel: &str) -> Vec<String> {
    let mut prev = String::new();

    let mut output: Vec<String> = Vec::new();

    for cur in rel.chars() {
        match (prev.as_str(), cur) {
            (".", '.') => {
                prev.push(cur);
            }
            (".", '/') | ("..", '/') => {
                prev.push(cur);
                output.push(prev);
                prev = String::new();
            }
            (_, '.') => {
                if !prev.is_empty() {
                    output.push(prev);
                }
                prev = String::new();
                prev.push(cur);
            }
            (".", _) => {
                prev = String::new();
                prev.push(cur);
            }
            _ => prev.push(cur),
        }
    }

    output.push(prev);

    output
}

/// Resolve a full path from base path and relative path
pub fn resolve(base: &[String], rel: &[String]) -> Vec<String> {
    if let Some(true) = rel.get(0).map(|part| part.ends_with("./")) {
        return relative(base, rel);
    }

    // otherwise we have to figure out if this is something like
    // BEGIN a.b.c
    // `- {a.b.c.d}
    // or if it's an absolute path
    let mut found = false;
    let mut rel_start = 0;
    let mut base_end = 0;

    for l in (1..=rel.len()).rev() {
        // slide through array from end to start until a match is found
        if base.len() < l {
            continue;
        }

        for j in (0..=base.len() - l).rev() {
            // check every element from (j) to (j + l) for equality
            // if not equal, break right away
            for i in 0..l {
                let b_part = &base[j + i];

                let b_part_fixed = if b_part.ends_with(']') {
                    match b_part.get(0..b_part.len() - 3) {
                        Some(fixed) => fixed,
                        None => b_part,
                    }
                } else {
                    b_part
                };

                let r_part = &rel[i];

                if b_part_fixed == r_part {
                    found = true;

                    if i == l - 1 {
                        rel_start = l;
                        base_end = j + l;
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
        let mut output: Vec<String> = base[0..base_end].to_vec();
        let mut rel_slice = rel[rel_start..].to_vec();
        output.append(&mut rel_slice);

        output
    } else {
        // assume its an absolute path
        rel.to_vec()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_test() {
        assert_eq!(
            split("../../thing"),
            ["../".to_string(), "../".to_string(), "thing".to_string()]
        );
    }

    #[test]
    fn rel_test() {
        assert_eq!(
            relative(
                &[],
                &["../".to_string(), "../".to_string(), "thing".to_string()]
            ),
            ["thing".to_string()]
        );
    }
}
