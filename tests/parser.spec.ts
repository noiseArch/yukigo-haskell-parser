import { YukigoHaskellParser } from "../src/index.js";
import { assert } from "chai";
import { inspect } from "util";

import {
  application,
  arithmetic,
  charPrimitive,
  constraint,
  equation,
  expression,
  func,
  lambda,
  listBinaryOp,
  ListType,
  listType,
  literalPattern,
  numberPrimitive,
  parameterizedType,
  stringPrimitive,
  symbolPrimitive,
  typeAlias,
  typeApplication,
  typeCast,
  typeCon,
  typeSig,
  unguardedbody,
  varPattern,
} from "yukigo-core";

describe("Parser Tests", () => {
  let parser: YukigoHaskellParser;
  beforeEach(() => {
    parser = new YukigoHaskellParser();
  });
  it("parses literal character patterns", () => {
    assert.deepEqual(parser.parse("f 'a' = 1"), [
      func(
        "f",
        equation(
          [literalPattern(charPrimitive("'a'"))],
          unguardedbody(expression(numberPrimitive(1)))
        )
      ),
    ]);
  });
  it("parses literal string patterns", () => {
    assert.deepEqual(parser.parse('f "hello world" = 1'), [
      func(
        "f",
        equation(
          [literalPattern(stringPrimitive('"hello world"'))],
          unguardedbody(expression(numberPrimitive(1)))
        )
      ),
    ]);
  });
  it("parses literal number patterns", () => {
    assert.deepEqual(parser.parse("f 1 = 1"), [
      func(
        "f",
        equation(
          [literalPattern(numberPrimitive(1))],
          unguardedbody(expression(numberPrimitive(1)))
        )
      ),
    ]);
  });
  it("parses left infix partial application", () => {
    assert.deepEqual(parser.parse("f = (1+)"), [
      func(
        "f",
        equation(
          [],
          unguardedbody(
            expression(
              application(
                expression(symbolPrimitive("Plus")),
                expression(numberPrimitive(1))
              )
            )
          )
        )
      ),
    ]);
  });
  it("parses right infix partial application", () => {
    assert.deepEqual(parser.parse("f = (+1)"), [
      func(
        "f",
        equation(
          [],
          unguardedbody(
            expression(
              application(
                expression(symbolPrimitive("flip")),
                expression(
                  application(
                    expression(symbolPrimitive("Plus")),
                    expression(numberPrimitive(1))
                  )
                )
              )
            )
          )
        )
      ),
    ]);
  });
  it("parses type restrictions", () => {
    assert.deepEqual(parser.parse("f :: Num a => [a] -> [a]"), [
      typeSig(
        "f",
        [listType(typeCon("a", []), [])],
        listType(typeCon("a", []), []),
        [constraint("Num", [typeCon("a", [])])]
      ),
    ]);
  });
  it("parses multiple type restrictions", () => {
    assert.deepEqual(parser.parse("f :: (Num a, Eq b) => [a] -> [b]"), [
      typeSig(
        "f",
        [listType(typeCon("a", []), [])],
        listType(typeCon("b", []), []),
        [
          constraint("Num", [typeCon("a", [])]),
          constraint("Eq", [typeCon("b", [])]),
        ]
      ),
    ]);
  });
  it("parses signatures without type restrictions", () => {
    assert.deepEqual(parser.parse("f :: [a] -> [a]"), [
      typeSig(
        "f",
        [listType(typeCon("a", []), [])],
        listType(typeCon("a", []), []),
        []
      ),
    ]);
  });
  it("parses type alias", () => {
    assert.deepEqual(parser.parse("type String = [Char]"), [
      typeAlias("String", listType(typeCon("Char", []), []), []),
    ]);
  });
  it("parses type alias with arguments", () => {
    assert.deepEqual(parser.parse("type List a = [a]"), [
      typeAlias("List", listType(typeCon("a", []), []), ["a"]),
    ]);
  });
  it("parses inline type annotations", () => {
    assert.deepEqual(parser.parse("x = 1 :: Int"), [
      func(
        "x",
        equation(
          [],
          unguardedbody(
            expression(
              typeCast(typeCon("Int", []), expression(numberPrimitive(1)))
            )
          )
        )
      ),
    ]);
  });
  it("parses inline type annotations with restrictions", () => {
    assert.deepEqual(parser.parse("x = 1 :: (Num a, Foldable t) => t a"), [
      func(
        "x",
        equation(
          [],
          unguardedbody(
            expression(
              typeCast(
                parameterizedType(
                  [],
                  typeApplication(typeCon("t", []), typeCon("a", [])),
                  [
                    constraint("Num", [typeCon("a", [])]),
                    constraint("Foldable", [typeCon("t", [])]),
                  ]
                ),
                expression(numberPrimitive(1))
              )
            )
          )
        )
      ),
    ]);
  });
  it("parses chars and single char strings differently", () => {
    assert.notDeepEqual(parser.parse('x = "a"'), parser.parse("x = 'a'"));
  });
  it("parses chars as YuChars", () => {
    assert.deepEqual(parser.parse("x = 'a'"), [
      func("x", equation([], unguardedbody(expression(charPrimitive("'a'"))))),
    ]);
  });
  it("parses primitive operator map with lambda", () => {
    const code = `f :: [Int] -> [Int]\nf xs = map (\\x -> x * 2) xs`;
    const ast = parser.parse(code);
    console.log(inspect(ast, false, null, true));
    assert.deepEqual(ast, [
      typeSig(
        "f",
        [listType(typeCon("Int", []), [])],
        listType(typeCon("Int", []), []),
        []
      ),
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("xs"))],
          unguardedbody(
            expression(
              listBinaryOp(
                "Collect",
                expression(
                  lambda(
                    [varPattern(symbolPrimitive("x"))],
                    expression(
                      arithmetic(
                        "Multiply",
                        expression(symbolPrimitive("x")),
                        expression(numberPrimitive(2))
                      )
                    )
                  )
                ),
                expression(symbolPrimitive("xs"))
              )
            )
          )
        )
      ),
    ]);
  });
  it("parses primitive operator map with function", () => {
    const code = `f :: [Int] -> [Int]\nf xs = map double xs`;
    const ast = parser.parse(code);
    assert.deepEqual(ast, [
      typeSig(
        "f",
        [listType(typeCon("Int", []), [])],
        listType(typeCon("Int", []), []),
        []
      ),
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("xs"))],
          unguardedbody(
            expression(
              listBinaryOp(
                "Collect",
                expression(symbolPrimitive("double")),
                expression(symbolPrimitive("xs"))
              )
            )
          )
        )
      ),
    ]);
  });
  it("parses primitive operator map with partial application", () => {
    const code = `f :: [Int] -> [Int]\nf xs = map (multiply 2) xs`;
    const ast = parser.parse(code);
    assert.deepEqual(ast, [
      typeSig(
        "f",
        [listType(typeCon("Int", []), [])],
        listType(typeCon("Int", []), []),
        []
      ),
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("xs"))],
          unguardedbody(
            expression(
              listBinaryOp(
                "Collect",
                expression(
                  application(
                    expression(symbolPrimitive("multiply")),
                    expression(numberPrimitive(2))
                  )
                ),
                expression(symbolPrimitive("xs"))
              )
            )
          )
        )
      ),
    ]);
  });
  it("parses primitive operator map with infix partial application", () => {
    const code = `f :: [Int] -> [Int]\nf xs = map (* 2) xs`;
    const ast = parser.parse(code);
    console.log(inspect(ast, false, null, true));
    assert.deepEqual(ast, [
      typeSig(
        "f",
        [listType(typeCon("Int", []), [])],
        listType(typeCon("Int", []), []),
        []
      ),
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("xs"))],
          unguardedbody(
            expression(
              listBinaryOp(
                "Collect",
                expression(
                  application(
                    expression(symbolPrimitive("flip")),
                    expression(
                      application(
                        expression(symbolPrimitive("Multiply")),
                        expression(numberPrimitive(2))
                      )
                    )
                  )
                ),
                expression(symbolPrimitive("xs"))
              )
            )
          )
        )
      ),
    ]);
  });
});
