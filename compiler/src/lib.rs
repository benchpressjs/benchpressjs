use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn compile(source: &str) -> String {
    benchpress_sys::compile(source)
}
