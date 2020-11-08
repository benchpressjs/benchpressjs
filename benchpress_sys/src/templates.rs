// static keywords
pub static CONTEXT: &str = "context";
pub static HELPERS: &str = "helpers";
pub static HELPER: &str = "helper";
pub static ESCAPE: &str = "__escape";
pub static GUARD: &str = "guard";
pub static ITER: &str = "iter";
pub static EACH: &str = "each";
pub static KEY: &str = "key";
pub static VALUE: &str = "value";
pub static INDEX: &str = "index";
pub static LENGTH: &str = "length";
pub static COMPILED: &str = "compiled";
pub static BLOCKS: &str = "compiled.blocks";

/// key with an indexed suffix
/// for nested scoped
pub fn key_i(i: u16) -> String {
    format!("{}{}", KEY, i)
}
/// length with an indexed suffix
/// for nested scoped
pub fn length_i(i: u16) -> String {
    format!("{}{}", LENGTH, i)
}

// static convenient keyword combinations
lazy_static! {
    pub static ref FIRST: String = format!("{} === 0", INDEX);
    pub static ref LAST: String = format!("{} === {} - 1", INDEX, LENGTH);
    pub static ref RUNTIME_PARAMS: String =
        format!("{}, {}, {}, {}, {}", HELPERS, CONTEXT, GUARD, ITER, HELPER);
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
pub fn iter(suffix: u16, subject: &str, body: &str, alt: &str) -> String {
    let key = key_i(suffix);

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

use crate::parser::Expression;

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
pub fn guard(input: Vec<String>) -> String {
    let mut exp = CONTEXT.to_string();
    let mut last = exp.clone();

    for part in input {
        // handle indices like item[1]
        let (part_fixed, index) = if part.ends_with(']') && part.len() > 3 {
            let n: usize = part.len() - 2;
            let index: Option<char> = match part.chars().nth(n) {
                Some(ch) => {
                    if ch.is_numeric() {
                        Some(ch)
                    } else {
                        None
                    }
                }
                None => None,
            };

            (part[..part.len() - 3].to_string(), index)
        } else {
            (part, None)
        };

        last = format!("{}['{}']", last, escape_path(&part_fixed));
        exp.push_str(" && ");
        exp.push_str(&last);

        if let Some(n) = index {
            last = format!("{}[key{}]", last, n);
            exp.push_str(" && ");
            exp.push_str(&last);
        }
    }

    format!("{}({})", GUARD, exp)
}

/// create JS code for a given expression
pub fn expression(input: Expression) -> String {
    match input {
        Expression::StringLiteral { value } => format!("\"{}\"", value),
        Expression::PathExpression { path } => {
            if let Some(part) = path.get(0).cloned() {
                match part.as_str() {
                    "@root" => CONTEXT.to_string(),
                    "@key" => KEY.to_string(),
                    "@index" => INDEX.to_string(),
                    "@value" => format!("guard({})", VALUE),
                    "@first" => FIRST.to_string(),
                    "@last" => LAST.to_string(),
                    _ => guard(path),
                }
            } else {
                guard(path)
            }
        }
        Expression::HelperExpression { helper_name, args } => {
            let args_str = args
                .into_iter()
                .map(expression)
                .collect::<Vec<String>>()
                .join(", ");

            format!(
                "{}({}, {}, '{}', [{}])",
                HELPER, CONTEXT, HELPERS, helper_name, args_str
            )
        }
        Expression::NegativeExpression { expr } => format!("!{}", expression(*expr)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_length_i() {
        assert_eq!(key_i(3), "key3");
        assert_eq!(length_i(3), "length3");
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
            .to_string()
        )
    }

    #[test]
    fn guard_test() {
        assert_eq!(
            guard(
                ["thing", "stuff"]
                    .iter()
                    .map(|&x| x.to_string())
                    .collect::<Vec<String>>()
            ),
            "guard(context && context['thing'] && context['thing']['stuff'])"
        );

        assert_eq!(guard(
            ["items[1]", "prop"].iter().map(|&x| x.to_string()).collect::<Vec<String>>()
        ), "guard(context && context['items'] && context['items'][key1] && context['items'][key1]['prop'])".to_string());

        assert_eq!(
            guard(vec!["foo\\bar".to_string()]),
            "guard(context && context['foo\\\\bar'])".to_string()
        )
    }

    #[test]
    fn expression_test() {
        assert_eq!(
            expression(Expression::StringLiteral {
                value: "stuff\\n \\\"about\\\" things".to_string()
            }),
            "\"stuff\\n \\\"about\\\" things\"".to_string()
        );

        assert_eq!(
            expression(Expression::PathExpression {
                path: vec!["thing".to_string()],
            }),
            "guard(context && context['thing'])".to_string()
        );

        assert_eq!(
            expression(Expression::PathExpression {
                path: vec!["@root".to_string()],
            }),
            "context".to_string()
        );

        assert_eq!(
            expression(Expression::PathExpression {
                path: vec!["@first".to_string()],
            }),
            "index === 0".to_string()
        );

        assert_eq!(
            expression(Expression::PathExpression {
                path: vec!["@last".to_string()],
            }),
            "index === length - 1".to_string()
        );

        assert_eq!(expression(Expression::HelperExpression {
            helper_name: "localeToHTML".to_string(),
            args: vec![
                Expression::PathExpression { path: vec!["userLang".to_string()] },
                Expression::PathExpression { path: vec!["defaultLang".to_string()] },
            ]
        }), "helper(context, helpers, 'localeToHTML', [guard(context && context['userLang']), guard(context && context['defaultLang'])])");
    }
}
