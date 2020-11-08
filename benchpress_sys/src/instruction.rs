use crate::token::Token;

/// template instructions
/// `{stuff}`, `{{{each people}}}`, etc
#[derive(Debug, PartialEq, Clone, Eq, Hash)]
pub enum Instruction {
    Text(String),          // everything that not's an instruction
    Escaped(Vec<Token>),   // `{stuff}`
    Raw(Vec<Token>),       // `{{html}}`
    IfStart(Vec<Token>),   // `{{{if animal.carnivorous}}}`, `<!-- IF animal.carnivorous -->`
    IterStart(Vec<Token>), // `{{{each people}}}`, `<!-- BEGIN peopl -->`
    Else,                  // `{{{else}}}`, `<!-- ELSE -->`
    End(Vec<Token>),       // `{{{end}}}`, `<!-- END -->`, `<!-- ENDIF animal.carnivorous -->`
}

/// a wrapper for Instructions, containing source position information
#[derive(Debug, PartialEq, Clone, Eq, Hash)]
pub struct InstructionPos {
    pub start: usize,
    pub end: usize,

    pub inst: Instruction,
}

impl InstructionPos {
    /// get the source string of this instruction
    /// given the position information contained
    /// and the original source string
    pub fn get_source(&self, source: &str) -> String {
        source[self.start..self.end].to_string()
    }
}
