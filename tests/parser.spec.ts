import { YukigoHaskellParser } from "../src/index.js";
import { assert } from "chai";
import {
  char,
  equation,
  expr,
  func,
  litPattern,
  number,
  str,
  typeCon,
  typeSig,
  unguardedbody,
} from "./builders.js";

describe("Parser Tests", () => {
  let parser: YukigoHaskellParser;
  beforeEach(() => {
    parser = new YukigoHaskellParser();
  });
  it("parses literal character patterns", () => {
    assert.deepEqual(parser.parse("f :: Char -> Int\r\nf 'a' = 1"), [
      typeSig("f", [typeCon("Char")], typeCon("Int")),
      func(
        "f",
        equation([litPattern(char("'a'"))], unguardedbody(expr(number(1))))
      ),
    ]);
  });
  it("parses literal string patterns", () => {
    assert.deepEqual(
      parser.parse('f :: String -> Int\r\nf "hello world" = 1'),
      [
        typeSig("f", [typeCon("String")], typeCon("Int")),
        func(
          "f",
          equation(
            [litPattern(str('"hello world"'))],
            unguardedbody(expr(number(1)))
          )
        ),
      ]
    );
  });
  it("parses literal number patterns", () => {
    assert.deepEqual(parser.parse("f :: Int -> Int\r\nf 1 = 1"), [
      typeSig("f", [typeCon("Int")], typeCon("Int")),
      func(
        "f",
        equation([litPattern(number(1))], unguardedbody(expr(number(1))))
      ),
    ]);
  });
  it("parses left infix partial application", () => {
    assert.deepEqual(parser.parse("f :: Int -> Int\r\nf = (1+)"), []);
  });
  it("parses right infix partial application", () => {
    assert.deepEqual(parser.parse("f :: Int -> Int\r\nf = (+1)"), []);
  });
});
