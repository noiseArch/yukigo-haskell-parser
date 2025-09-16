import {
  AST,
  BodyExpression,
  Record,
  traverse,
  Function,
  TypeAlias,
  Pattern,
  TypeSignature,
  ArithmeticBinaryOperation,
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
  Primitive,
  Equation,
  Type as YukigoType,
  isYukigoPrimitive,
  ListBinaryOperation,
} from "yukigo-core";
import { typeClasses, typeMappings } from "./utils/types.js";
import { inspect } from "util";

interface TypeVar {
  type: "TypeVar";
  id: number;
  name?: string;
  constraints: string[];
}

interface TypeConstructor {
  type: "TypeConstructor";
  name: string;
  args: Type[];
}

interface TypeScheme {
  type: "TypeScheme";
  quantifiers: number[];
  body: Type;
  constraints: Map<number, string[]>;
}

type Type = TypeVar | TypeConstructor;

type Environment = Map<string, TypeScheme>;

type Substitution = Map<number, Type>;

type Result<T> =
  | { success: true; value: T }
  | { success: false; error: string };

export class TypeChecker {
  private errors: string[] = [];
  private nextVarId = 0;
  private signatureMap = new Map<string, TypeScheme>();
  private recordMap = new Map<string, Type>();
  private typeAliasMap = new Map<string, Type>();

  public check(ast: AST): string[] {
    this.errors = [];
    this.nextVarId = 0;
    this.signatureMap.clear();
    this.recordMap.clear();
    this.typeAliasMap.clear();

    this.buildGlobalEnvironment(ast);
    this.typeCheck(ast);
    return this.errors;
  }

  private buildGlobalEnvironment(ast: AST) {
    traverse(ast, {
      TypeAlias: (node: TypeAlias) => {
        const typeAliasIdentifier = node.identifier.value;
        if (
          this.typeAliasMap.has(typeAliasIdentifier) ||
          this.recordMap.has(typeAliasIdentifier)
        ) {
          this.errors.push(`Multiple declaration of '${typeAliasIdentifier}'.`);
          return;
        }

        const { type, constraints } = this.toType(node.value);
        this.typeAliasMap.set(typeAliasIdentifier, type);
      },
      Record: (node: Record) => {
        const recordIdentifier = node.name.value;
        if (
          this.typeAliasMap.has(recordIdentifier) ||
          this.recordMap.has(recordIdentifier)
        ) {
          this.errors.push(`Multiple declaration of '${recordIdentifier}'.`);
          return;
        }

        // Save the record type itself
        const recordType: TypeConstructor = {
          type: "TypeConstructor",
          name: recordIdentifier,
          args: [],
        };
        this.recordMap.set(recordIdentifier, recordType);

        // Add constructors to signature map as type schemes
        for (const cons of node.contents) {
          if (this.signatureMap.has(cons.name)) {
            this.errors.push(`Constructor '${cons.name}' is already defined`);
            continue;
          }
          const paramTypes = cons.fields.map((field) =>
            this.toType(field.value)
          );
          const returnType: TypeConstructor = {
            type: "TypeConstructor",
            name: recordIdentifier,
            args: paramTypes.map(() => this.freshVar()),
          };

          const funcType: Type = paramTypes.reduceRight(
            (acc, param) => ({
              type: "TypeConstructor",
              name: "->",
              args: [param.type, acc],
            }),
            returnType
          );

          // Generalize all free variables in the constructor type
          const scheme = this.generalize(new Map(), funcType);
          this.signatureMap.set(cons.name, scheme);
        }
      },
      TypeSignature: (node: TypeSignature) => {
        const functionName = node.identifier.value;
        if (this.signatureMap.has(functionName)) {
          this.errors.push(
            `Function '${functionName}' has multiple type signatures`
          );
          return;
        }
        const typeVarMap = new Map<string, TypeVar>();
        const { type, constraints } = this.toType(node.body, typeVarMap);
        const quantifiers = Array.from(typeVarMap.values()).map((tv) => tv.id);
        this.signatureMap.set(functionName, {
          type: "TypeScheme",
          quantifiers,
          body: type,
          constraints,
        });
      },
    });
    //console.log(inspect(this.signatureMap, false, null, true));
  }

  private checkEquation(
    equation: Equation,
    funcScheme: TypeScheme,
    env: Environment
  ) {
    const funcType = this.instantiate(funcScheme);

    const returnType = this.getReturnType(funcType);
    const patternTypes = this.getArgumentTypes(funcType);

    const equationEnv = new Map(env);

    patternTypes.forEach((argType, i) => {
      this.processPatterns(equation.patterns[i], argType, equationEnv);
    });

    if (!Array.isArray(equation.body)) {
      // Handles UnguardedBody case
      const body = equation.body.expression.body;

      const bodyResult = this.infer(body, equationEnv);
      if (bodyResult.success === false) throw Error(bodyResult.error);
      //console.log("checkEquation", bodyResult.value, returnType);

      const sub = this.unify(bodyResult.value, returnType);
      if (sub.success === false) throw Error(sub.error);
    } else {
      // Handles GuardedBody case
      const boolType: TypeConstructor = {
        type: "TypeConstructor",
        name: "YuBoolean",
        args: [],
      };
      for (const guard of equation.body) {
        // checks if condition expression in guard is a resolves to YuBoolean
        const condition = this.infer(guard.condition.body, equationEnv);
        if (condition.success === false) throw Error(condition.error);

        const conditionSub = this.unify(condition.value, boolType);
        if (conditionSub.success === false) throw Error(conditionSub.error);

        const bodyResult = this.infer(guard.body.body, equationEnv);
        if (bodyResult.success === false) throw Error(bodyResult.error);

        const sub = this.unify(bodyResult.value, returnType);
        if (sub.success === false) throw Error(sub.error);
      }
    }
  }

  private getReturnType(type: Type): Type {
    let t: Type = type;
    while (
      t.type === "TypeConstructor" &&
      t.name === "->" &&
      t.args.length === 2
    ) {
      t = t.args[1];
    }
    return t;
  }

  private getArgumentTypes(type: Type): Type[] {
    const args: Type[] = [];
    let t: Type = type;
    while (
      t.type === "TypeConstructor" &&
      t.name === "->" &&
      t.args.length === 2
    ) {
      args.push(t.args[0]);
      t = t.args[1];
    }
    return args;
  }

  private getArity(type: Type): number {
    return this.getArgumentTypes(type).length;
  }

  private typeCheck(ast: AST) {
    const env: Environment = new Map();

    // Add top-level signatures to environment
    for (const [name, scheme] of this.signatureMap) {
      env.set(name, scheme);
    }

    traverse(ast, {
      Function: (node: Function) => {
        const functionName = node.identifier.value;
        let funcScheme = this.signatureMap.get(functionName);

        // Handle function without signature
        if (!funcScheme) {
          this.errors.push(
            `Function '${functionName}' is defined but has no signature`
          );

          const firstEq = node.equations[0];
          const eqEnv = new Map(env);
          const paramTypes = firstEq.patterns.map(() => this.freshVar());
          const returnType = this.freshVar();

          paramTypes.forEach((type, i) => {
            this.processPatterns(firstEq.patterns[i], type, eqEnv);
          });

          let inferredBodyType: Type;
          if (!Array.isArray(firstEq.body)) {
            const bodyResult = this.infer(firstEq.body.expression.body, eqEnv);
            if (bodyResult.success === false) {
              this.errors.push(
                `Type error inferring '${functionName}': ${bodyResult.error}`
              );
              return;
            }
            inferredBodyType = bodyResult.value;
          } else {
            // Handle guarded body inference if necessary
            inferredBodyType = this.freshVar(); // Placeholder
          }

          const fullFuncType = paramTypes.reduceRight(
            (acc, param) =>
              ({
                type: "TypeConstructor",
                name: "->",
                args: [param, acc],
              } as TypeConstructor),
            inferredBodyType
          );

          // Generalize the inferred type to create a polymorphic type scheme
          funcScheme = this.generalize(env, fullFuncType);
          this.signatureMap.set(functionName, funcScheme);
          env.set(functionName, funcScheme);
        }

        const expectedArity = this.getArity(this.instantiate(funcScheme));
        for (const equation of node.equations) {
          if (equation.patterns.length !== expectedArity) {
            this.errors.push(`Arity mismatch in function '${functionName}'`);
            continue;
          }
          try {
            this.checkEquation(equation, funcScheme, new Map(env));
          } catch (error: any) {
            this.errors.push(
              `Type error in '${functionName}': ${error.message}`
            );
          }
        }
      },
    });
  }

  private infer(expr: BodyExpression, env: Environment): Result<Type> {
    switch (expr.type) {
      case "YuChar":
      case "YuString":
      case "YuNumber":
      case "YuBoolean":
        return this.inferPrimitive(expr);
      case "YuList":
        return this.inferList(expr, env);
      case "YuSymbol":
        return this.inferSymbol(expr, env);

      case "ArithmeticBinaryOperation":
        return this.inferArithmetic(expr, env);

      case "If":
        return this.inferIf(expr, env);

      case "Lambda":
        return this.inferLambda(expr, env);

      case "Application":
        return this.inferApplication(expr, env);

      case "CompositionExpression":
        return this.inferComposition(expr, env);

      case "InfixApplication":
        return this.inferInfixApplication(expr, env);

      case "DataExpression":
        return this.inferDataExpression(expr, env);

      case "TupleExpression":
        return this.inferTuple(expr, env);

      case "ConsExpression":
        return this.inferCons(expr, env);

      case "ComparisonOperation":
        return this.inferComparison(expr, env);

      case "StringOperation":
        return this.inferStringOp(expr, env);
      case "ListBinaryOperation":
        return this.inferListBinaryOp(expr, env);

      default:
        return {
          success: false,
          error: `Unknown expression type: ${expr.type}`,
        };
    }
  }

  // ===== Core HM Functions =====

  private freshVar(constraints: string[] = []): TypeVar {
    return { type: "TypeVar", id: this.nextVarId++, constraints };
  }

  private freeTypeVars(t: Type): Map<number, string[]> {
    const freeVars = new Map<number, string[]>();
    const collect = (type: Type) => {
      if (type.type === "TypeVar") {
        freeVars.set(type.id, type.constraints);
      } else if (type.type === "TypeConstructor") {
        type.args.forEach(collect);
      }
    };
    collect(t);
    return freeVars;
  }
  private generalize(env: Environment, t: Type): TypeScheme {
    const envFreeVars = new Set<number>();
    for (const scheme of env.values()) {
      const schemeFreeVars = this.freeTypeVars(scheme.body);
      for (const id of schemeFreeVars.keys()) {
        if (!scheme.quantifiers.includes(id)) {
          envFreeVars.add(id);
        }
      }
    }

    const typeFreeVars = this.freeTypeVars(t);

    const quantifiers: number[] = [];
    const constraints = new Map<number, string[]>();

    for (const [id, consts] of typeFreeVars.entries()) {
      if (!envFreeVars.has(id)) {
        quantifiers.push(id);
        if (consts.length > 0) {
          constraints.set(id, consts);
        }
      }
    }

    return { type: "TypeScheme", quantifiers, body: t, constraints };
  }

  private instantiate(scheme: TypeScheme): Type {
    const substitutions = new Map<number, Type>();
    scheme.quantifiers.forEach((id) => {
      const constraints = scheme.constraints.get(id) || [];
      substitutions.set(id, this.freshVar(constraints));
    });
    return this.applySubst(substitutions, scheme.body);
  }

  private applySubst(subst: Substitution, t: Type): Type {
    if (t.type === "TypeVar") {
      const replacement = subst.get(t.id);
      return replacement ? replacement : t;
    } else if (t.type === "TypeConstructor") {
      return {
        type: "TypeConstructor",
        name: t.name,
        args: t.args.map((arg) => this.applySubst(subst, arg)),
      };
    }

    throw new Error("Unexpected TypeScheme in applySubst");
  }

  private composeSubst(s1: Substitution, s2: Substitution): Substitution {
    const result = new Map(s2);
    for (const [id, type] of s1) {
      result.set(id, this.applySubst(s2, type));
    }
    return result;
  }

  private unify(t1: Type, t2: Type): Result<Substitution> {
    if (t1.type === "TypeVar") return this.unifyVar(t1, t2);
    if (t2.type === "TypeVar") return this.unifyVar(t2, t1);
    if (t1.type === "TypeConstructor" && t2.type === "TypeConstructor") {
      if (t1.name !== t2.name || t1.args.length !== t2.args.length) {
        return {
          success: false,
          error: `Cannot unify ${this.showType(t1)} with ${this.showType(t2)}`,
        };
      }
      let sub: Substitution = new Map();
      for (let i = 0; i < t1.args.length; i++) {
        const arg1 = this.applySubst(sub, t1.args[i]);
        const arg2 = this.applySubst(sub, t2.args[i]);
        const argSubRes = this.unify(arg1, arg2);
        if (!argSubRes.success) return argSubRes;
        sub = this.composeSubst(sub, argSubRes.value);
      }
      return { success: true, value: sub };
    }
    return { success: false, error: `Cannot unify non-types` };
  }

  private unifyVar(v: TypeVar, t: Type): Result<Substitution> {
    if (t.type === "TypeVar" && t.id === v.id) {
      return { success: true, value: new Map() };
    }
    if (this.occurs(v.id, t)) {
      return { success: false, error: `Occurs check failed` };
    }

    // TC REVISED: Check constraints before binding.
    for (const constraint of v.constraints) {
      this.checkConstraint(constraint, t);
    }
    if (t.type === "TypeVar") {
      for (const constraint of t.constraints) {
        this.checkConstraint(constraint, v);
      }
      // Merge constraints
      const mergedConstraints = [
        ...new Set([...v.constraints, ...t.constraints]),
      ];
      v.constraints = mergedConstraints;
      t.constraints = mergedConstraints;
    }

    return { success: true, value: new Map([[v.id, t]]) };
  }

  private checkConstraint(constraintName: string, t: Type) {
    if (t.type === "TypeVar") {
      if (!t.constraints.includes(constraintName)) {
        t.constraints.push(constraintName);
      }
    } else if (t.type === "TypeConstructor") {
      const instances = typeClasses.get(constraintName);
      if (!instances || !instances.includes(t.name)) {
        throw new Error(
          `Type '${this.showType(t)}' is not an instance of '${constraintName}'`
        );
      }
    }
  }

  private occurs(varId: number, t: Type): boolean {
    if (t.type === "TypeVar") return t.id === varId;
    if (t.type === "TypeConstructor")
      return t.args.some((a) => this.occurs(varId, a));
    return false;
  }

  // ===== Expression Type Inference =====

  private inferPrimitive(expr: Primitive): Result<Type> {
    const typeName = expr.type;
    return {
      success: true,
      value: {
        type: "TypeConstructor",
        name: typeName,
        args: [],
      },
    };
  }

  private inferSymbol(expr: SymbolPrimitive, env: Environment): Result<Type> {
    const name = expr.value;
    //console.log(env, env.get(name));
    const scheme = env.get(name) || this.signatureMap.get(name);

    if (!scheme) return { success: false, error: `Unbound variable: ${name}` };

    return { success: true, value: this.instantiate(scheme) };
  }

  private inferArithmetic(
    expr: ArithmeticBinaryOperation,
    env: Environment
  ): Result<Type> {
    const numType: TypeConstructor = {
      type: "TypeConstructor",
      name: "YuNumber",
      args: [],
    };
    const leftResult = this.infer(expr.left.body, env);
    const rightResult = this.infer(expr.right.body, env);

    if (!leftResult.success) return leftResult;
    if (!rightResult.success) return rightResult;

    const unifyLeft = this.unify(leftResult.value, numType);
    const unifyRight = this.unify(rightResult.value, numType);

    if (!unifyLeft.success) {
      return {
        success: false,
        error: `Left operand of ${expr.operator} must be a number`,
      };
    }

    if (!unifyRight.success) {
      return {
        success: false,
        error: `Right operand of ${expr.operator} must be a number`,
      };
    }

    return { success: true, value: numType };
  }

  private inferIf(expr: If, env: Environment): Result<Type> {
    const boolType: TypeConstructor = {
      type: "TypeConstructor",
      name: "YuBoolean",
      args: [],
    };
    const condResult = this.infer(expr.condition.body, env);

    if (!condResult.success) return condResult;

    const condSub = this.unify(condResult.value, boolType);
    if (!condSub.success) {
      return { success: false, error: "Condition must be a boolean" };
    }

    const thenResult = this.infer(expr.then.body, env);
    const elseResult = this.infer(expr.else.body, env);

    if (!thenResult.success) return thenResult;
    if (!elseResult.success) return elseResult;

    const unifyResult = this.unify(thenResult.value, elseResult.value);
    if (!unifyResult.success) {
      return {
        success: false,
        error: `Branch types don't match: ${this.showType(
          thenResult.value
        )} vs ${this.showType(elseResult.value)}`,
      };
    }

    return thenResult;
  }

  private inferLambda(expr: Lambda, env: Environment): Result<Type> {
    // Create fresh type variables for parameters
    const paramTypes = expr.parameters.map(() => this.freshVar());
    const newEnv = new Map(env);

    // Add parameters to environment
    expr.parameters.forEach((param, i) => {
      if (param.type === "VariablePattern") {
        newEnv.set(param.name.value, {
          type: "TypeScheme",
          quantifiers: [],
          body: paramTypes[i],
          constraints: new Map(),
        });
      } else if (param.type === "WildcardPattern") {
        // Wildcards are ignored in environment
      } else {
        // For other pattern types, handle accordingly or skip
      }
    });

    // Infer body type
    const bodyResult = this.infer(expr.body.body, newEnv);
    if (!bodyResult.success) return bodyResult;

    // Construct function type
    const funcType = paramTypes.reduceRight(
      (acc, param) =>
        ({
          type: "TypeConstructor",
          name: "->",
          args: [param, acc],
        } satisfies TypeConstructor),
      bodyResult.value
    );

    return { success: true, value: funcType };
  }

  private inferApplication(expr: Application, env: Environment): Result<Type> {
    const funcResult = this.infer(expr.function.body, env);
    if (funcResult.success === false) return funcResult;

    const argResult = this.infer(
      expr.parameter.type === "Expression"
        ? expr.parameter.body
        : expr.parameter,
      env
    );
    if (argResult.success === false) return argResult;

    const resultType = this.freshVar();
    const funcType: TypeConstructor = {
      type: "TypeConstructor",
      name: "->",
      args: [argResult.value, resultType],
    };
    const unifyResult = this.unify(funcResult.value, funcType);
    if (unifyResult.success === false) {
      return {
        success: false,
        error: `Cannot apply ${this.showType(
          argResult.value
        )} to function of type ${this.showType(funcResult.value)}`,
      };
    }

    return { success: true, value: resultType };
  }

  private inferComposition(
    expr: CompositionExpression,
    env: Environment
  ): Result<Type> {
    const fResult = this.infer(expr.left.body, env);
    const gResult = this.infer(expr.right.body, env);

    if (!fResult.success) return fResult;
    if (!gResult.success) return gResult;

    const a = this.freshVar();
    const b = this.freshVar();
    const c = this.freshVar();

    const fType: TypeConstructor = {
      type: "TypeConstructor",
      name: "->",
      args: [b, c],
    };

    const gType: TypeConstructor = {
      type: "TypeConstructor",
      name: "->",
      args: [a, b],
    };

    const fSub = this.unify(fResult.value, fType);
    const gSub = this.unify(gResult.value, gType);

    if (!fSub.success) {
      return {
        success: false,
        error: "Left operand of composition must be a function",
      };
    }

    if (!gSub.success) {
      return {
        success: false,
        error: "Right operand of composition must be a function",
      };
    }

    const composedType: TypeConstructor = {
      type: "TypeConstructor",
      name: "->",
      args: [a, c],
    };

    return { success: true, value: composedType };
  }

  private inferInfixApplication(
    expr: InfixApplicationExpression,
    env: Environment
  ): Result<Type> {
    const opScheme = this.signatureMap.get(expr.operator.value);
    if (!opScheme) {
      return {
        success: false,
        error: `Unknown operator: ${expr.operator.value}`,
      };
    }

    const opType = this.instantiate(opScheme);
    if (
      opType.type !== "TypeConstructor" ||
      opType.name !== "->" ||
      opType.args.length !== 2
    ) {
      return {
        success: false,
        error: `Operator ${expr.operator.value} has invalid type`,
      };
    }

    const leftResult = this.infer(expr.left.body, env);
    const rightResult = this.infer(expr.right.body, env);

    if (!leftResult.success) return leftResult;
    if (!rightResult.success) return rightResult;

    const unifyLeft = this.unify(leftResult.value, opType.args[0]);
    const unifyRight = this.unify(rightResult.value, opType.args[1]);

    if (!unifyLeft.success || !unifyRight.success) {
      return {
        success: false,
        error: `Type mismatch in infix application: ${expr.operator.value}`,
      };
    }

    return { success: true, value: opType.args[1] };
  }

  private inferDataExpression(
    expr: DataExpression,
    env: Environment
  ): Result<Type> {
    const ctorScheme = this.signatureMap.get(expr.name.value);
    if (!ctorScheme) {
      return {
        success: false,
        error: `Unknown constructor: ${expr.name.value}`,
      };
    }

    const ctorType = this.instantiate(ctorScheme);

    // Data constructors should be functions
    if (ctorType.type !== "TypeConstructor" || ctorType.name !== "->") {
      return { success: true, value: ctorType };
    }

    // Check arguments
    let currentType: Type = ctorType;
    for (const arg of expr.contents) {
      const argResult = this.infer(arg.expression.body, env);
      if (!argResult.success) return argResult;

      if (currentType.type !== "TypeConstructor" || currentType.name !== "->") {
        return {
          success: false,
          error: `Too many arguments to constructor ${expr.name.value}`,
        };
      }

      const unifyResult = this.unify(argResult.value, currentType.args[0]);
      if (!unifyResult.success) {
        return {
          success: false,
          error: `Argument type mismatch for constructor ${expr.name.value}`,
        };
      }

      currentType = currentType.args[1];
    }

    return { success: true, value: currentType };
  }

  private inferTuple(expr: TupleExpression, env: Environment): Result<Type> {
    const elementResults = expr.elements.map((e) => this.infer(e.body, env));
    const errors = elementResults.filter((r) => !r.success);
    if (elementResults.every((res) => res.success === true)) {
      const elementTypes = elementResults.map((r) => r.value);
      const tupleType: TypeConstructor = {
        type: "TypeConstructor",
        name: `Tuple${elementTypes.length}`,
        args: elementTypes,
      };

      return { success: true, value: tupleType };
    } else {
      return errors[0] as Result<Type>;
    }
  }

  private inferCons(expr: ConsExpression, env: Environment): Result<Type> {
    const headResult = this.infer(expr.head.body, env);
    const tailResult = this.infer(expr.tail.body, env);

    if (!headResult.success) return headResult;
    if (!tailResult.success) return tailResult;

    // Tail must be a list
    if (
      tailResult.value.type !== "TypeConstructor" ||
      tailResult.value.name !== "List"
    ) {
      return { success: false, error: "Tail of cons must be a list" };
    }

    // Head must match list element type
    const elemType = tailResult.value.args[0];
    const unifyResult = this.unify(headResult.value, elemType);

    if (!unifyResult.success) {
      return {
        success: false,
        error: `Head type doesn't match list element type`,
      };
    }

    return tailResult;
  }

  private inferList(expr: ListPrimitive, env: Environment): Result<Type> {
    if (expr.elements.length === 0) {
      // Empty list - polymorphic
      const elemType = this.freshVar();
      return {
        success: true,
        value: {
          type: "TypeConstructor",
          name: "List",
          args: [elemType],
        },
      };
    }

    // Infer type of first element
    const firstResult = this.infer(expr.elements[0].body, env);
    if (firstResult.success === false) return firstResult;

    // Check all elements match first element's type
    for (let i = 1; i < expr.elements.length; i++) {
      const elemResult = this.infer(expr.elements[i].body, env);
      if (elemResult.success === false) return elemResult;
      const unifyResult = this.unify(elemResult.value, firstResult.value);
      if (unifyResult.success === false) {
        return {
          success: false,
          error: `List elements must have the same type`,
        };
      }
    }

    return {
      success: true,
      value: {
        type: "TypeConstructor",
        name: "List",
        args: [firstResult.value],
      },
    };
  }

  private inferComparison(
    expr: ComparisonOperation,
    env: Environment
  ): Result<Type> {
    const leftResult = this.infer(expr.left.body, env);
    const rightResult = this.infer(expr.right.body, env);

    if (!leftResult.success) return leftResult;
    if (!rightResult.success) return rightResult;

    const unifyResult = this.unify(leftResult.value, rightResult.value);
    if (!unifyResult.success) {
      return {
        success: false,
        error: `Comparison operands must have the same type`,
      };
    }

    return {
      success: true,
      value: { type: "TypeConstructor", name: "YuBoolean", args: [] },
    };
  }

  private inferStringOp(expr: StringOperation, env: Environment): Result<Type> {
    const strType: TypeConstructor = {
      type: "TypeConstructor",
      name: "YuString",
      args: [],
    };
    const leftResult = this.infer(expr.left.body, env);
    const rightResult = this.infer(expr.right.body, env);

    if (!leftResult.success) return leftResult;
    if (!rightResult.success) return rightResult;

    const unifyLeft = this.unify(leftResult.value, strType);
    const unifyRight = this.unify(rightResult.value, strType);

    if (!unifyLeft.success || !unifyRight.success) {
      return {
        success: false,
        error: `String operation requires string operands`,
      };
    }

    return { success: true, value: strType };
  }
  private inferListBinaryOp(
    expr: ListBinaryOperation,
    env: Environment
  ): Result<Type> {
    switch (expr.operator) {
      case "Collect": {
        const leftResult = this.infer(expr.left.body, env);
        const rightResult = this.infer(expr.right.body, env);

        if (!leftResult.success) return leftResult;
        if (!rightResult.success) return rightResult;

        const funcArity = this.getArity(leftResult.value);
        if (funcArity !== 1)
          return {
            success: false,
            error: `${expr.operator}'s left operand expects to have only one argument`,
          };

        // Right-hand side must be a list [a]
        const freshInputVar = this.freshVar();
        const listInputType: TypeConstructor = {
          type: "TypeConstructor",
          name: "List",
          args: [freshInputVar],
        };

        const unifyRight = this.unify(rightResult.value, listInputType);
        if (!unifyRight.success)
          return {
            success: false,
            error: `${expr.operator}'s right operand must be a list`,
          };

        const elementType = unifyRight.value.get(freshInputVar.id);

        // Left-hand side must be a function: elementType -> outputType
        const freshOutputVar = this.freshVar();
        const funcType: TypeConstructor = {
          type: "TypeConstructor",
          name: "->",
          args: [elementType, freshOutputVar],
        };

        const unifyLeft = this.unify(leftResult.value, funcType);
        if (!unifyLeft.success) {
          return {
            success: false,
            error: `${
              expr.operator
            }'s left operand must be a function of type ${elementType.toString()} -> ?`,
          };
        }

        // Result is a list of the function's output type: [outputType]

        const resultType: TypeConstructor = {
          type: "TypeConstructor",
          name: "List",
          args: [freshOutputVar],
        };

        const subType = this.applySubst(unifyLeft.value, resultType);

        // Return the result type, now fully resolved with substitutions
        return { success: true, value: subType };
      }

      default:
        break;
    }
  }

  // ===== Helper Functions =====

  private toType(
    node: YukigoType,
    typeVarMap: Map<string, TypeVar> = new Map()
  ): { type: Type; constraints: Map<number, string[]> } {
    const constraintsMap = new Map<number, string[]>();

    const processNode = (n: YukigoType): Type => {
      switch (n.type) {
        case "SimpleType": {
          if (/^[a-z]/.test(n.value)) {
            if (!typeVarMap.has(n.value)) {
              typeVarMap.set(n.value, { ...this.freshVar(), name: n.value });
            }
            return typeVarMap.get(n.value);
          }
          const primitive = typeMappings[n.value];
          return {
            type: "TypeConstructor",
            name: primitive || n.value,
            args: [],
          };
        }
        case "ParameterizedType": {
          // Collect constraints from the signature context
          for (const c of n.constraints || []) {
            const param = c.parameters[0];
            if (param.type === "SimpleType" && /^[a-z]/.test(param.value)) {
              // Ensure the type var exists
              processNode(param);
              const tv = typeVarMap.get(param.value);
              if (!constraintsMap.has(tv.id)) constraintsMap.set(tv.id, []);
              constraintsMap.get(tv.id).push(c.name);
            }
          }
          return n.inputs.reduceRight(
            (acc, input) => ({
              type: "TypeConstructor",
              name: "->",
              args: [processNode(input), acc],
            }),
            processNode(n.return)
          );
        }
        case "TupleType":
          return {
            type: "TypeConstructor",
            name: `Tuple${n.values.length}`,
            args: n.values.map((v) => this.toType(v, typeVarMap).type),
          };

        case "ListType":
          return {
            type: "TypeConstructor",
            name: "List",
            args: [this.toType(n.values, typeVarMap).type],
          };

        default:
          return this.freshVar();
      }
    };
    const type = processNode(node);
    return { type, constraints: constraintsMap };
  }

  private processPatterns(
    pattern: Pattern,
    expectedType: Type,
    env: Environment
  ) {
    switch (pattern.type) {
      case "LiteralPattern": {
        // Determine the type based on the literal value
        const value = pattern.name;
        if (!isYukigoPrimitive(value.type)) {
          this.errors.push(
            `Unsupported literal type in pattern: ${value.type}`
          );
          break;
        }
        let literalType: Type = {
          type: "TypeConstructor",
          name: value.type,
          args: [],
        };

        const unifyResult = this.unify(literalType, expectedType);
        if (unifyResult.success === false)
          this.errors.push(
            `Literal pattern type mismatch: expected ${this.showType(
              expectedType
            )} but found ${this.showType(literalType)}`
          );
      }
      case "VariablePattern": {
        env.set(pattern.name.value.toString(), {
          type: "TypeScheme",
          quantifiers: [],
          body: expectedType,
          constraints: new Map(),
        });
      }
      case "WildcardPattern":
        break;
      case "ApplicationPattern": {
        const appCtorScheme = this.signatureMap.get(pattern.symbol.value);
        if (!appCtorScheme)
          this.errors.push(`Unknown constructor: ${pattern.symbol.value}`);

        const appCtorType = this.instantiate(appCtorScheme);

        // Handle both curried and non-curried constructor types
        let currentType = appCtorType;
        let argIndex = 0;

        const patternTypes = this.getArgumentTypes(appCtorType);
        patternTypes.forEach((argType, i) => {
          this.processPatterns(pattern.args[argIndex], argType, env);
        });

        // Check if we've consumed all expected arguments
        const unifyResult = this.unify(currentType, expectedType);
        if (unifyResult.success === false)
          this.errors.push(
            `Constructor ${pattern.symbol.value} arguments don't match expected type: ${unifyResult.error}`
          );
        break;
      }
      case "AsPattern": {
        if (
          this.processPatterns(pattern.pattern, expectedType, env) &&
          pattern.alias.type === "VariablePattern"
        ) {
          // Create a fresh flexible variable to store in env
          let type = expectedType;
          env.set(pattern.alias.name.value, {
            type: "TypeScheme",
            quantifiers: [],
            body: type,
            constraints: new Map(),
          });
        }
        break;
      }
      case "ConsPattern": {
        if (
          expectedType.type !== "TypeConstructor" ||
          expectedType.name !== "List"
        ) {
          this.errors.push(
            `Pattern expects a list but found non-list type: ${this.showType(
              expectedType
            )}`
          );
          break;
        }

        let elemType = expectedType.args[0];

        this.processPatterns(pattern.head, elemType, env);

        // Process tail pattern (which should be a list of the same element type)
        const tailType: TypeConstructor = {
          type: "TypeConstructor",
          name: "List",
          args: [elemType],
        };

        this.processPatterns(pattern.tail, tailType, env);

        break;
      }
      case "ConstructorPattern":
        const ctorScheme = this.signatureMap.get(pattern.constructor);
        if (!ctorScheme) {
          this.errors.push(`Unknown constructor: ${pattern.constructor}`);
          break;
        }

        const ctorType = this.instantiate(ctorScheme);
        if (ctorType.type !== "TypeConstructor") {
          this.errors.push(
            `Constructor ${pattern.constructor} is not a function`
          );
          break;
        }

        // Check if constructor matches expected type
        const unifyResult = this.unify(ctorType, expectedType);
        if (!unifyResult.success) {
          this.errors.push(
            `Constructor ${pattern.constructor} doesn't match expected type`
          );
          break;
        }

        // Process constructor arguments
        pattern.patterns.forEach((pattern) => {
          this.processPatterns(pattern, ctorType.args[0], env);
        });
        break;
      case "ListPattern": {
        if (
          expectedType.type !== "TypeConstructor" ||
          expectedType.name !== "List"
        ) {
          this.errors.push(`Pattern expects a list but found non-list type`);
          return false;
        }

        const patternTypes = this.getArgumentTypes(expectedType);
        const elemType = patternTypes[0];
        patternTypes.every((type) => this.unify(elemType, type));

        break;
      }
      case "TuplePattern":
        if (
          expectedType.type !== "TypeConstructor" ||
          expectedType.name !== "Tuple"
        ) {
          this.errors.push(`Pattern expects a tuple but found non-tuple type`);
          break;
        }

        if (pattern.elements.length !== expectedType.args.length) {
          this.errors.push(`Tuple arity mismatch`);
          break;
        }

        const expectedTypes = this.getArgumentTypes(expectedType);
        pattern.elements.forEach((pattern, i) =>
          this.processPatterns(pattern, expectedTypes[i], env)
        );
        break;
      default:
        this.errors.push(`Unsupported pattern type: ${pattern.type}`);
        break;
    }
  }

  private showType(t: Type): string {
    if (t.type === "TypeVar") return t.name ?? `t${t.id}`;
    if (t.type === "TypeConstructor") {
      if (t.name === "->") {
        const a = this.showType(t.args[0]);
        const b = this.showType(t.args[1]);
        const aDisp =
          t.args[0].type === "TypeConstructor" && t.args[0].name === "->"
            ? `(${a})`
            : a;
        return `${aDisp} -> ${b}`;
      }
      if (t.name === "List") return `[${this.showType(t.args[0])}]`;
      if (t.name.startsWith("Tuple"))
        return `(${t.args.map(this.showType.bind(this)).join(", ")})`;
      return t.args.length
        ? `${t.name} ${t.args.map(this.showType.bind(this)).join(" ")}`
        : t.name;
    }
    return "scheme";
  }
}
