@{%
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
  tupleType,
  typeApplication,
  typeCast
} from "yukigo-core"

const filter = d => {
    return d.filter((token) => token !== null);
};

%}
@preprocessor typescript
@lexer HSLexer

program -> (declaration):* {% (d) => d[0].map(x => x[0]).filter(x => x !== null) %}

declaration -> ((function_declaration) | (function_type_declaration _ EOL) | (type_declaration _ EOL) | (data_declaration _ EOL) | (emptyline)) {% (d) =>  d[0][0][0] %}

emptyline -> _ EOL {% (d) => null %}

expression -> type_cast {% (d) => parseExpression(d[0]) %}

type_cast -> apply_operator _ "::" _ type {% (d) => 
    typeCast(
        d[4],
        expression(d[0]), 
    )
%}
| apply_operator {% (d) => d[0] %}

# Operation rules

apply_operator ->
    cons_expression _ "$" _ apply_operator {% (d) => parseApplication([d[0], d[4]]) %}
    | cons_expression {% (d) => d[0] %}

cons_expression ->
    concatenation _ ":" _ cons_expression {% (d) => ({
        type: "ConsExpression",
        head: {type: "Expression", body: d[0]},
        tail: {type: "Expression", body: d[4]}
    }) %}
    | concatenation {% (d) => d[0] %}

concatenation ->
    comparison _ "++" _ concatenation {% (d) => ({ type: "StringOperation", operator: "Concat", left: {type: "Expression", body:d[0]}, right: {type: "Expression", body:d[4]} }) %}
    | comparison {% (d) => d[0] %}

comparison ->
    addition _ comparison_operator _ comparison {% (d) => ({ type: "ComparisonOperation", operator: d[2], left: {type: "Expression", body:d[0]}, right: {type: "Expression", body:d[4]} }) %}
    | addition {% (d) => d[0] %}

addition -> 
    multiplication _ "+" _ addition {% (d) => ({ type: "ArithmeticOperation", operator: "Plus", left: {type: "Expression", body: d[0]}, right: {type: "Expression", body: d[4]} }) %}
    | multiplication _ "-" _ addition {% (d) => ({ type: "ArithmeticOperation", operator: "Minus", left: {type: "Expression", body: d[0]}, right: {type: "Expression", body: d[4]} }) %}
    | multiplication {% (d) => d[0] %}

multiplication ->
    infix_operator_expression _ "*" _ multiplication {% (d) => ({ type: "ArithmeticOperation", operator: "Multiply", left: {type: "Expression", body: d[0]}, right: {type: "Expression", body: d[4]} }) %}
    | infix_operator_expression _ "/" _ multiplication {% (d) => ({ type: "ArithmeticOperation", operator: "Divide", left: {type: "Expression", body: d[0]}, right: {type: "Expression", body: d[4]} }) %}
    | infix_operator_expression {% (d) => d[0] %}

infix_operator_expression ->
    application _ "`" _ variable _ "`" _ infix_operator_expression {% (d) => parseInfixApplication([d[4], d[0], d[8]]) %}
    | application {% d => d[0] %}

application -> 
  "show" _ primary {% (d) => ({ type: "Print", expression: { type: "Expression", body: d[2] } }) %}
  | primary (_ primary):* {% (d) => {
      if (d[1].length === 0) return d[0];
      return d[1].reduce((left, right) => parseApplication([left, right[1]]), d[0]);
  } %}

operator -> 
    "==" {% (d) => "Equal" %}
    | "/=" {% (d) => "NotEqual" %}
    | "<" {% (d) => "LessThan" %}
    | ">" {% (d) => "GreaterThan" %}
    | "<=" {% (d) => "LessOrEqualThan" %}
    | ">=" {% (d) => "GreaterOrEqualThan" %}
    | "+" {% (d) => "Plus" %}
    | "-" {% (d) => "Minus" %}
    | "*" {% (d) => "Multiply" %}
    | "/" {% (d) => "Divide" %}

left_section -> "(" _ expression _ operator _ ")" {% (d) => application(expression(symbolPrimitive(d[4])), d[2]) %}

right_section -> "(" _ operator _ expression _ ")" {% (d) => {
    const innerApp = expression(application(expression(symbolPrimitive(d[2])), d[4]));
    const flipBody = expression(symbolPrimitive("flip"));

    return application(flipBody, innerApp);
  }
%}

primary ->
    %number {% (d) => parsePrimary(d[0]) %}
    | %char {% (d) => parsePrimary(d[0]) %}
    | %string {% (d) => parsePrimary(d[0]) %}
    | %bool {% (d) => parsePrimary(d[0]) %}
    #| primitive_operator {% (d) => d[0] %}
    | variable {% (d) => d[0] %}
    | constr {% (d) => d[0] %}
    | tuple_expression {% (d) => d[0] %}
    | left_section {% (d) => d[0] %}
    | right_section {% (d) => d[0] %}
    | "(" _ expression _ ")" {% (d) => d[2] %}
    | list_literal {% (d) => parsePrimary({type: "list", body: d[0].elements, start: d[0].start, end: d[0].end }) %}
    | composition_expression {% (d) => d[0] %}
    | lambda_expression {% (d) => d[0] %}
    | if_expression {% d => d[0] %}
    | data_expression {% d => d[0] %}
    
# Expression rules

composition_expression ->
    expression _ "." _ expression {% (d) => parseCompositionExpression([d[0], d[4]]) %}

lambda_expression -> 
    "(" _ "\\" _ parameter_list _ "->" _ expression _ ")" {% (d) => parseLambda([d[4], d[8]]) %}

tuple_expression -> "(" _ expression (_ "," _ expression):+ _ ")" {% (d) => ({ type: "TupleExpression", elements: [d[2], ...d[3].map(x => x[3])] }) %}

data_expression -> constr _ %lbracket _ fields_expressions _ %rbracket {% (d) => parseDataExpression([d[0], d[4]]) %}

fields_expressions -> field_exp (_ "," _ field_exp):* {% (d) => [d[0], ...d[1].map(x => x[3])] %}

field_exp -> variable _ "=" _ expression {% (d) => ({type: "FieldExpression", name: d[0], expression: d[4]}) %}

if_expression -> "if" _ expression _ (%NL):? _ "then" _ expression _ (%NL):? _ "else" _ expression {% (d) => parseConditional([d[2], d[8], d[14]]) %}

# Data rules

data_declaration -> "data" __ constr (__ type_variable):? _ "=" _ constructor_def (_ "|" _ constructor_def):* {% (d) => parseDataDeclaration([d[2], [d[7], ...d[8].map(x => x[3])]]) %}

constructor_def ->
  constr _ (%NL __):? %lbracket _ (%NL _):? field_list _ (%NL _):? %rbracket {% (d) => ({name: d[0].value, fields: d[6]}) %}
  | constr (__ simple_type):* {% (d) => ({name: d[0].value, fields: d[1].map(x => ({type: "Field", name: undefined, value: x[1]}) )}) %}

field_list -> field (_ "," _ (%NL _):? field):* {% (d) => [d[0], ...d[1].map(x => x[4])]%}

field -> variable _ %typeEquals _ type {% (d) => ({type: "Field", name: d[0], value: d[4]}) %}

# Function rules

function_type_declaration -> variable _ %typeEquals _ type {% (d) => parseFunctionType([d[0], d[4]]) %}

function_declaration -> 
    variable __ parameter_list:? _ (%NL __):? guarded_rhs {% (d) => parseFunction({type: "Function", name: d[0], params: d[2] ? d[2] : [], body: d[5], attributes: ["GuardedBody"]}) %}
    | variable __ parameter_list:? _ %assign _ (%NL __):? expression _ EOL {% (d) => parseFunction({type: "Function", name: d[0], params: d[2] ? d[2] : [], body: d[7], attributes: ["UnguardedBody"]}) %}

guarded_rhs -> guarded_branch:+ {% (d) => d[0] %}

guarded_branch -> "|" _ expression _ "=" _ expression _ ((%NL __) | EOL) {% (d) => ({ condition: d[2], body: d[6] }) %}

parameter_list -> pattern (__ pattern):* {% (d) => [d[0], ...d[1].map(x => x[1])] %}

# Patterns

pattern -> cons_pattern {% (d) => d[0] %}

cons_pattern -> 
  simple_pattern _ ":" _ cons_pattern {% (d) => ({
    type: "ConsPattern",
    head: d[0],
    tail: d[4]
  }) %}
  | simple_pattern {% (d) => d[0] %}

simple_pattern ->
  (as_pattern
  | constructor_pattern
  | list_pattern
  | tuple_pattern
  | record_pattern
  | literal_pattern
  | variable_pattern
  | wildcard_pattern
  | paren_pattern) {% (d) => d[0][0] %}

wildcard_pattern -> %anonymousVariable {% (d) => ({
  type: "WildcardPattern",
  name: "_"
}) %}

paren_pattern -> "(" _ pattern _ ")" {% (d) => d[2] %}

variable_pattern -> variable {% (d) => ({type: "VariablePattern", name: d[0]}) %}

literal_pattern -> 
  (%number | %char | %string | %bool) {% (d) => ({type: "LiteralPattern", name: parsePrimary(d[0][0])}) %} 

as_pattern -> (variable_pattern | wildcard_pattern) _ "@" _ pattern {% (d) => ({type: "AsPattern", alias: d[0][0], pattern: d[4]}) %}

constructor_pattern -> 
  constr (_ pattern):* {% (d) => ({
    type: "ConstructorPattern",
    constructor: d[0].value,
    patterns: d[1].map(x => x[1])
  }) %}

record_pattern -> 
  constr:? _ %lbracket _ field_pattern_list _ %rbracket {% (d) => ({
    type: "RecordPattern",
    constructor: d[0] ? d[0].value : null,
    fields: d[4]
  }) %}

field_pattern_list -> field_pattern (_ "," _ field_pattern):* {% (d) => [d[0], ...d[1].map(x => x[3])] %}

field_pattern -> variable _ "=" _ pattern {% (d) => ({ field: d[0].value, pattern: d[4] }) %}

list_pattern -> 
  "[" _ pattern_list:? _ "]" {% (d) => ({
    type: "ListPattern",
    elements: d[2] || []
  }) %}

pattern_list -> pattern (_ "," _ pattern):* {% (d) => [d[0], ...d[1].map(x => x[3])] %}

tuple_pattern -> 
  "(" _ pattern (_ "," _ pattern):+ _ ")" {% (d) => ({
    type: "TuplePattern",
    elements: [d[2], ...d[3].map(x => x[3])]
  }) %}

# Type rules

type_declaration -> "type" __ constr (__ variable_list):? _ "=" _ type {% (d) => typeAlias(d[2].value, d[7], d[3] ? d[3][1] : []) %}

variable_list -> variable (__ variable):* {% (d) => [d[0].value, ...d[1].map(x => x[1].value)] %}

type -> function_type {% d => d[0] %}

constrained_type -> 
    constraint_list _ %arrow _ type {% (d) => ({
        type: "ParameterizedType",
        inputs: [],
        return: d[4],
        constraints: d[0]
    }) %}

context -> 
  constraint {% (d) => [d[0]] %}
  | "(" _ constraint_list _ ")" {% (d) => d[2] %}

constraint_list -> 
  constraint (_ "," _ constraint):* {% (d) => 
    [d[0], ...d[1].map(x => x[3])]
  %}

constraint -> 
  %typeClass (_ application_type):+ {% (d) => constraint(d[0].value, d[1].map(x => x[1])) %}

function_type ->
    (context _ %arrow _):? (application_type _ %typeArrow _):* application_type {% (d) => {
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
    } %}

application_type ->
  simple_type (_ simple_type):+ {% (d) => d[1].reduce((acc, arg) => typeApplication(acc, arg[1]), d[0]) %}
  | simple_type {% (d) => d[0] %}

simple_type ->
    type_variable {% (d) => ({
        type: "SimpleType",
        value: d[0].value,
        constraints: [],
    }) %}
  | type_constructor {% (d) => ({
        type: "SimpleType",
        value: d[0].value,
        constraints: [],
    }) %}
  | "[" _ type _ "]" {% (d) => listType(d[2], []) %}
  | "(" _ type (_ "," _ type):+ _ ")" {% (d) => tupleType([d[2], ...d[3].map(x => x[3])], []) %}
  | "(" _ type _ ")" {% (d) => d[2] %}

type_variable -> variable {% (d) => ({ value: d[0].value }) %}
type_constructor -> constr {% (d) => ({ value: d[0].value }) %}

# Misc rules

constr -> %constructor {% (d) => parsePrimary(d[0]) %} # constr because js doesnt like rules called constructor
variable -> %variable {% (d) => parsePrimary(d[0]) %}

list_literal -> 
  "[" _ "]" {% (d) => ({elements: [], start: d[0], end: d[2]}) %}
  | "[" _ expression_list _ "]" {% (d) => ({elements: d[2], start: d[0], end: d[4]}) %}

expression_list -> expression (_ "," _ expression):* {% (d) => [d[0], ...d[1].map(x => x[3])] %}

comparison_operator -> 
    "==" {% (d) => "Equal" %}
    | "/=" {% (d) => "NotEqual" %}
    | "<" {% (d) => "LessThan" %}
    | ">" {% (d) => "GreaterThan" %}
    | "<="  {% (d) => "LessOrEqualThan" %}
    | ">=" {% (d) => "GreaterOrEqualThan" %}

primitive_operator -> 
    "show" {% (d) => "Print" %}

_ -> %WS:*

__ -> %WS:+

EOL -> %NL | %EOF | %comment