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

pub fn key_i(i: u16) -> String {
    format!("{}{}", KEY, i)
}
pub fn length_i(i: u16) -> String {
    format!("{}{}", LENGTH, i)
}

lazy_static! {
    pub static ref FIRST: String = format!("{} === 0", INDEX);
    pub static ref LAST: String = format!("{} === {} - 1", INDEX, LENGTH);
    pub static ref RUNTIME_PARAMS: String = format!("{}, {}, {}, {}, {}", HELPERS, CONTEXT, GUARD, ITER, HELPER);
}

pub fn indent(source: String, amount: usize) -> String {
    let joiner = format!("\n{}", " ".repeat(amount));
    source.lines().collect::<Vec<&str>>().join(joiner.as_ref())
}

pub fn block(name: String, body: String) -> String {
    let mut first = true;
    let safe_name: String = name.chars().filter(|&x| {
        x.is_alphabetic() || x == '_' || if first { first = false; false } else { x.is_numeric() }
    }).collect::<String>();

    format!(
"
'{}': function {}({}) {{
  var {} = {}.{};
  return {};
}}
",
        escape_path(name), safe_name, RUNTIME_PARAMS.to_string(),
        ESCAPE, HELPERS, ESCAPE,
        indent(body, 2)
    ).trim().to_string()
}

pub fn block_call(name: String) -> String {
    format!("{}['{}']({})", BLOCKS, escape_path(name), RUNTIME_PARAMS.to_string())
}

pub fn wrapper(body: String, blocks: Vec<String>) -> String {
    let blocks_str = indent(blocks.join(",\n"), 4);

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
    return {};
  }}

  {} = {{
    {}
  }};

  return compiled;
}})
", 
        RUNTIME_PARAMS.to_string(),
        ESCAPE, HELPERS, ESCAPE,
        indent(body, 6),
        BLOCKS, 
        blocks_str
    )
}

pub fn if_else(neg: bool, subject: String, body: String, alt: String) -> String {
    // switch body/alt position if neg
    let (first, second) = if neg { (alt, body) } else { (body, alt) };

    format!(
"({} ?
  {} :
  {})",
        subject, indent(first, 4), indent(second, 4)
    ).trim().to_string()
}

pub fn iter(suffix: u16, subject: String, body: String, alt: String) -> String {
    let key = key_i(suffix);
    
    format!(
"iter({}, function each({}, {}, {}) {{
  var {} = {};
  return {};
}}, function alt() {{
  return {};
}})",
        subject, key, INDEX, LENGTH,
        KEY, key,
        indent(body, 4),
        indent(alt, 4)
    )
}

pub fn concat(input: Vec<String>) -> String {
    input.join(" + \n")
}

use parser::Expression;

pub fn escape_path(input: String) -> String {
    input.chars().map(|x| match x {
        '"' => String::from("\\\""),
        '\'' => String::from("\\\'"),
        '\\' => String::from("\\\\"),
        _ => x.to_string(),
    }).collect::<String>()
}

pub fn guard(input: Vec<String>) -> String {
    let mut exp = String::from(CONTEXT);
    let mut last = exp.clone();

    for part in input {
        // handle indices like item[1]
        let (part_fixed, index) = if part.ends_with("]") && part.len() > 3 {
            let n: usize = part.len() - 2;
            let index: Option<char> = match part.chars().nth(n) {
                Some(ch) => if ch.is_numeric() {
                    Some(ch)
                } else {
                    None
                },
                None => None,
            };
            
            (part[..part.len() - 3].to_string(), index)
        } else {
            (part, None)
        };

        last = format!("{}['{}']", last, escape_path(part_fixed));
        exp.push_str(" && ");
        exp.push_str(last.as_ref());

        if let Some(n) = index {
            last = format!("{}[key{}]", last, n);
            exp.push_str(" && ");
            exp.push_str(last.as_ref());
        }
    }

    format!("guard({})", exp)
}

pub fn expression(input: Expression) -> String {
    match input {
        Expression::StringLiteral { value } => {
            format!("\"{}\"", value)
        },
        Expression::PathExpression { path } => {
            if let Some(part) = path.clone().get(0) {
                match part.as_ref() {
                    "@root" => String::from(CONTEXT),
                    "@key" => String::from(KEY),
                    "@index" => String::from(INDEX),
                    "@value" => String::from(VALUE),
                    "@first" => FIRST.to_string(),
                    "@last" => LAST.to_string(),
                    _ => guard(path),
                }
            } else {
                guard(path)
            }
        },
        Expression::HelperExpression { helper_name, args } => {
            let args_str = args.into_iter().map(|x| expression(x)).collect::<Vec<String>>().join(", ");

            format!(
                "{}({}, {}, '{}', [{}])",
                HELPER, CONTEXT, HELPERS, helper_name, args_str
            )
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_length_i() {
        assert_eq!(key_i(3), "key3".to_string());
        assert_eq!(length_i(3), "length3".to_string());
    }

    #[test]
    fn indent_test() {
        assert_eq!(indent("a\nb\nc".to_string(), 2), "a\n  b\n  c".to_string());
    }

    #[test]
    fn block_test() {
        assert_eq!(block(String::from("metaTags"), String::from("'every' +\n' meta tag'")), 
"'metaTags': function metaTags(helpers, context, guard, iter, helper) {
  var __escape = helpers.__escape;
  return 'every' +
  ' meta tag';
}"
        );

        assert_eq!(block(String::from("meta.tags"), String::from("'every meta tag'")), 
"'meta.tags': function metatags(helpers, context, guard, iter, helper) {
  var __escape = helpers.__escape;
  return 'every meta tag';
}"
        );
    }

    #[test]
    fn wrapper_test() {
        assert_eq!(wrapper(String::from("'stuff'"), vec![]), 
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
    return 'stuff';
  }

  compiled.blocks = {
    
  };

  return compiled;
})
"
        );

        assert_eq!(wrapper(
            String::from("'stuff'"), 
            vec![
                String::from("one"),
                String::from("two\nthree")
            ]
        ),
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
        assert_eq!(if_else(
            false, 
            "thing".to_string(), 
            "'body' +\n' content'".to_string(),
            "'alt content'".to_string()
        ),
"(thing ?
  'body' +
    ' content' :
  'alt content')"
        );

        assert_eq!(if_else(
            true, 
            "false_thing".to_string(), 
            "'body content'".to_string(),
            "'alt content'".to_string()
        ),
"(false_thing ?
  'alt content' :
  'body content')"
        );
    }

    #[test]
    fn iter_test() {
        assert_eq!(iter(
            9, 
            "stuff".to_string(), 
            "'for ' + \n'each one'".to_string(), 
            "'if ' + \n'none'".to_string()
        ),
"iter(stuff, function each(key9, index, length) {
  var key = key9;
  return 'for ' + 
    'each one';
}, function alt() {
  return 'if ' + 
    'none';
})".to_string()
        )
    }

    #[test]
    fn guard_test() {
        assert_eq!(guard(
            ["thing", "stuff"].into_iter().map(|x| x.to_string()).collect::<Vec<String>>()
        ), "guard(context && context['thing'] && context['thing']['stuff'])");

        assert_eq!(guard(
            ["items[1]", "prop"].into_iter().map(|x| x.to_string()).collect::<Vec<String>>()
        ), "guard(context && context['items'] && context['items'][key1] && context['items'][key1]['prop'])".to_string());

        assert_eq!(guard(
            vec!["foo\\bar".to_string()]
        ), "guard(context && context['foo\\\\bar'])".to_string())
    }

    #[test]
    fn expression_test() {
        assert_eq!(expression(Expression::StringLiteral { 
            value: String::from("stuff\\n \\\"about\\\" things") 
        }), "\"stuff\\n \\\"about\\\" things\"".to_string());

        assert_eq!(expression(Expression::PathExpression {
            path: vec!["thing".to_string()],
        }), "guard(context && context['thing'])".to_string());

        assert_eq!(expression(Expression::PathExpression {
            path: vec!["@root".to_string()],
        }), "context".to_string());

        assert_eq!(expression(Expression::PathExpression {
            path: vec!["@first".to_string()],
        }), "index === 0".to_string());

        assert_eq!(expression(Expression::PathExpression {
            path: vec!["@last".to_string()],
        }), "index === length - 1".to_string());

        assert_eq!(expression(Expression::HelperExpression {
            helper_name: "localeToHTML".to_string(),
            args: vec![
                Expression::PathExpression { path: vec!["userLang".to_string()] },
                Expression::PathExpression { path: vec!["defaultLang".to_string()] },
            ]
        }), "helper(context, helpers, 'localeToHTML', [guard(context && context['userLang']), guard(context && context['defaultLang'])])");
    }
}
