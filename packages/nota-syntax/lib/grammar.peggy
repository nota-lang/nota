Text = Token*

Token 
  = value:AtExpr   { return {type: "TokenAtExpr", value}; } 
  / value:BodyText { return {type: "TokenBodyText", value}; }

BodyText 
  = "\n"                  { return {type: "BodyTextLine"}; }
  / value:$([^@#%{}\n]+) "\n"?  { return {type: "BodyTextString", value}; }
  
AtExpr = sigil:AtSigil func:AtFunc args:AtArgs? body:AtBody? 
  { return {sigil, func, args, body}; }

AtSigil = "@" / "#" / "%"

AtFunc 
  = "(" value:$([^)]*) ")"  { return {type: "AtFuncExpr", value}; }
  / value:Ident            { return {type: "AtFuncIdent", value}; }

AtArgs = "[" kvs:AtArgKvs "]" { return kvs; }
AtArgKvs 
  = value:AtArgKv _ "," _ values:AtArgKvs { return [value, ...values]; }
  / value:AtArgKv { return [value]; }
  / "" { return []; }
AtArgKv = key:Ident { return {key, value: true}; }

AtBody 
  = "{" value:Text "}"             { return {type: "AtBodyText", value}; }
  / "|{" value:$((! "}|") .)* "}|" { return {type: "AtBodyVerbatim", value}; }
  
Ident = $[a-zA-Z0-9_$]+
_ = [\s]*