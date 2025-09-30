import { typeClasses } from "../utils/types.js";
import {
  Environment,
  Result,
  showType,
  Substitution,
  Type,
  TypeScheme,
  TypeVar,
} from "./checker.js";

export class CoreHM {
  private nextVarId = 0;

  public freshVar(constraints: string[] = []): TypeVar {
    return { type: "TypeVar", id: this.nextVarId++, constraints };
  }

  public freeTypeVars(t: Type): Map<number, string[]> {
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
  public generalize(env: Environment, t: Type): TypeScheme {
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

  public instantiate(scheme: TypeScheme): Type {
    const substitutions = new Map<number, Type>();
    scheme.quantifiers.forEach((id) => {
      const constraints = scheme.constraints.get(id) || [];
      substitutions.set(id, this.freshVar(constraints));
    });
    return this.applySubst(substitutions, scheme.body);
  }

  public applySubst(subst: Substitution, t: Type): Type {
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

  public composeSubst(s1: Substitution, s2: Substitution): Substitution {
    const result = new Map(s2);
    for (const [id, type] of s1) {
      result.set(id, this.applySubst(s2, type));
    }
    return result;
  }

  public unify(t1: Type, t2: Type): Result<Substitution> {
    if (t1.type === "TypeVar") return this.unifyVar(t1, t2);
    if (t2.type === "TypeVar") return this.unifyVar(t2, t1);
    if (t1.type === "TypeConstructor" && t2.type === "TypeConstructor") {
      if (t1.name !== t2.name || t1.args.length !== t2.args.length) {
        return {
          success: false,
          error: `Cannot unify ${showType(t1)} with ${showType(t2)}`,
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

  public unifyVar(v: TypeVar, t: Type): Result<Substitution> {
    if (t.type === "TypeVar" && t.id === v.id) {
      return { success: true, value: new Map() };
    }
    if (this.occurs(v.id, t)) {
      return { success: false, error: `Occurs check failed` };
    }

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

  public checkConstraint(constraintName: string, t: Type) {
    if (t.type === "TypeVar") {
      if (!t.constraints.includes(constraintName)) {
        t.constraints.push(constraintName);
      }
    } else if (t.type === "TypeConstructor") {
      const instances = typeClasses.get(constraintName);
      if (!instances || !instances.includes(t.name)) {
        throw new Error(
          `Type '${showType(t)}' is not an instance of '${constraintName}'`
        );
      }
    }
  }

  public occurs(varId: number, t: Type): boolean {
    if (t.type === "TypeVar") return t.id === varId;
    if (t.type === "TypeConstructor")
      return t.args.some((a) => this.occurs(varId, a));
    return false;
  }
}

