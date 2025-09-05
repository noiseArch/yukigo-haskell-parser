import moo from "moo";
import { keywords } from "../utils/types.js";
import { makeLexer } from "moo-ignore";
export const HaskellLexerConfig = {
  EOF: "*__EOF__*",
  anonymousVariable: "_",
  WS: /[ \t]+/,
  comment: /--.*?$|{-[\s\S]*?-}/,
  number:
    /0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/,
  char: /'(?:\\['\\bfnrtv0]|\\u[0-9a-fA-F]{4}|[^'\\\n\r])?'/,
  string: /"(?:\\["\\bfnrtv0]|\\u[0-9a-fA-F]{4}|[^"\\\n\r])*"/,
  //template: /`(?:\\[\s\S]|[^\\`])*`/,
  backtick: "`",
  lparen: "(",
  rparen: ")",
  lbracket: "{",
  rbracket: "}",
  lsquare: "[",
  rsquare: "]",
  comma: ",",
  dot: ".",
  semicolon: ";",
  typeArrow: "->",
  typeEquals: "::",
  colon: ":",
  question: "?",
  arrow: "=>",
  strictEquals: "===",
  notEquals: "!==",
  lessThanEquals: "<=",
  lessThan: "<",
  greaterThanEquals: ">=",
  greaterThan: ">",
  equals: "==",
  assign: "=",
  bool: {
    match: ["True", "False"],
  },
  op: /[#!$%&*+./<=>?@\\^|~-]+/,
  constructor: {
    match: /[A-Z][a-zA-Z0-9']*/,
    type: moo.keywords({
      typeClass: [
        "Foldable",
        "Bounded",
        "Enum",
        "Eq",
        "Floating",
        "Fractional",
        "Functor",
        "Integral",
        "Ix",
        "Monad",
        "MonadPlus",
        "Num",
        "Ord",
        "Random",
        "RandomGen",
        "Read",
        "Real",
        "RealFloat",
        "RealFrac",
        "Show",
      ],
    }),
  },
  variable: {
    match: /[a-z_][a-zA-Z0-9_']*/,
    type: moo.keywords({
      keyword: keywords,
      primitiveOperator: [
        "show"
      ],
    }),
  },
  NL: { match: /\r?\n/, lineBreaks: true },
};

export const HSLexer = makeLexer(HaskellLexerConfig, [], {
  eof: true,
});
