// test/ast-builders.ts
import {
  Equation,
  GuardedBody,
  Position,
  Type,
  TypeSignature,
  UnguardedBody,
} from "yukigo-core";
import {
  SourceLocation,
  SymbolPrimitive,
  Function,
  Pattern,
  Expression,
  NumberPrimitive,
  CharPrimitive,
  StringPrimitive,
} from "yukigo-core";

export const location = (start: Position, end: Position): SourceLocation => ({
  start,
  end,
});
export const position = (
  line: number,
  column: number,
  offset: number
): Position => ({
  line,
  column,
  offset,
});

// Symbol builder
export const symbol = (value: string): SymbolPrimitive => ({
  type: "YuSymbol",
  value,
});

// Type constructors
export const typeCon = (name: string): Type => ({
  type: "SimpleType",
  value: name,
  constraints: [],
});

// Function type signature
export const typeSig = (
  name: string,
  inputs: Type[],
  output: Type,
  constraints: string[] = []
): TypeSignature => ({
  type: "TypeSignature",
  identifier: symbol(name),
  body: {
    type: "ParameterizedType",
    inputs: inputs,
    return: output,
    constraints,
  },
});

// Literal pattern builder
export const litPattern = (
  primitive: NumberPrimitive | CharPrimitive | StringPrimitive
): Pattern => ({
  type: "LiteralPattern",
  name: primitive,
});

// Primitive builders
export const number = (value: number): NumberPrimitive => ({
  type: "YuNumber",
  numericType: "number",
  value,
});

export const char = (value: string): CharPrimitive => ({
  type: "YuChar",
  value,
});

export const str = (value: string): StringPrimitive => ({
  type: "YuString",
  value,
});

// Expression wrapper
export const expr = (body: any): Expression => ({
  type: "Expression",
  body,
});

// Function builder
export const func = (name: string, ...declarations: any[]): Function => ({
  type: "Function",
  identifier: symbol(name),
  equations: declarations,
});
export const equation = (
  patterns: Pattern[],
  body: GuardedBody[] | UnguardedBody
): Equation => ({
  type: "Equation",
  patterns,
  body,
});

export const unguardedbody = (expression: Expression): UnguardedBody => ({
  type: "UnguardedBody",
  expression,
});
export const guardedbody = (
  condition: Expression,
  body: Expression
): GuardedBody => ({
  type: "GuardedBody",
  condition,
  body,
});
