#[derive(Debug, PartialEq, Clone, Eq, Hash)]
pub enum Token {
    Text(String),
    Unknown(String),

    Identifier(String),
    StringLiteral(String),

    LegacyHelper, // function.

    BlockOpen(String), // {{{, <!--
    BlockClose(String), // }}}, -->

    If(String), // if, IF
    Else(String), // else, ELSE
    Iter(String), // each, BEGIN
    End(String), // end, END, ENDIF

    Bang, // !
    LeftParen, // (
    RightParen, // )
    Comma, // ,
    Space,

    RawOpen, // {{
    RawClose, // }}
    EscapedOpen, // {
    EscapedClose, // }
}

impl ToString for Token {
    fn to_string(&self) -> String {
        match self {
            &Token::Text(ref val) => val.to_string(),
            &Token::Unknown(ref val) => val.to_string(),

            &Token::Identifier(ref val) => val.to_string(),
            &Token::StringLiteral(ref val) => format!("\"{}\"", val.to_string()),

            &Token::LegacyHelper => "function.".to_string(), // function.

            &Token::BlockOpen(ref val) => val.to_string(), // {{{, <!--
            &Token::BlockClose(ref val) => val.to_string(), // }}}, -->

            &Token::If(ref val) => val.to_string(), // if, IF
            &Token::Else(ref val) => val.to_string(), // else, ELSE
            &Token::Iter(ref val) => val.to_string(), // each, BEGIN
            &Token::End(ref val) => val.to_string(), // end, END, ENDIF

            &Token::Bang => "!".to_string(), // !
            &Token::LeftParen => "(".to_string(), // (
            &Token::RightParen => ")".to_string(), // )
            &Token::Comma => ",".to_string(), // ,
            &Token::Space => " ".to_string(),

            &Token::RawOpen => "{{".to_string(), // {{
            &Token::RawClose => "}}".to_string(), // }}
            &Token::EscapedOpen => "{".to_string(), // {
            &Token::EscapedClose => "}".to_string(), // }
        }
    }
}
