#[derive(Debug, PartialEq, Clone, Eq, Hash)]
pub enum Token {
    // stuff that's just text in the template
    Text(String),

    // the property name to the value
    // the `person.name` in `{{person.name}}`
    Identifier(String),
    // `"string \" literal"`
    StringLiteral(String),

    LegacyHelper, // function.

    BlockOpen,  // {{{, <!--
    BlockClose, // }}}, -->

    If,   // if, IF
    Else, // else, ELSE
    Iter, // each, BEGIN
    End,  // end, END, ENDIF

    Bang,       // !
    LeftParen,  // (
    RightParen, // )
    Comma,      // ,

    RawOpen,      // {{
    RawClose,     // }}
    EscapedOpen,  // {
    EscapedClose, // }
}

/// a wrapper for Tokens, containing source position information
#[derive(Debug, PartialEq, Clone, Eq, Hash)]
pub struct TokenPos {
    pub start: usize,
    pub end: usize,

    pub tok: Token,
}
