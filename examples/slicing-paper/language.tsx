import { Language } from "@wcrichto/nota";

const r = String.raw;

// prettier-ignore
export let Oxide = new Language([
  ["Variable", "vr", "x", []],
  ["Function", "fname", "f", []],
  ["Number", "num", "n", []],  
  ["Path", "path", "q", [
    [r`empty`, 0, r`\varepsilon`, []], 
    [r`elem`, 2, r`{#1}.{#2}`, [r`\num`, r`\path`]]]],
  ["Place", "plc", r`\pi`, [
    [r`form`, 2, r`{#1}.{#2}`, [r`\vr`, r`\path`]]]],
  ["Place Expression", "pexp", `p`, [
    [`var`, 1, r`#1`, [r`\vr`]], 
    [`elem`, 2, r`{#1}.{#2}`, [r`\pexp`, r`\num`]], 
    [`deref`, 1, r`\ast {#1}`, [r`\pexp`]]]],
  ["Constant", "const", "c", [
    [`unit`, 0, "()", []],
    [`num`, 1, "#1", [r`\num`]], 
    [`true`, 0, r`\msf{true}`, []],
    [`false`, 0, r`\msf{false}`, []]]],
  ["Concrete Provenance", "concrprov", "r", []],
  ["Abstract Provenance", "abstrprov", r`\varrho`, []],
  ["Provenance", "prov", r`\rho`, [
    ["concr", 1, "#1", [r`\concrprov`]],
    ["abstr", 1, "#1", [r`\abstrprov`]]]],
  ["Ownership Qualifier", "ownq", r`\omega`, [
    ["shrd", 0, r`\msf{shrd}`, []],
    ["uniq", 0, r`\msf{uniq}`, []]]],  
  ["Base Type", "tyb", r`\tau^\textsc{B}`, [
    ["unit", 0, r`\msf{unit}`, []],
    ["num", 0, r`\msf{u32}`, []],
    ["bool", 0, r`\msf{bool}`, []]]],  
  ["Sized Type", "tys", r`\tau^\textsc{SI}`, [
    ["base", 1, "{#1}", [r`\tyb`]],
    ["ref", 3, r`\&{#1}~{#2}~{#3}`, [r`\prov`, r`\ownq`, r`\tau^\textsc{XI}`]],
    ["tup", 1, r`({#1})`, [r`\tys{}_1, \ldots, \tys{}_n`]]]],
  ["Expression", "expr", "e", [
    ["const", 1, "{#1}", [r`\const`]],
    ["pexp", 1, "{#1}", [r`\pexp`]],   
    ["ref", 3, r`\&{#1}~{#2}~{#3}`, [r`\concrprov`, r`\ownq`, r`\pexp`]],
    ["ite", 3, r`\msf{if}~{#1}~\{\,{#2}\,\}~\msf{else}~\{\,{#3}\,\}`, 
      [r`\expr_1`, r`\expr_2`, r`\expr_3`]],
    ["let", 4, r`\msf{let}~{#1} : {#2} = {#3}; ~ {#4}`, 
      [r`\expr_1`, r`\tys`, r`\expr_2`, r`\expr_3`]],
    ["plcasgn", 2, r`{#1} \mathrel{:=} {#2}`, [r`\plc`, r`\expr`]],
    ["pexpasgn", 2, r`{#1} \mathrel{:=} {#2}`, [r`\pexp`, r`\expr`]],
    ["seq", 2, r`{#1};~{#2}`, [r`\expr_1`, r`\expr_2`]],
    ["call", 5, r`{#1}\left\langle{#2}, {#3}, {#4}\right\rangle\left({#5}\right)`,
      [r`\fname`, r`\overline{\Phi}`, r`\overline{\rho}`, r`\overline{\tau}`, r`\plc`]],
    ["tup", 1, "({#1})", [r`\expr_1, \ldots, \expr_n`]],
    ["prov", 2, r`\msf{letprov}\langle{#1}\rangle\,\{{#2}\}`, [r`\concrprov`, r`\expr`]]
    ]],
  ["Global Entries", "fdef", r`\varepsilon`, [
    ["form", 9, r`\msf{fn}~{#1}\left\langle {#2}, {#3}, {#4}, \right\rangle\left({#5} : {#6}\right) \rightarrow {#7} ~ \msf{where} ~ {#8} ~ \{\,{#9}\,\}`, 
      [r`\fname`, r`\overline{\psi}`, r`\overline{\abstrprov}`, r`\overline{\alpha}`, 
       r`\vr`, r`\tys_a`, r`\tys_r`, r`\overline{\abstrprov_1 : \abstrprov_2}`, r`\expr`]]]],
  ["Global Environment", "fenv", r`\Sigma`, [
    ["empty", 0, r`\bullet`, []],
    ["with", 2, r`{#1}, {#2}`, [r`\fenv`, r`\fdef`]]]]
]);

export let OxideExtra = new Language([
  ["Dead Types", "tyd", r`\tau^\textsc{SD}`, [
    ["s", 1, r`{#1}^\dagger`, [r`\tys`]],
    ["tup", 1, r`({#1})`, [r`\tyd_1, \ldots, \tyd_n`]]]],
  ["Maybe Unsized Type", "tyx", r`\tau^\textsc{XI}`, [
    ["s", 1, "{#1}", [r`\tys`]],
    ["a", 1, "[{#1}]", [r`\tys`]]]],
  ["Maybe Dead Types", "tysx", r`\tau^\textsc{SX}`, [
    ["s", 1, "{#1}", [r`\tys`]],
    ["d", 1, "{#1}", [r`\tyd`]],
    ["tup", 1, "({#1})", [r`\tysx_1, \ldots, \tysx_n`]]]],
  ["Type", "ty", r`\tau`, [
    ["tyx", 1, "{#1}", [r`\tyx`]],
    ["tysx", 1, "{#1}", [r`\tysx`]]]],
  ["Loan", "loan", r`\ell`, [
    [`form`, 2, r`\,^{#1}{#2}`, [r`\ownq`, r`\pexp`]]]],  
  ["Frame Var", "frmvar", r`\varphi`, []],
  ["Frame Typing", "ft", r`\mathcal{F}`, [
    ["empty", 0, r`\bullet`, []],
    ["wty", 3, "{#1}, {#2} : {#3}", [r`\ft`, r`\vr`, r`\tyx`]],
    ["wlf", 3, r`{#1}, {#2} \mapsto {#3}`, [r`\ft`, r`\concrprov`, r`\setof{\loan}`],
  ]]],
  ["Stack Typing", "stackenv", r`\Gamma`, [
    ["empty", 0, r`\bullet`, []],
    ["wfr", 2, r`{#1} \mathrel{\natural} {#2}`, [r`\stackenv`, r`\ft`]]]],
  ["Kind", "kind", r`\kappa`, [
    ["base", 0, r`\bigstar`, []],
    ["prv", 0, r`\msf{PRV}`, []],
    ["frm", 0, r`\msf{FRM}`, []]]],
  ["Type Var", "tyvar", r`\alpha`, []],
  ["Type Environment", "tyenv", r`\Delta`, [
    ["empty", 0, r`\bullet`, []],
    ["wtvar", 2, r`{#1}, {#2} : \kindbase`, [r`\tyenv`, r`\tyvar`]],
    ["wprv", 2, r`{#1}, {#2} : \kindprv`, [r`\tyenv`, r`\abstrprov`]],
    ["wfrm", 2, r`{#1}, {#2} : \kindfrm`, [r`\tyenv`, r`\frmvar`]],
    ["wconstr", 3, r`{#1}, {#2} \mathrel{:>} {#3}`, [r`\tyenv`, r`\abstrprov`, r`\abstrprov'`]]
  ]]
]); 
