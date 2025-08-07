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
    parseFunction, 
    parsePrimary, 
    parseDataExpression,
    parseConditional, 
    parseInfixApplication,
    parseDataDeclaration, 
    parseApplication, 
    parseExpression, 
    parseCompositionExpression, 
    parseTypeAlias, 
    parseFunctionType, 
    parseLambda
} from "../utils/helpers.js";

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
    {"name": "expression", "symbols": ["apply_operator"], "postprocess": (d) => parseExpression(d[0])},
    {"name": "apply_operator", "symbols": ["cons_expression", "_", {"literal":"$"}, "_", "apply_operator"], "postprocess": (d) => parseApplication([d[0], d[4]])},
    {"name": "apply_operator", "symbols": ["cons_expression"], "postprocess": (d) => d[0]},
    {"name": "cons_expression", "symbols": ["concatenation", "_", {"literal":":"}, "_", "cons_expression"], "postprocess":  (d) => ({
            type: "ConsExpression",
            head: {type: "Expression", body: d[0]},
            tail: {type: "Expression", body: d[4]}
        }) },
    {"name": "cons_expression", "symbols": ["concatenation"], "postprocess": (d) => d[0]},
    {"name": "concatenation", "symbols": ["comparison", "_", {"literal":"++"}, "_", "concatenation"], "postprocess": (d) => ({ type: "Concat", operator: d[2].value, left: {type: "Expression", body:d[0]}, right: {type: "Expression", body:d[4]} })},
    {"name": "concatenation", "symbols": ["comparison"], "postprocess": (d) => d[0]},
    {"name": "comparison", "symbols": ["addition", "_", "comparison_operator", "_", "comparison"], "postprocess": (d) => ({ type: "Comparison", operator: d[2], left: {type: "Expression", body:d[0]}, right: {type: "Expression", body:d[4]} })},
    {"name": "comparison", "symbols": ["addition"], "postprocess": (d) => d[0]},
    {"name": "addition", "symbols": ["multiplication", "_", {"literal":"+"}, "_", "addition"], "postprocess": (d) => ({ type: "Arithmetic", operator: d[2].value, left: {type: "Expression", body: d[0]}, right: {type: "Expression", body: d[4]} })},
    {"name": "addition", "symbols": ["multiplication", "_", {"literal":"-"}, "_", "addition"], "postprocess": (d) => ({ type: "Arithmetic", operator: d[2].value, left: {type: "Expression", body: d[0]}, right: {type: "Expression", body: d[4]} })},
    {"name": "addition", "symbols": ["multiplication"], "postprocess": (d) => d[0]},
    {"name": "multiplication", "symbols": ["infix_operator_expression", "_", {"literal":"*"}, "_", "multiplication"], "postprocess": (d) => ({ type: "Arithmetic", operator: d[2].value, left: {type: "Expression", body: d[0]}, right: {type: "Expression", body: d[4]} })},
    {"name": "multiplication", "symbols": ["infix_operator_expression", "_", {"literal":"/"}, "_", "multiplication"], "postprocess": (d) => ({ type: "Arithmetic", operator: d[2].value, left: {type: "Expression", body: d[0]}, right: {type: "Expression", body: d[4]} })},
    {"name": "multiplication", "symbols": ["infix_operator_expression"], "postprocess": (d) => d[0]},
    {"name": "infix_operator_expression", "symbols": ["application", "_", {"literal":"`"}, "_", "variable", "_", {"literal":"`"}, "_", "infix_operator_expression"], "postprocess": (d) => parseInfixApplication([d[4], d[0], d[8]])},
    {"name": "infix_operator_expression", "symbols": ["application"], "postprocess": d => d[0]},
    {"name": "application$ebnf$1", "symbols": []},
    {"name": "application$ebnf$1$subexpression$1", "symbols": ["_", "primary"]},
    {"name": "application$ebnf$1", "symbols": ["application$ebnf$1", "application$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "application", "symbols": ["primary", "application$ebnf$1"], "postprocess":  (d) => {
            if (d[1].length === 0) return d[0];
            return d[1].reduce((left, right) => parseApplication([left, right[1]]), d[0]);
        } },
    {"name": "primary", "symbols": [(HSLexer.has("number") ? {type: "number"} : number)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "primary", "symbols": [(HSLexer.has("char") ? {type: "char"} : char)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "primary", "symbols": [(HSLexer.has("string") ? {type: "string"} : string)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "primary", "symbols": [(HSLexer.has("bool") ? {type: "bool"} : bool)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "primary", "symbols": ["variable"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["constr"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["tuple_expression"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": [{"literal":"("}, "_", "expression", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "primary", "symbols": ["list_literal"], "postprocess": (d) => parsePrimary({type: "list", body: d[0].elements, start: d[0].start, end: d[0].end })},
    {"name": "primary", "symbols": ["composition_expression"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["lambda_expression"], "postprocess": (d) => d[0]},
    {"name": "primary", "symbols": ["if_expression"], "postprocess": d => d[0]},
    {"name": "primary", "symbols": ["case_expression"], "postprocess": d => d[0]},
    {"name": "primary", "symbols": ["data_expression"], "postprocess": d => d[0]},
    {"name": "primary", "symbols": ["let_in_expression"], "postprocess": d => d[0]},
    {"name": "composition_expression", "symbols": ["variable", "_", {"literal":"."}, "_", "variable"], "postprocess": (d) => parseCompositionExpression([d[0], d[4]])},
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
    {"name": "if_expression$ebnf$1$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL)]},
    {"name": "if_expression$ebnf$1", "symbols": ["if_expression$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "if_expression$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "if_expression$ebnf$2$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL)]},
    {"name": "if_expression$ebnf$2", "symbols": ["if_expression$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "if_expression$ebnf$2", "symbols": [], "postprocess": () => null},
    {"name": "if_expression", "symbols": [{"literal":"if"}, "_", "expression", "_", "if_expression$ebnf$1", "_", {"literal":"then"}, "_", "expression", "_", "if_expression$ebnf$2", "_", {"literal":"else"}, "_", "expression"], "postprocess": (d) => parseConditional([d[2], d[8], d[14]])},
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
    {"name": "function_declaration$ebnf$1", "symbols": ["parameter_list"], "postprocess": id},
    {"name": "function_declaration$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "function_declaration$ebnf$2$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "function_declaration$ebnf$2", "symbols": ["function_declaration$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "function_declaration$ebnf$2", "symbols": [], "postprocess": () => null},
    {"name": "function_declaration", "symbols": ["variable", "__", "function_declaration$ebnf$1", "_", "function_declaration$ebnf$2", "guarded_rhs"], "postprocess": (d) => parseFunction({type: "function", name: d[0], params: d[2] ? d[2] : [], body: d[5], return: d[5], attributes: ["GuardedBody"]})},
    {"name": "function_declaration$ebnf$3", "symbols": ["parameter_list"], "postprocess": id},
    {"name": "function_declaration$ebnf$3", "symbols": [], "postprocess": () => null},
    {"name": "function_declaration$ebnf$4$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "function_declaration$ebnf$4", "symbols": ["function_declaration$ebnf$4$subexpression$1"], "postprocess": id},
    {"name": "function_declaration$ebnf$4", "symbols": [], "postprocess": () => null},
    {"name": "function_declaration", "symbols": ["variable", "__", "function_declaration$ebnf$3", "_", (HSLexer.has("assign") ? {type: "assign"} : assign), "_", "function_declaration$ebnf$4", "expression", "_", "EOL"], "postprocess": (d) => parseFunction({type: "function", name: d[0], params: d[2] ? d[2] : [], body: d[7], return: d[7], attributes: ["UnguardedBody"]})},
    {"name": "guarded_rhs$ebnf$1", "symbols": ["guarded_branch"]},
    {"name": "guarded_rhs$ebnf$1", "symbols": ["guarded_rhs$ebnf$1", "guarded_branch"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "guarded_rhs", "symbols": ["guarded_rhs$ebnf$1"], "postprocess": (d) => d[0]},
    {"name": "guarded_branch$subexpression$1$subexpression$1", "symbols": [(HSLexer.has("NL") ? {type: "NL"} : NL), "__"]},
    {"name": "guarded_branch$subexpression$1", "symbols": ["guarded_branch$subexpression$1$subexpression$1"]},
    {"name": "guarded_branch$subexpression$1", "symbols": ["EOL"]},
    {"name": "guarded_branch", "symbols": [{"literal":"|"}, "_", "expression", "_", {"literal":"="}, "_", "expression", "_", "guarded_branch$subexpression$1"], "postprocess": (d) => ({ condition: d[2], body: d[6], return: d[6] })},
    {"name": "parameter_list$ebnf$1", "symbols": []},
    {"name": "parameter_list$ebnf$1$subexpression$1", "symbols": ["__", "pattern"]},
    {"name": "parameter_list$ebnf$1", "symbols": ["parameter_list$ebnf$1", "parameter_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "parameter_list", "symbols": ["pattern", "parameter_list$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[1])]},
    {"name": "pattern", "symbols": ["cons_pattern"], "postprocess": (d) => d[0]},
    {"name": "cons_pattern", "symbols": ["simple_pattern", "_", {"literal":":"}, "_", "cons_pattern"], "postprocess":  (d) => ({
          type: "ConsPattern",
          head: d[0],
          tail: d[4]
        }) },
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
          value: "_"
        }) },
    {"name": "paren_pattern", "symbols": [{"literal":"("}, "_", "pattern", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "variable_pattern", "symbols": ["variable"], "postprocess": (d) => ({type: "VariablePattern", name: d[0]})},
    {"name": "literal_pattern$subexpression$1", "symbols": [(HSLexer.has("number") ? {type: "number"} : number)]},
    {"name": "literal_pattern$subexpression$1", "symbols": [(HSLexer.has("char") ? {type: "char"} : char)]},
    {"name": "literal_pattern$subexpression$1", "symbols": [(HSLexer.has("string") ? {type: "string"} : string)]},
    {"name": "literal_pattern$subexpression$1", "symbols": [(HSLexer.has("bool") ? {type: "bool"} : bool)]},
    {"name": "literal_pattern", "symbols": ["literal_pattern$subexpression$1"], "postprocess": (d) => ({type: "LiteralPattern", value: parsePrimary(d[0][0])})},
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
    {"name": "let_in_expression", "symbols": [{"literal":"let"}, "__", "let_bindings", "__", {"literal":"in"}, "__", "expression"], "postprocess": (d) => ({ type: "LetIn", bindings: d[2], body: d[6] })},
    {"name": "let_bindings$ebnf$1", "symbols": []},
    {"name": "let_bindings$ebnf$1$subexpression$1", "symbols": ["__", "let_binding"]},
    {"name": "let_bindings$ebnf$1", "symbols": ["let_bindings$ebnf$1", "let_bindings$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "let_bindings", "symbols": ["let_binding", "let_bindings$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[1])]},
    {"name": "let_binding", "symbols": ["pattern", "_", {"literal":"="}, "_", "expression"], "postprocess": (d) => ({ pattern: d[0], expr: d[4] })},
    {"name": "case_expression", "symbols": [{"literal":"case"}, "__", "expression", "__", {"literal":"of"}, "__", "case_alternatives"], "postprocess": (d) => ({ type: "CaseExpression", expr: d[2], alts: d[6] })},
    {"name": "case_alternatives$ebnf$1", "symbols": []},
    {"name": "case_alternatives$ebnf$1$subexpression$1", "symbols": ["__", "case_alternative"]},
    {"name": "case_alternatives$ebnf$1", "symbols": ["case_alternatives$ebnf$1", "case_alternatives$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "case_alternatives", "symbols": ["case_alternative", "case_alternatives$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[1])]},
    {"name": "case_alternative", "symbols": ["pattern", "_", {"literal":"->"}, "_", "expression"], "postprocess": (d) => ({ pattern: d[0], body: d[4] })},
    {"name": "type_declaration$subexpression$1", "symbols": [{"literal":"type"}, "__", "constr", "_", {"literal":"="}, "_", "type"]},
    {"name": "type_declaration", "symbols": ["type_declaration$subexpression$1"], "postprocess": (d) => parseTypeAlias([d[0][2], d[0][6]])},
    {"name": "type", "symbols": ["constrained_type"], "postprocess": (d) => d[0]},
    {"name": "type", "symbols": ["function_type"], "postprocess": (d) => d[0]},
    {"name": "constrained_type", "symbols": ["context", "_", (HSLexer.has("arrow") ? {type: "arrow"} : arrow), "_", "type"], "postprocess":  (d) => ({ 
            type: "ConstrainedType", 
            context: d[0], 
            body: d[4] 
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
    {"name": "constraint", "symbols": [(HSLexer.has("typeClass") ? {type: "typeClass"} : typeClass), "constraint$ebnf$1"], "postprocess":  (d) => ({
            type: "Constraint",
            className: d[0].value,
            params: d[1].map(x => x[1])
        }) },
    {"name": "function_type$ebnf$1", "symbols": []},
    {"name": "function_type$ebnf$1$subexpression$1", "symbols": ["application_type", "_", (HSLexer.has("typeArrow") ? {type: "typeArrow"} : typeArrow), "_"]},
    {"name": "function_type$ebnf$1", "symbols": ["function_type$ebnf$1", "function_type$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "function_type", "symbols": ["function_type$ebnf$1", "application_type"], "postprocess": (d) => (d[0].length > 0 ? { type: "FunctionType", from: d[0].map(x => x[0]), to: d[1] } : d[1])},
    {"name": "application_type$ebnf$1", "symbols": []},
    {"name": "application_type$ebnf$1$subexpression$1", "symbols": ["_", "simple_type"]},
    {"name": "application_type$ebnf$1", "symbols": ["application_type$ebnf$1", "application_type$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "application_type", "symbols": ["simple_type", "application_type$ebnf$1"], "postprocess":  (d) =>
        d[1].length === 0 ? d[0] : { type: "TypeApplication", base: d[0], args: d[1].map(x => x[1]) }
            },
    {"name": "simple_type", "symbols": ["type_variable"], "postprocess": (d) => d[0]},
    {"name": "simple_type", "symbols": ["type_constructor"], "postprocess": (d) => d[0]},
    {"name": "simple_type", "symbols": [{"literal":"["}, "_", "type", "_", {"literal":"]"}], "postprocess": (d) => ({ type: "ListType", element: d[2] })},
    {"name": "simple_type$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "type"]},
    {"name": "simple_type$ebnf$1", "symbols": ["simple_type$ebnf$1$subexpression$1"]},
    {"name": "simple_type$ebnf$1$subexpression$2", "symbols": ["_", {"literal":","}, "_", "type"]},
    {"name": "simple_type$ebnf$1", "symbols": ["simple_type$ebnf$1", "simple_type$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "simple_type", "symbols": [{"literal":"("}, "_", "type", "simple_type$ebnf$1", "_", {"literal":")"}], "postprocess":  (d) => ({ 
          type: "TupleType", 
          elements: [d[2], ...d[3].map(x => x[3])] 
        }) },
    {"name": "simple_type", "symbols": [{"literal":"("}, "_", "type", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "type_variable", "symbols": ["variable"], "postprocess": (d) => ({ type: "TypeVar", name: d[0].value })},
    {"name": "type_constructor", "symbols": ["constr"], "postprocess": (d) => ({ type: "TypeConstructor", name: d[0].value })},
    {"name": "constr", "symbols": [(HSLexer.has("constructor") ? {type: "constructor"} : constructor)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "variable", "symbols": [(HSLexer.has("variable") ? {type: "variable"} : variable)], "postprocess": (d) => parsePrimary(d[0])},
    {"name": "list_literal", "symbols": [{"literal":"["}, "_", {"literal":"]"}], "postprocess": (d) => ({elements: [], start: d[0], end: d[2]})},
    {"name": "list_literal", "symbols": [{"literal":"["}, "_", "expression_list", "_", {"literal":"]"}], "postprocess": (d) => ({elements: d[2], start: d[0], end: d[4]})},
    {"name": "expression_list$ebnf$1", "symbols": []},
    {"name": "expression_list$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "expression"]},
    {"name": "expression_list$ebnf$1", "symbols": ["expression_list$ebnf$1", "expression_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "expression_list", "symbols": ["expression", "expression_list$ebnf$1"], "postprocess": (d) => [d[0], ...d[1].map(x => x[3])]},
    {"name": "comparison_operator", "symbols": [{"literal":"=="}]},
    {"name": "comparison_operator", "symbols": [{"literal":"/="}]},
    {"name": "comparison_operator", "symbols": [{"literal":"<"}]},
    {"name": "comparison_operator", "symbols": [{"literal":">"}]},
    {"name": "comparison_operator", "symbols": [{"literal":"<="}]},
    {"name": "comparison_operator", "symbols": [{"literal":">="}], "postprocess": (d) => d[0].value},
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
