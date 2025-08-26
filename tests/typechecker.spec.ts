import { inspect } from "util";
import { YukigoHaskellParser } from "../src/index.js";
import { assert } from "chai";

describe("TypeChecker Tests", () => {
  let parser: YukigoHaskellParser;
  beforeEach(() => {
    parser = new YukigoHaskellParser();
  });

  it("reports undefined function in type signature", () => {
    const code = `g = 1`;
    parser.parse(code);
    assert.include(
      parser.errors,
      "Function 'g' is defined but has no signature"
    );
  });

  it("reports multiple type signatures for a function", () => {
    const code = `f :: Int -> Int\nf :: Int -> Int\nf x = x`;
    parser.parse(code);
    assert.include(parser.errors, "Function 'f' has multiple type signatures");
  });

  it("reports type alias redefinition", () => {
    const code = `type Foo = Int\ntype Foo = String`;
    parser.parse(code);
    assert.include(parser.errors, "Type alias 'Foo' is already defined");
  });

  it("reports record redefinition", () => {
    const code = `data Bar = Baz\ndata Bar = Qux`;
    parser.parse(code);
    assert.include(parser.errors, "Record 'Bar' is already defined");
  });

  it("reports list with mixed types", () => {
    const code = `f = [1, 'a']`;
    parser.parse(code);
    assert.include(
      parser.errors,
      "List elements must all be same type. Found: YuNumber and others"
    );
  });

  it("reports type mismatch in if branches", () => {
    const code = `f x = if x then 1 else 'a'`;
    parser.parse(code);
    assert.include(parser.errors, "Type mismatch");
  });

  it("reports function arity mismatch", () => {
    const code = `f :: Int -> Int\nf x y = x + y`;
    parser.parse(code);
    assert.include(parser.errors, "Function 'f' has arity mismatch");
  });

  it("reports infinite type error", () => {
    const code = `type Foo = Bar\r\ntype Bar = Foo`;
    parser.parse(code);
    assert.include(parser.errors, "Infinite type detected");
  });

  it("accepts correct type signature and implementation", () => {
    const code = `f :: Int -> Int\nf x = x + 1`;
    parser.parse(code);
    assert.isEmpty(parser.errors);
  });

  it("accepts correct type alias", () => {
    const code = `type Foo = Int\nf :: Foo -> Int\nf x = x + 1`;
    parser.parse(code);
    assert.isEmpty(parser.errors);
  });

  it("accepts tuple with different elements", () => {
    const code = `f :: (Int, Char)\r\nf = (1, 'a')`;
    parser.parse(code);
    assert.isEmpty(parser.errors);
  });

  it("reports constructor redefinition in record", () => {
    const code = `data Foo = Bar | Bar`;
    parser.parse(code);
    assert.include(parser.errors, "Constructor 'Bar' is already defined");
  });

  it("accepts correct record usage", () => {
    const code = `data Foo = Bar Int | Baz String\nf :: Foo -> Int\nf (Bar x) = x\nf (Baz s) = 1`;
    parser.parse(code);
    assert.isEmpty(parser.errors);
  });

  it("reports type variable shadowing in type alias", () => {
    const code = `type List a = [a]\ntype List a = [Int]`;
    parser.parse(code);
    assert.include(parser.errors, "Type alias 'List' is already defined");
  });

  it("reports nested list type mismatch", () => {
    const code = `f = [[1], ['a']]`;
    parser.parse(code);
    assert.include(
      parser.errors,
      "List elements must all be same type. Found: [YuNumber] and others"
    );
  });

  it("reports tuple arity mismatch in pattern", () => {
    const code = `f (x, y) = x\nf (x, y, z) = x`;
    parser.parse(code);
    console.log(parser.errors)
    assert.include(parser.errors, "Type mismatch");
  });

  it("reports record constructor argument mismatch", () => {
    const code = `data Foo = Bar Int | Baz String\r\nf = Bar 'a'`;
    parser.parse(code);
    assert.include(parser.errors, "Cannot apply YuChar to function expecting YuNumber");
  });

  it("accepts type alias with parameterized types", () => {
    const code = `type Pair a b = (a, b)\r\nf :: Pair Int String -> Int\nf (x, y) = x`;
    parser.parse(code);
    assert.isEmpty(parser.errors);
  });

  it("accepts function with constraints", () => {
    const code = `f :: Num a => a -> a\nf x = x + 1`;
    parser.parse(code);
    assert.isEmpty(parser.errors);
  });

  it("accepts correct tuple usage", () => {
    const code = `f :: (Int, Int)\r\nf = (1, 2)`;
    parser.parse(code);
    assert.isEmpty(parser.errors);
  });
});
