// static keywords
pub const CONTEXT: &str = "context";
pub const HELPERS: &str = "helpers";
pub const HELPER: &str = "helper";
pub const ESCAPE: &str = "__escape";
pub const GUARD: &str = "guard";
pub const KEY: &str = "key";
pub const VALUE: &str = "value";
pub const GUARD_VALUE: &str = "guard(value)";
pub const INDEX: &str = "index";
pub const LENGTH: &str = "length";
pub const BLOCKS: &str = "compiled.blocks";
pub const FIRST: &str = "index === 0";
pub const LAST: &str = "index === length - 1";
pub const TRUE: &str = "true";
pub const FALSE: &str = "false";
pub const RUNTIME_PARAMS: &str = "helpers, context, guard, iter, helper";

/// key with an indexed suffix
/// for nested scoped
pub fn key_i(i: u32) -> String {
    format!("{}{}", KEY, i)
}

/// indent each line (except the first) by a given number of spaces
pub fn indent(source: &str, amount: usize) -> String {
    let joiner = format!("\n{}", " ".repeat(amount));
    source.lines().collect::<Vec<&str>>().join(&joiner)
}

/// block method template
pub fn block(name: &str, body: &str) -> String {
    let mut first = true;
    let safe_name: String = name
        .chars()
        .filter(|&x| {
            x.is_alphabetic()
                || x == '_'
                || if first {
                    first = false;
                    false
                } else {
                    x.is_numeric()
                }
        })
        .collect();

    format!(
        "
'{}': function {}({}) {{
  var {} = {}.{};
  var {} = {};
  return {};
}}
",
        escape_path(name),
        safe_name,
        RUNTIME_PARAMS.to_string(),
        ESCAPE,
        HELPERS,
        ESCAPE,
        VALUE,
        CONTEXT,
        indent(body, 2)
    )
    .trim()
    .to_string()
}

/// block call template
pub fn block_call(name: &str) -> String {
    format!(
        "{}['{}']({})",
        BLOCKS,
        escape_path(name),
        RUNTIME_PARAMS.to_string()
    )
}

/// module wrapper template
pub fn wrapper(body: &str, blocks: &[String]) -> String {
    let blocks_str = indent(&blocks.join(",\n"), 4);

    format!(
        "
(function (factory) {{
  if (typeof module === 'object' && module.exports) {{
    module.exports = factory();
  }} else if (typeof define === 'function' && define.amd) {{
    define(factory);
  }}
}})(function () {{
  function compiled({}) {{
    var {} = {}.{};
    var {} = {};
    return {};
  }}

  {} = {{
    {}
  }};

  return compiled;
}})
",
        RUNTIME_PARAMS.to_string(),
        ESCAPE,
        HELPERS,
        ESCAPE,
        VALUE,
        CONTEXT,
        indent(body, 6),
        BLOCKS,
        blocks_str
    )
}

/// if-else template
/// `neg` switches body and alt
pub fn if_else(neg: bool, subject: &str, body: &str, alt: &str) -> String {
    // switch body/alt position if neg
    let (first, second) = if neg { (alt, body) } else { (body, alt) };

    format!(
        "({} ?
  {} :
  {})",
        subject,
        indent(first, 4),
        indent(second, 4)
    )
    .trim()
    .to_string()
}

/// iter template
pub fn iter(depth: u32, subject: &str, body: &str, alt: &str) -> String {
    let key = key_i(depth);

    format!(
        "iter({}, function each({}, {}, {}, {}) {{
  var {} = {};
  return {};
}}, function alt() {{
  return {};
}})",
        subject,
        key,
        INDEX,
        LENGTH,
        VALUE,
        KEY,
        key,
        indent(body, 4),
        indent(alt, 4)
    )
}

/// create a string concatenation in JS
pub fn concat(input: &[String]) -> String {
    input.join(" + \n")
}

use crate::parse::{
    expression::{
        Expression,
        Keyword,
    },
    path::{
        Path,
        PathPart,
    },
    Span,
};

/// escape path
pub fn escape_path(input: &str) -> String {
    input
        .chars()
        .map(|x| match x {
            '"' => "\\\"".to_string(),
            '\'' => "\\\'".to_string(),
            '\\' => "\\\\".to_string(),
            _ => x.to_string(),
        })
        .collect()
}

/// create guarded chained property access
pub fn guard(input: Path<Span>) -> String {
    let mut exp = CONTEXT.to_string();
    let mut last = exp.clone();

    for part in input {
        last = format!("{}['{}']", last, escape_path(part.inner()));
        exp.push_str(" && ");
        exp.push_str(&last);

        if let PathPart::PartDepth(_, n) = part {
            last = format!("{}[key{}]", last, n);
            exp.push_str(" && ");
            exp.push_str(&last);
        }
    }

    format!("{}({})", GUARD, exp)
}

use std::borrow::Cow;

/// Unescape contents of string literal
fn unescape(input: &str) -> String {
    // remove first and last quote
    let input = &input[1..(input.len() - 1)];
    let mut output = String::new();

    let mut chars = input.chars();
    while let Some(c) = chars.next() {
        output.push(if c == '\\' {
            match chars.next() {
                Some(c) => match c {
                    'r' => '\r',
                    'n' => '\n',
                    't' => '\t',
                    _ => c,
                },
                _ => c,
            }
        } else {
            c
        });
    }

    output
}

/// create JS code for a given expression
pub fn expression(input: Expression<Span>) -> Cow<str> {
    match input {
        Expression::StringLiteral(value) => {
            json::stringify(json::from(unescape(value.fragment()))).into()
        }
        Expression::Keyword { keyword, .. } => match keyword {
            Keyword::Root => CONTEXT.into(),
            Keyword::Key => KEY.into(),
            Keyword::Index => INDEX.into(),
            Keyword::Value => GUARD_VALUE.into(),
            Keyword::First => FIRST.into(),
            Keyword::Last => LAST.into(),
            Keyword::True => TRUE.into(),
            Keyword::False => FALSE.into(),
        },
        Expression::Path { path, .. } => guard(&path).into(),
        Expression::Helper { name, args, .. } | Expression::LegacyHelper { name, args, .. } => {
            let args_str = args
                .into_iter()
                .map(expression)
                .collect::<Vec<Cow<str>>>()
                .join(", ");

            format!(
                "{}({}, {}, '{}', [{}])",
                HELPER, CONTEXT, HELPERS, name, args_str
            )
            .into()
        }
        Expression::Negative { expr, .. } => format!("!{}", expression(*expr)).into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse::test::sp;
    use pretty_assertions::assert_eq;

    #[test]
    fn key_length_i() {
        assert_eq!(key_i(3), "key3");
    }

    #[test]
    fn indent_test() {
        assert_eq!(indent("a\nb\nc", 2), "a\n  b\n  c");
    }

    #[test]
    fn block_test() {
        assert_eq!(
            block("metaTags", "'every' +\n' meta tag'"),
            "'metaTags': function metaTags(helpers, context, guard, iter, helper) {
  var __escape = helpers.__escape;
  var value = context;
  return 'every' +
  ' meta tag';
}"
        );

        assert_eq!(
            block("meta.tags", "'every meta tag'"),
            "'meta.tags': function metatags(helpers, context, guard, iter, helper) {
  var __escape = helpers.__escape;
  var value = context;
  return 'every meta tag';
}"
        );
    }

    #[test]
    fn wrapper_test() {
        assert_eq!(
            wrapper("'stuff'", &[]),
            "
(function (factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  }
})(function () {
  function compiled(helpers, context, guard, iter, helper) {
    var __escape = helpers.__escape;
    var value = context;
    return 'stuff';
  }

  compiled.blocks = {
    
  };

  return compiled;
})
"
        );

        assert_eq!(
            wrapper("'stuff'", &["one".to_string(), "two\nthree".to_string(),]),
            "
(function (factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  }
})(function () {
  function compiled(helpers, context, guard, iter, helper) {
    var __escape = helpers.__escape;
    var value = context;
    return 'stuff';
  }

  compiled.blocks = {
    one,
    two
    three
  };

  return compiled;
})
"
        );
    }

    #[test]
    fn if_else_test() {
        assert_eq!(
            if_else(false, "thing", "'body' +\n' content'", "'alt content'"),
            "(thing ?
  'body' +
    ' content' :
  'alt content')"
        );

        assert_eq!(
            if_else(true, "false_thing", "'body content'", "'alt content'"),
            "(false_thing ?
  'alt content' :
  'body content')"
        );
    }

    #[test]
    fn iter_test() {
        assert_eq!(
            iter(9, "stuff", "'for ' + \n'each one'", "'if ' + \n'none'"),
            "iter(stuff, function each(key9, index, length, value) {
  var key = key9;
  return 'for ' + 
    'each one';
}, function alt() {
  return 'if ' + 
    'none';
})"
        )
    }

    #[test]
    fn guard_test() {
        assert_eq!(
            guard(&[PathPart::Part(sp("thing")), PathPart::Part(sp("stuff"))]),
            "guard(context && context['thing'] && context['thing']['stuff'])"
        );

        assert_eq!(guard(
            &[PathPart::PartDepth(sp("items"), 1), PathPart::Part(sp("prop"))],
        ), "guard(context && context['items'] && context['items'][key1] && context['items'][key1]['prop'])");

        assert_eq!(
            guard(&[PathPart::Part(sp("foo\\bar"))]),
            "guard(context && context['foo\\\\bar'])"
        )
    }

    #[test]
    fn expression_test() {
        assert_eq!(
            expression(Expression::StringLiteral(sp(
                "\"stuff\\n \\\"about\\\" things\""
            ))),
            "\"stuff\\n \\\"about\\\" things\""
        );

        assert_eq!(
            expression(Expression::Path {
                span: sp("thing"),
                path: vec![PathPart::Part(sp("thing"))]
            }),
            "guard(context && context['thing'])"
        );

        assert_eq!(
            expression(Expression::Keyword {
                span: sp("@root"),
                keyword: Keyword::Root
            }),
            "context"
        );

        assert_eq!(
            expression(Expression::Keyword {
                span: sp("@first"),
                keyword: Keyword::First
            }),
            "index === 0"
        );

        assert_eq!(
            expression(Expression::Keyword {
                span: sp("@last"),
                keyword: Keyword::Last
            }),
            "index === length - 1"
        );

        assert_eq!(expression(Expression::Helper {
            span: sp("localeToHTML(userLang, defaultLang)"),
            name: sp("localeToHTML"),
            args: vec![
                Expression::Path { span: sp("userLang"), path: vec![PathPart::Part(sp("userLang"))] },
                Expression::Path { span: sp("defaultLang"), path: vec![PathPart::Part(sp("defaultLang"))] },
            ]
        }), "helper(context, helpers, 'localeToHTML', [guard(context && context['userLang']), guard(context && context['defaultLang'])])");
    }
}
