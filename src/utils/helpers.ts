import {
  AST,
  BodyExpression,
  BooleanPrimitive,
  CharPrimitive,
  Constructor,
  If,
  DataExpression,
  Expression,
  FieldExpression,
  ListPrimitive,
  NumberPrimitive,
  Primitive,
  Record as RecordNode,
  StringPrimitive,
  SymbolPrimitive,
} from "yukigo-core";
import {
  CompositionExpression,
  Application,
  TypeSignature,
  TypeAlias,
  Pattern,
  Type,
  Lambda,
  Function,
  InfixApplicationExpression,
} from "yukigo-core";

interface BaseMooToken {
  type: string;
  value: string;
  text: string;
  toString: () => string;
  offset: number;
  lineBreaks: number;
  line: number;
  col: number;
}

interface ListToken {
  type: "list";
  body: Expression[];
  start: BaseMooToken;
  end: BaseMooToken;
}

type Token = BaseMooToken | ListToken;

interface TempUnguardedFunction {
  type: "Function";
  name: SymbolPrimitive;
  parameters: Pattern[];
  body: Expression;
  return: Expression;
  attributes: string[];
}
interface TempGuardedFunction {
  type: "Function";
  name: SymbolPrimitive;
  parameters: Pattern[];
  body: { body: Expression; condition: Expression }[];
  return: Expression;
  attributes: string[];
}
type TempFunction = TempGuardedFunction | TempUnguardedFunction;
function parseFunction(token: {
  type: "Function";
  name: SymbolPrimitive;
  params: Pattern[];
  body: Expression;
  attributes: string[];
}): TempFunction {
  //console.log("Function", inspect(token, false, null, true));
  return {
    type: "Function",
    name: token.name,
    parameters: token.params,
    body: token.body,
    return: token.body,
    attributes: token.attributes,
  };
}

function parseFunctionType(token: [SymbolPrimitive, Type]): TypeSignature {
  return {
    type: "TypeSignature",
    identifier: token[0],
    body: token[1],
  };
}

function parseExpression(token: BodyExpression): Expression {
  //console.log("Expression", inspect(token, false, null, true));
  return { type: "Expression", body: token };
}

function parseLambda(token: [Pattern[], Expression]): Lambda {
  //console.log("Lambda", util.inspect(token, false, null, true));
  const lambda: Lambda = {
    type: "Lambda",
    parameters: token[0],
    body: token[1],
  };
  return lambda;
}

function parseCompositionExpression(
  token: [Expression, Expression]
): CompositionExpression {
  //console.log("Composition Expr", util.inspect(token, false, null, true));
  const compositionExpression: CompositionExpression = {
    type: "CompositionExpression",
    left: token[0],
    right: token[1],
  };
  return compositionExpression;
}

function parseApplication(
  token: [BodyExpression, Expression | BodyExpression]
): Application {
  //console.log("Application", util.inspect(token, false, null, true));
  return {
    type: "Application",
    function: { type: "Expression", body: token[0] },
    parameter: token[1],
  };
}

function parseInfixApplication(
  token: [SymbolPrimitive, BodyExpression, BodyExpression]
): InfixApplicationExpression {
  return {
    type: "InfixApplication",
    operator: token[0],
    left: { type: "Expression", body: token[1] },
    right: { type: "Expression", body: token[2] },
  };
}

function parseDataExpression(
  token: [SymbolPrimitive, FieldExpression[]]
): DataExpression {
  return { type: "DataExpression", name: token[0], contents: token[1] };
}

function parseDataDeclaration(
  token: [SymbolPrimitive, Constructor[]]
): RecordNode {
  return {
    type: "Record",
    name: token[0],
    contents: token[1],
  };
}
function parseConditional(token: [Expression, Expression, Expression]): If {
  return {
    type: "If",
    condition: token[0],
    then: token[1],
    else: token[2],
  };
}

function parsePrimary(token: Token): Primitive {
  //console.log("Primary", token);
  switch (token.type) {
    case "constructor":
    case "variable": {
      const identifierPrimitive: SymbolPrimitive = {
        type: "YuSymbol",
        value: token.value,
      };
      return identifierPrimitive;
    }
    case "number": {
      const numberPrimitive: NumberPrimitive = {
        type: "YuNumber",
        numericType: "number",
        value: Number(token.value),
      };
      return numberPrimitive;
    }
    case "char": {
      const stringPrimitive: CharPrimitive = {
        type: "YuChar",
        value: token.value,
      };
      return stringPrimitive;
    }
    case "string": {
      const stringPrimitive: StringPrimitive = {
        type: "YuString",
        value: token.value,
      };
      return stringPrimitive;
    }
    case "list": {
      const list = token as ListToken;
      const listPrimitive: ListPrimitive = {
        type: "YuList",
        elements: list.body,
      };
      return listPrimitive;
    }
    case "bool": {
      const booleanPrimitive: BooleanPrimitive = {
        type: "YuBoolean",
        value: token.value,
      };
      return booleanPrimitive;
    }
    default:
      throw new Error(
        `Error parsing Primary. Unknown token type: ${token.type}`
      );
  }
}
// Serious doubts with this function
// Final AST should be... AST (no pun intended) not ASTGrouped
export function groupFunctionDeclarations(
  ast: Omit<AST, "Function"> & TempFunction
): AST {
  const groups: Record<string, TempFunction[]> = {};
  const others: AST = [];

  for (const node of ast) {
    if (node.type == "Function") {
      const func = node as unknown as TempFunction;
      const name = func.name.value;
      if (!groups[name]) groups[name] = [];
      groups[name].push(func);
    } else {
      others.push(node);
    }
  }
  const functionGroups: Function[] = Object.entries(groups).map(
    ([, contents]) => ({
      type: "Function",
      identifier: contents[0].name,
      equations: contents.map((func: TempFunction) => ({
        type: "Equation",
        patterns: func.parameters,
        body: isGuardedBody(func)
          ? func.body.map((guard) => ({ type: "GuardedBody", ...guard }))
          : { type: "UnguardedBody", expression: func.body },
      })),
    })
  );

  return [...others, ...functionGroups];
}

export function isGuardedBody(
  declaration: Omit<TempFunction, "name" | "type">
): declaration is TempGuardedFunction {
  return declaration.attributes.includes("GuardedBody");
}

export function isUnguardedBody(
  declaration: Omit<TempFunction, "name" | "type">
): declaration is TempUnguardedFunction {
  return declaration.attributes.includes("UnguardedBody");
}

export {
  parseFunction,
  parsePrimary,
  parseExpression,
  parseConditional,
  parseCompositionExpression,
  parseDataDeclaration,
  parseFunctionType,
  parseInfixApplication,
  parseApplication,
  parseDataExpression,
  parseLambda,
};
