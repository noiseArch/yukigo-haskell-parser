// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any { return d[0]; }
declare var number: any;
declare var char: any;
declare var string: any;
declare var bool: any;
declare var lbracket: any;
declare var rbracket: any;
declare var NL: any;
declare var typeEquals: any;
declare var assign: any;
declare var anonymousVariable: any;
declare var arrow: any;
declare var typeClass: any;
declare var typeArrow: any;
declare var constructor: any;
declare var variable: any;
declare var WS: any;
declare var EOF: any;
declare var comment: any;

import { HSLexer } from "./lexer.js"
import { 
    parsePrimary, 
    parseDataExpression,
    parseConditional, 
    parseInfixApplication,
    parseDataDeclaration, 
    parseApplication, 
    parseExpression, 
    parseCompositionExpression, 
    parseFunctionType, 
    parseLambda
} from "../utils/helpers.js";

import { 
  constraint, 
  typeAlias,
  expression,
  symbolPrimitive,
  application,
  listType,
  arithmetic,
  arithmeticUnary,
  func,
  equation,
  sequence,
  guardedbody,
  unguardedbody,
  returnExpr,
  comparisonOp,
  listBinaryOp,
  listUnaryOp,
  logicalBinaryOperation,
  variable as variableExpr,
  otherwise,
  tupleType,
  typeApplication,
  typeCast
} from "yukigo-core"

const filter = d => {
    return d.filter((token) => token !== null);
};


interface NearleyToken {
  value: any;
  [key: string]: any;
};

interface NearleyLexer {
  reset: (chunk: string, info: any) => void;
  next: () => NearleyToken | undefined;
  save: () => any;
  formatError: (token: never) => string;
  has: (tokenType: string) => boolean;
};

interface NearleyRule {
  name: string;
  symbols: NearleySymbol[];
  postprocess?: (d: any[], loc?: number, reject?: {}) => any;
};

type NearleySymbol = string | { literal: any } | { test: (token: any) => boolean };

interface Grammar {
  Lexer: NearleyLexer | undefined;
  ParserRules: NearleyRule[];
  ParserStart: string;
};

const grammar: Grammar = {
  Lexer: HSLexer,
  ParserRules: [
    {"name": "program$ebnf$1", "symbols": []},
    {"name": "program$ebnf$1$subexpression$1", "symbols": ["declaration"]},
    {"name": "program$ebnf$1", "symbols": ["program$ebnf$1", "program$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "program", "symbols": ["program$ebnf$1"], "postprocess": (d) => d[0].map(x => x[0]).filter(x => x !== null)},
    {"name": "declaration$subexpression$1$subexpression$1", "symbols": ["function_declaration"]},
    {"name": "declaration$subexpression$1", "symbols": ["declaration$subexpression$1$subexpression$1"]},
    {"name": "declaration$subexpression$1$subexpression$2", "symbols": ["function_type_declaration", "_", "EOL"]},
    {"name": "declaration$subexpression$1", "symbols": ["declaration$subexpression$1$subexpression$2"]},
    {"name": "declaration$subexpression$1$subexpression$3", "symbols": ["type_declaration", "_", "EOL"]},
    {"name": "declaration$subexpression$1", "symbols": ["declaration$subexpression$1$subexpression$3"]},
    {"name": "declaration$subexpression$1$subexpression$4", "symbols": ["data_declaration", "_", "EOL"]},
    {"name": "declaration$subexpression$1", "symbols": ["declaration$subexpression$1$subexpression$4"]},
    {"name": "declaration$subexpression$1$subexpression$5", "symbols": ["emptyline"]},
    {"name": "declaration$subexpression$1", "symbols": ["declaration$subexpression$1$subexpression$5"]},
    {"name": "declaration", "symbols": ["declaration$subexpression$1"], "postprocess": (d) =>  d[0][0][0]},
    {"name": "emptyline", "symbols": ["_", "EOL"], "postprocess": (d) => null},
    {"name": "expression", "symbols": ["type_cast"], "postprocess": (d) => parseExpression(d[0])},
    {"name": "type_cast", "symbols": ["apply_operator", "_", {"literal":"::"}, "_", "type"], "postprocess":  (d) => 
        typeCast(
            d[4],
            expression(d[0]), 
        )
        },
    {"name": "type_cast", "symbols": ["apply_operator"], "postprocess": (d) => d[0]},
    {"name": "apply_operator", "symbols": ["cons_expression", "_", {"literal":"$"}, "_", "apply_operator"], "postprocess": (d) => parseApplication([d[0], d[4]])},
    {"name": "apply_operator", "symbols": ["cons_expression"], "postprocess": (d) => d[0]},
    {"name": "cons_expression", "symbols": ["concatenation", "_", {"literal":":"}, "_", "cons_expression"], "postprocess":  (d) => ({
            type: "ConsExpression",
            head: {type: "Expression", body: d[0]},
            tail: {type: "Expression", body: d[4]}
        }) },
    {"name": "cons_expression", "symbols": ["concatenation"], "postprocess": (d) => d[0]},
    {"name": "concatenation", "symbols": ["logical_expression", "_", {"literal":"++"}, "_", "concatenation"], "postprocess": (d) => ({ type: "StringOperation", operator: "Concat", left: expression(d[0]), right: expression(d[4]) })},
    {"name": "concatenation", "symbols": ["logical_expression"], "postprocess": (d) => d[0]},
    {"name": "logical_expression", "symbols": ["comparison", "_", {"literal":"&&"}, "_", "logical_expression"], "postprocess": (d) => logicalBinaryOperation("And", expression(d[0]), expression(d[4]))},
    {"name": "logical_expression", "symbols": ["comparison", "_", {"literal":"||"}, "_", "logical_expression"], "postprocess": (d) => logicalBinaryOperation("Or", expression(d[0]), expression(d[4]))},
    {"name": "logical_expression", "symbols": ["comparison"], "postprocess": (d) => d[0]},
    {"name": "comparison", "symbols": ["addition", "_", "comparison_operator", "_", "comparison"], "postprocess": (d) => comparisonOp(d[2], expression(d[0]), expression(d[4]))},
    {"name": "comparison", "symbols": ["addition"], "postprocess": (d) => d[0]},
    {"name": "addition", "symbols": ["power", "_", {"literal":"+"}, "_", "addition"], "postprocess": (d) => arithmetic("Plus", expression(d[0]), expression(d[4]))},
    {"name": "addition", "symbols": ["power", "_", {"literal":"-"}, "_", "addition"], "postprocess": (d) => arithmetic("Minus", expression(d[0]), expression(d[4]))},
    {"name": "addition", "symbols": ["power"], "postprocess": (d) => d[0]},
    {"name": "power", "symbols": ["multiplication", "_", {"literal":"**"}, "_", "power"], "postprocess": (d) => arithmetic("Power", expression(d[0]), expression(d[4]))},
    {"name": "power", "symbols": ["multiplication", "_", {"literal":"^"}, "_", "power"], "postprocess": (d) => arithmetic("Power", expression(d[0]), expression(d[4]))},
    {"name": "power", "symbols": ["multiplication", "_", {"literal":"^^"}, "_", "power"], "postprocess": (d) => arithmetic("Power", expression(d[0]), expression(d[4]))},
    {"name": "power", "symbols": ["multiplication"], "postprocess": (d) => d[0]},
    {"name": "multiplication", "symbols": ["infix_operator_expression", "_", {"literal":"*"}, "_", "multiplication"], "postprocess": (d) => arithmetic("Multiply", expression(d[0]), expression(d[4]))},
    {"name": "multiplication", "symbols": ["infix_operator_expression", "_", {"literal":"/"}, "_", "multiplication"], "postprocess": (d) => arithmetic("Divide", expression(d[0]), expression(d[4]))},
    {"name": "multiplication", "symbols": ["infix_operator_expression"], "postprocess": (d) => d[0]},
    {"name": "infix_operator_expression", "symbols": ["application", "_", {"literal":"`"}, "_", "variable", "_", {"literal":"`"}, "_", "infix_operator_expression"], "postprocess": (d) => parseInfixApplication([d[4], d[0], d[8]])},
    {"name": "infix_operator_expression", "symbols": ["application"], "postprocess": d => d[0]},
    {"name": "application", "symbols": [{"literal":"show"}, "_", "primary"], "postprocess": (d) => ({ type: "Print", expression: expression(d[2]) })},
    {"name": "application", "symbols": ["binary_list_operator", "_", "primary", "_", "primary"], "postprocess": (d) => listBinaryOp(d[0], expression(d[2]), expression(d[4]))},
    {"name": "application", "symbols": ["unary_list_operator", "_", "primary"], "postprocess": (d) => listUnaryOp(d[0], expression(d[2]))},
    {"name": "application", "symbols": ["binary_arithmetic_operator", "_", "primary", "_", "primary"], "postprocess": (d) => arithmetic(d[0], expression(d[2]), expression(d[4]))},
    {"name": "application", "symbols": ["unary_arithmetic_operator", "_", "primary"], "postprocess": (d) => arithmeticUnary(d[0], expression(d[2]))},
    {"name": "application$ebnf$1", "symbols": []},
    {"name": "application$ebnf$1$subexpression$1", "symbols": ["_", "primary"]},
    {"name": "application$ebnf$1", "symbols": ["application$ebnf$1", "application$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "application", "symbols": ["primary", "application$ebnf$1"], "postprocess":  (d) => {
            if (d[1].length === 0) return d[0];
            return d[1].reduce((left, right) => application(expression(left), expression(right[1])), d[0]);
        } },
    {"name": "binary_arithmetic_operator", "symbols": [{"literal":"max"}], "postprocess": d => "Max"},
    {"name": "binary_arithmetic_operator", "symbols": [{"literal":"min"}], "postprocess": d => "Min"},
    {"name": "unary_arithmetic_operator", "symbols": [{"literal":"round"}], "postprocess": d => "Round"},
    {"name": "unary_arithmetic_operator", "symbols": [{"literal":"abs"}], "postprocess": d => "Absolute"},
    {"name": "unary_arithmetic_operator", "symbols": [{"literal":"ceiling"}], "postprocess": d => "Ceil"},
    {"name": "unary_arithmetic_operator", "symbols": [{"literal":"floor"}], "postprocess": d => "Floor"},
    {"name": "unary_arithmetic_operator", "symbols": [{"literal":"sqrt"}], "postprocess": d => "Sqrt"},
    {"name": "binary_list_operator", "symbols": [{"literal":"map"}], "postprocess": d => "Collect"},
    {"name": "binary_list_operator", "symbols": [{"literal":"filter"}], "postprocess": d => "Select"},
    {"name": "binary_list_operator", "symbols": [{"literal":"all"}], "postprocess": d => "AllSatisfy"},
    {"name": "binary_list_operator", "symbols": [{"literal":"any"}], "postprocess": d => "AnySatisfy"},
    {"name": "binary_list_operator", "symbols": [{"literal":"find"}], "postprocess": d => "Detect"},
    {"name": "binary_list_operator", "symbols": [{"literal":"foldl"}], "postprocess": d => "Inject"},
    {"name": "binary_list_operator", "symbols": [{"literal":"foldl1"}], "postprocess": d => "Inject"},
    {"name": "binary_list_operator", "symbols": [{"literal":"foldr"}], "postprocess": d => "Inject"},
    {"name": "binary_list_operator", "symbols": [{"literal":"foldr1"}], "postprocess": d => "Inject"},
    {"name": "unary_list_operator", "symbols": [{"literal":"max"}], "postprocess": d => "DetectMax"},
    {"name": "unary_list_operator", "symbols": [{"literal":"min"}], "postprocess": d => "DetectMin"},
    {"name": "unary_list_operator", "symbols": [{"literal":"length"}], "postprocess": d => "Size"},
    {"name": "operator", "symbols": [{"literal":"=="}], "postprocess": (d) => "Equal"},
    {"name": "operator", "symbols": [{"literal":"/="}], "postprocess": (d) => "NotEqual"},
    {"name": "operator", "symbols": [{"literal":"<"}], "postprocess": (d) => "LessThan"},
    {"name": "operator", "symbols": [{"literal":">"}], "postprocess": (d) => "GreaterThan"},
    {"name": "operator", "symbols": [{"literal":"<="}], "postprocess": (d) => "LessOrEqualThan"},
    {"name": "operator", "symbols": [{"literal":">="}], "postprocess": (d) => "GreaterOrEqualThan"},
    {"name": "operator", "symbols": [{"literal":"+"}], "postprocess": (d) => "Plus"},
    {"name": "operator", "symbols": [{"literal":"-"}], "postprocess": (d) => "Minus"},
    {"name": "operator", "symbols": [{"literal":"*"}], "postprocess": (d) => "Multiply"},
    {"name": "operator", "symbols": [{"literal":"/"}], "postprocess": (d) => "Divide"},
    {"name": "left_section", "symbols": [{"literal":"("}, "_", "expression", "_", "operator", "_", {"literal":")"}], "postprocess": (d) => application(expression(symbolPrimitive(d[4])), d[2])},
    {"name": "right_section", "symbols": [{"literal":"("}, "_", "operator", "_", "expression", "_", {"literal":")"}], "postprocess":  (d) => {
          const innerApp = expression(application(expression(symbolPrimitive(d[2])), d[4]));
          const flipBody = expression(symbolPrimitive("flip"));
        
          return application(flipBody, innerApp);
        }
        },
    {"name": "primary", "symbols": [(HSLexer.has("number") ? {type: "number"} : number)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "primary", "symbols": [(HSLexer.has("char") ? {type: "char"} : char)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "primary", "symbols": [(HSLexer.has("string") ? {type: "string"} : string)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "primary", "symbols": [(HSLexer.has("bool") ? {type: "bool"} : bool)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "primary", "symbols": ["variable"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["constr"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["tuple_expression"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["left_section"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["right_section"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": [{"literal":"("}, "_", "type_cast", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "primary", "symbols": ["list_literal"], "postprocess": (d) => parsePrimary({type: "list", body: d[0].elements, start: d[0].start, end: d[0].end })},
    {"name": "primary", "symbols": ["composition_expression"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["lambda_expression"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["if_expression"], "postprocess": d => d[0]},
    {"name": "primary", "symbols": ["data_expression"], "postprocess": d => d[0]},
    {"name": "composition_expression", "symbols": ["expression", "_", {"literal":"."}, "_", "expression"], "postprocess": (d) => parseCompositionExpression([d[0], d[4]])},
    {"name": "lambda_expression", "symbols": [{"literal":"("}, "_", {"literal":"\\"}, "_", "parameter_list", "_", {"literal":"->"}, "_", "expression", "_", {"literal":")"}], "postprocess": (d) => parseLambda([d[4], d[8]])},
    {"name": "tuple_expression$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "expression"]},
    {"name": "tuple_expression$ebnf$1", "symbols": ["tuple_expression$ebnf$1$subexpression$1"]},
    {"name": "tuple_expression$ebnf$1$subexpression$2", "symbols": ["_", {"literal":","}, "_", "expression"]},
    {"name": "tuple_expression$ebnf$1", "symbols": ["tuple_expression$ebnf$1", "tuple_expression$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "tuple_expression", "symbols": [{"literal":"("}, "_", "expression", "tuple_expression$ebnf$1", "_", {"literal":")"}], "postprocess": (d) => ({ type: "TupleExpression", elements: [d[2], ...d[3].map(x => x[3])] })},
    {"name": "data_expression", "symbols": ["constr", "_", (HSLexer.has("lbracket") ? {type: "lbracket"} : lbracket), "_", "fields_expressions", "_", (HSLexer.has("rbracket") ? {type: "rbracket"} : rbracket)], "postprocess": (d) => parseDataExpression([d[0], d[4]])},
    {"name": "fields_expressions$ebnf$1", "symbols": []},
    {"name": "fields_expressions$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "field_exp"]},
    {"name": "fields_expressions$ebnf$1", "symbols": ["fields_expressions$ebnf$1", "fields_expressions$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "fields_expressions", "symbols": ["field_exp", "fields_expressions$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[3])]},
    {"name": "field_exp", "symbols": ["variable", "_", {"literal":"="}, "_", "expression"], "postprocess": (d) => ({type: "FieldExpression", name: d[0], expression: d[4]})},
    {"name": "if_expression$subexpression$1", "symbols": ["__"]},
    {"name": "if_expression$subexpression$1$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "_"]},
    {"name": "if_expression$subexpression$1", "symbols": ["if_expression$subexpression$1$subexpression$1"]},
    {"name": "if_expression$subexpression$2", "symbols": ["__"]},
    {"name": "if_expression$subexpression$2$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "_"]},
    {"name": "if_expression$subexpression$2", "symbols": ["if_expression$subexpression$2$subexpression$1"]},
    {"name": "if_expression$subexpression$3", "symbols": ["__"]},
    {"name": "if_expression$subexpression$3$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "if_expression$subexpression$3", "symbols": ["if_expression$subexpression$3$subexpression$1"]},
    {"name": "if_expression$subexpression$4", "symbols": ["__"]},
    {"name": "if_expression$subexpression$4$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "_"]},
    {"name": "if_expression$subexpression$4", "symbols": ["if_expression$subexpression$4$subexpression$1"]},
    {"name": "if_expression$subexpression$5", "symbols": ["__"]},
    {"name": "if_expression$subexpression$5$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "if_expression$subexpression$5", "symbols": ["if_expression$subexpression$5$subexpression$1"]},
    {"name": "if_expression", "symbols": [{"literal":"if"}, "if_expression$subexpression$1", "expression", "if_expression$subexpression$2", {"literal":"then"}, "if_expression$subexpression$3", "expression", "if_expression$subexpression$4", {"literal":"else"}, "if_expression$subexpression$5", "expression"], "postprocess": (d) => parseConditional([d[2], d[6], d[10]])},
    {"name": "data_declaration$ebnf$1$subexpression$1", "symbols": ["__", "type_variable"]},
    {"name": "data_declaration$ebnf$1", "symbols": ["data_declaration$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "data_declaration$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "data_declaration$ebnf$2", "symbols": []},
    {"name": "data_declaration$ebnf$2$subexpression$1", "symbols": ["_", {"literal":"|"}, "_", "constructor_def"]},
    {"name": "data_declaration$ebnf$2", "symbols": ["data_declaration$ebnf$2", "data_declaration$ebnf$2$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "data_declaration", "symbols": [{"literal":"data"}, "__", "constr", "data_declaration$ebnf$1", "_", {"literal":"="}, "_", "constructor_def", "data_declaration$ebnf$2"], "postprocess": (d) => parseDataDeclaration([d[2], [d[7], ...d[8].map(x => x[3])]])},
    {"name": "constructor_def$ebnf$1$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "constructor_def$ebnf$1", "symbols": ["constructor_def$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "constructor_def$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "constructor_def$ebnf$2$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL), "_"]},
    {"name": "constructor_def$ebnf$2", "symbols": ["constructor_def$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "constructor_def$ebnf$2", "symbols": [], "postprocess": () => null},
    {"name": "constructor_def$ebnf$3$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL), "_"]},
    {"name": "constructor_def$ebnf$3", "symbols": ["constructor_def$ebnf$3$subexpression$1"], "postprocess": id},
    {"name": "constructor_def$ebnf$3", "symbols": [], "postprocess": () => null},
    {"name": "constructor_def", "symbols": ["constr", "_", "constructor_def$ebnf$1", (HSLexer.has("lbracket") ? {type: "lbracket"} : lbracket), "_", "constructor_def$ebnf$2", "field_list", "_", "constructor_def$ebnf$3", (HSLexer.has("rbracket") ? {type: "rbracket"} : rbracket)], "postprocess": (d) => ({name: d[0].value, fields: d[6]})},
    {"name": "constructor_def$ebnf$4", "symbols": []},
    {"name": "constructor_def$ebnf$4$subexpression$1", "symbols": ["__", "simple_type"]},
    {"name": "constructor_def$ebnf$4", "symbols": ["constructor_def$ebnf$4", "constructor_def$ebnf$4$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "constructor_def", "symbols": ["constr", "constructor_def$ebnf$4"], "postprocess": (d) => ({name: d[0].value, fields: d[1].map(x => ({type: "Field", name: undefined, value: x[1]}) )})},
    {"name": "field_list$ebnf$1", "symbols": []},
    {"name": "field_list$ebnf$1$subexpression$1$ebnf$1$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL), "_"]},
    {"name": "field_list$ebnf$1$subexpression$1$ebnf$1", "symbols": ["field_list$ebnf$1$subexpression$1$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "field_list$ebnf$1$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "field_list$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "field_list$ebnf$1$subexpression$1$ebnf$1", "field"]},
    {"name": "field_list$ebnf$1", "symbols": ["field_list$ebnf$1", "field_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "field_list", "symbols": ["field", "field_list$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[4])]},
    {"name": "field", "symbols": ["variable", "_", (HSLexer.has("typeEquals") ? {type: "typeEquals"} : typeEquals), "_", "type"], "postprocess": (d) => ({type: "Field", name: d[0], value: d[4]})},
    {"name": "function_type_declaration", "symbols": ["variable", "_", (HSLexer.has("typeEquals") ? {type: "typeEquals"} : typeEquals), "_", "type"], "postprocess": (d) => parseFunctionType([d[0], d[4]])},
    {"name": "function_declaration", "symbols": ["variable", "equation", "_", "EOL"], "postprocess": (d) => func(d[0].value, d[1])},
    {"name": "return_expression", "symbols": ["expression"], "postprocess": d => returnExpr(d[0])},
    {"name": "where_clause$subexpression$1$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "where_clause$subexpression$1", "symbols": ["where_clause$subexpression$1$subexpression$1"]},
    {"name": "where_clause$subexpression$1", "symbols": ["_"]},
    {"name": "where_clause", "symbols": [{"literal":"where"}, "where_clause$subexpression$1", "definition_list"], "postprocess": d => d[2]},
    {"name": "definition_list", "symbols": ["definition"], "postprocess": d => [d[0]]},
    {"name": "definition_list$subexpression$1$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "definition_list$subexpression$1", "symbols": ["definition_list$subexpression$1$subexpression$1"]},
    {"name": "definition_list$subexpression$1$subexpression$2", "symbols": ["_", {"literal":";"}, "_"]},
    {"name": "definition_list$subexpression$1", "symbols": ["definition_list$subexpression$1$subexpression$2"]},
    {"name": "definition_list", "symbols": ["definition", "definition_list$subexpression$1", "definition_list"], "postprocess": d => [d[0], ...d[2]]},
    {"name": "definition", "symbols": ["variable", "equation"], "postprocess": d => func(d[0].value, d[1])},
    {"name": "equation$ebnf$1$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "equation$ebnf$1", "symbols": ["equation$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "equation$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "equation", "symbols": ["params", "equation$ebnf$1", "guarded_rhs"], "postprocess": d => equation(d[0], d[2])},
    {"name": "equation$subexpression$1$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "equation$subexpression$1", "symbols": ["equation$subexpression$1$subexpression$1"]},
    {"name": "equation$subexpression$1", "symbols": ["_"]},
    {"name": "equation$ebnf$2$subexpression$1$subexpression$1$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "equation$ebnf$2$subexpression$1$subexpression$1", "symbols": ["equation$ebnf$2$subexpression$1$subexpression$1$subexpression$1"]},
    {"name": "equation$ebnf$2$subexpression$1$subexpression$1", "symbols": ["_"]},
    {"name": "equation$ebnf$2$subexpression$1", "symbols": ["equation$ebnf$2$subexpression$1$subexpression$1", "where_clause"]},
    {"name": "equation$ebnf$2", "symbols": ["equation$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "equation$ebnf$2", "symbols": [], "postprocess": () => null},
    {"name": "equation", "symbols": ["params", (HSLexer.has("assign") ? {type: "assign"} : assign), "equation$subexpression$1", "return_expression", "equation$ebnf$2"], "postprocess": d => equation(d[0], unguardedbody(sequence(d[4] ? [...d[4][1], d[3]] : [d[3]])), d[3])},
    {"name": "params", "symbols": ["__", "parameter_list", "_"], "postprocess": d => d[1]},
    {"name": "params", "symbols": ["_"], "postprocess": d => []},
    {"name": "guarded_rhs$subexpression$1$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "guarded_rhs$subexpression$1", "symbols": ["guarded_rhs$subexpression$1$subexpression$1"]},
    {"name": "guarded_rhs$subexpression$1", "symbols": ["_"]},
    {"name": "guarded_rhs", "symbols": ["guarded_branch", "guarded_rhs$subexpression$1", "guarded_rhs"], "postprocess": (d) => [d[0], ...d[2]]},
    {"name": "guarded_rhs", "symbols": ["guarded_branch"], "postprocess": (d) => [d[0]]},
    {"name": "guarded_branch$subexpression$1$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "guarded_branch$subexpression$1", "symbols": ["guarded_branch$subexpression$1$subexpression$1"]},
    {"name": "guarded_branch$subexpression$1", "symbols": ["_"]},
    {"name": "guarded_branch$subexpression$2$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "guarded_branch$subexpression$2", "symbols": ["guarded_branch$subexpression$2$subexpression$1"]},
    {"name": "guarded_branch$subexpression$2", "symbols": ["_"]},
    {"name": "guarded_branch$subexpression$3$subexpression$1", "symbols": ["_", (HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "guarded_branch$subexpression$3", "symbols": ["guarded_branch$subexpression$3$subexpression$1"]},
    {"name": "guarded_branch$subexpression$3", "symbols": ["_"]},
    {"name": "guarded_branch", "symbols": [{"literal":"|"}, "guarded_branch$subexpression$1", "condition", "guarded_branch$subexpression$2", {"literal":"="}, "guarded_branch$subexpression$3", "expression"], "postprocess": (d) => guardedbody(d[2], d[6])},
    {"name": "condition", "symbols": [{"literal":"otherwise"}], "postprocess": d => expression(otherwise())},
    {"name": "condition", "symbols": ["expression"], "postprocess": d => d[0]},
    {"name": "parameter_list$ebnf$1", "symbols": []},
    {"name": "parameter_list$ebnf$1$subexpression$1", "symbols": ["__", "pattern"]},
    {"name": "parameter_list$ebnf$1", "symbols": ["parameter_list$ebnf$1", "parameter_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "parameter_list", "symbols": ["pattern", "parameter_list$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[1])]},
    {"name": "pattern", "symbols": ["cons_pattern"], "postprocess": (d) => d[0]},
    {"name": "cons_pattern$ebnf$1$subexpression$1", "symbols": ["_", {"literal":":"}, "_", "cons_pattern"]},
    {"name": "cons_pattern$ebnf$1", "symbols": ["cons_pattern$ebnf$1$subexpression$1"]},
    {"name": "cons_pattern$ebnf$1$subexpression$2", "symbols": ["_", {"literal":":"}, "_", "cons_pattern"]},
    {"name": "cons_pattern$ebnf$1", "symbols": ["cons_pattern$ebnf$1", "cons_pattern$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "cons_pattern", "symbols": [{"literal":"("}, "_", "cons_pattern", "cons_pattern$ebnf$1", "_", {"literal":")"}], "postprocess":  
        (d) => {
          const patterns = [d[2], ...d[3].map(item => item[3])];
          return patterns.reduceRight((tail, head, index, arr) => {
            if (index === arr.length - 1) return tail;
            return {
              type: "ConsPattern",
              head: head,
              tail: tail
            };
          });
        }
          },
    {"name": "cons_pattern", "symbols": ["simple_pattern"], "postprocess": (d) => d[0]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["as_pattern"]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["constructor_pattern"]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["list_pattern"]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["tuple_pattern"]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["record_pattern"]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["literal_pattern"]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["variable_pattern"]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["wildcard_pattern"]},
    {"name": "simple_pattern$subexpression$1", "symbols": ["paren_pattern"]},
    {"name": "simple_pattern", "symbols": ["simple_pattern$subexpression$1"], "postprocess": (d) => d[0][0]},
    {"name": "wildcard_pattern", "symbols": [(HSLexer.has("anonymousVariable") ? {type: "anonymousVariable"} : anonymousVariable)], "postprocess":  (d) => ({
          type: "WildcardPattern",
          name: "_"
        }) },
    {"name": "paren_pattern", "symbols": [{"literal":"("}, "_", "pattern", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "variable_pattern", "symbols": ["variable"], "postprocess": (d) => ({type: "VariablePattern", name: d[0]})},
    {"name": "literal_pattern$subexpression$1", "symbols": [(HSLexer.has("number") ? {type: "number"} : number)]},
    {"name": "literal_pattern$subexpression$1", "symbols": [(HSLexer.has("char") ? {type: "char"} : char)]},
    {"name": "literal_pattern$subexpression$1", "symbols": [(HSLexer.has("string") ? {type: "string"} : string)]},
    {"name": "literal_pattern$subexpression$1", "symbols": [(HSLexer.has("bool") ? {type: "bool"} : bool)]},
    {"name": "literal_pattern", "symbols": ["literal_pattern$subexpression$1"], "postprocess": (d) => ({type: "LiteralPattern", name: parsePrimary(d[0][0])})},
    {"name": "as_pattern$subexpression$1", "symbols": ["variable_pattern"]},
    {"name": "as_pattern$subexpression$1", "symbols": ["wildcard_pattern"]},
    {"name": "as_pattern", "symbols": ["as_pattern$subexpression$1", "_", {"literal":"@"}, "_", "pattern"], "postprocess": (d) => ({type: "AsPattern", alias: d[0][0], pattern: d[4]})},
    {"name": "constructor_pattern$ebnf$1", "symbols": []},
    {"name": "constructor_pattern$ebnf$1$subexpression$1", "symbols": ["_", "pattern"]},
    {"name": "constructor_pattern$ebnf$1", "symbols": ["constructor_pattern$ebnf$1", "constructor_pattern$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "constructor_pattern", "symbols": ["constr", "constructor_pattern$ebnf$1"], "postprocess":  (d) => ({
          type: "ConstructorPattern",
          constructor: d[0].value,
          patterns: d[1].map(x => x[1])
        }) },
    {"name": "record_pattern$ebnf$1", "symbols": ["constr"], "postprocess": id},
    {"name": "record_pattern$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "record_pattern", "symbols": ["record_pattern$ebnf$1", "_", (HSLexer.has("lbracket") ? {type: "lbracket"} : lbracket), "_", "field_pattern_list", "_", (HSLexer.has("rbracket") ? {type: "rbracket"} : rbracket)], "postprocess":  (d) => ({
          type: "RecordPattern",
          constructor: d[0] ? d[0].value : null,
          fields: d[4]
        }) },
    {"name": "field_pattern_list$ebnf$1", "symbols": []},
    {"name": "field_pattern_list$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "field_pattern"]},
    {"name": "field_pattern_list$ebnf$1", "symbols": ["field_pattern_list$ebnf$1", "field_pattern_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "field_pattern_list", "symbols": ["field_pattern", "field_pattern_list$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[3])]},
    {"name": "field_pattern", "symbols": ["variable", "_", {"literal":"="}, "_", "pattern"], "postprocess": (d) => ({ field: d[0].value, pattern: d[4] })},
    {"name": "list_pattern$ebnf$1", "symbols": ["pattern_list"], "postprocess": id},
    {"name": "list_pattern$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "list_pattern", "symbols": [{"literal":"["}, "_", "list_pattern$ebnf$1", "_", {"literal":"]"}], "postprocess":  (d) => ({
          type: "ListPattern",
          elements: d[2] || []
        }) },
    {"name": "pattern_list$ebnf$1", "symbols": []},
    {"name": "pattern_list$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "pattern"]},
    {"name": "pattern_list$ebnf$1", "symbols": ["pattern_list$ebnf$1", "pattern_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "pattern_list", "symbols": ["pattern", "pattern_list$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[3])]},
    {"name": "tuple_pattern$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "pattern"]},
    {"name": "tuple_pattern$ebnf$1", "symbols": ["tuple_pattern$ebnf$1$subexpression$1"]},
    {"name": "tuple_pattern$ebnf$1$subexpression$2", "symbols": ["_", {"literal":","}, "_", "pattern"]},
    {"name": "tuple_pattern$ebnf$1", "symbols": ["tuple_pattern$ebnf$1", "tuple_pattern$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "tuple_pattern", "symbols": [{"literal":"("}, "_", "pattern", "tuple_pattern$ebnf$1", "_", {"literal":")"}], "postprocess":  (d) => ({
          type: "TuplePattern",
          elements: [d[2], ...d[3].map(x => x[3])]
        }) },
    {"name": "type_declaration$ebnf$1$subexpression$1", "symbols": ["__", "variable_list"]},
    {"name": "type_declaration$ebnf$1", "symbols": ["type_declaration$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "type_declaration$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "type_declaration", "symbols": [{"literal":"type"}, "__", "constr", "type_declaration$ebnf$1", "_", {"literal":"="}, "_", "type"], "postprocess": (d) => typeAlias(d[2].value, d[7], d[3] ? d[3][1] : [])},
    {"name": "variable_list$ebnf$1", "symbols": []},
    {"name": "variable_list$ebnf$1$subexpression$1", "symbols": ["__", "variable"]},
    {"name": "variable_list$ebnf$1", "symbols": ["variable_list$ebnf$1", "variable_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "variable_list", "symbols": ["variable", "variable_list$ebnf$1"], "postprocess": (d) => [d[0].value, ...d[1].map(x => x[1].value)]},
    {"name": "type", "symbols": ["function_type"], "postprocess": d => d[0]},
    {"name": "constrained_type", "symbols": ["constraint_list", "_", (HSLexer.has("arrow") ? {type: "arrow"} : arrow), "_", "type"], "postprocess":  (d) => ({
            type: "ParameterizedType",
            inputs: [],
            return: d[4],
            constraints: d[0]
        }) },
    {"name": "context", "symbols": ["constraint"], "postprocess": (d) => [d[0]]},
    {"name": "context", "symbols": [{"literal":"("}, "_", "constraint_list", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "constraint_list$ebnf$1", "symbols": []},
    {"name": "constraint_list$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "constraint"]},
    {"name": "constraint_list$ebnf$1", "symbols": ["constraint_list$ebnf$1", "constraint_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "constraint_list", "symbols": ["constraint", "constraint_list$ebnf$1"], "postprocess":  (d) => 
        [d[0], ...d[1].map(x => x[3])]
          },
    {"name": "constraint$ebnf$1$subexpression$1", "symbols": ["_", "application_type"]},
    {"name": "constraint$ebnf$1", "symbols": ["constraint$ebnf$1$subexpression$1"]},
    {"name": "constraint$ebnf$1$subexpression$2", "symbols": ["_", "application_type"]},
    {"name": "constraint$ebnf$1", "symbols": ["constraint$ebnf$1", "constraint$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "constraint", "symbols": [(HSLexer.has("typeClass") ? {type: "typeClass"} : typeClass), "constraint$ebnf$1"], "postprocess": (d) => constraint(d[0].value, d[1].map(x => x[1]))},
    {"name": "function_type$ebnf$1$subexpression$1", "symbols": ["context", "_", (HSLexer.has("arrow") ? {type: "arrow"} : arrow), "_"]},
    {"name": "function_type$ebnf$1", "symbols": ["function_type$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "function_type$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "function_type$ebnf$2", "symbols": []},
    {"name": "function_type$ebnf$2$subexpression$1", "symbols": ["application_type", "_", (HSLexer.has("typeArrow") ? {type: "typeArrow"} : typeArrow), "_"]},
    {"name": "function_type$ebnf$2", "symbols": ["function_type$ebnf$2", "function_type$ebnf$2$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "function_type", "symbols": ["function_type$ebnf$1", "function_type$ebnf$2", "application_type"], "postprocess":  (d) => {
            const constraints = d[0] ? d[0][0] : [];
            
            if (d[1].length > 0) {
                return {
                    type: "ParameterizedType",
                    inputs: d[1].map(x => x[0]),
                    return: d[2],
                    constraints: constraints
                };
            }
        
            if (constraints.length === 0) {
                return d[2];
            }
        
            return {
                type: "ParameterizedType",
                inputs: [],
                return: d[d.length - 1],
                constraints: constraints
            };
        } },
    {"name": "application_type$ebnf$1$subexpression$1", "symbols": ["_", "simple_type"]},
    {"name": "application_type$ebnf$1", "symbols": ["application_type$ebnf$1$subexpression$1"]},
    {"name": "application_type$ebnf$1$subexpression$2", "symbols": ["_", "simple_type"]},
    {"name": "application_type$ebnf$1", "symbols": ["application_type$ebnf$1", "application_type$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "application_type", "symbols": ["simple_type", "application_type$ebnf$1"], "postprocess": (d) => d[1].reduce((acc, arg) => typeApplication(acc, arg[1]), d[0])},
    {"name": "application_type", "symbols": ["simple_type"], "postprocess": (d) => d[0]},
    {"name": "simple_type", "symbols": ["type_variable"], "postprocess":  (d) => ({
            type: "SimpleType",
            value: d[0].value,
            constraints: [],
        }) },
    {"name": "simple_type", "symbols": ["type_constructor"], "postprocess":  (d) => ({
            type: "SimpleType",
            value: d[0].value,
            constraints: [],
        }) },
    {"name": "simple_type", "symbols": [{"literal":"["}, "_", "type", "_", {"literal":"]"}], "postprocess": (d) => listType(d[2], [])},
    {"name": "simple_type$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "type"]},
    {"name": "simple_type$ebnf$1", "symbols": ["simple_type$ebnf$1$subexpression$1"]},
    {"name": "simple_type$ebnf$1$subexpression$2", "symbols": ["_", {"literal":","}, "_", "type"]},
    {"name": "simple_type$ebnf$1", "symbols": ["simple_type$ebnf$1", "simple_type$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "simple_type", "symbols": [{"literal":"("}, "_", "type", "simple_type$ebnf$1", "_", {"literal":")"}], "postprocess": (d) => tupleType([d[2], ...d[3].map(x => x[3])], [])},
    {"name": "simple_type", "symbols": [{"literal":"("}, "_", "type", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "type_variable", "symbols": ["variable"], "postprocess": (d) => ({ value: d[0].value })},
    {"name": "type_constructor", "symbols": ["constr"], "postprocess": (d) => ({ value: d[0].value })},
    {"name": "constr", "symbols": [(HSLexer.has("constructor") ? {type: "constructor"} : constructor)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "variable", "symbols": [(HSLexer.has("variable") ? {type: "variable"} : variable)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "list_literal", "symbols": [{"literal":"["}, "_", {"literal":"]"}], "postprocess": (d) => ({elements: [], start: d[0], end: d[2]})},
    {"name": "list_literal", "symbols": [{"literal":"["}, "_", "expression_list", "_", {"literal":"]"}], "postprocess": (d) => ({elements: d[2], start: d[0], end: d[4]})},
    {"name": "expression_list$ebnf$1", "symbols": []},
    {"name": "expression_list$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "expression"]},
    {"name": "expression_list$ebnf$1", "symbols": ["expression_list$ebnf$1", "expression_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "expression_list", "symbols": ["expression", "expression_list$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[3])]},
    {"name": "comparison_operator", "symbols": [{"literal":"=="}], "postprocess": (d) => "Equal"},
    {"name": "comparison_operator", "symbols": [{"literal":"/="}], "postprocess": (d) => "NotEqual"},
    {"name": "comparison_operator", "symbols": [{"literal":"<"}], "postprocess": (d) => "LessThan"},
    {"name": "comparison_operator", "symbols": [{"literal":">"}], "postprocess": (d) => "GreaterThan"},
    {"name": "comparison_operator", "symbols": [{"literal":"<="}], "postprocess": (d) => "LessOrEqualThan"},
    {"name": "comparison_operator", "symbols": [{"literal":">="}], "postprocess": (d) => "GreaterOrEqualThan"},
    {"name": "primitive_operator", "symbols": [{"literal":"show"}], "postprocess": (d) => "Print"},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", (HSLexer.has("WS") ? {type: "WS"} : WS)], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "_", "symbols": ["_$ebnf$1"]},
    {"name": "__$ebnf$1", "symbols": [(HSLexer.has("WS") ? {type: "WS"} : WS)]},
    {"name": "__$ebnf$1", "symbols": ["__$ebnf$1", (HSLexer.has("WS") ? {type: "WS"} : WS)], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "__", "symbols": ["__$ebnf$1"]},
    {"name": "EOL", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL)]},
    {"name": "EOL", "symbols": [(HSLexer.has("EOF") ? {type: "EOF"} : EOF)]},
    {"name": "EOL", "symbols": [(HSLexer.has("comment") ? {type: "comment"} : comment)]}
  ],
  ParserStart: "program",
};

export default grammar;
