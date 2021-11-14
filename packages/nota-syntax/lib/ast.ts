export type Text = Token[];

export type Token = TokenBodyText | TokenAtExpr;
export interface TokenBodyText {
  type: "TokenBodyText";
  value: BodyText;
}
export interface TokenAtExpr {
  type: "TokenAtExpr";
  value: AtExpr;
}
export type BodyText = BodyTextLine | BodyTextString;
export interface BodyTextLine { 
  type: "BodyTextLine" 
}
export interface BodyTextString {
  type: "BodyTextString",
  value: string
}

export interface AtExpr {
  sigil: AtSigil;
  func: AtFunc;
  args?: AtArgs;
  body?: AtBody;
}

export type AtSigil = "@" | "#" | "%";

export type AtFunc = AtFuncIdent | AtFuncExpr;
export interface AtFuncIdent {
  type: "AtFuncIdent",
  value: string
}
export interface AtFuncExpr {
  type: "AtFuncExpr",
  value: string
}

export type AtArgs = AtArgKv[];
export interface AtArgKv {
  key: string;
  value?: string;
}

export type AtBody = AtBodyText | AtBodyVerbatim;
export interface AtBodyText {
  type: "AtBodyText",
  value: Text
}
export interface AtBodyVerbatim {
  type: "AtBodyVerbatim",
  value: string
}