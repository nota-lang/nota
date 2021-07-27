import React, {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useAsync } from "react-async";

import { zipExn } from "./utils";
import { DefinitionContext, DefinitionData } from "./definitions";
import { $, $$, newcommand, ReactTexContext, Dimensions } from "./tex";

const r = String.raw;

type InputSyntaxBranch = [string, number, string, string[]];
type InputSyntaxSort = [string, string, string, InputSyntaxBranch[]];
type InputGrammar = InputSyntaxSort[];

type SyntaxBranch = {
  subcmd: string;
  nargs: number;
  body: string;
  args: string[];
};
type SyntaxSort = {
  kind: string;
  cmd: string;
  metavar: string;
  branches: SyntaxBranch[];
};
type Grammar = SyntaxSort[];

export class Language {
  grammar: Grammar;

  constructor(grammar: InputGrammar) {
    this.grammar = grammar.map(([kind, cmd, metavar, in_branches]) => {
      let branches = in_branches.map(([subcmd, nargs, body, args]) => ({
        subcmd,
        nargs,
        body,
        args,
      }));
      return { kind, cmd, metavar, branches };
    });
  }

  Commands = () => {
    let commands = this.grammar
      .map(({ cmd, metavar, branches }) => {
        let mv_cmd = newcommand(`${cmd}`, 0, metavar);
        let branch_cmds = branches.map(({ subcmd, nargs, body }) =>
          newcommand(cmd + subcmd, nargs, body)
        );
        return [mv_cmd].concat(branch_cmds).join("\n");
      })
      .join("\n");
    return <$$>{commands}</$$>;
  };

  BnfInner = ({ container_ref }: { container_ref: HTMLDivElement }) => {
    let def_ctx = useContext(DefinitionContext);
    let tex_ctx = useContext(ReactTexContext);

    let branch_to_tex =
      (cmd: string) =>
      ({ subcmd, args }: SyntaxBranch): string => {
        let arg_str = args.map((arg) => `{${arg}}`).join("");
        return r`\htmlData{def=${cmd}${subcmd}}{${
          `\\` + cmd
        }${subcmd}${arg_str}}`;
      };

    let {
      data: branch_dims,
      isPending,
      error,
    } = useAsync(
      useCallback(async ({}, { signal }) => {
        let branch_dims = await Promise.all(
          this.grammar.map(({ cmd, branches }) =>
            Promise.all(
              branches
                .map(branch_to_tex(cmd))
                .map((tex) => tex_ctx.dimensions(tex, false, container_ref))
            )
          )
        );
        return branch_dims;
      }, [])
    );

    // Have to pull out add_definition calls into an effect to avoid 
    // "setState while rendering component" errors
    let defs: [string, DefinitionData][] = [];
    useEffect(() => {
      if (branch_dims) {
        defs.forEach(([name, def]) => def_ctx.add_definition(name, def));
      }
    }, [branch_dims]);

    if (isPending) {
      return null;
    }

    if (!branch_dims) {
      console.error(error);
      return null;
    }

    const MAX_ROW_WIDTH = 350;

    let tex = zipExn(this.grammar, branch_dims)
      .map(([{ kind, cmd, metavar, branches }, bdims]) => {
        let rhs: string;
        if (branches.length > 0) {
          let [rows] = zipExn(branches, bdims).reduce(
            ([rows, cur_width], [branch, dims]) => {
              let last_row = rows[rows.length - 1];
              if (
                cur_width + dims.width > MAX_ROW_WIDTH &&
                last_row.length > 0
              ) {
                rows.push([branch]);
                cur_width = dims.width;
              } else {
                last_row.push(branch);
                cur_width += dims.width;
              }
              return [rows, cur_width];
            },
            [[[]] as SyntaxBranch[][], 0]
          );
          let str = rows
            .map((row) => row.map(branch_to_tex(cmd)).join(r` \mid `))
            .join(r`\\& & & && &&\mid`);
          rhs = `::= ~ &&${str}`;
        } else {
          rhs = ``;
        }

        kind = kind.replace(` `, r`\ `);

        branches.forEach(({ subcmd }) => {
          defs.push([`tex:${cmd}${subcmd}`, {
            Tooltip: () => (
              <$$ className="nomargin">{r`\begin{aligned}&\mathsf{${kind}}& ~ &${metavar} &&${rhs}\end{aligned}`}</$$>
            ),
            Label: null,
            }]);
        });

        defs.push([`tex:${cmd}`, {
          Tooltip: () => (
            <$$ className="nomargin">{r`\begin{aligned}&\mathsf{${kind}}& ~ &${metavar} &&${rhs}\end{aligned}`}</$$>
          ),
          Label: null,
        }]);
        return r`&\htmlData{def=${cmd}}{\mathsf{${kind}}}& ~ &${metavar} &&${rhs}`;
      })
      .join(r`\\`); 


    return <$$>{r`\begin{aligned}${tex}\end{aligned}`}</$$>;
  };

  Bnf = () => {
    let ref = useRef<HTMLDivElement>(null);

    // Needed for BnfInner to render once ref.current !== null
    let [_, rerender] = useState(false);
    useEffect(() => rerender(true), []);

    return (
      <div ref={ref}>
        {ref.current ? <this.BnfInner container_ref={ref.current} /> : null}
      </div>
    );
  };
}
