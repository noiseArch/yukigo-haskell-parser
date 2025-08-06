import grammar from "./parser/grammar.js";
import nearley from "nearley";
import { groupFunctionDeclarations } from "./utils/helpers.js";
import { TypeChecker } from "./typechecker.js";
import { ASTGrouped, YukigoParser } from "yukigo-core";

// This is the final parser that Yukigo accepts.
// every parser NEEDS to expose a 'parse' method/function and an array of errors

export class YukigoHaskellParser implements YukigoParser {
  public errors: string[] = [];
  constructor() {
    this.errors = [];
  }

  public parse(code: string): ASTGrouped {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    parser.feed(code);
    parser.finish();
    if (parser.results.length > 1) {
      this.errors.push("Too much ambiguity. Output not generated.");
      throw Error("Too much ambiguity. Output not generated.");
    }
    if (parser.results.length == 0) {
      this.errors.push("Parser did not generate an AST.");
      throw Error("Parser did not generate an AST.");
    }
    const groupedAst = groupFunctionDeclarations(parser.results[0]);
    const typeChecker = new TypeChecker();
    const errors = typeChecker.check(groupedAst);
    if (errors.length > 0) {
      this.errors.push(...errors);
    }
    return groupedAst;
  }
}
