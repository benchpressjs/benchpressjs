use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn compile(source: &str, _filename: &str) -> String {
    benchpress_sys::compile(source)
}
