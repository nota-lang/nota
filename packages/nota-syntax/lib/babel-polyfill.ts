import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  ClassDeclaration,
  DebuggerStatement,
  Declaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  LVal,
  MemberExpression,
  Node,
  NumericLiteral,
  ObjectExpression,
  ObjectMethod,
  ObjectPattern,
  ObjectProperty,
  Pattern,
  PatternLike,
  Program,
  RestElement,
  ReturnStatement,
  SpreadElement,
  Statement,
  StringLiteral,
  TSDeclareFunction,
  VariableDeclaration,
  VariableDeclarator,
} from "@babel/types";

let baseNode = {
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
  ...baseNode,
});

export let stringLiteral = (value: string): StringLiteral => ({
  type: "StringLiteral",
  value,
  ...baseNode,
});

export let objectExpression = (
  properties: Array<ObjectMethod | ObjectProperty | SpreadElement>
): ObjectExpression => ({
  type: "ObjectExpression",
  properties,
  ...baseNode,
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
  ...baseNode,
});

export let callExpression = (
  callee: Expression,
  args: Array<Expression | SpreadElement>
): CallExpression => ({
  type: "CallExpression",
  callee,
  arguments: args,
  ...baseNode,
});

export let spreadElement = (argument: Expression): SpreadElement => ({
  type: "SpreadElement",
  argument,
  ...baseNode,
});

export let blockStatement = (body: Array<Statement>): BlockStatement => ({
  type: "BlockStatement",
  body,
  directives: [],
  ...baseNode,
});

export let variableDeclaration = (
  kind: "var" | "let" | "const",
  declarations: Array<VariableDeclarator>
): VariableDeclaration => ({
  type: "VariableDeclaration",
  kind,
  declarations,
  ...baseNode,
});

export let variableDeclarator = (id: LVal, init?: Expression | null): VariableDeclarator => ({
  type: "VariableDeclarator",
  id,
  init,
  ...baseNode,
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
  ...baseNode,
});

export let returnStatement = (argument?: Expression | null): ReturnStatement => ({
  type: "ReturnStatement",
  argument,
  ...baseNode,
});

export let arrowFunctionExpression = (
  params: Array<Identifier | Pattern | RestElement>,
  body: BlockStatement | Expression
): ArrowFunctionExpression => ({
  type: "ArrowFunctionExpression",
  params,
  body,
  expression: false,
  ...baseNode,
});

export let arrayExpression = (
  elements: Array<null | Expression | SpreadElement>
): ArrayExpression => ({
  type: "ArrayExpression",
  elements,
  ...baseNode,
});

export let program = (body: Array<Statement>): Program => ({
  type: "Program",
  body,
  sourceType: "module",
  directives: [],
  sourceFile: "",
  ...baseNode,
});

export let expressionStatement = (expression: Expression): ExpressionStatement => ({
  type: "ExpressionStatement",
  expression,
  ...baseNode,
});

export let objectPattern = (properties: Array<RestElement | ObjectProperty>): ObjectPattern => ({
  type: "ObjectPattern",
  properties,
  ...baseNode,
});

export let booleanLiteral = (value: boolean): BooleanLiteral => ({
  type: "BooleanLiteral",
  value,
  ...baseNode,
});

export let restElement = (argument: LVal): RestElement => ({
  type: "RestElement",
  argument,
  ...baseNode,
});

export let numericLiteral = (value: number): NumericLiteral => ({
  type: "NumericLiteral",
  value,
  ...baseNode,
});

export let importDeclaration = (
  specifiers: Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>,
  source: StringLiteral
): ImportDeclaration => ({
  type: "ImportDeclaration",
  specifiers,
  source,
  ...baseNode,
});

export let importSpecifier = (
  local: Identifier,
  imported: Identifier | StringLiteral
): ImportSpecifier => ({
  type: "ImportSpecifier",
  local,
  imported,
  ...baseNode,
});

export let importDefaultSpecifier = (local: Identifier): ImportDefaultSpecifier => ({
  type: "ImportDefaultSpecifier",
  local,
  ...baseNode,
});

export let exportDefaultDeclaration = (
  declaration: FunctionDeclaration | TSDeclareFunction | ClassDeclaration | Expression
): ExportDefaultDeclaration => ({
  type: "ExportDefaultDeclaration",
  declaration,
  ...baseNode,
});

export let exportNamedDeclaration = (
  declaration?: Declaration,
  source: StringLiteral | null = null,
  specifiers: ExportSpecifier[] = []
): ExportNamedDeclaration => ({
  type: "ExportNamedDeclaration",
  declaration,
  specifiers,
  source,
  ...baseNode,
});

export let debuggerStatement = (): DebuggerStatement => ({
  type: "DebuggerStatement",
  ...baseNode,
});

let is_node = (x: any): x is Node => typeof x == "object" && x && x.type;
export let traverse = (node: Node, visit: (node: Node) => void) => {
  visit(node);
  Object.keys(node).forEach(k => {
    let v = (node as any)[k];
    if (is_node(v)) {
      traverse(v, visit);
    } else if (v instanceof Array && v.length > 0 && is_node(v[0])) {
      v.forEach(child => traverse(child, visit));
    }
  });
};

export let exportSpecifier = (local: Identifier, exported: Identifier): ExportSpecifier => ({
  type: "ExportSpecifier",
  local,
  exported,
  ...baseNode,
});
