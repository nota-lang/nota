import type {
  ArrayExpression,
  ArrayPattern,
  ArrowFunctionExpression,
  AssignmentExpression,
  AssignmentPattern,
  BinaryExpression,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  ClassDeclaration,
  ConditionalExpression,
  DebuggerStatement,
  Declaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  IfStatement,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  LVal,
  MemberExpression,
  NewExpression,
  Node,
  NullLiteral,
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
  Super,
  TemplateElement,
  TemplateLiteral,
  ThisExpression,
  ThrowStatement,
  UnaryExpression,
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
  ...baseNode,
  type: "Identifier",
  name,
});

export let stringLiteral = (value: string): StringLiteral => ({
  ...baseNode,
  type: "StringLiteral",
  value,
});

export let objectExpression = (
  properties: Array<ObjectMethod | ObjectProperty | SpreadElement>
): ObjectExpression => ({
  ...baseNode,
  type: "ObjectExpression",
  properties,
});

export let objectProperty = ({
  key,
  value,
  shorthand = false,
  computed = false,
}: {
  key: Expression | Identifier | StringLiteral | NumericLiteral;
  value: Expression | PatternLike;
  shorthand?: boolean;
  computed?: boolean;
}): ObjectProperty => ({
  ...baseNode,
  type: "ObjectProperty",
  key,
  value,
  computed,
  shorthand,
});

export let callExpression = (
  callee: Expression,
  args: Array<Expression | SpreadElement>
): CallExpression => ({
  ...baseNode,
  type: "CallExpression",
  callee,
  arguments: args,
});

export let spreadElement = (argument: Expression): SpreadElement => ({
  type: "SpreadElement",
  argument,
  ...baseNode,
});

export let blockStatement = (body: Array<Statement>): BlockStatement => ({
  ...baseNode,
  type: "BlockStatement",
  body,
  directives: [],
});

export let throwStatement = ({ argument }: { argument: Expression }): ThrowStatement => ({
  ...baseNode,
  type: "ThrowStatement",
  argument,
});

export let variableDeclaration = (
  kind: "var" | "let" | "const",
  declarations: Array<VariableDeclarator>
): VariableDeclaration => ({
  ...baseNode,
  type: "VariableDeclaration",
  kind,
  declarations,
});

export let variableDeclarator = (id: LVal, init?: Expression | null): VariableDeclarator => ({
  ...baseNode,
  type: "VariableDeclarator",
  id,
  init,
});

export let memberExpression = (
  object: Expression,
  property: Expression | Identifier,
  computed: boolean = false
): MemberExpression => ({
  ...baseNode,
  type: "MemberExpression",
  object,
  property,
  computed,
});

export let returnStatement = (argument?: Expression | null): ReturnStatement => ({
  ...baseNode,
  type: "ReturnStatement",
  argument,
});

export let newExpression = ({
  callee,
  args,
}: {
  callee: Expression;
  args: (Expression | SpreadElement)[];
}): NewExpression => ({
  ...baseNode,
  type: "NewExpression",
  callee,
  arguments: args,
});

export let binaryExpression = ({
  left,
  right,
  operator,
}: {
  left: Expression;
  right: Expression;
  operator: any;
}): BinaryExpression => ({
  ...baseNode,
  type: "BinaryExpression",
  left,
  right,
  operator,
});

export let unaryExpression = ({
  argument,
  operator,
  prefix = true,
}: {
  argument: Expression;
  operator: any;
  prefix?: boolean;
}): UnaryExpression => ({
  ...baseNode,
  type: "UnaryExpression",
  argument,
  operator,
  prefix,
});

export let functionExpression = (
  id: Identifier | null,
  params: Array<Identifier | Pattern | RestElement>,
  body: BlockStatement
): FunctionExpression => ({
  ...baseNode,
  type: "FunctionExpression",
  id,
  params,
  body,
  async: false,
  generator: false,
});

export let conditionalExpression = ({
  test,
  consequent,
  alternate,
}: {
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}): ConditionalExpression => ({
  ...baseNode,
  type: "ConditionalExpression",
  test,
  consequent,
  alternate,
});

export let thisExpression = (): ThisExpression => ({
  ...baseNode,
  type: "ThisExpression",
});

export let superExpression = (): Super => ({
  ...baseNode,
  type: "Super",
});

export let templateLiteral = ({
  quasis,
  expressions,
}: {
  quasis: TemplateElement[];
  expressions: Expression[];
}): TemplateLiteral => ({
  ...baseNode,
  type: "TemplateLiteral",
  quasis,
  expressions,
});

export let templateElement = ({
  raw,
  cooked = undefined,
  tail = false,
}: {
  raw: string;
  cooked?: string;
  tail?: boolean;
}): TemplateElement => ({
  ...baseNode,
  type: "TemplateElement",
  value: { raw, cooked },
  tail,
});

export let arrowFunctionExpression = (
  params: Array<Identifier | Pattern | RestElement>,
  body: BlockStatement | Expression
): ArrowFunctionExpression => ({
  ...baseNode,
  type: "ArrowFunctionExpression",
  params,
  body,
  expression: false,
  async: false,
});

export let arrayExpression = (
  elements: Array<null | Expression | SpreadElement>
): ArrayExpression => ({
  ...baseNode,
  type: "ArrayExpression",
  elements,
});

export let program = (body: Array<Statement>): Program => ({
  ...baseNode,
  type: "Program",
  body,
  sourceType: "module",
  directives: [],
  sourceFile: "",
});

export let expressionStatement = (expression: Expression): ExpressionStatement => ({
  ...baseNode,
  type: "ExpressionStatement",
  expression,
});

export let objectPattern = (properties: Array<RestElement | ObjectProperty>): ObjectPattern => ({
  ...baseNode,
  type: "ObjectPattern",
  properties,
});

export let arrayPattern = ({
  elements,
}: {
  elements: (Identifier | Pattern | RestElement)[];
}): ArrayPattern => ({
  ...baseNode,
  type: "ArrayPattern",
  elements,
});

export let assignmentPattern = ({
  left,
  right,
}: {
  left: Identifier | ObjectPattern | ArrayPattern | MemberExpression;
  right: Expression;
}): AssignmentPattern => ({
  ...baseNode,
  type: "AssignmentPattern",
  left,
  right,
});

export let booleanLiteral = (value: boolean): BooleanLiteral => ({
  ...baseNode,
  type: "BooleanLiteral",
  value,
});

export let restElement = (argument: LVal): RestElement => ({
  ...baseNode,
  type: "RestElement",
  argument,
});

export let numericLiteral = (value: number): NumericLiteral => ({
  ...baseNode,
  type: "NumericLiteral",
  value,
});

export let importDeclaration = (
  specifiers: Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>,
  source: StringLiteral
): ImportDeclaration => ({
  ...baseNode,
  type: "ImportDeclaration",
  specifiers,
  source,
});

export let importSpecifier = (
  local: Identifier,
  imported: Identifier | StringLiteral
): ImportSpecifier => ({
  ...baseNode,
  type: "ImportSpecifier",
  local,
  imported,
});

export let importDefaultSpecifier = (local: Identifier): ImportDefaultSpecifier => ({
  ...baseNode,
  type: "ImportDefaultSpecifier",
  local,
});

export let importNamespaceSpecifier = ({
  local,
}: {
  local: Identifier;
}): ImportNamespaceSpecifier => ({
  ...baseNode,
  type: "ImportNamespaceSpecifier",
  local,
});

export let exportDefaultDeclaration = (
  declaration: FunctionDeclaration | ClassDeclaration | Expression
): ExportDefaultDeclaration => ({
  ...baseNode,
  type: "ExportDefaultDeclaration",
  declaration,
});

export let exportNamedDeclaration = (
  declaration?: Declaration,
  source: StringLiteral | null = null,
  specifiers: ExportSpecifier[] = []
): ExportNamedDeclaration => ({
  ...baseNode,
  type: "ExportNamedDeclaration",
  declaration,
  specifiers,
  source,
});

export let debuggerStatement = (): DebuggerStatement => ({
  ...baseNode,
  type: "DebuggerStatement",
});

export let exportSpecifier = (local: Identifier, exported: Identifier): ExportSpecifier => ({
  ...baseNode,
  type: "ExportSpecifier",
  local,
  exported,
});

export let nullLiteral = (): NullLiteral => ({
  ...baseNode,
  type: "NullLiteral",
});

export let assignmentExpression = ({
  left,
  right,
}: {
  left: LVal;
  right: Expression;
}): AssignmentExpression => ({
  ...baseNode,
  type: "AssignmentExpression",
  operator: "=",
  left,
  right,
});

export let ifStatement = ({
  test,
  consequent,
  alternate,
}: {
  test: Expression;
  consequent: Statement;
  alternate?: Statement | null;
}): IfStatement => ({
  ...baseNode,
  type: "IfStatement",
  test,
  consequent,
  alternate,
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
