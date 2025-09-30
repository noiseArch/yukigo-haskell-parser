import grammar from "./parser/grammar.js";
import nearley from "nearley";
import { groupFunctionDeclarations } from "./utils/helpers.js";
import { TypeChecker } from "./typechecker/checker.js";
import { AST, YukigoParser } from "yukigo-core";
import { inspect } from "util";

// This is the final parser that Yukigo accepts.
// every parser NEEDS to expose a 'parse' method/function and an array of errors

export class YukigoHaskellParser implements YukigoParser {
  public errors: string[] = [];
  constructor() {
    this.errors = [];
  }

  public parse(code: string): AST {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    try {
      parser.feed(code);
      parser.finish();
    } catch (error) {
      const token = error.token;
      const message = `Unexpected '${token.type}' token '${token.value}' at line ${token.line} col ${token.col}.`;
      this.errors.push(message);
      throw Error(message);
    }
    if (parser.results.length > 1) {
      this.errors.push("Too much ambiguity. Output not generated.");
      throw Error("Too much ambiguity. Output not generated.");
    }
    if (parser.results.length == 0) {
      this.errors.push("Parser did not generate an AST.");
      throw Error("Parser did not generate an AST.");
    }
    const groupedAst = groupFunctionDeclarations(parser.results[0]);
    try {
      const typeChecker = new TypeChecker();
      const errors = typeChecker.check(groupedAst);
      if (errors.length > 0) {
        this.errors.push(...errors);
      }
    } catch (error) {
      console.log(error)
    }
    return groupedAst;
  }
}
