import type {
  Identifier,
  StringLiteral,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  SpreadElement,
  NumericLiteral,
  Expression,
  PatternLike,
  CallExpression,
  BlockStatement,
  Statement,
  VariableDeclarator,
  VariableDeclaration,
  LVal,
  PrivateName,
  MemberExpression,
  ReturnStatement,
  Pattern,
  RestElement,
  ArrowFunctionExpression,
  ArrayExpression,
  Program,
  ExpressionStatement,
  ObjectPattern,
  BooleanLiteral,
  Literal,
  ImportDeclaration,
  ImportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ExportDefaultDeclaration,
  ClassDeclaration,
  TSDeclareFunction,
  FunctionDeclaration,
} from "@babel/types";

let base_node = {
  leadingComments: null,
  innerComments: null,
  trailingComments: null,
  start: null,
  end: null,
  loc: null,
};

export let identifier = (name: string): Identifier => ({
  type: "Identifier",
  name,
  ...base_node,
});

export let stringLiteral = (value: string): StringLiteral => ({
  type: "StringLiteral",
  value,
  ...base_node,
});

export let objectExpression = (
  properties: Array<ObjectMethod | ObjectProperty | SpreadElement>
): ObjectExpression => ({
  type: "ObjectExpression",
  properties,
  ...base_node,
});

export let objectProperty = (
  key: Expression | Identifier | StringLiteral | NumericLiteral,
  value: Expression | PatternLike,
  shorthand: boolean = false
): ObjectProperty => ({
  type: "ObjectProperty",
  key,
  value,
  computed: false,
  shorthand,
  ...base_node,
});

export let callExpression = (
  callee: Expression,
  args: Array<Expression | SpreadElement>
): CallExpression => ({
  type: "CallExpression",
  callee,
  arguments: args,
  ...base_node,
});

export let spreadElement = (argument: Expression): SpreadElement => ({
  type: "SpreadElement",
  argument,
  ...base_node,
});

export let blockStatement = (body: Array<Statement>): BlockStatement => ({
  type: "BlockStatement",
  body,
  directives: [],
  ...base_node,
});

export let variableDeclaration = (
  kind: "var" | "let" | "const",
  declarations: Array<VariableDeclarator>
): VariableDeclaration => ({
  type: "VariableDeclaration",
  kind,
  declarations,
  ...base_node,
});

export let variableDeclarator = (id: LVal, init?: Expression | null): VariableDeclarator => ({
  type: "VariableDeclarator",
  id,
  init,
  ...base_node,
});

export let memberExpression = (
  object: Expression,
  property: Expression | Identifier,
  computed: boolean = false
): MemberExpression => ({
  type: "MemberExpression",
  object,
  property,
  computed,
  ...base_node,
});

export let returnStatement = (argument?: Expression | null): ReturnStatement => ({
  type: "ReturnStatement",
  argument,
  ...base_node,
});

export let arrowFunctionExpression = (
  params: Array<Identifier | Pattern | RestElement>,
  body: BlockStatement | Expression
): ArrowFunctionExpression => ({
  type: "ArrowFunctionExpression",
  params,
  body,
  expression: false,
  ...base_node,
});

export let arrayExpression = (
  elements: Array<null | Expression | SpreadElement>
): ArrayExpression => ({
  type: "ArrayExpression",
  elements,
  ...base_node,
});

export let program = (body: Array<Statement>): Program => ({
  type: "Program",
  body,
  sourceType: "script",
  directives: [],
  sourceFile: "",
  ...base_node,
});

export let expressionStatement = (expression: Expression): ExpressionStatement => ({
  type: "ExpressionStatement",
  expression,
  ...base_node,
});

export let objectPattern = (properties: Array<RestElement | ObjectProperty>): ObjectPattern => ({
  type: "ObjectPattern",
  properties,
  ...base_node,
});

export let booleanLiteral = (value: boolean): BooleanLiteral => ({
  type: "BooleanLiteral",
  value,
  ...base_node,
});

export let restElement = (argument: LVal): RestElement => ({
  type: "RestElement",
  argument,
  ...base_node,
});

export let numericLiteral = (value: number): NumericLiteral => ({
  type: "NumericLiteral",
  value,
  ...base_node,
});

export let importDeclaration = (
  specifiers: Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>,
  source: StringLiteral
): ImportDeclaration => ({
  type: "ImportDeclaration",
  specifiers,
  source,
  ...base_node,
});

export let importSpecifier = (
  local: Identifier,
  imported: Identifier | StringLiteral
): ImportSpecifier => ({
  type: "ImportSpecifier",
  local,
  imported,
  ...base_node,
});

export let importDefaultSpecifier = (local: Identifier): ImportDefaultSpecifier => ({
  type: "ImportDefaultSpecifier",
  local,
  ...base_node,
});

export let exportDefaultDeclaration = (
  declaration: FunctionDeclaration | TSDeclareFunction | ClassDeclaration | Expression
): ExportDefaultDeclaration => ({
  type: "ExportDefaultDeclaration",
  declaration,
  ...base_node,
});
