import { YukigoHaskellParser } from "../src/index.js";
import { assert } from "chai";
import { inspect } from "util";

import {
  application,
  arithmetic,
  arithmeticUnary,
  charPrimitive,
  comparisonOp,
  consPattern,
  constraint,
  equation,
  expression,
  func,
  guardedbody,
  ifThenElse,
  lambda,
  listBinaryOp,
  ListType,
  listType,
  listUnaryOp,
  literalPattern,
  logicalBinaryOperation,
  numberPrimitive,
  otherwise,
  parameterizedType,
  returnExpr,
  sequence,
  stringPrimitive,
  symbolPrimitive,
  tuplePattern,
  typeAlias,
  typeApplication,
  typeCast,
  typeCon,
  typeSig,
  unguardedbody,
  variable,
  varPattern,
} from "yukigo-core";

describe("Parser Tests", () => {
  let parser: YukigoHaskellParser;
  beforeEach(() => {
    parser = new YukigoHaskellParser();
  });

  it("parses boolean expressions", () => {
    const returnExpression = returnExpr(
      logicalBinaryOperation(
        "And",
        expression(symbolPrimitive("x")),
        expression(symbolPrimitive("y"))
      )
    );
    assert.deepEqual(parser.parse("f x y = x && y"), [
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("x")), varPattern(symbolPrimitive("y"))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses literal character patterns", () => {
    const returnExpression = returnExpr(numberPrimitive(1));
    assert.deepEqual(parser.parse("f 'a' = 1"), [
      func(
        "f",
        equation(
          [literalPattern(charPrimitive("'a'"))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses literal string patterns", () => {
    const returnExpression = returnExpr(numberPrimitive(1));
    assert.deepEqual(parser.parse('f "hello world" = 1'), [
      func(
        "f",
        equation(
          [literalPattern(stringPrimitive('"hello world"'))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses literal number patterns", () => {
    const returnExpression = returnExpr(numberPrimitive(1));
    assert.deepEqual(parser.parse("f 1 = 1"), [
      func(
        "f",
        equation(
          [literalPattern(numberPrimitive(1))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses simple cons pattern", () => {
    const returnExpression = returnExpr(
      arithmetic(
        "Plus",
        expression(symbolPrimitive("x")),
        expression(
          application(
            expression(symbolPrimitive("f")),
            expression(symbolPrimitive("xs"))
          )
        )
      )
    );
    assert.deepEqual(parser.parse("f (x:xs) = x + f xs"), [
      func(
        "f",
        equation(
          [
            consPattern(
              varPattern(symbolPrimitive("x")),
              varPattern(symbolPrimitive("xs"))
            ),
          ],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses multiple cons pattern", () => {
    const returnExpression = returnExpr(
      arithmetic(
        "Plus",
        expression(symbolPrimitive("x")),
        expression(
          application(
            expression(symbolPrimitive("f")),
            expression(symbolPrimitive("xs"))
          )
        )
      )
    );
    assert.deepEqual(parser.parse("f (x:y:xs) = x + f xs"), [
      func(
        "f",
        equation(
          [
            consPattern(
              varPattern(symbolPrimitive("x")),
              consPattern(
                varPattern(symbolPrimitive("y")),
                varPattern(symbolPrimitive("xs"))
              )
            ),
          ],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses left infix partial application", () => {
    const returnExpression = returnExpr(
      application(
        expression(symbolPrimitive("Plus")),
        expression(numberPrimitive(1))
      )
    );
    assert.deepEqual(parser.parse("f = (1+)"), [
      func(
        "f",
        equation(
          [],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses right infix partial application", () => {
    const returnExpression = returnExpr(
      application(
        expression(symbolPrimitive("flip")),
        expression(
          application(
            expression(symbolPrimitive("Plus")),
            expression(numberPrimitive(1))
          )
        )
      )
    );
    assert.deepEqual(parser.parse("f = (+1)"), [
      func(
        "f",
        equation(
          [],
          unguardedbody(sequence([returnExpression])),
          returnExpression
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
    const returnExpression = returnExpr(
      typeCast(typeCon("Int", []), expression(numberPrimitive(1)))
    );
    assert.deepEqual(parser.parse("x = 1 :: Int"), [
      func(
        "x",
        equation(
          [],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses inline type annotations with restrictions", () => {
    const returnExpression = returnExpr(
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
    );
    assert.deepEqual(parser.parse("x = 1 :: (Num a, Foldable t) => t a"), [
      func(
        "x",
        equation(
          [],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses chars and single char strings differently", () => {
    assert.notDeepEqual(parser.parse('x = "a"'), parser.parse("x = 'a'"));
  });
  it("parses chars as YuChars", () => {
    const returnExpression = returnExpr(charPrimitive("'a'"));
    assert.deepEqual(parser.parse("x = 'a'"), [
      func(
        "x",
        equation(
          [],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses inline guards correctly", () => {
    assert.deepEqual(parser.parse("f x | x > 40 = 2 | otherwise = 1"), [
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("x"))],
          [
            guardedbody(
              expression(
                comparisonOp(
                  "GreaterThan",
                  expression(symbolPrimitive("x")),
                  expression(numberPrimitive(40))
                )
              ),
              expression(numberPrimitive(2))
            ),
            guardedbody(
              expression(otherwise()),
              expression(numberPrimitive(1))
            ),
          ]
        )
      ),
    ]);
  });
  it("throws when guarded body is badly indented ", () => {
    assert.throw(
      () => parser.parse("f x | x < 1 = 10\n| x > 11 = 0"),
      "Unexpected 'op' token '|' at line 2 col 1"
    );
  });
  it("parses multi-line guards correctly", () => {
    const ast = [
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("x"))],
          [
            guardedbody(
              expression(
                comparisonOp(
                  "GreaterThan",
                  expression(symbolPrimitive("x")),
                  expression(numberPrimitive(40))
                )
              ),
              expression(numberPrimitive(2))
            ),
            guardedbody(
              expression(otherwise()),
              expression(numberPrimitive(1))
            ),
          ]
        )
      ),
    ];

    assert.deepEqual(parser.parse("f x\n | x > 40 = 2\n | otherwise = 1"), ast);
    assert.deepEqual(parser.parse("f x\n | x > 40 = 2 | otherwise = 1"), ast);
    assert.deepEqual(parser.parse("f x | x > 40 = 2\n | otherwise = 1"), ast);
    assert.deepEqual(
      parser.parse("f x\n |\n x > 40 =\n 2 |\n otherwise\n =\n 1"),
      ast
    );
    assert.deepEqual(
      parser.parse("f x\n |\n x > 40 =\n 2 | otherwise = 1"),
      ast
    );
    assert.deepEqual(
      parser.parse("f x | x > 40 = 2 |\n otherwise\n =\n 1"),
      ast
    );
  });
  it("parses inline if then else correctly", () => {
    const returnExpression = returnExpr(
      ifThenElse(
        expression(
          comparisonOp(
            "LessThan",
            expression(symbolPrimitive("x")),
            expression(numberPrimitive(4))
          )
        ),
        expression(numberPrimitive(10)),
        expression(numberPrimitive(20))
      )
    );
    assert.deepEqual(parser.parse("f x = if x < 4 then 10 else 20"), [
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("x"))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses multi-line if then else correctly", () => {
    const returnExpression = returnExpr(
      ifThenElse(
        expression(
          comparisonOp(
            "LessThan",
            expression(symbolPrimitive("x")),
            expression(numberPrimitive(4))
          )
        ),
        expression(numberPrimitive(10)),
        expression(numberPrimitive(20))
      )
    );
    const ast = [
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("x"))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ];

    assert.deepEqual(parser.parse("f x =\n if x < 4 then 10 else 20"), ast);
    assert.deepEqual(parser.parse("f x = if x < 4\n then 10\n else 20"), ast);
    assert.deepEqual(parser.parse("f x = \n if x < 4\nthen 10\n else 20"), ast);
    assert.deepEqual(parser.parse("f x = \n if x < 4\n then 10\nelse 20"), ast);
    assert.deepEqual(
      parser.parse("f x = \n if x < 4\n then 10\n else 20"),
      ast
    );
  });
  it("parses inline where clause correctly", () => {
    assert.deepEqual(
      parser.parse(
        "areaOfCircle radius = pi * radius_squared where pi = 3.14159; radius_squared = radius * radius"
      ),
      [
        func(
          "areaOfCircle",
          equation(
            [varPattern(symbolPrimitive("radius"))],
            unguardedbody(
              sequence([
                func(
                  "pi",
                  equation(
                    [],
                    unguardedbody(
                      sequence([returnExpr(numberPrimitive(3.14159))])
                    ),
                    returnExpr(numberPrimitive(3.14159))
                  )
                ),
                func(
                  "radius_squared",
                  equation(
                    [],
                    unguardedbody(
                      sequence([
                        returnExpr(
                          expression(
                            arithmetic(
                              "Multiply",
                              expression(symbolPrimitive("radius")),
                              expression(symbolPrimitive("radius"))
                            )
                          )
                        ),
                      ])
                    ),
                    returnExpr(
                      expression(
                        arithmetic(
                          "Multiply",
                          expression(symbolPrimitive("radius")),
                          expression(symbolPrimitive("radius"))
                        )
                      )
                    )
                  )
                ),

                returnExpr(
                  arithmetic(
                    "Multiply",
                    expression(symbolPrimitive("pi")),
                    expression(symbolPrimitive("radius_squared"))
                  )
                ),
              ])
            ),
            returnExpr(
              arithmetic(
                "Multiply",
                expression(symbolPrimitive("pi")),
                expression(symbolPrimitive("radius_squared"))
              )
            )
          )
        ),
      ]
    );
  });
  it("parses multi-line where clause correctly", () => {
    const returnExpression = returnExpr(
      arithmetic(
        "Multiply",
        expression(symbolPrimitive("pi")),
        expression(symbolPrimitive("radius_squared"))
      )
    );
    const ast = [
      func(
        "areaOfCircle",
        equation(
          [varPattern(symbolPrimitive("radius"))],
          unguardedbody(
            sequence([
              func(
                "pi",
                equation(
                  [],
                  unguardedbody(
                    sequence([returnExpr(numberPrimitive(3.14159))])
                  ),
                  returnExpr(numberPrimitive(3.14159))
                )
              ),
              func(
                "radius_squared",
                equation(
                  [],
                  unguardedbody(
                    sequence([
                      returnExpr(
                        expression(
                          arithmetic(
                            "Multiply",
                            expression(symbolPrimitive("radius")),
                            expression(symbolPrimitive("radius"))
                          )
                        )
                      ),
                    ])
                  ),
                  returnExpr(
                    expression(
                      arithmetic(
                        "Multiply",
                        expression(symbolPrimitive("radius")),
                        expression(symbolPrimitive("radius"))
                      )
                    )
                  )
                )
              ),
              returnExpression,
            ])
          ),
          returnExpression
        )
      ),
    ];

    assert.deepEqual(
      parser.parse(
        "areaOfCircle radius = pi * radius_squared\n where pi = 3.14159; radius_squared = radius * radius"
      ),
      ast
    );
    assert.deepEqual(
      parser.parse(
        "areaOfCircle radius = pi * radius_squared\n where\n pi = 3.14159\n radius_squared = radius * radius"
      ),
      ast
    );
  });

  it("parses primitive operator map with lambda", () => {
    const code = `f :: [Int] -> [Int]\nf xs = map (\\x -> x * 2) xs`;
    const returnExpression = returnExpr(
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
    );
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
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses primitive operator map with function", () => {
    const code = `f :: [Int] -> [Int]\nf xs = map double xs`;
    const returnExpression = returnExpr(
      listBinaryOp(
        "Collect",
        expression(symbolPrimitive("double")),
        expression(symbolPrimitive("xs"))
      )
    );
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
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses primitive operator map with partial application", () => {
    const code = `f :: [Int] -> [Int]\nf xs = map (multiply 2) xs`;
    const returnExpression = returnExpr(
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
    );
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
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses primitive operator map with infix partial application", () => {
    const code = `f :: [Int] -> [Int]\nf xs = map (* 2) xs`;
    const returnExpression = returnExpr(
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
    );
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
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses collection's primitive operator max", () => {
    const code = `f :: [Int] -> Int\nf xs = max xs`;
    const ast = parser.parse(code);
    const returnExpression = returnExpr(
      listUnaryOp("DetectMax", expression(symbolPrimitive("xs")))
    );
    assert.deepEqual(ast, [
      typeSig("f", [listType(typeCon("Int", []), [])], typeCon("Int", []), []),
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("xs"))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses arithmetic's binary primitive operator max", () => {
    const code = `f :: Int -> Int -> Int\r\nf x y = max x y`;
    const ast = parser.parse(code);
    const returnExpression = returnExpr(
      arithmetic(
        "Max",
        expression(symbolPrimitive("x")),
        expression(symbolPrimitive("y"))
      )
    );
    assert.deepEqual(ast, [
      typeSig(
        "f",
        [typeCon("Int", []), typeCon("Int", [])],
        typeCon("Int", []),
        []
      ),
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("x")), varPattern(symbolPrimitive("y"))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses arithmetic's unary primitive operator round", () => {
    const code = `f :: Int -> Int\r\nf x = round x`;
    const ast = parser.parse(code);
    const returnExpression = returnExpr(
      arithmeticUnary("Round", expression(symbolPrimitive("x")))
    );
    assert.deepEqual(ast, [
      typeSig("f", [typeCon("Int", [])], typeCon("Int", []), []),
      func(
        "f",
        equation(
          [varPattern(symbolPrimitive("x"))],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
  it("parses arithmetic's unary primitive operator round with YuNumber", () => {
    const code = `four :: Int\r\nfour = round 3.7`;
    const ast = parser.parse(code);
    const returnExpression = returnExpr(
      arithmeticUnary("Round", expression(numberPrimitive(3.7)))
    );
    assert.deepEqual(ast, [
      typeSig("four", [], typeCon("Int", []), []),
      func(
        "four",
        equation(
          [],
          unguardedbody(sequence([returnExpression])),
          returnExpression
        )
      ),
    ]);
  });
});
