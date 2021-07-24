import React, { useContext } from "react";
import { DefinitionContext } from "./definitions";
import { $, $$, newcommand } from "./tex";

const r = String.raw;

type SyntaxBranch = [string, number, string, string[]];
type SyntaxSort = [string, string, string, SyntaxBranch[]];
type Grammar = SyntaxSort[]

export class Language {
  grammar: Grammar;

  constructor(grammar: Grammar) {
    this.grammar = grammar;
  }

  Commands = () => {
    let commands = this.grammar
      .map(([kind, cmd, metavar, branches]) => {
        let mv_cmd = newcommand(`${cmd}`, 0, metavar);
        let branch_cmds = branches.map(([subcmd, nargs, body, _]) =>
          newcommand(cmd + subcmd, nargs, body)
        );
        return [mv_cmd].concat(branch_cmds).join("\n");
      })
      .join("\n");
    return <$$>{commands}</$$>;
  };

  Bnf = () => {
    let ctx = useContext(DefinitionContext);
    let tex = this.grammar
      .map(([kind, cmd, metavar, branches]) => {
        let rhs;
        if (branches.length > 0) {
          let branches_str = branches
          .map(([subcmd, _1, _2, args]) => {
            let arg_str = args.map((arg) => `{${arg}}`).join("");
            return r`\htmlData{def=${cmd}${subcmd}}{${`\\` + cmd}${subcmd}${arg_str}}`;
          })
          .join(r` \mid `);
          rhs = `::= ~ ${branches_str}`;
        } else {
          rhs = ``;
        }

        kind = kind.replace(` `, r`\ `);

        branches.forEach(([subcmd]) => {
          ctx.add_definition(`tex:${cmd}${subcmd}`, {
            tooltip: <$>{r`\mathsf{${kind}} ~ ${metavar} ${rhs}`}</$>,
            label: null
          })
        });
        
        ctx.add_definition(`tex:${cmd}`, {
          tooltip: <$>{r`\mathsf{${kind}} ~ ${metavar} ${rhs}`}</$>,
          label: null,
        });
        return r`&\htmlData{def=${cmd}}{\mathsf{${kind}}}& ~ &${metavar} &&${rhs}`;
      })
      .join(r`\\`);
    return (
      <$$>{r`
    \begin{aligned}      
      ${tex}
    \end{aligned}
    `}</$$>
    );
  };
}
