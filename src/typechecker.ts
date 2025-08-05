import {
  ASTGrouped,
  BodyExpression,
  FunctionType,
  Record,
  traverse,
} from "yukigo-core";
import {
  DataType,
  FunctionGroup,
  FunctionTypeSignature,
  ListType,
  Pattern,
  TypeAlias,
  TypeNode,
  TypeVar,
} from "yukigo-core";
import { typeMappings } from "./utils/types.js";
import { isGuardedBody, isUnguardedBody } from "./utils/helpers.js";

type Substitution = Map<string, TypeNode>;

// big ahh class down here -_-

export class TypeChecker {
  private errors: string[] = [];
  private signatureMap = new Map<string, FunctionType>();
  private recordMap = new Map<string, DataType>();
  private typeAliasMap = new Map<string, TypeNode>();

  public check(ast: ASTGrouped): string[] {
    this.buildGlobalEnvironment(ast);
    traverse(ast, {
      function: (node: FunctionGroup) => {
        const functionName = node.name.value;
        const functionType: TypeNode | undefined =
          this.signatureMap.get(functionName);

        if (!functionType)
          this.errors.push(
            `Function '${functionName}' is used but not defined`
          );

        // checks for every "instance" of the function.
        // like pattern matching "generates" two funcs in node.contents
        for (const func of node.contents) {
          const substitutions: Substitution = new Map();
          const symbolMap = new Map<string, TypeNode>();
          const returnType: TypeNode = functionType.to;

          // resolve param types
          const paramTypes: TypeNode[] = functionType.from.map((t) =>
            this.mapTypeNodePrimitives(t)
          );
          func.parameters.forEach((param, i) => {
            this.resolvePatterns(param, symbolMap, paramTypes, i);
          });
          let subReturnType: TypeNode;
          let subInferredType: TypeNode;
          // infer the return expression
          if (isUnguardedBody(func)) {
            // function body doesnt have guards
            const funcInferredType = this.inferType(
              func.return.body,
              symbolMap,
              substitutions
            );
            if (
              returnType.type === "ListType" &&
              funcInferredType.type === "ListType" &&
              funcInferredType.element.type === "TypeVar"
            ) {
              const sub1 = this.unify(returnType, funcInferredType);
              sub1.forEach((v, k) => substitutions.set(k, v));
            }
            subReturnType = this.applySubstitution(returnType, substitutions);
            subInferredType = this.applySubstitution(
              funcInferredType,
              substitutions
            );
          } else if (isGuardedBody(func)) {
            // function body has guards, checks for each if it has a valid condition and its return expr
            for (const guard of func.body) {
              const guardBody = guard.condition.body;

              const isOtherwise =
                guardBody.type === "YuSymbol" &&
                guardBody.value === "otherwise";

              const guardInferredType: TypeNode = isOtherwise
                ? { type: "TypeConstructor", name: "YuBoolean" }
                : this.inferType(guardBody, symbolMap, substitutions);

              if (
                guardInferredType.type !== "TypeConstructor" ||
                guardInferredType.name !== "YuBoolean"
              ) {
                this.errors.push(
                  `Guard condition must evaluate to a boolean (YuBoolean), but found ${this.formatType(
                    guardInferredType
                  )}`
                );
                return;
              }
              const funcInferredType = this.inferType(
                guard.return.body,
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

  private buildGlobalEnvironment(ast: ASTGrouped) {
    traverse(ast, {
      TypeAlias: (node: TypeAlias) => {
        const typeAliasIdentifier = node.name.value;
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
            (cons1) => cons1[1].name === constructor.name
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

            const constructorFuncType: FunctionType = {
              type: "FunctionType",
              from: resCons.fields.map((field) => field.value),
              to: { type: "TypeConstructor", name: recordIdentifier },
            };

            this.signatureMap.set(resCons.name, constructorFuncType);
            resCons.fields.forEach(
              (field) =>
                field.name &&
                this.signatureMap.set(field.name.value, {
                  type: "FunctionType",
                  from: [{ type: "TypeConstructor", name: recordIdentifier }],
                  to: field.value,
                })
            );
          }
          const record: DataType = {
            type: "DataType",
            name: recordIdentifier,
            constructors: resolvedConstructors,
          };
          this.recordMap.set(recordIdentifier, record);
        } catch (e) {
          this.errors.push(`In record '${recordIdentifier}': ${e.message}`);
        }
      },
      TypeSignature: (node: FunctionTypeSignature) => {
        const functionName = node.name.value;
        const returnType = node.returnType;
        if (this.signatureMap.has(functionName)) {
          this.errors.push(
            `Function '${functionName}' has multiple type signatures`
          );
          return;
        }
        try {
          const resolvedInputs = node.inputTypes.map((t) =>
            this.mapTypeNodePrimitives(t)
          );
          const resolvedReturn = this.mapTypeNodePrimitives(returnType);
          let finalInputs = resolvedInputs;
          let finalReturn = resolvedReturn;

          const isFunctionType =
            (returnType.type === "TypeVar" ||
              returnType.type === "TypeConstructor") &&
            resolvedReturn.type === "FunctionType";

          if (isFunctionType) {
            finalInputs = [...resolvedInputs, ...resolvedReturn.from];
            finalReturn = resolvedReturn.to;
          }

          this.signatureMap.set(functionName, {
            type: "FunctionType",
            from: finalInputs,
            to: finalReturn,
          });
        } catch (e) {
          this.errors.push(`In signature for '${functionName}': ${e.message}`);
        }
      },
    });
    console.log(this.signatureMap);
  }

  private inferType(
    node: BodyExpression,
    symbolMap: Map<string, TypeNode>,
    substitutions: Substitution
  ): TypeNode {
    switch (node.type) {
      case "YuChar":
      case "YuString":
      case "YuNumber":
      case "YuBoolean":
        return { type: "TypeConstructor", name: node.type };
      case "YuList": {
        const elementInferredTypes = node.elements.map((element) =>
          this.inferType(element.body, symbolMap, substitutions)
        );
        const firstType =
          elementInferredTypes.length === 0
            ? undefined
            : elementInferredTypes[0];
        if (!firstType) {
          const listVarType: ListType = {
            type: "ListType",
            element: { type: "TypeVar", name: `var_${Math.random()}` },
          };
          return listVarType;
        }
        const allElementsMatch = elementInferredTypes.every((element) =>
          this.typeEquals(firstType, element)
        );
        if (allElementsMatch) {
          return {
            type: "ListType",
            element: firstType,
          };
        }
        this.errors.push(
          `List elements must be the same type. Found mixed types: ${this.formatType(
            firstType
          )} and others`
        );
        return {
          type: "ListType",
          element: { type: "TypeVar", name: "Error" },
        };
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
          return { type: "TypeVar", name: node.value };
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
        const numberType: TypeNode = {
          type: "TypeConstructor",
          name: "YuNumber",
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
          return { type: "TypeVar", name: "TypeError" };
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

        if (leftHandType.type !== "FunctionType") {
          this.errors.push(
            `Left side of composition must be a function. Found: ${this.formatType(
              leftHandType
            )}`
          );
          return { type: "TypeVar", name: "Error" };
        }
        if (rightHandType.type !== "FunctionType") {
          this.errors.push(
            `Right side of composition must be a function. Found: ${this.formatType(
              rightHandType
            )}`
          );
          return { type: "TypeVar", name: "Error" };
        }

        if (!this.typeEquals(leftHandType, rightHandType)) {
          this.errors.push(
            `Function types in composition don't match: ${this.formatType(
              leftHandType
            )} vs ${this.formatType(rightHandType)}`
          );
          return { type: "TypeVar", name: "Error" };
        }

        const leftReturn = leftHandType.to;

        if (
          leftReturn.type === "TypeConstructor" ||
          leftReturn.type === "TypeVar"
        ) {
          return {
            type: "TypeConstructor",
            name: leftReturn.name,
          };
        }

        this.errors.push(
          `Cannot determine return type name for composition: ${JSON.stringify(
            leftReturn
          )}`
        );
        return { type: "TypeVar", name: "Error" };
      }
      case "IfThenElse": {
        const conditionType = this.inferType(
          node.condition.body,
          symbolMap,
          substitutions
        );

        const isConditionBoolean =
          conditionType.type == "TypeConstructor" &&
          conditionType.name == "YuBoolean";

        if (!isConditionBoolean) {
          this.errors.push(
            `Condition must be a boolean (YuBoolean), found ${this.formatType(
              conditionType
            )}`
          );
          return { type: "TypeVar", name: "Error" };
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
          return { type: "TypeVar", name: "Error" };
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
        if (funcType.type === "FunctionType" && funcType.from.length > 0) {
          const expectedArgType = this.applySubstitution(
            funcType.from[0],
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
            return { type: "TypeVar", name: "Error" };
          }

          // handles application with partial application
          // in 'add 1 2' => first checks 'add 1' which gives a 'YuNumber -> YuNumber' => then 'YuNumber 2' finally getting YuNumber
          // in 'add 1' => checks for 'add 1' and resolves a function that expects a YuNumber and returns a YuNumber (YuNumber -> YuNumber)
          const remainingArgs = funcType.from
            .slice(1)
            .map((t) => this.applySubstitution(t, substitutions));
          const returnType = this.applySubstitution(funcType.to, substitutions);

          return remainingArgs.length > 0
            ? { type: "FunctionType", from: remainingArgs, to: returnType }
            : returnType;
        } else {
          // default case, not functiontype or datatype. im not sure about this
          const returnType: TypeNode = {
            type: "TypeVar",
            name: `ret_${Math.random()}`,
          };
          const expectedFuncType: TypeNode = {
            type: "FunctionType",
            from: [argType],
            to: returnType,
          };
          try {
            const newSub = this.unify(funcType, expectedFuncType);
            newSub.forEach((value, key) => substitutions.set(key, value));
            return returnType;
          } catch (error) {
            this.errors.push(
              `Error while unifying ApplicationExpression: ${error.message}`
            );
            return { type: "TypeVar", name: "Error" };
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
        if (!dataType) {
          this.errors.push(`Constructor '${dataConstructor}' is not defined`);
          return { type: "TypeVar", name: "Error" };
        }
        for (let i = 0; i < dataType.from.length; i++) {
          const expectedType = dataType.from[i];
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
            return { type: "TypeVar", name: "TypeError" };
          }
        }
        return dataType.to;
      }
      case "TupleExpression": {
        const elementTypes = node.elements.map((el) =>
          this.inferType(el.body, symbolMap, substitutions)
        );
        return { type: "TupleType", elements: elementTypes };
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
        if (tailType.type !== "ListType") {
          this.errors.push(
            `Right side of ':' must be a list. Found: ${this.formatType(
              tailType
            )}`
          );
          return { type: "TypeVar", name: "TypeError" };
        }
        try {
          const sub = this.unify(headType, tailType.element);
          sub.forEach((v, k) => substitutions.set(k, v));
          return tailType;
        } catch (e) {
          this.errors.push(
            `Cons operator ':' requires matching types. Head is ${this.formatType(
              headType
            )} but list contains ${this.formatType(tailType.element)}`
          );

          return { type: "TypeVar", name: "TypeError" };
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
          return { type: "TypeVar", name: "TypeError" };
        }

        return { type: "TypeConstructor", name: "YuBoolean" };
      }
      case "Concat": {
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
        let unifiedType: TypeNode;

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
          return { type: "TypeVar", name: "Error" };
        }
        const isYuString =
          unifiedType.type === "TypeConstructor" &&
          unifiedType.name === "YuString";
        const isYuList = unifiedType.type === "ListType";

        if (isYuString || isYuList) return unifiedType;

        if (unifiedType.type !== "TypeVar") {
          this.errors.push(
            `Concatenation requires both sides to be lists or strings. Got ${this.formatType(
              leftType
            )} and ${this.formatType(rightType)}`
          );
          return { type: "TypeVar", name: "Error" };
        }

        // If a TypeVar, try to unify it to a YuString or a YuList.
        const elemType: TypeVar = {
          type: "TypeVar",
          name: `elem_${Math.random()}`,
        };
        try {
          this.unify(unifiedType, {
            type: "TypeConstructor",
            name: "YuString",
          });
          return { type: "TypeConstructor", name: "YuString" };
        } catch {
          try {
            this.unify(unifiedType, {
              type: "ListType",
              element: elemType,
            });
            return { type: "ListType", element: elemType };
          } catch (e) {
            this.errors.push(
              `Concat requires both sides to be strings or lists of the same type. ` +
                `Got: ${JSON.stringify(leftType)} and ${JSON.stringify(
                  rightType
                )}`
            );
            return { type: "TypeVar", name: "Error" };
          }
        }
      }
      case "LambdaExpression": {
        const lambdaSymbolMap = new Map(symbolMap);
        const paramTypes: TypeNode[] = [];

        for (const param of node.parameters) {
          if (param.type === "VariablePattern") {
            const typeVar: TypeVar = {
              type: "TypeVar",
              name: `lambda_${Math.random()}`,
            };
            lambdaSymbolMap.set(param.name.value, typeVar);
            paramTypes.push(typeVar);
          } else {
            // TODO add missing patterns
            this.errors.push(
              `Unsupported pattern in lambda parameter: ${param.type}`
            );
            return { type: "TypeVar", name: "Error" };
          }
        }

        const bodyType = this.inferType(
          node.body.body,
          lambdaSymbolMap,
          substitutions
        );

        return {
          type: "FunctionType",
          from: paramTypes,
          to: bodyType,
        };
      }
      default:
        break;
    }
  }

  private unify(t1: TypeNode, t2: TypeNode): Substitution {
    if (this.typeEquals(t1, t2)) return new Map();

    if (t1.type === "TypeVar") return this.bindVariable(t1.name, t2);
    if (t2.type === "TypeVar") return this.bindVariable(t2.name, t1);

    if (t1.type === "FunctionType" && t2.type === "FunctionType") {
      const sub1 = this.unifyLists(t1.from, t2.from);
      const sub2 = this.unify(
        this.applySubstitution(t1.to, sub1),
        this.applySubstitution(t2.to, sub1)
      );
      return new Map([...sub1, ...sub2]);
    }

    if (t1.type === "DataType" && t2.type === "DataType") {
      if (
        t1.name !== t2.name ||
        t1.constructors.length !== t2.constructors.length
      ) {
        throw new Error(
          `Cannot unify ${this.formatType(t1)} with ${this.formatType(
            t2
          )}. Data types have different structures`
        );
      }
      let combinedSub: Substitution = new Map();
      for (let i = 0; i < t1.constructors.length; i++) {
        for (let j = 0; j < t1.constructors[i].fields.length; j++) {
          const f1 = this.applySubstitution(
            t1.constructors[i].fields[j],
            combinedSub
          );
          const f2 = this.applySubstitution(
            t2.constructors[i].fields[j],
            combinedSub
          );
          const newSub = this.unify(f1, f2);
          combinedSub = new Map([...combinedSub, ...newSub]);
        }
      }
      return combinedSub;
    }

    if (t1.type === "ListType" && t2.type === "ListType") {
      return this.unify(t1.element, t2.element);
    }

    if (t1.type === "TupleType" && t2.type === "TupleType") {
      if (t1.elements.length !== t2.elements.length) {
        throw new Error(
          `Tuple length mismatch: Expected ${t1.elements.length} elements but got ${t2.elements.length}`
        );
      }
      let combinedSub: Substitution = new Map();
      for (let i = 0; i < t1.elements.length; i++) {
        const el1 = this.applySubstitution(t1.elements[i], combinedSub);
        const el2 = this.applySubstitution(t2.elements[i], combinedSub);
        const newSub = this.unify(el1, el2);
        combinedSub = new Map([...combinedSub, ...newSub]);
      }
      return combinedSub;
    }

    throw new Error(
      `Type mismatch: Cannot unify ${this.formatType(
        t1
      )} with ${this.formatType(t2)}`
    );
  }

  private unifyLists(t1: TypeNode[], t2: TypeNode[]): Substitution {
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

  private typeEquals(a: TypeNode, b: TypeNode): boolean {
    if (!a || !b || a.type !== b.type) return false;
    switch (a.type) {
      case "TypeVar":
      case "TypeConstructor":
        if (!("name" in b)) return false;
        return a.name === b.name;
      case "FunctionType":
        if (b.type !== "FunctionType") return false;
        return (
          this.typeEqualsList(a.from, b.from) && this.typeEquals(a.to, b.to)
        );
      case "TypeApplication":
        if (b.type !== "TypeApplication") return false;
        return (
          this.typeEquals(a.base, b.base) &&
          a.args.length === b.args.length &&
          a.args.every((arg, i) => this.typeEquals(arg, b.args[i]))
        );
      case "ListType":
        if (b.type !== "ListType") return false;
        return this.typeEquals(a.element, b.element);
      case "TupleType":
        if (b.type !== "TupleType") return false;
        return (
          a.elements.length === b.elements.length &&
          a.elements.every((el, i) => this.typeEquals(el, b.elements[i]))
        );
      case "DataType":
        if (b.type !== "DataType") return false;
        return (
          a.name === b.name &&
          a.constructors.every((cons, i) =>
            cons.fields.every((el, j) =>
              this.typeEquals(el, b.constructors[i].fields[j])
            )
          )
        );
      default:
        return false;
    }
  }

  private typeEqualsList(a: TypeNode[], b: TypeNode[]) {
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

  private resolveTypeAlias(
    type: TypeNode,
    visited: Set<string> = new Set()
  ): TypeNode {
    switch (type.type) {
      case "TypeConstructor":
      case "TypeVar": {
        if (visited.has(type.name)) {
          throw new Error(`Cyclic type alias detected: ${type.name}`);
        }

        if (this.typeAliasMap.has(type.name)) {
          visited.add(type.name);
          return this.resolveTypeAlias(
            this.typeAliasMap.get(type.name)!,
            visited
          );
        }
        return type;
      }

      case "FunctionType":
        return {
          type: "FunctionType",
          from: type.from.map((t) =>
            this.resolveTypeAlias(t, new Set(visited))
          ),
          to: this.resolveTypeAlias(type.to, new Set(visited)),
        };

      case "ListType":
        return {
          type: "ListType",
          element: this.resolveTypeAlias(type.element, new Set(visited)),
        };

      case "TupleType":
        return {
          type: "TupleType",
          elements: type.elements.map((el) =>
            this.resolveTypeAlias(el, new Set(visited))
          ),
        };
      case "DataType":
        return {
          ...type,
          constructors: type.constructors.flatMap((c) => ({
            name: c.name,
            fields: c.fields.map((f) =>
              this.resolveTypeAlias(f, new Set(visited))
            ),
          })),
        };
      default:
        return type;
    }
  }

  private bindVariable(name: string, type: TypeNode): Substitution {
    if (type.type === "TypeVar" && type.name === name) {
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

  private isTypeInfinite(name: string, type: TypeNode): boolean {
    switch (type.type) {
      case "TypeVar":
        return type.name === name;
      case "FunctionType":
        return (
          type.from.some((t) => this.isTypeInfinite(name, t)) ||
          this.isTypeInfinite(name, type.to)
        );
      case "ListType":
        return this.isTypeInfinite(name, type.element);
      case "TupleType":
        return type.elements.some((t) => this.isTypeInfinite(name, t));
      case "DataType":
        return type.constructors.some((c) =>
          c.fields.some((f) => this.isTypeInfinite(name, f))
        );
      case "TypeConstructor":
      case "TypeApplication":
        return false;
      default:
        return false;
    }
  }

  private resolvePatterns(
    param: Pattern,
    symbolMap: Map<string, TypeNode>,
    paramTypes: TypeNode[],
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
        if (constructorType.type === "FunctionType")
          param.patterns.forEach((el, j) =>
            this.resolvePatterns(
              el,
              symbolMap,
              [...constructorType.from, constructorType.to],
              j
            )
          );
        symbolMap.set(param.constructor, constructorType);
        break;
      }
      case "ListPattern": {
        const listType = paramTypes[i];
        if (listType.type === "ListType") {
          param.elements.forEach((el) =>
            this.resolvePatterns(el, symbolMap, [listType.element], 0)
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
        if (listType.type === "ListType") {
          this.resolvePatterns(param.head, symbolMap, [listType.element], 0);
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
          if (
            Array.isArray(param.elements) &&
            Array.isArray(tupleParamType.elements)
          ) {
            param.elements.forEach((pattern, idx) => {
              this.resolvePatterns(
                pattern,
                symbolMap,
                tupleParamType.elements,
                idx
              );
            });
          }
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

  private mapTypeNodePrimitives(type: TypeNode): TypeNode {
    const mapPrimitiveNode = (t: TypeNode): TypeNode => {
      switch (t.type) {
        case "TypeVar":
        case "TypeConstructor": {
          if (this.typeAliasMap.has(t.name)) {
            return this.typeAliasMap.get(t.name);
          }
          if (this.recordMap.has(t.name)) {
            return { ...t, type: "TypeConstructor", name: t.name };
          }
          if (t.name in typeMappings) {
            return {
              ...t,
              type: "TypeConstructor",
              name: typeMappings[t.name],
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

  private applySubstitution(type: TypeNode, sub: Substitution): TypeNode {
    const substituteNode = (t: TypeNode): TypeNode => {
      if (t.type === "TypeVar") {
        const typeSub = sub.get(t.name);
        if (typeSub) {
          return this.applySubstitution(typeSub, sub);
        }
      }
      return t;
    };
    return this.walkTypeNode(type, substituteNode);
  }

  private walkTypeNode(
    type: TypeNode,
    callback: (node: TypeNode) => TypeNode
  ): TypeNode {
    const result = callback(type);
    switch (result.type) {
      case "FunctionType":
        return {
          ...result,
          from: result.from.map((t) => this.walkTypeNode(t, callback)),
          to: this.walkTypeNode(result.to, callback),
        };
      case "TypeApplication":
        return {
          ...result,
          base: this.walkTypeNode(result.base, callback),
          args: result.args.map((t) => this.walkTypeNode(t, callback)),
        };
      case "ListType":
        return {
          ...result,
          element: this.walkTypeNode(result.element, callback),
        };
      case "TupleType":
        return {
          ...result,
          elements: result.elements.map((t) => this.walkTypeNode(t, callback)),
        };
      case "DataType":
        return {
          ...result,
          constructors: result.constructors.flatMap((c) => ({
            ...c,
            fields: c.fields.map((f) => this.walkTypeNode(f, callback)),
          })),
        };
      default:
        return result;
    }
  }
  private formatType(type: TypeNode): string {
    switch (type.type) {
      case "TypeConstructor":
        return type.name;
      case "TypeVar":
        return `'${type.name}'`;
      case "FunctionType":
        const args = type.from.map((t) => this.formatType(t)).join(" -> ");
        return `(${args}) -> ${this.formatType(type.to)}`;
      case "ListType":
        return `[${this.formatType(type.element)}]`;
      case "TupleType":
        return `(${type.elements.map((t) => this.formatType(t)).join(", ")})`;
      case "DataType":
        return type.name;
      case "TypeApplication":
        return `${this.formatType(type.base)} ${type.args
          .map((arg) => this.formatType(arg))
          .join(" ")}`;
      default:
        return JSON.stringify(type);
    }
  }
}
