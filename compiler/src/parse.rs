use nom::{
    character::complete::multispace0,
    error::ParseError,
    sequence::delimited,
    IResult,
    Slice,
};

pub mod expression;
pub mod path;
pub mod tokens;
pub mod tree;

#[cfg_attr(test, derive(Default))]
#[derive(Debug, PartialEq, Eq, Hash, Clone, Copy)]
pub struct FileInfo<'a> {
    pub filename: &'a str,
    pub full_source: &'a str,
}
pub type Span<'a> = nom_locate::LocatedSpan<&'a str, FileInfo<'a>>;

trait SpanExt {
    fn get_line(&self) -> &str;
    fn get_line_column_padding(&self) -> (&str, usize, String);
}
impl<'a> SpanExt for Span<'a> {
    fn get_line(&self) -> &str {
        let full_source = self.extra.full_source;
        let offset = self.location_offset();

        let start = full_source.slice(..offset).rfind('\n').map_or(0, |x| x + 1);
        full_source.slice(offset..).find('\n').map_or_else(
            || full_source.slice(start..),
            |end| full_source.slice(start..(offset + end)),
        )
    }

    fn get_line_column_padding(&self) -> (&str, usize, String) {
        let line = self.get_line();

        let mut column = 0;
        let mut tabs = 0;
        let mut spaces = 0;
        for c in line[..(self.get_column() - 1)].chars() {
            column += 1;

            match c {
                '\t' => {
                    tabs += 1;
                }
                _ => spaces += 1,
            }
        }

        (line, column, "\t".repeat(tabs) + &(" ".repeat(spaces)))
    }
}

/// A combinator that takes a parser `inner` and produces a parser that also consumes both leading and
/// trailing whitespace, returning the output of `inner`.
pub fn ws<'a, F: 'a, O, E: ParseError<Span<'a>>>(
    inner: F,
) -> impl FnMut(Span<'a>) -> IResult<Span<'a>, O, E>
where
    F: FnMut(Span<'a>) -> IResult<Span<'a>, O, E>,
{
    delimited(multispace0, inner, multispace0)
}

#[cfg(test)]
pub mod test {
    use super::*;

    pub fn sp(s: &str) -> Span {
        Span::new_test(s)
    }
}
