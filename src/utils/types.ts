import { YukigoPrimitive } from "yukigo-core";
import { TypeNode } from "yukigo-core";

export const keywords = [
  "type",
  "where",
  "in",
  "if",
  "else",
  "then",
  "data",
  "case",
  "class",
  "do",
  "default",
  "deriving",
  "import",
  "infix",
  "infixl",
  "infixr",
  "instance",
  "let",
  "module",
  "newtype",
  "of",
  "qualified",
  "as",
  "hiding",
  "foreign",
];

export const typeMappings: { [key: string]: YukigoPrimitive } = {
  Float: "YuNumber",
  Double: "YuNumber",
  Int: "YuNumber",
  Integer: "YuNumber",
  String: "YuString",
  Char: "YuChar",
  Boolean: "YuBoolean",
  Bool: "YuBoolean",
};

// Yet to be implemented
export const typeClasses: Map<string, TypeNode[]> = new Map([
  ["Bounded", []],
  ["Enum", []],
  ["Eq", []],
  ["Floating", []],
  ["Fractional", []],
  ["Functor", []],
  [
    "Integral",
    [
      { type: "TypeConstructor", name: "Int" },
      { type: "TypeConstructor", name: "Integer" },
    ],
  ],
  ["Ix", []],
  ["Monad", []],
  ["MonadPlus", []],
  [
    "Num",
    [
      { type: "TypeConstructor", name: "Int" },
      { type: "TypeConstructor", name: "Double" },
      { type: "TypeConstructor", name: "Float" },
      { type: "TypeConstructor", name: "Integer" },
    ],
  ],
  ["Random", []],
  ["RandomGen", []],
  ["Read", []],
  ["Real", []],
  ["RealFloat", []],
  ["RealFrac", []],
  ["Show", []],
]);
