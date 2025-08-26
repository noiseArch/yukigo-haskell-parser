import {
  AST,
  BodyExpression,
  Record,
  traverse,
  Function,
  TypeAlias,
  SimpleType,
  ParameterizedType,
  Pattern,
  TypeSignature,
  ArithmeticOperation,
  ListPrimitive,
  SymbolPrimitive,
  CompositionExpression,
  If,
  Application,
  InfixApplicationExpression,
  DataExpression,
  TupleExpression,
  ConsExpression,
  ComparisonOperation,
  StringOperation,
  Lambda,
  Constructor,
} from "yukigo-core";
import { Type } from "yukigo-core";
import { typeMappings } from "./utils/types.js";

type Substitution = Map<string, Type>;

// big ahh class down here -_-

function formatType(type: Type): string {
  switch (type.type) {
    case "TypeVar":
    case "SimpleType":
      return type.value;
    case "ParameterizedType":
      const args = type.inputs.map((t) => formatType(t)).join(" -> ");
      return `(${args}) -> ${formatType(type.return)}`;
    case "TupleType":
      return `(${type.values.map((t) => formatType(t)).join(", ")})`;
    case "ListType":
      return `[${formatType(type.values)}]`;
    case "ConstrainedType":
    default:
      return JSON.stringify(type);
  }
}

function freshTypeVariable(counter: number): Type {
  const type: Type = {
    type: "TypeVar",
    value: `T${counter}`,
    constraints: [],
  };
  return type;
}

function applySubstitution(type: Type, sub: Substitution): Type {
  const substituteNode = (t: Type): Type => {
    if (t.type === "SimpleType") {
      const typeSub = sub.get(t.value);
      if (typeSub) {
        return applySubstitution(typeSub, sub);
      }
    }
    return t;
  };
  return walkTypeNode(type, substituteNode);
}

function walkTypeNode(type: Type, callback: (node: Type) => Type): Type {
  const result = callback(type);
  switch (result.type) {
    case "ParameterizedType":
      return {
        ...result,
        inputs: result.inputs.map((t) => walkTypeNode(t, callback)),
        return: walkTypeNode(result.return, callback),
      };
    case "ListType":
      return {
        ...result,
        values: walkTypeNode(result.values, callback),
      };
    case "TupleType":
      return {
        ...result,
        values: result.values.map((t) => walkTypeNode(t, callback)),
      };
    default:
      return result;
  }
}

export class TypeChecker {
  private errors: string[] = [];
  private signatureMap = new Map<string, SimpleType | ParameterizedType>();
  private recordMap = new Map<string, SimpleType>();
  private typeAliasMap = new Map<string, Type>();
  private typeVarCounter = 0;
  private inferer: Inferer;

  constructor() {
    this.inferer = new Inferer({
      errors: this.errors,
      typeEquals: this.typeEquals.bind(this),
      unify: this.unify.bind(this),
      resolveTypeAlias: this.resolveTypeAlias.bind(this),
      signatureMap: this.signatureMap,
      recordMap: this.recordMap,
      typeAliasMap: this.typeAliasMap,
    });
  }

  public check(ast: AST): string[] {
    this.buildGlobalEnvironment(ast);
    traverse(ast, {
      Function: (node: Function) => {
        // search function signature
        const functionName = node.identifier.value;
        const functionType: Type | undefined =
          this.signatureMap.get(functionName);

        let returnType: Type;
        let paramTypes: Type[];

        if (functionType) {
          returnType =
            functionType.type === "SimpleType"
              ? this.mapTypeNodePrimitives(functionType)
              : this.mapTypeNodePrimitives(functionType.return);
          // resolve param types
          paramTypes =
            functionType.type === "SimpleType"
              ? []
              : functionType.inputs.map((t) => this.mapTypeNodePrimitives(t));
        } else {
          this.errors.push(
            `Function '${functionName}' is defined but has no signature`
          );
        }

        for (const func of node.equations) {
          const substitutions: Substitution = new Map();
          const symbolMap = new Map<string, Type>();

          if (!paramTypes) {
            paramTypes = func.patterns.map(() =>
              freshTypeVariable(this.typeVarCounter++)
            );
          }

          if (paramTypes) {
            if (func.patterns.length !== paramTypes.length) {
              this.errors.push(`Function '${functionName}' has arity mismatch`);
              continue;
            }
            func.patterns.forEach((param, i) => {
              this.resolvePatterns(param, symbolMap, paramTypes, i);
            });
          }
          let subReturnType: Type;
          let subInferredType: Type;
          // infer the return expression
          if (!Array.isArray(func.body)) {
            // function body doesnt have guards
            const funcInferredType = this.inferer.inferType(
              func.body.expression.body,
              symbolMap,
              substitutions
            );

            subInferredType = applySubstitution(
              funcInferredType,
              substitutions
            );
            subReturnType = returnType
              ? applySubstitution(returnType, substitutions)
              : subInferredType;

            if (!returnType) returnType = subReturnType;
            if (!paramTypes)
              paramTypes = Array.from(symbolMap).map((t) => t[1]);
          } else {
            // function body has guards, checks for each if it has a valid condition and its return expr
            for (const guard of func.body) {
              const guardBody = guard.condition.body;

              const isOtherwise =
                guardBody.type === "YuSymbol" &&
                guardBody.value === "otherwise";

              const guardInferredType: Type = isOtherwise
                ? { type: "SimpleType", value: "YuBoolean", constraints: [] }
                : this.inferer.inferType(guardBody, symbolMap, substitutions);

              if (
                guardInferredType.type !== "SimpleType" ||
                guardInferredType.value !== "YuBoolean"
              ) {
                this.errors.push(
                  `Guard condition must evaluate to a boolean (YuBoolean), but found ${formatType(
                    guardInferredType
                  )}`
                );
                return;
              }
              const funcInferredType = this.inferer.inferType(
                guard.body.body,
                symbolMap,
                substitutions
              );
              subInferredType = applySubstitution(
                funcInferredType,
                substitutions
              );
              subReturnType = returnType
                ? applySubstitution(returnType, substitutions)
                : subInferredType;
              if (!returnType) returnType = subReturnType;
              if (!paramTypes)
                paramTypes = Array.from(symbolMap).map((t) => t[1]);
            }
          }
          // unify signature return type with inferred type
          if (!this.typeEquals(subReturnType, subInferredType)) {
            this.errors.push(
              `Type mismatch in '${functionName}': Expected ${formatType(
                subReturnType
              )} but got ${formatType(subInferredType)}`
            );
          }
        }
      },
    });
    return this.errors;
  }

  private buildGlobalEnvironment(ast: AST) {
    traverse(ast, {
      TypeAlias: (node: TypeAlias) => {
        const typeAliasIdentifier = node.identifier.value;
        if (this.typeAliasMap.has(typeAliasIdentifier)) {
          this.errors.push(
            `Type alias '${typeAliasIdentifier}' is already defined`
          );

          return;
        }
        const resolvedType = this.mapTypeNodePrimitives(node.value);
        this.typeAliasMap.set(typeAliasIdentifier, resolvedType);
      },
      Record: (node: Record) => {
        const recordIdentifier = node.name.value;
        if (this.recordMap.has(recordIdentifier)) {
          this.errors.push(`Record '${recordIdentifier}' is already defined`);
          return;
        }
        // check multiple declaration of constructors
        // resolve and save types of constructors in recordMap
        try {
          const resolvedConstructors = [];
          for (const cons of node.contents) {
            if (this.signatureMap.has(cons.name)) {
              this.errors.push(`Constructor '${cons.name}' is already defined`);
              return;
            }
            const resCons: Constructor = {
              name: cons.name,
              fields: cons.fields.map((field) => ({
                type: "Field",
                name: field.name,
                value: this.mapTypeNodePrimitives(field.value),
              })),
            };
            resolvedConstructors.push(resCons);

            const constructorFuncType: ParameterizedType = {
              type: "ParameterizedType",
              inputs: resCons.fields.map((field) => field.value),
              return: {
                type: "SimpleType",
                value: recordIdentifier,
                constraints: [],
              },
              constraints: [],
            };

            this.signatureMap.set(resCons.name, constructorFuncType);
            resCons.fields.forEach(
              (field) =>
                field.name &&
                this.signatureMap.set(field.name.value, {
                  type: "ParameterizedType",
                  inputs: [
                    {
                      type: "SimpleType",
                      value: recordIdentifier,
                      constraints: [],
                    },
                  ],
                  return: field.value,
                  constraints: [],
                })
            );
          }
          const record: SimpleType = {
            type: "SimpleType",
            value: recordIdentifier,
            constraints: [],
          };
          this.recordMap.set(recordIdentifier, record);
        } catch (e) {
          this.errors.push(`In record '${recordIdentifier}': ${e.message}`);
        }
      },
      TypeSignature: (node: TypeSignature) => {
        const functionName = node.identifier.value;
        const functionType = node.body;
        if (this.signatureMap.has(functionName)) {
          this.errors.push(
            `Function '${functionName}' has multiple type signatures`
          );
          return;
        }
        try {
          let resolvedInputs = [];
          let resolvedReturn;
          if (functionType.type === "ParameterizedType") {
            resolvedInputs = functionType.inputs.map((t) =>
              this.mapTypeNodePrimitives(t)
            );
            resolvedReturn = functionType.return;
          } else {
            resolvedReturn = functionType;
          }

          this.signatureMap.set(functionName, {
            type: "ParameterizedType",
            inputs: resolvedInputs,
            return: resolvedReturn,
            constraints: [],
          });
        } catch (e) {
          this.errors.push(`In signature for '${functionName}': ${e.message}`);
        }
      },
    });
  }

  // inside TypeChecker

  private unify(t1: Type, t2: Type): Substitution {
    if (this.typeEquals(t1, t2)) return new Map();

    if (t1.type === "TypeVar") return this.bindVariable(t1.value, t2);
    if (t2.type === "TypeVar") return this.bindVariable(t2.value, t1);

    if (t1.type === "ParameterizedType" && t2.type === "ParameterizedType") {
      const sub1 = this.unifyLists(t1.inputs, t2.inputs);
      const sub2 = this.unify(
        applySubstitution(t1.return, sub1),
        applySubstitution(t2.return, sub1)
      );
      return new Map([...sub1, ...sub2]);
    }
    throw new Error(
      `Type mismatch: Cannot unify ${formatType(t1)} with ${formatType(t2)}`
    );
  }

  private unifyLists(t1: Type[], t2: Type[]): Substitution {
    if (t1.length !== t2.length) {
      throw new Error(
        `Function arity mismatch: Expected ${t1.length} arguments but got ${t2.length}`
      );
    }
    return t1.reduce((sub, curr, i) => {
      const newSub = this.unify(
        applySubstitution(curr, sub),
        applySubstitution(t2[i], sub)
      );
      return new Map([...sub, ...newSub]);
    }, new Map());
  }

  private typeEquals(a: Type, b: Type): boolean {
    if (!a || !b || a.type !== b.type) return false;
    switch (a.type) {
      case "TypeVar":
        if (b.type !== "TypeVar") return false;
        return a.value === b.value;
      case "SimpleType":
        if (b.type !== "SimpleType") return false;
        return a.value === b.value;
      case "ParameterizedType":
        if (b.type !== "ParameterizedType") return false;
        return (
          this.typeEqualsList(a.inputs, b.inputs) &&
          this.typeEquals(a.return, b.return)
        );
      case "TupleType":
        if (b.type !== "TupleType") return false;
        return this.typeEqualsList(a.values, b.values);
      case "ListType":
        if (b.type !== "ListType") return false;
        return this.typeEquals(a.values, b.values);
      default:
        return false;
    }
  }

  private typeEqualsList(a: Type[], b: Type[]) {
    let combinedResult = true;
    for (let i = 0; i < a.length && combinedResult; i++) {
      const el1 = this.typeEquals(a[i], b[i]);
      if (!el1) {
        combinedResult = false;
        break;
      }
    }
    return combinedResult;
  }

  private resolveTypeAlias(type: Type, visited: Set<string> = new Set()): Type {
    switch (type.type) {
      case "SimpleType": {
        if (visited.has(type.value)) {
          this.errors.push(`Cyclic type alias detected: ${formatType(type)}`);
          throw new Error(`Cyclic type alias detected: ${formatType(type)}`);
        }
        if (this.typeAliasMap.has(type.value)) {
          visited.add(type.value);
          return this.resolveTypeAlias(
            this.typeAliasMap.get(type.value)!,
            visited
          );
        }
        return type;
      }

      case "ParameterizedType":
        return {
          type: "ParameterizedType",
          inputs: type.inputs.map((t) =>
            this.resolveTypeAlias(t, new Set(visited))
          ),
          return: this.resolveTypeAlias(type.return, new Set(visited)),
          constraints: [],
        };

      case "ConstrainedType":
      default:
        return type;
    }
  }

  private bindVariable(name: string, type: Type): Substitution {
    if (type.type === "SimpleType" && type.value === name) {
      // basically if they are the same TypeVar there isnt a need to substitute
      return new Map();
    }
    if (this.isTypeInfinite(name, type)) {
      this.errors.push(
        `Infinite type detected: ${name} occurs in ${formatType(type)}`
      );
      throw new Error(
        `Infinite type detected: ${name} occurs in ${formatType(type)}`
      );
    }
    return new Map([[name, type]]);
  }

  private isTypeInfinite(name: string, type: Type): boolean {
    switch (type.type) {
      case "SimpleType":
        return type.value === name;
      case "ParameterizedType":
        return (
          type.inputs.some((t) => this.isTypeInfinite(name, t)) ||
          this.isTypeInfinite(name, type.return)
        );
      default:
        return false;
    }
  }

  private resolvePatterns(
    param: Pattern,
    symbolMap: Map<string, Type>,
    paramTypes: Type[],
    i: number
  ) {
    switch (param.type) {
      case "WildcardPattern":
        break;
      case "VariablePattern":
        symbolMap.set(param.name.value, paramTypes[i]);
        break;
      case "ConstructorPattern": {
        const constructorType = this.signatureMap.get(param.constructor);
        if (constructorType.type === "ParameterizedType")
          param.patterns.forEach((el, j) =>
            this.resolvePatterns(
              el,
              symbolMap,
              [...constructorType.inputs, constructorType.return],
              j
            )
          );
        symbolMap.set(param.constructor, constructorType);
        break;
      }
      case "ListPattern": {
        const listType = paramTypes[i];
        if (listType.type === "SimpleType") {
          param.elements.forEach((el) =>
            this.resolvePatterns(
              el,
              symbolMap,
              [{ type: "SimpleType", value: listType.value, constraints: [] }],
              0
            )
          );
        } else {
          this.errors.push(
            `Pattern expects a list but found ${formatType(listType)}`
          );
        }
        break;
      }
      case "ConsPattern": {
        const listType = paramTypes[i];
        if (listType.type === "ListType") {
          this.resolvePatterns(param.head, symbolMap, [listType.values], 0);
          if (param.tail.type === "VariablePattern") {
            this.resolvePatterns(param.tail, symbolMap, [listType], 0);
          } else {
            this.resolvePatterns(param.tail, symbolMap, paramTypes, i);
          }
        } else {
          this.errors.push(
            `Couldn't match expected type '${JSON.stringify(
              listType
            )}' with actual ListPattern`
          );
        }

        break;
      }
      case "AsPattern": {
        const alias = param.alias;
        this.resolvePatterns(alias, symbolMap, paramTypes, i);
        this.resolvePatterns(param.pattern, symbolMap, paramTypes, i);
        break;
      }
      case "TuplePattern": {
        const tupleParamType = paramTypes[i];
        if (tupleParamType.type === "TupleType") {
          param.elements.forEach((pattern, idx) => {
            this.resolvePatterns(
              pattern,
              symbolMap,
              tupleParamType.values,
              idx
            );
          });
        } else {
          this.errors.push(
            `Pattern expects a tuple but found ${formatType(tupleParamType)}`
          );
        }
        break;
      }
      default:
        break;
    }
  }

  private mapTypeNodePrimitives(type: Type): Type {
    const mapPrimitiveNode = (t: Type): Type => {
      switch (t.type) {
        case "SimpleType": {
          const typeAliasType = this.recordMap.get(t.value);
          if (typeAliasType) return typeAliasType;

          const recordType = this.recordMap.get(t.value);
          if (recordType)
            return { ...t, type: "SimpleType", value: recordType.value };

          const primitiveType = typeMappings[t.value];
          if (primitiveType !== undefined)
            return {
              ...t,
              type: "SimpleType",
              value: primitiveType,
            };

          return t;
        }
        default:
          return t;
      }
    };
    return this.resolveTypeAlias(walkTypeNode(type, mapPrimitiveNode));
  }
}

interface InferContext {
  errors: string[];
  typeEquals: (a: Type, b: Type) => boolean;
  resolveTypeAlias: (type: Type, visited: Set<string>) => Type;
  unify: (a: Type, b: Type) => Substitution;
  signatureMap: Map<string, Type>;
  recordMap: Map<string, SimpleType>;
  typeAliasMap: Map<string, Type>;
}

class Inferer {
  private typeVarCounter: number = 0;
  constructor(private ctx: InferContext) {}

  private get errors() {
    return this.ctx.errors;
  }
  private get typeEquals() {
    return this.ctx.typeEquals;
  }
  private get unify() {
    return this.ctx.unify;
  }
  private get resolveTypeAlias() {
    return this.ctx.resolveTypeAlias;
  }
  private get signatureMap() {
    return this.ctx.signatureMap;
  }
  private get recordMap() {
    return this.ctx.recordMap;
  }
  private get typeAliasMap() {
    return this.ctx.typeAliasMap;
  }

  public inferType(
    node: BodyExpression,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    switch (node.type) {
      case "YuChar":
      case "YuString":
      case "YuNumber":
      case "YuBoolean":
        return this.inferPrimitive(node);

      case "YuList":
        return this.inferList(node, symbolMap, substitutions);

      case "YuSymbol":
        return this.inferSymbol(node, symbolMap);

      case "ArithmeticOperation":
        return this.inferArithmetic(node, symbolMap, substitutions);

      case "CompositionExpression":
        return this.inferComposition(node, symbolMap, substitutions);

      case "If":
        return this.inferIf(node, symbolMap, substitutions);

      case "Application":
        return this.inferApplication(node, symbolMap, substitutions);

      case "InfixApplication":
        return this.inferInfixApplication(node, symbolMap, substitutions);

      case "DataExpression":
        return this.inferDataExpression(node, symbolMap, substitutions);

      case "TupleExpression":
        return this.inferTuple(node, symbolMap, substitutions);

      case "ConsExpression":
        return this.inferCons(node, symbolMap, substitutions);

      case "ComparisonOperation":
        return this.inferComparison(node, symbolMap, substitutions);

      case "StringOperation":
        return this.inferStringOp(node, symbolMap, substitutions);

      case "Lambda":
        return this.inferLambda(node, symbolMap, substitutions);

      default:
        this.errors.push(`Unknown node type: ${node.type}`);
        return { type: "SimpleType", value: "Error", constraints: [] };
    }
  }

  private inferPrimitive(node: BodyExpression): Type {
    return { type: "SimpleType", value: node.type, constraints: [] };
  }
  private inferList(
    node: ListPrimitive,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const elementTypes = node.elements.map((el) =>
      this.inferType(el.body, symbolMap, substitutions)
    );
    if (elementTypes.length === 0) {
      return {
        type: "ListType",
        values: freshTypeVariable(this.typeVarCounter++),
        constraints: [],
      };
    }

    const first = elementTypes[0];
    if (!elementTypes.every((t) => this.typeEquals(first, t))) {
      this.errors.push(
        `List elements must all be same type. Found: ${formatType(
          first
        )} and others`
      );
      return { type: "SimpleType", value: "Error", constraints: [] };
    }
    return {
      type: "ListType",
      values: first,
      constraints: [],
    };
  }
  private inferSymbol(
    node: SymbolPrimitive,
    symbolMap: Map<string, Type>
  ): Type {
    const symbolValue = node.value;
    const symbolType =
      symbolMap.get(symbolValue) ??
      this.signatureMap.get(symbolValue) ??
      this.recordMap.get(symbolValue) ??
      this.typeAliasMap.get(symbolValue);

    if (!symbolType) {
      this.errors.push(`'${symbolValue}' is not defined in current scope`);
      return { type: "SimpleType", value: "Error", constraints: [] };
    }
    return symbolType;
  }
  private inferArithmetic(
    node: ArithmeticOperation,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const leftType = this.inferType(node.left.body, symbolMap, substitutions);
    const rightType = this.inferType(node.right.body, symbolMap, substitutions);
    const numberType: Type = {
      type: "SimpleType",
      value: "YuNumber",
      constraints: [],
    };

    const errorsMessage = `Arithmetic operation requires numbers, got ${formatType(
      leftType
    )} and ${formatType(rightType)}`;
    if (
      !this.tryUnify(leftType, numberType, substitutions, errorsMessage) ||
      !this.tryUnify(rightType, numberType, substitutions, errorsMessage)
    ) {
      return { type: "SimpleType", value: "Error", constraints: [] };
    }
    return numberType;
  }
  private inferComposition(
    node: CompositionExpression,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const funcType1 = this.inferType(node.right.body, symbolMap, substitutions);
    const funcType2 = this.inferType(node.left.body, symbolMap, substitutions);

    if (
      funcType1.type !== "ParameterizedType" ||
      funcType2.type !== "ParameterizedType"
    ) {
      this.errors.push(
        "Function composition requires both operands to be functions"
      );
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    const errorsMessage = `Function composition failed. Types: ${formatType(
      funcType1
    )} and ${formatType(funcType2)}`;

    if (
      !this.tryUnify(
        funcType1.inputs[0],
        funcType2.return,
        substitutions,
        errorsMessage
      )
    ) {
      return { type: "SimpleType", value: "Error", constraints: [] };
    }
    return {
      type: "ParameterizedType",
      inputs: funcType2.inputs,
      return: funcType1.return,
      constraints: [],
    };
  }
  private inferIf(
    node: If,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const conditionType = this.inferType(
      node.condition.body,
      symbolMap,
      substitutions
    );
    const thenType = this.inferType(node.then.body, symbolMap, substitutions);
    const elseType = this.inferType(node.else.body, symbolMap, substitutions);

    const boolType: Type = {
      type: "SimpleType",
      value: "YuBoolean",
      constraints: [],
    };
    const errorsMessage = `Type mismatch in if branches: ${formatType(
      thenType
    )} vs ${formatType(elseType)}`;

    if (
      !this.tryUnify(conditionType, boolType, substitutions, errorsMessage) ||
      !this.tryUnify(thenType, elseType, substitutions, errorsMessage)
    ) {
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    return thenType;
  }
  private inferApplication(
    node: Application,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const funcType = this.inferType(
      node.function.body,
      symbolMap,
      substitutions
    );
    const argType = this.inferType(
      node.parameter.type === "Expression"
        ? node.parameter.body
        : node.parameter,
      symbolMap,
      substitutions
    );
    // case for function with params
    if (funcType.type === "ParameterizedType" && funcType.inputs.length > 0) {
      const expectedArgType = applySubstitution(
        funcType.inputs[0],
        substitutions
      );
      const errorsMessage = `Cannot apply ${formatType(
        argType
      )} to function expecting ${formatType(expectedArgType)}`;
      if (
        !this.tryUnify(expectedArgType, argType, substitutions, errorsMessage)
      ) {
        return { type: "SimpleType", value: "Error", constraints: [] };
      }

      // handles application with partial application
      // in 'add 1 2' => first checks 'add 1' which gives a 'YuNumber -> YuNumber' => then 'YuNumber 2' finally getting YuNumber
      // in 'add 1' => checks for 'add 1' and resolves a function that expects a YuNumber and returns a YuNumber (YuNumber -> YuNumber)
      const remainingArgs = funcType.inputs
        .slice(1)
        .map((t) => applySubstitution(t, substitutions));
      const returnType = applySubstitution(funcType.return, substitutions);

      return remainingArgs.length > 0
        ? {
            type: "ParameterizedType",
            inputs: remainingArgs,
            return: returnType,
            constraints: [],
          }
        : returnType;
    } else {
      this.errors.push(
        `Trying to apply argument to non-function type: ${formatType(funcType)}`
      );
      return { type: "SimpleType", value: "Error", constraints: [] };
    }
  }
  private inferInfixApplication(
    node: InfixApplicationExpression,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const left = this.inferType(node.left.body, symbolMap, substitutions);
    const right = this.inferType(node.right.body, symbolMap, substitutions);
    const opType = this.signatureMap.get(node.operator.value);

    if (!opType || opType.type !== "ParameterizedType") {
      this.errors.push(`Unknown infix operator: ${node.operator}`);
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    const errorsMessage = `Type mismatch in infix application '${
      node.operator
    }': ${formatType(left)} vs ${formatType(right)}`;

    if (
      !this.tryUnify(opType.inputs[0], left, substitutions, errorsMessage) ||
      !this.tryUnify(opType.inputs[1], right, substitutions, errorsMessage)
    ) {
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    return opType.return;
  }
  private inferDataExpression(
    node: DataExpression,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const ctorType = this.signatureMap.get(node.name.value);
    if (!ctorType) {
      this.errors.push(`Unknown constructor: ${node.name.value}`);
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    if (ctorType.type !== "ParameterizedType") {
      return ctorType;
    }

    const argTypes = node.contents.map((a: any) =>
      this.inferType(a.body, symbolMap, substitutions)
    );
    if (argTypes.length !== ctorType.inputs.length) {
      this.errors.push(
        `Constructor ${node.name.value} expected ${ctorType.inputs.length} args but got ${argTypes.length}`
      );
      return { type: "SimpleType", value: "Error", constraints: [] };
    }
    const errorsMessage = `Type mismatch in constructor ${node.name.value}`;

    for (let i = 0; i < argTypes.length; i++) {
      if (
        !this.tryUnify(
          ctorType.inputs[i],
          argTypes[i],
          substitutions,
          errorsMessage
        )
      ) {
        return { type: "SimpleType", value: "Error", constraints: [] };
      }
    }

    return ctorType.return;
  }
  private inferTuple(
    node: TupleExpression,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const elementTypes = node.elements.map((e: any) =>
      this.inferType(e.body, symbolMap, substitutions)
    );
    return { type: "TupleType", values: elementTypes, constraints: [] };
  }
  private inferCons(
    node: ConsExpression,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const headType = this.inferType(node.head.body, symbolMap, substitutions);
    const tailType = this.inferType(node.tail.body, symbolMap, substitutions);

    if (tailType.type !== "ListType") {
      this.errors.push(
        `Right-hand side of cons must be a list. Got: ${formatType(tailType)}`
      );
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    const errorsMessage = `Type mismatch in cons: head ${formatType(
      headType
    )} vs list of ${formatType(tailType.values)}`;
    if (
      !this.tryUnify(headType, tailType.values, substitutions, errorsMessage)
    ) {
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    return { type: "ListType", values: headType, constraints: [] };
  }
  private inferComparison(
    node: ComparisonOperation,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const left = this.inferType(node.left.body, symbolMap, substitutions);
    const right = this.inferType(node.right.body, symbolMap, substitutions);

    const errorsMessage = `Comparison operands must match. Got ${formatType(
      left
    )} vs ${formatType(right)}`;
    if (!this.tryUnify(left, right, substitutions, errorsMessage)) {
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    return { type: "SimpleType", value: "YuBoolean", constraints: [] };
  }
  private inferStringOp(
    node: StringOperation,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const left = this.inferType(node.left.body, symbolMap, substitutions);
    const right = this.inferType(node.right.body, symbolMap, substitutions);
    const strType: Type = {
      type: "SimpleType",
      value: "YuString",
      constraints: [],
    };

    const errorsMessage = `String operation requires both operands to be strings. Got ${formatType(
      left
    )} and ${formatType(right)}`;
    if (
      !this.tryUnify(left, strType, substitutions, errorsMessage) ||
      !this.tryUnify(right, strType, substitutions, errorsMessage)
    ) {
      return { type: "SimpleType", value: "Error", constraints: [] };
    }

    return strType;
  }
  private inferLambda(
    node: Lambda,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    const paramTypes = node.parameters.map((_: any) =>
      freshTypeVariable(this.typeVarCounter++)
    );

    const newSymbolMap = new Map(symbolMap);
    node.parameters.forEach((p: any, i: number) =>
      newSymbolMap.set(p.name, paramTypes[i])
    );

    const bodyType = this.inferType(
      node.body.body,
      newSymbolMap,
      substitutions
    );

    return {
      type: "ParameterizedType",
      inputs: paramTypes,
      return: bodyType,
      constraints: [],
    };
  }
  private tryUnify(
    a: Type,
    b: Type,
    substitutions: Substitution,
    errMsg: string
  ): boolean {
    try {
      const subs = this.unify(a, b);
      subs.forEach((v, k) => substitutions.set(k, v));
      return true;
    } catch {
      this.errors.push(errMsg);
      return false;
    }
  }
}
