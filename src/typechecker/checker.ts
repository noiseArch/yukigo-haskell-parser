import {
  AST,
  Record,
  traverse,
  Function,
  TypeAlias,
  TypeSignature,
  Equation,
  Type as YukigoType,
  UnguardedBody,
  GuardedBody,
} from "yukigo-core";
import { typeMappings } from "../utils/types.js";
import { InferenceEngine } from "./inference.js";
import { CoreHM } from "./core.js";
import { inspect } from "util";

export interface TypeVar {
  type: "TypeVar";
  id: number;
  name?: string;
  constraints: string[];
}

export interface TypeConstructor {
  type: "TypeConstructor";
  name: string;
  args: Type[];
}
export interface FunctionType {
  type: "TypeConstructor";
  name: "->";
  args: [Type, Type];
}
export interface ListType {
  type: "TypeConstructor";
  name: "List";
  args: [Type];
}
export interface TupleType {
  type: "TypeConstructor";
  name: "Tuple";
  args: Type[];
}

export interface TypeScheme {
  type: "TypeScheme";
  quantifiers: number[];
  body: Type;
  constraints: Map<number, string[]>;
}

export type Type = TypeVar | TypeConstructor;

export type Environment = Map<string, TypeScheme>;

export type Substitution = Map<number, Type>;

export type Result<T> =
  | { success: true; value: T }
  | { success: false; error: string };

export class TypeChecker {
  private errors: string[] = [];
  private signatureMap = new Map<string, TypeScheme>();
  private recordMap = new Map<string, Type>();
  private typeAliasMap = new Map<string, Type>();

  private coreHM: CoreHM = new CoreHM();
  private inferenceEngine: InferenceEngine = new InferenceEngine(
    this.signatureMap,
    this.coreHM
  );

  public check(ast: AST): string[] {
    this.signatureMap.clear();
    this.errors = [];
    this.recordMap.clear();
    this.typeAliasMap.clear();
    this.coreHM = new CoreHM();
    this.inferenceEngine = new InferenceEngine(this.signatureMap, this.coreHM);

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
            args: paramTypes.map(() => this.coreHM.freshVar()),
          };

          const funcType: Type = paramTypes.reduceRight(
            (acc, param) => functionType(param.type, acc),
            returnType
          );

          // Generalize all free variables in the constructor type
          const scheme = this.coreHM.generalize(new Map(), funcType);
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
  }

  private checkEquation(
    equation: Equation,
    funcScheme: TypeScheme,
    env: Environment
  ) {
    const funcType = this.coreHM.instantiate(funcScheme);

    const returnType = getReturnType(funcType);
    const patternTypes = getArgumentTypes(funcType);

    const equationEnv = new Map(env);

    patternTypes.forEach((argType, i) => {
      try {
        this.inferenceEngine.processPatterns(
          equation.patterns[i],
          argType,
          equationEnv
        );
      } catch (error) {
        this.errors.push(error.message);
      }
    });
    if (isUnguardedBody(equation.body)) {
      // Handles UnguardedBody case
      const returnExpression = equation.return;
      if (!returnExpression) throw Error(`Error: Return expression not found`);

      const bodyResult = this.inferenceEngine.infer(
        returnExpression.body.body, // lol
        equationEnv
      );
      if (bodyResult.success === false) throw Error(bodyResult.error);
      //console.log("checkEquation", bodyResult.value, returnType);

      const sub = this.coreHM.unify(bodyResult.value, returnType);
      if (sub.success === false) throw Error(sub.error);
    } else {
      // Handles GuardedBody case
      for (const guard of equation.body) {
        // checks if condition expression in guard is a resolves to YuBoolean

        const condition = this.inferenceEngine.infer(
          guard.condition.body,
          equationEnv
        );
        if (condition.success === false) throw Error(condition.error);

        const conditionSub = this.coreHM.unify(condition.value, booleanType);
        if (conditionSub.success === false) throw Error(conditionSub.error);

        const bodyResult = this.inferenceEngine.infer(
          guard.body.body,
          equationEnv
        );
        if (bodyResult.success === false) throw Error(bodyResult.error);

        const sub = this.coreHM.unify(bodyResult.value, returnType);
        if (sub.success === false) throw Error(sub.error);
      }
    }
  }

  private typeCheck(ast: AST) {
    const env: Environment = new Map();

    // Add top-level signatures to environment
    for (const [name, scheme] of this.signatureMap) {
      env.set(name, scheme);
    }

    // Adds to environment every function that doens't have a signature
    traverse(ast, {
      Function: (node: Function) => {
        const functionName = node.identifier.value;
        let funcScheme = this.signatureMap.get(functionName);
        if (!funcScheme) {
          const funcTypeVar = this.coreHM.freshVar();
          env.set(functionName, {
            type: "TypeScheme",
            quantifiers: [],
            body: funcTypeVar,
            constraints: new Map(),
          });
        }
      },
    });

    traverse(ast, {
      Function: (node: Function) => {
        const functionName = node.identifier.value;
        let funcScheme = this.signatureMap.get(functionName);
        // console.log(inspect(node, false, null, true))
        // Handle function without signature
        if (!funcScheme) {
          const firstEq = node.equations[0];
          const eqEnv = new Map(env);
          const paramTypes = firstEq.patterns.map(() => this.coreHM.freshVar());

          paramTypes.forEach((type, i) => {
            try {
              this.inferenceEngine.processPatterns(
                firstEq.patterns[i],
                type,
                eqEnv
              );
            } catch (error) {
              this.errors.push(error.message);
            }
          });

          let inferredBodyType: Type;
          if (isUnguardedBody(firstEq.body)) {
            const returnExpression = firstEq.return;
            if (!returnExpression)
              throw Error(`Error: Return expression not found`);

            const bodyResult = this.inferenceEngine.infer(
              returnExpression.body.body,
              eqEnv
            );
            if (bodyResult.success === false) {
              this.errors.push(
                `Type error inferring '${functionName}': ${bodyResult.error}`
              );
              return;
            }
            inferredBodyType = bodyResult.value;
          } else {
            // Handle guarded body inference if necessary
            inferredBodyType = this.coreHM.freshVar(); // Placeholder
          }

          const fullFuncType = paramTypes.reduceRight(
            (acc, param) => functionType(param, acc),
            inferredBodyType
          );

          // Generalize the inferred type to create a polymorphic type scheme
          funcScheme = this.coreHM.generalize(env, fullFuncType);
          this.signatureMap.set(functionName, funcScheme);
          env.set(functionName, funcScheme);
        }

        const expectedArity = getArity(this.coreHM.instantiate(funcScheme));
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
              typeVarMap.set(n.value, {
                ...this.coreHM.freshVar(),
                name: n.value,
              });
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
            (acc, input) => functionType(processNode(input), acc),
            processNode(n.return)
          );
        }
        case "TupleType":
          return {
            type: "TypeConstructor",
            name: `Tuple`,
            args: n.values.map((v) => this.toType(v, typeVarMap).type),
          };

        case "ListType":
          return {
            type: "TypeConstructor",
            name: "List",
            args: [this.toType(n.values, typeVarMap).type],
          };

        default:
          return this.coreHM.freshVar();
      }
    };
    const type = processNode(node);
    return { type, constraints: constraintsMap };
  }
}

export function showType(t: Type): string {
  if (t.type === "TypeVar") return t.name ?? `t${t.id}`;

  if (isFunctionType(t)) {
    const a = showType(t.args[0]);
    const b = showType(t.args[1]);
    const aDisp = isFunctionType(t.args[0]) ? `(${a})` : a;
    return `${aDisp} -> ${b}`;
  }
  if (isListType(t)) return `[${showType(t.args[0])}]`;
  if (isTupleType(t)) return `(${t.args.map(showType.bind(this)).join(", ")})`;

  return t.args.length
    ? `${t.name} ${t.args.map(showType.bind(this)).join(" ")}`
    : t.name;
}

export function getReturnType(type: Type): Type {
  let t: Type = type;
  while (isFunctionType(t)) t = t.args[1];
  return t;
}
export function getArgumentTypes(type: Type): Type[] {
  const args: Type[] = [];
  let t: Type = type;
  while (isFunctionType(t)) {
    args.push(t.args[0]);
    t = t.args[1];
  }
  return args;
}
export function getArity(type: Type): number {
  return getArgumentTypes(type).length;
}

export function isUnguardedBody(
  body: UnguardedBody | GuardedBody[]
): body is UnguardedBody {
  return !Array.isArray(body);
}

export function isFunctionType(t: Type): t is FunctionType {
  return t.type === "TypeConstructor" && t.name === "->" && t.args.length === 2;
}
export function isListType(t: Type): t is ListType {
  return t.name === "List";
}
export function isTupleType(t: Type): t is TupleType {
  return t.name === "Tuple";
}

export function functionType(params: Type, returnType: Type): FunctionType {
  return {
    type: "TypeConstructor",
    name: "->",
    args: [params, returnType],
  };
}
export function listType(elementsType: Type): ListType {
  return {
    type: "TypeConstructor",
    name: "List",
    args: [elementsType],
  };
}

export const booleanType: TypeConstructor = {
  type: "TypeConstructor",
  name: "YuBoolean",
  args: [],
};
export const numberType: TypeConstructor = {
  type: "TypeConstructor",
  name: "YuNumber",
  args: [],
};
export const stringType: TypeConstructor = {
  type: "TypeConstructor",
  name: "YuString",
  args: [],
};
