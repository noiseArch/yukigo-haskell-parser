import {
  Application,
  ArithmeticBinaryOperation,
  ArithmeticUnaryOperation,
  BodyExpression,
  ComparisonOperation,
  CompositionExpression,
  ConsExpression,
  DataExpression,
  If,
  InfixApplicationExpression,
  isYukigoPrimitive,
  Lambda,
  ListBinaryOperation,
  ListPrimitive,
  ListUnaryOperation,
  LogicalBinaryOperation,
  Otherwise,
  Pattern,
  Primitive,
  StringOperation,
  SymbolPrimitive,
  TupleExpression,
} from "yukigo-core";
import {
  Environment,
  getArgumentTypes,
  getArity,
  isFunctionType,
  Result,
  showType,
  Type,
  functionType,
  TypeConstructor,
  TypeScheme,
  isListType,
  isTupleType,
  listType,
  TypeVar,
  booleanType,
  numberType,
  stringType,
} from "./checker.js";
import { CoreHM } from "./core.js";



export class InferenceEngine {
  private signatureMap: Map<string, TypeScheme>;
  private coreHM: CoreHM;

  constructor(signatureMap: Map<string, TypeScheme>, coreHM: CoreHM) {
    this.signatureMap = signatureMap;
    this.coreHM = coreHM;
  }

  public infer(expr: BodyExpression, env: Environment): Result<Type> {
    // I think all this would benefit from a Visitor pattern -_-
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
      case "ArithmeticUnaryOperation":
        return this.inferArithmeticUnary(expr, env);
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
      case "ListUnaryOperation":
        return this.inferListUnaryOp(expr, env);
      case "LogicalBinaryOperation":
        return this.inferLogicalBinaryOperation(expr, env);
      case "Otherwise":
        return this.inferOtherwise(expr);
      default:
        return {
          success: false,
          error: `Unknown expression type: ${expr.type}`,
        };
    }
  }

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
  private inferOtherwise(expr: Otherwise): Result<Type> {
    return {
      success: true,
      value: booleanType,
    };
  }

  private inferSymbol(expr: SymbolPrimitive, env: Environment): Result<Type> {
    const name = expr.value;
    //console.log(env, env.get(name));
    const scheme = env.get(name) || this.signatureMap.get(name);

    if (!scheme) return { success: false, error: `Unbound variable: ${name}` };

    return { success: true, value: this.coreHM.instantiate(scheme) };
  }

  private inferArithmetic(
    expr: ArithmeticBinaryOperation,
    env: Environment
  ): Result<Type> {
    const leftResult = this.infer(expr.left.body, env);
    const rightResult = this.infer(expr.right.body, env);

    if (!leftResult.success) return leftResult;
    if (!rightResult.success) return rightResult;

    const unifyLeft = this.coreHM.unify(leftResult.value, numberType);
    const unifyRight = this.coreHM.unify(rightResult.value, numberType);
    if (!unifyLeft.success)
      return {
        success: false,
        error: `Left operand of ${expr.operator} must be a number`,
      };

    if (!unifyRight.success)
      return {
        success: false,
        error: `Right operand of ${expr.operator} must be a number`,
      };

    return { success: true, value: numberType };
  }
  private inferArithmeticUnary(
    expr: ArithmeticUnaryOperation,
    env: Environment
  ): Result<Type> {
    const operandResult = this.infer(expr.operand.body, env);

    if (!operandResult.success) return operandResult;

    const unifyOperand = this.coreHM.unify(operandResult.value, numberType);
    if (!unifyOperand.success)
      return {
        success: false,
        error: `Operand of ${expr.operator} must be a number`,
      };

    return { success: true, value: numberType };
  }

  private inferLogicalBinaryOperation(
    expr: LogicalBinaryOperation,
    env: Environment
  ): Result<Type> {
    const operator = expr.operator;

    const leftResult = this.infer(expr.left.body, env);
    if (!leftResult.success) return leftResult;
    const rightResult = this.infer(expr.right.body, env);
    if (!rightResult.success) return rightResult;

    const leftSub = this.coreHM.unify(leftResult.value, booleanType);
    if (!leftSub.success)
      return {
        success: false,
        error: `Left side of ${operator} must be a boolean`,
      };
    const rightSub = this.coreHM.unify(rightResult.value, booleanType);
    if (!rightSub.success)
      return {
        success: false,
        error: `Right side of ${operator} must be a boolean`,
      };

    return { success: true, value: booleanType };
  }

  private inferIf(expr: If, env: Environment): Result<Type> {
    const condResult = this.infer(expr.condition.body, env);

    if (!condResult.success) return condResult;

    const condSub = this.coreHM.unify(condResult.value, booleanType);
    if (!condSub.success)
      return { success: false, error: "Condition must be a boolean" };

    const thenResult = this.infer(expr.then.body, env);
    const elseResult = this.infer(expr.else.body, env);

    if (!thenResult.success) return thenResult;
    if (!elseResult.success) return elseResult;

    const unifyResult = this.coreHM.unify(thenResult.value, elseResult.value);
    if (!unifyResult.success)
      return {
        success: false,
        error: `Branch types don't match: ${showType(
          thenResult.value
        )} vs ${showType(elseResult.value)}`,
      };

    return thenResult;
  }

  private inferLambda(expr: Lambda, env: Environment): Result<Type> {
    // Create fresh type variables for parameters
    const paramTypes = expr.parameters.map(() => this.coreHM.freshVar());
    const newEnv = new Map(env);

    // Add parameters to environment
    expr.parameters.forEach((param, i) => {
      try {
        this.processPatterns(param, paramTypes[i], newEnv);
      } catch (error) {
        throw Error(error.message);
      }
    });

    // Infer body type
    const bodyResult = this.infer(expr.body.body, newEnv);
    if (!bodyResult.success) return bodyResult;

    // Construct function type
    const funcType = paramTypes.reduceRight(
      (acc, param) => functionType(param, acc),
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

    const resultType = this.coreHM.freshVar();
    const funcType: TypeConstructor = functionType(argResult.value, resultType);
    const unifyResult = this.coreHM.unify(funcResult.value, funcType);
    if (unifyResult.success === false) {
      return {
        success: false,
        error: `Cannot apply ${showType(argResult.value)} to type ${showType(
          funcResult.value
        )}`,
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

    const a = this.coreHM.freshVar();
    const b = this.coreHM.freshVar();
    const c = this.coreHM.freshVar();

    const fType: TypeConstructor = functionType(b, c);
    const gType: TypeConstructor = functionType(a, b);

    const fSub = this.coreHM.unify(fResult.value, fType);
    const gSub = this.coreHM.unify(gResult.value, gType);

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

    const composedType: TypeConstructor = functionType(a, c);

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

    const opType = this.coreHM.instantiate(opScheme);
    if (!isFunctionType(opType)) {
      return {
        success: false,
        error: `Operator ${expr.operator.value} has invalid type`,
      };
    }

    const leftResult = this.infer(expr.left.body, env);
    const rightResult = this.infer(expr.right.body, env);

    if (!leftResult.success) return leftResult;
    if (!rightResult.success) return rightResult;

    const unifyLeft = this.coreHM.unify(leftResult.value, opType.args[0]);
    const unifyRight = this.coreHM.unify(rightResult.value, opType.args[1]);

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

    const ctorType = this.coreHM.instantiate(ctorScheme);

    // Data constructors should be functions
    if (!isFunctionType(ctorType))
      return { success: false, error: "Constructors should be FunctionType" };

    // Check arguments
    let currentType: Type = ctorType;
    for (const arg of expr.contents) {
      const argResult = this.infer(arg.expression.body, env);
      if (!argResult.success) return argResult;

      if (!isFunctionType(currentType)) {
        return {
          success: false,
          error: `Too many arguments to constructor ${expr.name.value}`,
        };
      }

      const unifyResult = this.coreHM.unify(
        argResult.value,
        currentType.args[0]
      );
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
        name: `Tuple`,
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

    // Create a list type with a fresh element type
    const elemType = this.coreHM.freshVar();
    const listT: TypeConstructor = listType(elemType);
    // Unify the tail result with the list type
    const unifyResult = this.coreHM.unify(tailResult.value, listT);
    if (unifyResult.success === false) {
      return {
        success: false,
        error: `Tail of cons must be a list: ${unifyResult.error}`,
      };
    }

    // Now we know the tail is a list, so we can get the element type
    const unifiedElemType = this.coreHM.applySubst(unifyResult.value, elemType);

    // Head must match list element type
    const headUnifyResult = this.coreHM.unify(
      headResult.value,
      unifiedElemType
    );
    if (headUnifyResult.success === false) {
      return {
        success: false,
        error: `Head type doesn't match list element type: ${headUnifyResult.error}`,
      };
    }

    // The result is the list type
    return {
      success: true,
      value: this.coreHM.applySubst(unifyResult.value, listT),
    };
  }

  private inferList(expr: ListPrimitive, env: Environment): Result<Type> {
    if (expr.elements.length === 0) {
      // Empty list - polymorphic
      const elemType = this.coreHM.freshVar();
      return {
        success: true,
        value: listType(elemType),
      };
    }

    // Infer type of first element
    const firstResult = this.infer(expr.elements[0].body, env);
    if (firstResult.success === false) return firstResult;

    // Check all elements match first element's type
    for (let i = 1; i < expr.elements.length; i++) {
      const elemResult = this.infer(expr.elements[i].body, env);
      if (elemResult.success === false) return elemResult;
      const unifyResult = this.coreHM.unify(
        elemResult.value,
        firstResult.value
      );
      if (unifyResult.success === false) {
        return {
          success: false,
          error: `List elements must have the same type`,
        };
      }
    }

    return {
      success: true,
      value: listType(firstResult.value),
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

    const unifyResult = this.coreHM.unify(leftResult.value, rightResult.value);
    if (!unifyResult.success) {
      return {
        success: false,
        error: `Comparison operands must have the same type`,
      };
    }

    return {
      success: true,
      value: booleanType,
    };
  }

  private inferStringOp(expr: StringOperation, env: Environment): Result<Type> {
    const leftResult = this.infer(expr.left.body, env);
    const rightResult = this.infer(expr.right.body, env);

    if (!leftResult.success) return leftResult;
    if (!rightResult.success) return rightResult;

    const unifyLeft = this.coreHM.unify(leftResult.value, stringType);
    const unifyRight = this.coreHM.unify(rightResult.value, stringType);

    if (!unifyLeft.success || !unifyRight.success) {
      return {
        success: false,
        error: `String operation requires string operands`,
      };
    }

    return { success: true, value: stringType };
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

        const funcArity = getArity(leftResult.value);
        if (funcArity !== 1)
          return {
            success: false,
            error: `${expr.operator}'s left operand expects to have only one argument`,
          };

        // Right-hand side must be a list [a]
        const freshInputVar = this.coreHM.freshVar();
        const listInputType: TypeConstructor = listType(freshInputVar);

        const unifyRight = this.coreHM.unify(rightResult.value, listInputType);
        if (!unifyRight.success)
          return {
            success: false,
            error: `${expr.operator}'s right operand must be a list`,
          };

        const elementType = unifyRight.value.get(freshInputVar.id);

        // Left-hand side must be a function: elementType -> outputType
        const freshOutputVar = this.coreHM.freshVar();
        const funcType: TypeConstructor = functionType(
          elementType,
          freshOutputVar
        );

        const unifyLeft = this.coreHM.unify(leftResult.value, funcType);
        if (!unifyLeft.success) {
          return {
            success: false,
            error: `${
              expr.operator
            }'s left operand must be a function of type ${showType(
              elementType
            )} -> a`,
          };
        }

        // Result is a list of the function's output type: [outputType]

        const resultType: TypeConstructor = listType(freshOutputVar);

        const subType = this.coreHM.applySubst(unifyLeft.value, resultType);

        // Return the result type, now fully resolved with substitutions
        return { success: true, value: subType };
      }
      case "Select": {
        const leftResult = this.infer(expr.left.body, env);
        const rightResult = this.infer(expr.right.body, env);

        if (!leftResult.success) return leftResult;
        if (!rightResult.success) return rightResult;

        const funcArity = getArity(leftResult.value);
        if (funcArity !== 1)
          return {
            success: false,
            error: `${expr.operator}'s left operand expects to have only one argument`,
          };

        // Right-hand side must be a list [a]
        const freshInputVar = this.coreHM.freshVar();
        const listInputType = listType(freshInputVar);

        const unifyRight = this.coreHM.unify(rightResult.value, listInputType);

        if (!unifyRight.success)
          return {
            success: false,
            error: `${expr.operator}'s right operand must be a list`,
          };

        const elementType = unifyRight.value.get(freshInputVar.id);

        // Left-hand side must be a function: elementType -> Bool
        const funcType: TypeConstructor = functionType(
          elementType,
          booleanType
        );
        const unifyLeft = this.coreHM.unify(leftResult.value, funcType);
        if (!unifyLeft.success) {
          return {
            success: false,
            error: `${
              expr.operator
            }'s left operand must be a function of type ${showType(funcType)}`,
          };
        }

        // Result is a list of the function's output type: [outputType]

        const resultType = listType(elementType);

        const subType = this.coreHM.applySubst(unifyLeft.value, resultType);

        // Return the result type, now fully resolved with substitutions
        return { success: true, value: subType };
      }
      case "Detect": {
        const leftResult = this.infer(expr.left.body, env);
        const rightResult = this.infer(expr.right.body, env);

        if (!leftResult.success) return leftResult;
        if (!rightResult.success) return rightResult;

        const funcArity = getArity(leftResult.value);
        if (funcArity !== 1)
          return {
            success: false,
            error: `${expr.operator}'s left operand expects to have only one argument`,
          };

        // Right-hand side must be a list [a]
        const freshInputVar = this.coreHM.freshVar();
        const listInputType = listType(freshInputVar);

        const unifyRight = this.coreHM.unify(rightResult.value, listInputType);

        if (!unifyRight.success)
          return {
            success: false,
            error: `${expr.operator}'s right operand must be a list`,
          };

        const elementType = unifyRight.value.get(freshInputVar.id);

        // Left-hand side must be a function: elementType -> Bool
        const funcType: TypeConstructor = functionType(
          elementType,
          booleanType
        );
        const unifyLeft = this.coreHM.unify(leftResult.value, funcType);
        if (!unifyLeft.success) {
          return {
            success: false,
            error: `${
              expr.operator
            }'s left operand must be a function of type ${showType(funcType)}`,
          };
        }

        // Result is a list of the function's output type: [outputType]
        const subType = this.coreHM.applySubst(unifyLeft.value, elementType);

        // Return the result type, now fully resolved with substitutions
        return { success: true, value: subType };
      }
      case "AnySatisfy":
      case "AllSatisfy": {
        const leftResult = this.infer(expr.left.body, env);
        const rightResult = this.infer(expr.right.body, env);

        if (!leftResult.success) return leftResult;
        if (!rightResult.success) return rightResult;

        const funcArity = getArity(leftResult.value);
        if (funcArity !== 1)
          return {
            success: false,
            error: `${expr.operator}'s left operand expects to have only one argument`,
          };

        // Right-hand side must be a list [a]
        const freshInputVar = this.coreHM.freshVar();
        const listInputType: TypeConstructor = listType(freshInputVar);

        const unifyRight = this.coreHM.unify(rightResult.value, listInputType);

        if (!unifyRight.success)
          return {
            success: false,
            error: `${expr.operator}'s right operand must be a list`,
          };

        const elementType = unifyRight.value.get(freshInputVar.id);

        // Left-hand side must be a function: elementType -> Bool
        const funcType: TypeConstructor = functionType(
          elementType,
          booleanType
        );
        const unifyLeft = this.coreHM.unify(leftResult.value, funcType);
        if (!unifyLeft.success) {
          return {
            success: false,
            error: `${
              expr.operator
            }'s left operand must be a function of type ${showType(funcType)}`,
          };
        }

        // Result is a list of the function's output type: [outputType]

        const subType = this.coreHM.applySubst(unifyLeft.value, booleanType);

        // Return the result type, now fully resolved with substitutions
        return { success: true, value: subType };
      }

      default:
        return {
          success: false,
          error: `Unknown Binary List operation with operator ${expr.operator}.`,
        };
    }
  }
  private inferListUnaryOp(
    expr: ListUnaryOperation,
    env: Environment
  ): Result<Type> {
    switch (expr.operator) {
      case "DetectMin":
      case "DetectMax": {
        const operandResult = this.infer(expr.operand.body, env);

        if (!operandResult.success) return operandResult;

        // Operand must be a list of ordenables (YuNumber, YuString, YuChar)
        const ordType: TypeVar = this.coreHM.freshVar(["Ord"]);
        const listT: TypeConstructor = listType(ordType);
        const unifyOperand = this.coreHM.unify(operandResult.value, listT);
        if (!unifyOperand.success)
          return {
            success: false,
            error: `${expr.operator} expects operand to be an Ordenable Type`,
          };
        const finalType = this.coreHM.applySubst(unifyOperand.value, ordType);
        // Result is a the resolved type of the elements of the list
        return { success: true, value: finalType };
      }
      case "Size": {
        const operandResult = this.infer(expr.operand.body, env);

        if (!operandResult.success) return operandResult;
        // Operand must be a YuList
        const freshInputVar = this.coreHM.freshVar();
        const listInputType: TypeConstructor = listType(freshInputVar);
        const unifyOperand = this.coreHM.unify(
          operandResult.value,
          listInputType
        );

        if (!unifyOperand.success)
          return {
            success: false,
            error: `${expr.operator} expects operand must be a YuList`,
          };

        // Result is a YuNumber
        return { success: true, value: numberType };
      }

      default:
        return {
          success: false,
          error: `Unknown Unary List operation with operator ${expr.operator}.`,
        };
    }
  }

  public processPatterns(
    pattern: Pattern,
    expectedType: Type,
    env: Environment
  ) {
    switch (pattern.type) {
      case "LiteralPattern": {
        const value = pattern.name;
        if (!isYukigoPrimitive(value.type))
          throw new Error(`Unsupported literal type in pattern: ${value.type}`);

        let literalType: Type = {
          type: "TypeConstructor",
          name: value.type,
          args: [],
        };

        const unifyResult = this.coreHM.unify(literalType, expectedType);
        if (unifyResult.success === false)
          throw new Error(
            `Literal pattern type mismatch: expected ${showType(
              expectedType
            )} but found ${showType(literalType)}`
          );
        break;
      }
      case "VariablePattern": {
        const varName = pattern.name.value.toString();
        if (env.has(varName))
          throw new Error(`Duplicate variable name '${varName}'`);

        env.set(varName, {
          type: "TypeScheme",
          quantifiers: [],
          body: expectedType,
          constraints: new Map(),
        });
        break;
      }

      case "ApplicationPattern": {
        const appCtorScheme = this.signatureMap.get(pattern.symbol.value);
        if (!appCtorScheme)
          throw new Error(`Unknown constructor: ${pattern.symbol.value}`);

        const appCtorType = this.coreHM.instantiate(appCtorScheme);

        // Handle both curried and non-curried constructor types
        let currentType = appCtorType;
        let argIndex = 0;

        const patternTypes = getArgumentTypes(appCtorType);
        patternTypes.forEach((argType, i) => {
          this.processPatterns(pattern.args[argIndex], argType, env);
        });

        // Check if we've consumed all expected arguments
        const unifyResult = this.coreHM.unify(currentType, expectedType);
        if (unifyResult.success === false)
          throw new Error(
            `Constructor ${pattern.symbol.value} arguments don't match expected type: ${unifyResult.error}`
          );
        break;
      }
      case "AsPattern": {
        this.processPatterns(pattern.pattern, expectedType, env);

        if (pattern.alias.type === "VariablePattern") {
          const varName = pattern.alias.name.value.toString();
          if (env.has(varName))
            throw new Error(`Duplicate variable name: ${varName}`);

          env.set(varName, {
            type: "TypeScheme",
            quantifiers: [],
            body: expectedType,
            constraints: new Map(),
          });
        }

        break;
      }
      case "ConsPattern": {
        // Create a list type with a fresh element type
        const elemType = this.coreHM.freshVar();
        const listT = listType(elemType);

        // Unify the expected type with the list type
        const unifyResult = this.coreHM.unify(expectedType, listT);
        if (unifyResult.success === false)
          throw new Error(`Pattern type mismatch: ${unifyResult.error}`);

        // After unification, get the element type from the unified type
        const unifiedElemType = this.coreHM.applySubst(
          unifyResult.value,
          elemType
        );

        // Process head pattern with the element type
        this.processPatterns(pattern.head, unifiedElemType, env);

        // Process tail pattern with a list of the same element type
        const tailType = listType(unifiedElemType);
        this.processPatterns(pattern.tail, tailType, env);
        break;
      }
      case "ConstructorPattern":
        const ctorScheme = this.signatureMap.get(pattern.constructor);
        if (!ctorScheme)
          throw new Error(`Unknown constructor: ${pattern.constructor}`);

        const ctorType = this.coreHM.instantiate(ctorScheme);
        if (ctorType.type !== "TypeConstructor")
          throw new Error(
            `Constructor ${pattern.constructor} is not a function`
          );

        // Check if constructor matches expected type
        const unifyResult = this.coreHM.unify(ctorType, expectedType);
        if (!unifyResult.success)
          throw new Error(
            `Constructor ${pattern.constructor} doesn't match expected type`
          );

        // Process constructor arguments
        pattern.patterns.forEach((pattern) => {
          this.processPatterns(pattern, ctorType.args[0], env);
        });
        break;
      case "ListPattern": {
        if (expectedType.type === "TypeVar") {
          const elemType = this.coreHM.freshVar();
          const listT = listType(elemType);
          // Unify with a list type
          const unifyResult = this.coreHM.unify(expectedType, listT);
          if (unifyResult.success === false)
            throw new Error(`Pattern type mismatch: ${unifyResult.error}`);
          pattern.elements.forEach((pat) => {
            this.processPatterns(pat, elemType, env);
          });
          break;
        }
        if (!isListType(expectedType)) {
          throw new Error(`Pattern expects a list but found non-list type`);
        }
        pattern.elements.forEach((pat) => {
          this.processPatterns(pat, expectedType.args[0], env);
        });
        break;
      }
      case "TuplePattern": {
        if (expectedType.type === "TypeVar") {
          // Create a tuple type with fresh type variables for each element
          const tupleElementTypes = pattern.elements.map(() =>
            this.coreHM.freshVar()
          );
          const tupleType: TypeConstructor = {
            type: "TypeConstructor",
            name: `Tuple`,
            args: tupleElementTypes,
          };

          // Unify the expected type with this tuple type
          const unifyResult = this.coreHM.unify(expectedType, tupleType);
          if (unifyResult.success === false)
            throw new Error(`Pattern type mismatch: ${unifyResult.error}`);

          // Process each element with the fresh type variables
          pattern.elements.forEach((pattern, i) => {
            this.processPatterns(pattern, tupleElementTypes[i], env);
          });
          break;
        }
        if (!isTupleType(expectedType))
          throw new Error(
            `Pattern expects a tuple but found non-tuple type: ${showType(
              expectedType
            )}`
          );

        // Check arity
        if (pattern.elements.length !== expectedType.args.length)
          throw new Error(`Tuple arity mismatch`);

        // Process each element with the corresponding type from expectedType.args
        pattern.elements.forEach((pattern, i) => {
          this.processPatterns(pattern, expectedType.args[i], env);
        });

        break;
      }
      case "WildcardPattern":
        break;
      default:
        throw new Error(`Unsupported pattern type: ${pattern.type}`);
    }
  }
}
