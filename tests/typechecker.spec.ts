import { inspect } from "util";
import { YukigoHaskellParser } from "../src/index.js";
import { assert } from "chai";

describe("TypeChecker Tests", () => {
  let parser: YukigoHaskellParser;
  beforeEach(() => {
    parser = new YukigoHaskellParser();
  });

  it("reports missing signature for function", () => {
    const code = `g = 1`;
    parser.parse(code);
    assert.include(
      parser.errors,
      "Function 'g' is defined but has no signature"
    );
  });

  it("accepts function with correct type signature", () => {
    const code = `length' :: [a] -> Int\r\nlength' [] = 0\r\nlength' (_:xs) = 1 + length' xs`;
    parser.parse(code);
    assert.isEmpty(parser.errors, "Should have no type errors");
  });

  it("detects return type mismatch", () => {
    const code = `toInt :: String -> Int\r\ntoInt s = s`;
    parser.parse(code);

    assert.include(
      parser.errors,
      "Type error in 'toInt': Cannot unify YuString with YuNumber"
    );
  });

  it("detects parameter type mismatch", () => {
    const code = `head' :: [Int] -> Int\r\nhead' (x:_) = x\r\nhead' [] = 0\r\nfirst :: [Char] -> Char\r\nfirst list = head' list`;
    parser.parse(code);

    assert.include(
      parser.errors,
      "Type error in 'first': Cannot apply [YuChar] to function of type [YuNumber] -> YuNumber"
    );
  });

  it("validates polymorphic function signatures", () => {
    const code = `id :: a -> a\nid x = x`;
    parser.parse(code);
    assert.isEmpty(
      parser.errors,
      "Polymorphic identity function should be valid"
    );
  });

  it("detects incorrect polymorphic usage", () => {
    const code = `id :: a -> a\nid x = x + "not polymorphic"`;
    parser.parse(code);

    assert.include(
      parser.errors,
      "Type error in 'id': Right operand of Plus must be a number"
    );
  });

  it("validates typeclass constraints", () => {
    const code = `f :: Num a => a -> a\r\nf x = x + 2`;
    const ast = parser.parse(code);
    assert.isEmpty(parser.errors, "Should accept valid Show constraint");
  });

  it("detects incorrect typeclass constraints", () => {
    const code = `f :: Num a => a -> a\r\nf x = x ++ "2"`;
    parser.parse(code);
    assert.include(
      parser.errors,
      "Type error in 'f': Type 'YuString' is not an instance of 'Num'"
    );
  });
  it("detects arithmetic type errors", () => {
    const code = `invalidAdd = "text" + 42`;
    parser.parse(code);

    assert.include(
      parser.errors,
      "Type error inferring 'invalidAdd': Left operand of Plus must be a number"
    );
  });

  it("validates higher-order function types", () => {
    const code = `apply :: (a -> b) -> a -> b\napply f x = f x`;
    parser.parse(code);
    assert.isEmpty(parser.errors, "Should accept valid higher-order function");
  });

  it("detects higher-order function misuse", () => {
    const code = `apply :: (Int -> String) -> Int -> String\napply f x = f (x + "error")`;
    parser.parse(code);

    assert.include(
      parser.errors,
      "Type error in 'apply': Right operand of Plus must be a number"
    );
  });

  it("validates recursive function types", () => {
    const code = `factorial :: Int -> Int\nfactorial 0 = 1\nfactorial n = n * factorial (n - 1)`;
    parser.parse(code);
    assert.isEmpty(parser.errors, "Should accept valid recursive function");
  });

  it("detects recursive type errors", () => {
    const code = `badFactorial :: Int -> String\nbadFactorial 0 = "1"\nbadFactorial n = n * badFactorial (n - 1)`;
    parser.parse(code);
    assert.include(
      parser.errors,
      "Type error in 'badFactorial': Cannot unify YuNumber with YuString"
    );
  });

  it("validates data constructor types", () => {
    const code = `data Maybe a = Nothing | Just a\nfromMaybe :: a -> Maybe a -> a\nfromMaybe d Nothing = d\nfromMaybe _ (Just x) = x`;
    parser.parse(code);

    assert.isEmpty(parser.errors, "Should accept valid Maybe implementation");
  });

  it("detects data constructor type errors", () => {
    const code = `data Foo = Bar String | Baz\r\nf :: Int -> Foo\r\nf x = Bar x`;
    parser.parse(code);
    assert.include(
      parser.errors,
      "Type error in 'f': Cannot apply YuNumber to function of type YuString -> Foo t1"
    );
  });

  it("handles multiple type errors", () => {
    const code = `f :: Int -> String\nf x = x + "error"\ng = 42`;
    parser.parse(code);
    assert.equal(parser.errors.length, 2);
    assert.include(
      parser.errors,
      "Function 'g' is defined but has no signature"
    );
    assert.include(
      parser.errors,
      "Type error in 'f': Right operand of Plus must be a number"
    );
  });
});
