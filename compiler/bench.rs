//! Benchmark to use for optimizing
//!
//! To see a flamegraph of the execution:
//! 1. Install [flamegraph](https://github.com/flamegraph-rs/flamegraph)
//! 2. Execute `RUSTFLAGS='-g' cargo +nightly flamegraph --bin bench`
//! 3. Open `flamegraph.svg` in your web browser
//!
//! To run benchmarks:
//! 1. `cargo +nightly bench`
//! 2. `grunt bench 2>/dev/null`

#![feature(test)]
extern crate test;

static CATEGORIES_TPL: &str = include_str!("../tests/bench/categories.tpl");
static TOPIC_TPL: &str = include_str!("../tests/bench/topic.tpl");

fn main() {
    let samples = 10_000;

    let start = std::time::Instant::now();

    for _ in 0..samples {
        let categories_src = std::hint::black_box(CATEGORIES_TPL);
        let topic_src = std::hint::black_box(TOPIC_TPL);

        let categories_js = compiler::compile(categories_src, "tests/bench/categories.tpl");
        let topic_js = compiler::compile(topic_src, "tests/bench/topic.tpl");

        std::hint::black_box(categories_js);
        std::hint::black_box(topic_js);
    }

    let duration = start.elapsed();
    println!("took {}ms", duration.as_millis())
}

#[bench]
fn bench_compile_categories(b: &mut test::bench::Bencher) {
    b.iter(|| {
        let categories_src = std::hint::black_box(CATEGORIES_TPL);
        compiler::compile(categories_src, "tests/bench/categories.tpl")
    })
}

#[bench]
fn bench_compile_topic(b: &mut test::bench::Bencher) {
    b.iter(|| {
        let topic_src = std::hint::black_box(TOPIC_TPL);
        compiler::compile(topic_src, "tests/bench/topic.tpl")
    })
}
