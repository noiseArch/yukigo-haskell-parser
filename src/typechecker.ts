import {
  AST,
  BodyExpression,
  Record,
  traverse,
  Function,
  TypeAlias,
  SimpleType,
  ParameterizedType,
  SymbolPrimitive,
  UnguardedBody,
  Pattern,
  TypeSignature,
} from "yukigo-core";
import { Type } from "yukigo-core";
import { typeMappings } from "./utils/types.js";
import { isGuardedBody, isUnguardedBody } from "./utils/helpers.js";

type Substitution = Map<string, Type>;

// big ahh class down here -_-

export class TypeChecker {
  private errors: string[] = [];
  private signatureMap = new Map<string, SimpleType | ParameterizedType>();
  private recordMap = new Map<string, SimpleType>();
  private typeAliasMap = new Map<string, Type>();

  public check(ast: AST): string[] {
    this.buildGlobalEnvironment(ast);
    traverse(ast, {
      function: (node: Function) => {
        // search function signature
        const functionName = node.identifier.value;
        const functionType: Type | undefined =
          this.signatureMap.get(functionName);

        if (!functionType)
          this.errors.push(
            `Function '${functionName}' is used but not defined`
          );

        for (const func of node.equations) {
          const substitutions: Substitution = new Map();
          const symbolMap = new Map<string, Type>();
          const returnType =
            functionType.type === "SimpleType"
              ? functionType
              : functionType.return;

          // resolve param types
          const paramTypes: Type[] =
            functionType.type === "SimpleType"
              ? []
              : functionType.inputs.map((t) => this.mapTypeNodePrimitives(t));
          func.patterns.forEach((param, i) => {
            this.resolvePatterns(param, symbolMap, paramTypes, i);
          });

          let subReturnType: Type;
          let subInferredType: Type;
          // infer the return expression
          if (!Array.isArray(func.body)) {
            // function body doesnt have guards
            const funcInferredType = this.inferType(
              func.body.expression.body,
              symbolMap,
              substitutions
            );
            /*             if (
              funcInferredType.type === "ListType" &&
              funcInferredType.element.type === "TypeVar"
            ) {
              const sub1 = this.unify(returnType, funcInferredType);
              sub1.forEach((v, k) => substitutions.set(k, v));
            } */
            subReturnType = this.applySubstitution(returnType, substitutions);
            subInferredType = this.applySubstitution(
              funcInferredType,
              substitutions
            );
          } else {
            // function body has guards, checks for each if it has a valid condition and its return expr
            for (const guard of func.body) {
              const guardBody = guard.condition.body;

              const isOtherwise =
                guardBody.type === "YuSymbol" &&
                guardBody.value === "otherwise";

              const guardInferredType: Type = isOtherwise
                ? { type: "SimpleType", value: "YuBoolean", constraints: [] }
                : this.inferType(guardBody, symbolMap, substitutions);

              if (
                guardInferredType.type !== "SimpleType" ||
                guardInferredType.value !== "YuBoolean"
              ) {
                this.errors.push(
                  `Guard condition must evaluate to a boolean (YuBoolean), but found ${this.formatType(
                    guardInferredType
                  )}`
                );
                return;
              }
              const funcInferredType = this.inferType(
                guard.body.body,
                symbolMap,
                substitutions
              );
              subReturnType = this.applySubstitution(returnType, substitutions);
              subInferredType = this.applySubstitution(
                funcInferredType,
                substitutions
              );
            }
          }
          // unify signature return type with inferred type
          if (!this.typeEquals(subReturnType, subInferredType)) {
            this.errors.push(
              `Type mismatch in '${functionName}': Expected ${this.formatType(
                subReturnType
              )} but got ${this.formatType(subInferredType)}`
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
        for (const constructor of node.contents) {
          const cons = Array.from(this.recordMap).some(
            (cons1) => cons1[1].value === constructor.name
          );
          if (cons) {
            this.errors.push(
              `Constructor '${constructor.name}' is already defined`
            );
            return;
          }
        }
        // resolve and save types of constructors in recordMap
        try {
          const resolvedConstructors = [];
          for (const cons of node.contents) {
            const resCons = {
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
          /*           const record: DataType = {
            type: "DataType",
            name: recordIdentifier,
            constructors: resolvedConstructors,
          };
          this.recordMap.set(recordIdentifier, record); */
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

  private inferType(
    node: BodyExpression,
    symbolMap: Map<string, Type>,
    substitutions: Substitution
  ): Type {
    switch (node.type) {
      case "YuChar":
      case "YuString":
      case "YuNumber":
      case "YuBoolean":
        return {
          type: "SimpleType",
          value: node.value.toString(),
          constraints: [],
        };
      case "YuList": {
        const elementInferredTypes = node.elements.map((element) =>
          this.inferType(element.body, symbolMap, substitutions)
        );
        const firstType =
          elementInferredTypes.length === 0
            ? undefined
            : elementInferredTypes[0];
        if (!firstType) {
          const listVarType: SimpleType = {
            type: "SimpleType",
            value: `var_${Math.random()}`,
            constraints: [],
          };
          return listVarType;
        }
        const allElementsMatch = elementInferredTypes.every((element) =>
          this.typeEquals(firstType, element)
        );
        if (allElementsMatch) {
          return firstType;
        }
        this.errors.push(
          `List elements must be the same type. Found mixed types: ${this.formatType(
            firstType
          )} and others`
        );
        return { type: "SimpleType", value: "TypeError", constraints: [] };
      }
      case "YuSymbol": {
        const symbolValue = node.value;

        // first checks the symbolMap for parameters, then the signatures, then the typeAliases and finally the records
        const symbolType =
          symbolMap.get(symbolValue) ??
          this.signatureMap.get(symbolValue) ??
          this.typeAliasMap.get(symbolValue) ??
          this.recordMap.get(symbolValue);

        if (!symbolType) {
          this.errors.push(`'${node.value}' is not defined in current scope`);
          return { type: "SimpleType", value: node.value, constraints: [] };
        }
        return symbolType;
      }
      case "Arithmetic": {
        const leftType = this.inferType(
          node.left.body,
          symbolMap,
          substitutions
        );
        const rightType = this.inferType(
          node.right.body,
          symbolMap,
          substitutions
        );
        const numberType: Type = {
          type: "SimpleType",
          value: "YuNumber",
          constraints: [],
        };

        try {
          const sub1 = this.unify(leftType, numberType);
          sub1.forEach((v, k) => substitutions.set(k, v));
          const sub2 = this.unify(rightType, numberType);
          sub2.forEach((v, k) => substitutions.set(k, v));
        } catch (e) {
          this.errors.push(
            `Arithmetic operation requires numbers, but got ${this.formatType(
              leftType
            )} and ${this.formatType(rightType)}`
          );
          return { type: "SimpleType", value: "TypeError", constraints: [] };
        }
        return numberType;
      }

      case "CompositionExpression": {
        const leftHandType = this.inferType(
          node.left,
          symbolMap,
          substitutions
        );
        const rightHandType = this.inferType(
          node.right,
          symbolMap,
          substitutions
        );

        if (leftHandType.type !== "ParameterizedType") {
          this.errors.push(
            `Left side of composition must be a function. Found: ${this.formatType(
              leftHandType
            )}`
          );
          return { type: "SimpleType", value: "Error", constraints: [] };
        }
        if (rightHandType.type !== "ParameterizedType") {
          this.errors.push(
            `Right side of composition must be a function. Found: ${this.formatType(
              rightHandType
            )}`
          );
          return { type: "SimpleType", value: "Error", constraints: [] };
        }

        if (!this.typeEquals(leftHandType, rightHandType)) {
          this.errors.push(
            `Function types in composition don't match: ${this.formatType(
              leftHandType
            )} vs ${this.formatType(rightHandType)}`
          );
          return { type: "SimpleType", value: "Error", constraints: [] };
        }

        const leftReturn = leftHandType.return;

        if (leftReturn.type === "SimpleType") return leftReturn;

        this.errors.push(
          `Cannot determine return type name for composition: ${JSON.stringify(
            leftReturn
          )}`
        );
        return { type: "SimpleType", value: "Error", constraints: [] };
      }
      case "If": {
        const conditionType = this.inferType(
          node.condition.body,
          symbolMap,
          substitutions
        );

        const isConditionBoolean =
          conditionType.type === "SimpleType" &&
          conditionType.value === "YuBoolean";

        if (!isConditionBoolean) {
          this.errors.push(
            `Condition must be a boolean (YuBoolean), found ${this.formatType(
              conditionType
            )}`
          );
          return { type: "SimpleType", value: "Error", constraints: [] };
        }

        const thenType = this.applySubstitution(
          this.inferType(node.then.body, symbolMap, substitutions),
          substitutions
        );
        const elseType = this.applySubstitution(
          this.inferType(node.else.body, symbolMap, substitutions),
          substitutions
        );

        if (!this.typeEquals(thenType, elseType)) {
          this.errors.push(
            `If-then-else branches have different types: 'then' is ${this.formatType(
              thenType
            )} while 'else' is ${this.formatType(elseType)}`
          );
          return { type: "SimpleType", value: "Error", constraints: [] };
        }

        return thenType;
      }
      case "Application": {
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
        if (
          funcType.type === "ParameterizedType" &&
          funcType.inputs.length > 0
        ) {
          const expectedArgType = this.applySubstitution(
            funcType.inputs[0],
            substitutions
          );
          try {
            const newSub = this.unify(expectedArgType, argType);
            newSub.forEach((value, key) => substitutions.set(key, value));
          } catch (error) {
            this.errors.push(
              `Cannot apply ${this.formatType(
                argType
              )} to function expecting ${this.formatType(expectedArgType)}`
            );
            return { type: "SimpleType", value: "Error", constraints: [] };
          }

          // handles application with partial application
          // in 'add 1 2' => first checks 'add 1' which gives a 'YuNumber -> YuNumber' => then 'YuNumber 2' finally getting YuNumber
          // in 'add 1' => checks for 'add 1' and resolves a function that expects a YuNumber and returns a YuNumber (YuNumber -> YuNumber)
          const remainingArgs = funcType.inputs
            .slice(1)
            .map((t) => this.applySubstitution(t, substitutions));
          const returnType = this.applySubstitution(
            funcType.return,
            substitutions
          );

          return remainingArgs.length > 0
            ? {
                type: "ParameterizedType",
                inputs: remainingArgs,
                return: returnType,
                constraints: [],
              }
            : returnType;
        } else {
          // default case, not functiontype or datatype. im not sure about this
          const returnType: Type = {
            type: "SimpleType",
            value: `ret_${Math.random()}`,
            constraints: [],
          };
          const expectedFuncType: Type = {
            type: "ParameterizedType",
            inputs: [argType],
            return: returnType,
            constraints: [],
          };
          try {
            const newSub = this.unify(funcType, expectedFuncType);
            newSub.forEach((value, key) => substitutions.set(key, value));
            return returnType;
          } catch (error) {
            this.errors.push(
              `Error while unifying ApplicationExpression: ${error.message}`
            );
            return { type: "SimpleType", value: "Error", constraints: [] };
          }
        }
      }
      case "InfixApplication": {
        const operatorSymbol = node.operator;

        const firstApp: BodyExpression = {
          type: "Application",
          function: {
            type: "Expression",
            body: operatorSymbol,
          },
          parameter: {
            type: "Expression",
            body: node.left.body,
          },
        };
        // treats infix application as a common application
        const secondApp: BodyExpression = {
          type: "Application",
          function: {
            type: "Expression",
            body: firstApp,
          },
          parameter: {
            type: "Expression",
            body: node.right.body,
          },
        };
        return this.inferType(secondApp, symbolMap, substitutions);
      }
      case "DataExpression": {
        const dataConstructor = node.name.value;
        const dataType = this.signatureMap.get(dataConstructor);
        if (!dataType || dataType.type === "SimpleType") {
          this.errors.push(`Constructor '${dataConstructor}' is not defined`);
          return { type: "SimpleType", value: "Error", constraints: [] };
        }
        for (let i = 0; i < dataType.inputs.length; i++) {
          const expectedType = dataType.inputs[i];
          const inputValue = node.contents[i].expression.body;
          const inputType = this.inferType(
            inputValue,
            symbolMap,
            substitutions
          );
          try {
            const sub = this.unify(inputType, expectedType);
            sub.forEach((v, k) => substitutions.set(k, v));
          } catch (e) {
            const attributeName = node.contents[i].name.value;
            this.errors.push(
              `Field '${attributeName}' expected ${this.formatType(
                expectedType
              )} but got ${this.formatType(inputType)}`
            );
            return { type: "SimpleType", value: "Error", constraints: [] };
          }
        }
        return dataType.return;
      }
      case "TupleExpression": {
        const elementTypes = node.elements.map((el) =>
          this.inferType(el.body, symbolMap, substitutions)
        );
        return { type: "ListType", values: elementTypes, constraints: [] };
      }
      case "ConsExpression": {
        const headType = this.inferType(
          node.head.body,
          symbolMap,
          substitutions
        );
        const tailType = this.inferType(
          node.tail.body,
          symbolMap,
          substitutions
        );
        if (tailType.type !== "SimpleType" || tailType.value !== "YuList") {
          this.errors.push(
            `Right side of ':' must be a list. Found: ${this.formatType(
              tailType
            )}`
          );
          return { type: "SimpleType", value: "Error", constraints: [] };
        }
        try {
          const sub = this.unify(headType, tailType);
          sub.forEach((v, k) => substitutions.set(k, v));
          return tailType;
        } catch (e) {
          this.errors.push(
            `Cons operator ':' requires matching types. Head is ${this.formatType(
              headType
            )} but list contains ${this.formatType(tailType)}`
          );

          return { type: "SimpleType", value: "Error", constraints: [] };
        }
      }
      case "Comparison": {
        const leftType = this.inferType(
          node.left.body,
          symbolMap,
          substitutions
        );
        const rightType = this.inferType(
          node.right.body,
          symbolMap,
          substitutions
        );

        try {
          const sub = this.unify(leftType, rightType);
          sub.forEach((v, k) => substitutions.set(k, v));
        } catch (e) {
          this.errors.push(
            `Comparison requires matching types. Left is ${this.formatType(
              leftType
            )}, right is ${this.formatType(rightType)}`
          );
          return { type: "SimpleType", value: "Error", constraints: [] };
        }

        return { type: "SimpleType", value: "YuBoolean", constraints: [] };
      }
      /*       case "Concat": {
        const leftType = this.inferType(
          node.left.body,
          symbolMap,
          substitutions
        );
        const rightType = this.inferType(
          node.right.body,
          symbolMap,
          substitutions
        );
        let unifiedType: Type;

        try {
          const sub1 = this.unify(leftType, rightType);
          sub1.forEach((v, k) => substitutions.set(k, v));
          unifiedType = this.applySubstitution(leftType, substitutions);
        } catch (e) {
          this.errors.push(
            `Concatenation requires both sides to be lists or strings. Got ${this.formatType(
              leftType
            )} and ${this.formatType(rightType)}`
          );
          return {
            type: "SimpleType",
            value: { type: "YuSymbol", value: `Error` },
            constraints: [],
          };
        }
        const isValidType =
          unifiedType.type === "SimpleType" &&
          (unifiedType.value.value === "YuString" ||
            unifiedType.value.value === "YuList");

        if (isValidType) return unifiedType;

        if (unifiedType.type !== "SimpleType") {
          this.errors.push(
            `Concatenation requires both sides to be lists or strings. Got ${this.formatType(
              leftType
            )} and ${this.formatType(rightType)}`
          );
          return {
            type: "SimpleType",
            value: { type: "YuSymbol", value: `Error` },
            constraints: [],
          };
        }

        // If a TypeVar, try to unify it to a YuString or a YuList.
        const elemType: Type = {
          type: "SimpleType",
          value: { type: "YuSymbol", value: `elem_${Math.random()}` },
          constraints: [],
        };
        try {
          this.unify(unifiedType, {
            type: "SimpleType",
            value: { type: "YuSymbol", value: "YuString" },
            constraints: [],
          });
          return {
            type: "SimpleType",
            value: { type: "YuSymbol", value: "YuString" },
            constraints: [],
          };
        } catch {
          try {
            this.unify(unifiedType, elemType);
            return elemType;
          } catch (e) {
            this.errors.push(
              `Concat requires both sides to be strings or lists of the same type. ` +
                `Got: ${JSON.stringify(leftType)} and ${JSON.stringify(
                  rightType
                )}`
            );
            return {
              type: "SimpleType",
              value: { type: "YuSymbol", value: `Error` },
              constraints: [],
            };
          }
        }
      } */
      case "Lambda": {
        const lambdaSymbolMap = new Map(symbolMap);
        const paramTypes: Type[] = [];

        for (const param of node.parameters) {
          if (param.type === "VariablePattern") {
            const typeVar: Type = {
              type: "SimpleType",
              value: `lambda_${Math.random()}`,
              constraints: [],
            };
            lambdaSymbolMap.set(param.name.value, typeVar);
            paramTypes.push(typeVar);
          } else {
            // TODO add missing patterns
            this.errors.push(
              `Unsupported pattern in lambda parameter: ${param.type}`
            );
            return {
              type: "SimpleType",
              value: "Error",
              constraints: [],
            };
          }
        }

        const bodyType = this.inferType(
          node.body.body,
          lambdaSymbolMap,
          substitutions
        );

        return {
          type: "ParameterizedType",
          inputs: paramTypes,
          return: bodyType,
          constraints: [],
        };
      }
      default:
        break;
    }
  }

  private unify(t1: Type, t2: Type): Substitution {
    if (this.typeEquals(t1, t2)) return new Map();

    if (t1.type === "SimpleType") return this.bindVariable(t1.value, t2);
    if (t2.type === "SimpleType") return this.bindVariable(t2.value, t1);

    if (t1.type === "ParameterizedType" && t2.type === "ParameterizedType") {
      const sub1 = this.unifyLists(t1.inputs, t2.inputs);
      const sub2 = this.unify(
        this.applySubstitution(t1.return, sub1),
        this.applySubstitution(t2.return, sub1)
      );
      return new Map([...sub1, ...sub2]);
    }
    throw new Error(
      `Type mismatch: Cannot unify ${this.formatType(
        t1
      )} with ${this.formatType(t2)}`
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
        this.applySubstitution(curr, sub),
        this.applySubstitution(t2[i], sub)
      );
      return new Map([...sub, ...newSub]);
    }, new Map());
  }

  private resolveType(type: SimpleType): Type | undefined {
    const primitiveType = typeMappings[type.value];
    if (primitiveType)
      return {
        type: "SimpleType",
        value: primitiveType,
        constraints: [],
      };
    const typeAlias = this.typeAliasMap.get(type.value);
    if (typeAlias) return typeAlias;
    return undefined;
  }

  private typeEquals(a: Type, b: Type): boolean {
    if (!a || !b || a.type !== b.type) return false;
    switch (a.type) {
      case "SimpleType":
        if (b.type !== "SimpleType") return false;
        return a.value === b.value;
      case "ParameterizedType":
        if (b.type !== "ParameterizedType") return false;
        return (
          this.typeEqualsList(a.inputs, b.inputs) &&
          this.typeEquals(a.return, b.return)
        );
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
          throw new Error(
            `Cyclic type alias detected: ${this.formatType(type)}`
          );
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
      throw new Error(
        `Infinite type detected: ${name} occurs in ${this.formatType(type)}`
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
            `Pattern expects a list but found ${this.formatType(listType)}`
          );
        }
        break;
      }
      case "ConsPattern": {
        const listType = paramTypes[i];
        if (listType.type === "SimpleType") {
          this.resolvePatterns(
            param.head,
            symbolMap,
            [{ type: "SimpleType", value: listType.value, constraints: [] }],
            0
          );
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
        if (tupleParamType.type === "SimpleType") {
          param.elements.forEach((pattern, idx) => {
            this.resolvePatterns(
              pattern,
              symbolMap,
              [
                {
                  type: "SimpleType",
                  value: tupleParamType.value,
                  constraints: [],
                },
              ],
              idx
            );
          });
        } else {
          this.errors.push(
            `Pattern expects a tuple but found ${this.formatType(
              tupleParamType
            )}`
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
          if (this.typeAliasMap.has(t.value)) {
            return this.typeAliasMap.get(t.value);
          }
          if (this.recordMap.has(t.value)) {
            return { ...t, type: "SimpleType", value: t.value };
          }
          if (t.value in typeMappings) {
            return {
              ...t,
              type: "SimpleType",
              value: typeMappings[t.value],
            };
          }
          return t;
        }
        default:
          return t;
      }
    };
    return this.walkTypeNode(type, mapPrimitiveNode);
  }

  private applySubstitution(type: Type, sub: Substitution): Type {
    const substituteNode = (t: Type): Type => {
      if (t.type === "SimpleType") {
        const typeSub = sub.get(t.value);
        if (typeSub) {
          return this.applySubstitution(typeSub, sub);
        }
      }
      return t;
    };
    return this.walkTypeNode(type, substituteNode);
  }

  private walkTypeNode(type: Type, callback: (node: Type) => Type): Type {
    const result = callback(type);
    switch (result.type) {
      case "ParameterizedType":
        return {
          ...result,
          inputs: result.inputs.map((t) => this.walkTypeNode(t, callback)),
          return: this.walkTypeNode(result.return, callback),
        };
      default:
        return result;
    }
  }
  private formatType(type: Type): string {
    switch (type.type) {
      case "SimpleType":
        return type.value;
      case "ParameterizedType":
        const args = type.inputs.map((t) => this.formatType(t)).join(" -> ");
        return `(${args}) -> ${this.formatType(type.return)}`;
      case "ConstrainedType":
      default:
        return JSON.stringify(type);
    }
  }
}
