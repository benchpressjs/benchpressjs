mod generate;
mod parse;

#[cfg(target_arch = "wasm32")]
mod console {
    #![allow(unused_unsafe, dead_code)]

    #[doc(hidden)]
    pub fn console_info(s: &str) {
        unsafe {
            ::web_sys::console::info_1(&s.into());
        }
    }
    #[doc(hidden)]
    pub fn console_warn(s: &str) {
        unsafe {
            ::web_sys::console::warn_1(&s.into());
        }
    }
    #[doc(hidden)]
    pub fn console_error(s: &str) {
        unsafe {
            ::web_sys::console::error_1(&s.into());
        }
    }

    #[doc(hidden)]
    #[macro_export]
    macro_rules! _info {
        ($($t:tt)*) => { crate::console::console_info(&format!($($t)*)) }
    }
    #[doc(hidden)]
    #[macro_export]
    macro_rules! _warn {
        ($($t:tt)*) => { crate::console::console_warn(&format!($($t)*)) }
    }
    #[doc(hidden)]
    #[macro_export]
    macro_rules! _error {
        ($($t:tt)*) => { crate::console::console_error(&format!($($t)*)) }
    }

    pub use _error as error;
    pub use _info as info;
    pub use _warn as warn;
}

#[cfg(not(target_arch = "wasm32"))]
mod console {
    pub use std::{
        eprintln as warn,
        eprintln as error,
        println as info,
    };
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
pub fn compile(source: &str, filename: &str) -> String {
    console_error_panic_hook::set_once();

    let program = parse::Span::new_extra(
        &source,
        parse::FileInfo {
            filename,
            full_source: &source,
        },
    );
    let (rest, tokens) = parse::tokens::tokens(program).unwrap_or_else(|e| {
        console::error!("Failed at parse::tokens::tokens, {:?}", e);
        (
            parse::Span::new_extra(
                "",
                parse::FileInfo {
                    filename,
                    full_source: &source,
                },
            ),
            vec![],
        )
    });
    if rest.len() > 0 {
        console::error!("There was some source text left over, {:?}", rest);
    }
    let fixed = parse::tree::fix_extra_tokens(tokens);
    let mut iter = fixed.into_iter();
    let mut tree = vec![];
    let rest = parse::tree::tree(0, &[], &mut iter, &mut tree).unwrap_or_else(|e| {
        console::error!("Failed at parse::tree::tree, {:?}", e);
        None
    });
    if let Some(rest) = rest {
        console::error!("There was a token left over, {:?}", rest);
    }
    generate::generator::generate(tree)
}
