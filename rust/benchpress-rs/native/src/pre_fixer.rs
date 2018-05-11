use regex::{Regex, Captures};
use onig;

// add value context for in-loop helpers
fn fix_loop_helpers(input: String) -> String {
    lazy_static! {
        static ref LEGACY_LOOP_HELPER: Regex = Regex::new(r"\{function\.(?P<name>[^}\n ,]+)\}").unwrap();
    }

    LEGACY_LOOP_HELPER.replace_all(input.as_ref(), "{function.$name, @value}").into_owned()
}

// `<!-- BEGIN stuff -->` => `<!-- BEGIN ../stuff -->` and `<!-- BEGIN stuff -->`
// we need to add the fallback by duplicating under a different key
// only apply to nested blocks
fn fix_iter(input: String, first: bool) -> String {
    lazy_static! {
        static ref LEGACY_ITER_PATTERN: onig::Regex = onig::Regex::new(r"<!-- BEGIN ([^./][@a-zA-Z0-9/.\-_:]+?) -->([\s\S]*?)<!-- END \1 -->").unwrap();
    }
    
    LEGACY_ITER_PATTERN.replace_all(input.as_ref(), |caps: &onig::Captures| {
        let subject = caps.at(1).unwrap_or("");
        let body = fix_iter(caps.at(2).unwrap_or("").to_string(), false);

        if first {
            format!("<!-- BEGIN {} -->{}<!-- END {} -->", subject, body, subject)
        } else {
            format!(
                "<!-- IF ../{} --><!-- BEGIN ../{} -->{}<!-- END ../{} --><!-- ELSE --><!-- BEGIN {} -->{}<!-- END {} --><!-- ENDIF ../{} -->",
                subject, subject, body, subject, subject, body, subject, subject
            )
        }
    })
}

// wrap `@key`, `@value`, `@index` in mustaches
// if they aren't in a mustache already
fn fix_outside_tokens(input: String) -> String {
    lazy_static! {
        static ref OUTSIDE_TOKENS: Regex = Regex::new(r"(\{{1,2}[^}]+\}{1,2})|(<!--[^>]+-->)|(@key|@value|@index)").unwrap();
    }

    OUTSIDE_TOKENS.replace_all(input.as_ref(), |caps: &Captures| {
        let orig = String::from(caps.get(0).map_or("", |m| m.as_str()));
        let lone = String::from(caps.get(3).map_or("", |m| m.as_str()));

        if lone.len() > 0 {
            format!("{{{}}}", lone)
        } else {
            orig
        }
    }).into_owned()
}

// add root data to legacy if helpers
fn fix_helpers_root(input: String) -> String {
    lazy_static! {
        static ref IF_HELPERS: Regex = Regex::new(r"<!-- IF (?:function\.([@a-zA-Z0-9/._:]+)(?:\s*,\s*)?(.*?)) -->").unwrap();
    }

    IF_HELPERS.replace_all(input.as_ref(), |caps: &Captures| {
        let helper_name = String::from(&caps[1]);
        let args = String::from(&caps[2]);

        if args.len() > 0 {
            format!("<!-- IF function.{}, @root, {} -->", helper_name, args)
        } else {
            format!("<!-- IF function.{}, @root -->", helper_name)
        }        
    }).into_owned()
}

pub fn pre_fix(input: String) -> String {
    fix_helpers_root(
        fix_outside_tokens(
            fix_iter(
                fix_loop_helpers(input),
                true
            )
        )
    )
}
