use crate::parse::Span;

#[derive(Debug, PartialEq, Eq, Hash, Clone)]
pub enum PathPart<S> {
    Part(S),
    PartDepth(S, u32),
}

impl<'a> PathPart<Span<'a>> {
    pub fn span(&self) -> Span<'a> {
        match self {
            PathPart::Part(span) | PathPart::PartDepth(span, _) => *span,
        }
    }

    pub fn inner(&self) -> &'a str {
        self.span().fragment()
    }

    pub fn with_depth(&mut self, depth: u32) {
        *self = match *self {
            PathPart::Part(s) | PathPart::PartDepth(s, _) => PathPart::PartDepth(s, depth),
        }
    }
}

pub type PathBuf<S> = Vec<PathPart<S>>;
pub type Path<'b, S> = &'b [PathPart<S>];

pub fn resolve<'a>(base: Path<'_, Span<'a>>, rel: PathBuf<Span<'a>>) -> PathBuf<Span<'a>> {
    // ignore special paths
    if rel.len() == 1 && rel[0].inner().starts_with('@') {
        return rel.to_vec();
    }

    // handle explicitly relative paths
    if rel[0].inner().ends_with("./") {
        // discard first one
        let mut base_end = base.len();
        let mut rel_start = 1;
        loop {
            match rel.get(rel_start).map(|p| p.inner()) {
                Some("../") => {
                    base_end = base_end.saturating_sub(1);
                    rel_start += 1;
                }
                Some("./") => {
                    rel_start += 1;
                }
                _ => break,
            }
        }

        let mut out = base[..base_end].to_vec();
        out.extend_from_slice(&rel[rel_start..]);
        return out;
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
                let b_part = base[j + i].inner();
                let r_part = rel[i].inner();

                if b_part == r_part {
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
        let mut output = base[0..base_end].to_vec();
        output.extend_from_slice(&rel[rel_start..]);

        output
    } else {
        // assume its an absolute path
        rel.to_vec()
    }
}

#[cfg(test)]
mod test {
    use super::*;

    impl<'a> PathPart<Span<'a>> {
        pub fn span_to_str(self) -> PathPart<&'a str> {
            match self {
                PathPart::Part(span) => PathPart::Part(*span.fragment()),
                PathPart::PartDepth(span, depth) => PathPart::PartDepth(*span.fragment(), depth),
            }
        }
    }
}
