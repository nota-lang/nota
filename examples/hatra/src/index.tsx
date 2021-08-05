import React from "react";
import ReactDOM from "react-dom";
import {
  $,
  $$,
  Cite,
  Ref,
  Footnote,
  Section,
  SubSection,
  SubSubSection,
  Title,
  Authors,
  Author,
  Name,
  Affiliation,
  Institution,
  Abstract,
  Document,
  Wrap,
  Row,
  Listing,
  ListingConfigure,
  Figure,
  Subfigure,
  Caption,
  Definition,
  Smallcaps,
  Center,
  Commentary,
  Comment,  
  IR, 
  Premise, 
  PremiseRow,
  Togglebox,
  References

} from "nota";
import {Paper as SlicerPaper} from "slicing";

import {TsxViewer} from "./tsx_viewer";

// @ts-ignore
import bibtex from "./bib.bib";

import "katex/dist/katex.min.css";
import "nota/dist/index.css";

const r = String.raw;
const C: React.FC = props => <code {...props} />;
const bt = "`";
let $T = tex => props => <$ {...props}>{r`\text{${tex}}`}</$>;
let CenterSep = ({children}) => <div style={{margin: '1rem 0'}}><Center>{children}</Center></div>;

let AEx = ({children, ...props}) => <a target="_blank" {...props}>{children}</a>

export let Paper: React.FC = _ => {  
  return <Document anonymous>
    <Title>A New Medium for Communicating Research on Programming Languages</Title>
    <Authors>
      <Author>
        <Name value="Will Crichton" />
        <Affiliation>
          <Institution value="Stanford University" />
        </Affiliation>
      </Author>
    </Authors>
    <Abstract>
      Papers about programming languages involve complex notations, systems, and proofs. Static PDFs offer little support in understanding such concepts. We describe Nota, a framework for academic papers that uses the browser's interactive capabilities to support understanding in context. Nota uses hover effects, tooltips, expandable sections, toggle-able explanations, and other interactions to help readers understand a language's syntax and semantics. We demonstrate the use of Nota by rewriting a PL paper using its primitives, and also by writing this paper in Nota.
    </Abstract>
    
    <$$>{r`
    \newcommand{\k}{\mathcal{K}}
    \newcommand{\m}{\footnotesize\text{M}}
    \newcommand{\nl}{\hspace{2em}}
    `}</$$>

    <Section title="Introduction" name="sec:intro">
      <p>Programming languages research is conveyed through the medium of <em>academic papers.</em> These papers use a combination of natural language and mathematical notation to communicate ideas about languages, algorithms, and proofs. For example, an explanation of a typing rule for the simply-typed lambda calculus might look like this:</p>
 
      <div style={{border: '1px solid #ccc', borderRadius: '4px', padding: '1rem', margin: '1rem 2rem'}}>
        To type-check a function, we need to check that the body is well-typed given its argument. This is formally written as:
        <Center>
        <IR
          Top={<$>{r`\Gamma, x : \tau_x \vdash e : \tau_e`}</$>}
          Bot={<$>{r`\Gamma \vdash \lambda x : \tau_x \, . \, e ~ : ~ \tau_x \rightarrow \tau_e`}</$>} 
          Right={<Smallcaps>(T-Lambda)</Smallcaps>}
          />
        </Center>
        Here, the syntax <q><$>{r`\Gamma, x : \tau_x`}</$></q> means <q>add <$>x : \tau_x</$> to the type environment <$>\Gamma</$>.</q> Therefore we recursively check that <$>e</$> is well-typed assuming <$>x : \tau_x</$>. If so, then the type of the function is <$>\tau_x \rightarrow \tau_e</$> because it takes a value of type <$>\tau_x</$> as input and returns a value of type <$>\tau_e</$> as output.
      </div>

      <p>The principle question underlying our work is: <em>how much effort does it take to understand a PL paper?</em> In the example above, a key challenge is understanding the notation and the concepts they represent. For a formal system as small as the simply-typed lambda calculus, such an explanation only needs to reference a few symbols. The <Smallcaps>T-Lambda</Smallcaps> rule uses 11 distinct symbols (<$>x</$>, <$>e</$>, <$>\tau</$>,  <$>\lambda</$>,  <$>.</$>,  <$>\rightarrow</$>,  <$>\Gamma</$>, <$>\vdash</$>, <$>{r`\text{\textemdash}`}</$>)  to reference 8 distinct concepts (variables, expressions, types, functions, function types, typing contexts, typing judgments, and inference rules).</p>
      
      <p>However, PL has come a long way since the lambda calculus. Consider this rule reproduced from <Cite f v="cavallo2019higher" ex="p. 24"/>, a recent POPL paper about cubical type theory:</p>

      <div style={{border: '1px solid #ccc', borderRadius: '4px', margin: '1rem 2rem', textAlign: 'center'}}>
      <IR
        Top={<>
          <PremiseRow>
            <Premise><$>{r`\Delta \triangleright \mathcal{E} : \k \rightharpoonup \delta.h.D\,[\Psi]`}</$></Premise>
            <Premise><$>{r`\k[\ell] = (\Gamma;~ \gamma.\overline{I};~ \gamma.\Theta;~ \overline{x}.\overrightharpoon{\xi_k \hookrightarrow \gamma.\Theta.\m_k})`}</$></Premise>
          </PremiseRow>
          <PremiseRow>
            <Premise><$>{r`\text{ht}_\k(\ell) = |\mathcal{E}|`}</$></Premise>
            <Premise><$>{r`H_\ell := (\gamma : \Gamma, \eta : \lBrace \Theta \rBrace(\text{ind}_\Delta(\k; \overline{I})), \rho : \lBrace \Theta \rBrace_d(\delta.h.D;~\eta)) `}</$></Premise>
          </PremiseRow>
          <PremiseRow>
            <Premise><$>{r`H_\ell \gg R \in D[\text{intro}_{k,\ell}^{\overline{x}}(\gamma; \eta)/h]\,[\Psi,\overline{x}]`}</$></Premise>
          </PremiseRow>
          <PremiseRow>
            <Premise><$>{r`(\forall k) H_\ell \gg R \doteq {\Large ⦇} \Theta.\m_k {\Large ⦈}^{\k,\mathcal{E}}_{\delta.h.D}\normalsize(\eta; \rho) \in D[\text{intro}^{\overline{x}}_{\k,\ell}(\delta; \eta)/h]\,[\Psi, \overline{x}\mid \xi_k]`}</$></Premise>
          </PremiseRow>
        </>}
        Bot={<$>{r`\Delta \triangleright [\mathcal{E}, \ell : \overline{x}.\gamma.n.\rho.R] : \k \rightharpoonup \delta.h.D\,[\Psi]`}</$>}
        />
      </div>

      {/* \Delta, \triangleright, \mathcal{E}, \k, \rightharpoonup, \delta, h, D, \Psi, [], \ell, \Gamma, (;;), I, \overline, \gamma, \Theta, x, \overrightharpoon, \xi, k, \hookrightarrow, \m, 
          \text{ht}, ||, :=, H, \eta, \lBrace, \text{ind}, \rho, \gg, \in, R, \text{intro}, /, \forall, \doteq, (|, ^_, 
       */}

      <p className="noindent">This rule uses about 40 distinct symbols to communicate a significant number of concepts. Some symbols, such as <q><$>\forall</$></q>, are expected background for the reader. But most are defined solely within the context of the paper. Remembering and applying these paper-specific symbols is a known challenge in reading scientific papers <Cite v="head2021augmenting" />. And comprehension challenges go beyond individual symbols. A person reading a complex expression may want to know, how do I mentally parse this string? Where is the nearby text that explains this particular part of the rule? What kind of related work defines rules similar to this one?</p>

      <p>The difficulty of these tasks is compounded by the two technologies underlying the modern academic paper: PDF and LaTeX. PDFs are designed to be static documents, and so the only forms of interaction they usually offer are internal hyperlinks and text search, along with structuring mechanisms like a table of contents. LaTeX, a system designed in the 1980s, uses an archaic programming language where the only abstraction mechanism is a macro. Combined, these factors make certain visualizations and interactions nigh impossible to implement.</p>

      <p>On the SIGPLAN blog, <Cite v="placcessible" f /> argued for a new PL journal motivated by these challenges: to make PL research more accessible. Greenberg cited <AEx href="https://distill.pub/">Distill</AEx> as a primary inspiration for similar efforts in machine learning research. However, only three months after Greenberg's post, the Distill editors announced a potentially indefinite hiatus <Cite v="team2021distill" y />. A key reason was:</p>

      <blockquote>
        <q>We believed that many valuable scientific contributions — such as explanations, interactive articles, and visualizations — were held back by not being seen as “real scientific publications.” Our theory was that if a journal were to publish such artifacts, it would allow authors to benefit from the traditional academic incentive system and enable more of this kind of work. After four years, we no longer believe this theory of impact. [...] Instead, we believe the primary bottleneck is the amount of effort it takes to produce these articles and the unusual combination of scientific and design expertise required.</q>
      </blockquote>

      <p className="noindent">In this way, Distill presents both an inspiration and a cautionary tale. We know papers can be improved to help readers better understand their concepts. But we cannot train every researcher to be an expert in graphic design or frontend web development. Part of the success of LaTeX is that so many CS researchers are able to use it to create papers without significant training (and despite its many flaws).</p>

      <p>Hence, our goal is to create a system for writing PL papers that (a) provides features for more effective reading, and (b) requires no special design knowledge to use. To that end, we designed Nota (as in <i>nota bene</i>), a web framework for writing academic papers. Its primitives closely mirror LaTeX's to provide a similar authoring experience. Nota improves the reading experience by taking advantage of the browser's powerful rendering engine as well as the abstraction capabilities of Javascript.</p>

      <p>We have two objectives in this paper. First, to demonstrate the capabilities of the browser in improving PL papers. And second, to show that writing Nota is close enough to LaTeX that researchers could plausibly adopt it without a significant learning curve. To start with the first objective, we have re-implemented one of the authors' PL papers in Nota. We will present the first three sections of that paper with commentary to draw attention to usage of Nota features.</p> 
    </Section>
    <Section title="demo" name="sec:demo">
      <Commentary Document={SlicerPaper} comment_width={350}>
        <Comment selector={'h1'}>
          <p>The left column contains a draft of a PL paper currently under submission. The white bubbles in the right column contain commentary about the usage of Nota. You can compare against the original LaTeX/PDF version <AEx href="slicing_paper.pdf">here</AEx>, and read the Nota version in a standalone page <AEx href="slicing">here</AEx>.</p>
          <p>
            The general style (fonts, spacing, etc.) was designed to mimic the ACM Primary template as closely as possible. This demonstrates that the core visual style of a LaTeX-generated paper can still be represented in the browser.
          </p>
        </Comment>
        <Comment selector={'#def-sec-intro section:first-child h2 ~ p'}>
          <p>Try clicking on one of the purple citations. One click brings up a tooltip with the corresponding citation. (Click anywhere on the page to close it.) Then try double-clicking on a citation. You can use the browser's <q>back</q> function to jump back to where you were. Also note that the object you jump to is briefly highlighted in yellow to draw your attention after jumping.</p>
          <p>Some foundational concepts in Nota are definitions and references. For example, a bibliography defines sources, which can be referenced inline as a citation. A footnote defines asides, which can be referenced as a number. Try clicking on the footnote at the end of the first paragraph. Notice that the same tooltip mechanism can be used as with the citation.</p>
        </Comment>        
        <Comment selector={'#def-sec-intro ol'}>
          Unimplemented references are replaced with placeholders, rather than preventing the document from compiling.
        </Comment>
        <Comment selector={'#def-sec-places h3 ~ p'}>
          <p>Examples don't have to be static in the browser! Try editing this code example to say <code>x = z;</code>. then select <code>x</code> on line 5 and click <q>Slice</q>. </p>
          <p>Interactive examples allow readers to engage with the material by forming and testing hypotheses, or checking edge cases of an algorithm.</p>
        </Comment>
        <Comment selector={'#multi-snippets'}>
          Note that the browser allows for flexible layouts. If a figure needs to extend beyond page boundaries, then no problem &mdash; a monitors is wide enough. 
        </Comment>
        <Comment selector={'#def-sec-model'}>
          This section demonstrates the core features of Nota. Here, the paper needs to describe a large language, Oxide, imported from another paper (Weiss et al.). This language contains a large syntax and a semantics with a number of judgments. The goal of Nota is to simplify the definition, referencing, and explaining of formal systems like Oxide.
        </Comment>
        <Comment selector={'#def-sec-syn'}>
          This grammar defines dozens of syntax kinds, metavariables, and syntactic forms. Using Nota, every instance is linked to its definition. For example, try hovering over the form <$>{r`\&\rho\,\omega\,\tau^{\tiny\text{XI}}`}</$> under Sized Type. Click on each metavariable, then click on the ampersand. As before, you can double click to jump to the definition. The stack of tooltips indicate nested references, e.g. <$>\omega</$> within the broader reference form.
        </Comment>
        <Comment selector={'#syntax-diagram'}>
          This diagram doesn't have to be drawn in Illustrator! It uses HTML for the layout and boxes, and SVG to draw the lines. That means the underlying structure is still preserved, so the syntax elements are inspectable (as oppposed to a static image).
        </Comment>
        <Comment selector={'#def-sec-statsem'}>
          When describing a large formal system, some elements are less important than others. For instance, the context <$>\Delta</$> is necessary for the typing judgment, but isn't relevant to most of the paper. Rather than having a giant syntax figure or punting <$>\Delta</$> to the appendix, we can introduce <em>expandable elements.</em> Try double-clicking the <$>\Delta</$>. It will jump to the <q>extra</q> grammar hidden by the <q>Show grammar</q> button.
        </Comment>
        <Comment selector={'#static-rule'}>
          A common pattern in PL papers is to present a formal rule full of symbols, then accompany that rule with a separate paragraph explaining it. The rule on the left shows a possible enhancement of this pattern: co-locating natural language explanations with the corresponding symbolic expressions. Try clicking the <$>\Sigma</$> buttons. 
        </Comment>
        <Comment selector={'#correspondence-principle-1'}>
          <p>Part of Nota's inspiration was our attempts to visually encode correspondences between objects (see page 10 of the <AEx href="slicing_paper.pdf#page=10">PDF</AEx>). LaTeX's brittle abstractions made it frustratingly hard to do something as simple as <q>draw a colored underline beneath a piece of math.</q></p>
          <p>By contrast, implementing this feature was trivial in HTML/CSS/Javascript. And we could extend the idea with interactions like drawing attention to corresponding objects on hover.</p>
        </Comment>
      </Commentary>
    </Section>
    <Section title="Implementation">
      <p>Nota is a browser technology, so it is implemented using a combination of HTML, CSS, and Javascript. The core is the <AEx href="https://reactjs.org/">React</AEx> Javascript library. React allows HTML to be freely intermixed with Javascript, and enables the creation of new tags with associated interactions. For example, the following code shows the Nota implementation of <a href="#def-sec-statsem">Section 3.2</a> from above:</p>

      <CenterSep>
        <TsxViewer 
          code={r`<SubSection title="Static semantics" name="sec:statsem">
  <p>
    <Definition name="tex:tc">
      Expressions are typechecked via the judgment 
      <$>{r${bt}\tc{\fenv}{\tyenv}{\stackenv}{\expr}{\ty}{\stackenv'}${bt}}</$>, 
      read as: "<$>\expr</$> has type <$>\ty</$> under contexts 
      <$>{\fenv, \tyenv, \stackenv}</$> producing new context <$>\stackenv'</$>."
    </Definition> 
    <$>\tyenv</$> contains function-level type and provenance variables. 
    <$>\stackenv</$> maps variables to types and provenances to pointed-to 
    place expressions with ownership qualifiers. For instance, when type checking 
    <code>*b := a.1</code> in <Ref name="fig:oxide_syntax_example" />, the inputs would be 
    <$>\tyenv = \tyenvempty</$> (empty) and 
    <$>{r${bt}\stackenv = \{
      a \mapsto (\uty, \uty), ~ 
      b \mapsto \eref{\uniq}{\r_2}{\uty}, ~ 
      \r_1 \mapsto \{\loanform{\uniq}{a.0}\}, ~ 
      \r_2 \mapsto \{\loanform{\uniq}{a.0}\}\}
    ${bt}}</$>.
  </p> 
  {/* ... */}`} />      
      </CenterSep>

      <p>Some tags like <C>{'<p>'}</C> and <C>{'<code>'}</C> are default tags built into the browser. The rest are components provided by Nota. For instance, <C>{'<SubSection>'}</C> and <C>{'<$>'}</C> directly correspond to the <C>\subsection</C> and <C>$</C> operators of LaTeX. The <C>{`<Definition>`}</C> and <C>{`<Ref>`}</C> components are enhanced versions of <C>\label</C> and <C>\ref</C>. A definition has a name and a tooltip, by default the contents of the definition. Then a reference to the definition will bring up the tooltip on click, and jump to the definition on double-click.</p>

      <p>The <C>{'<$>'}</C> component is implemented using <AEx href="https://katex.org/">KaTeX</AEx>, a TeX implementation for the browser. By default, KaTeX is a black-box that generates HTML to render directly into the page. To support definitions and references, we use KaTeX's <AEx href="https://katex.org/docs/supported.html#html">HTML extensions</AEx> to tag elements with data. For example, the <C>\stackenv</C> macro is defined as:</p>

      <CenterSep>
        <pre>{r`\newcommand{\stackenv}{\htmlData{cmd=stackenv}{\Gamma}}`}</pre>
      </CenterSep>

      <p className="noindent">With this macro, the generated HTML for a <C>\stackenv</C> invocation looks like <C>{`<span data-cmd="stackenv">...</span>`}</C>. Nota post-processes KaTeX's output to replace tagged nodes with the corresponding definitions and references, enabling the interactions shown in the previous section.</p>

      <p>Most users of Nota would write the declarative markup shown above. Library writers would create React components that can be plugged into a Nota document. For instance, the <a href="#assign-static-rule">toggle-based inference rule</a> is based on a <C>{`<Togglebox>`}</C> abstraction. A basic togglebox looks like this:</p>

      <CenterSep>
        <Togglebox Inside={$T(r`$\LaTeX$ on the inside!`)} Outside={$T('Text out the outside...')} />
      </CenterSep>

      <p className="noindent">Below is a simplified implementation of <C>{`<Togglebox>`}</C> using React and Typescript. It uses <AEx href="https://reactjs.org/docs/components-and-props.html">function components</AEx> and <AEx href="https://reactjs.org/docs/hooks-overview.html">hooks</AEx> to implement the two key aspects of the togglebox: sizing the box to fit both elements, and toggling the box when clicking the toggle button.</p>

      <CenterSep>
        <TsxViewer 
          code={r`export let Togglebox: React.FC<ToggleboxProps> = ({ Inside, Outside }) => {
  let outside_ref = useRef<HTMLDivElement>(null);
  let inside_ref = useRef<HTMLDivElement>(null);
  let [show_inside, set_show_inside] = useState(false);

  // Set the box's dimensions to the maximum size of both input elements
  let style = useStateOnInterval({}, 1000, () => {
    if (outside_ref.current || !inside_ref.current) { return {}; }
    let get_dims = (ref: React.RefObject<HTMLDivElement>) => 
      ref.current!.getBoundingClientRect();
    let outside_dims = get_dims(outside_ref);
    let inside_dims = get_dims(inside_ref);
    return {
      width: Math.max(outside_dims.width, inside_dims.width),
      height: Math.max(outside_dims.height, inside_dims.height),
    };
  });

  let inner_style = (show: boolean): any =>
    !show ? {
      visibility: "hidden",
      position: "absolute",
    } : {};

  return <div className="togglebox-parent">
    <div className="togglebox" style={style}>
      <div ref={outside_ref} style={inner_style(!show_inside)}>
        <Outside />
      </div>
      <div ref={inside_ref} style={inner_style(show_inside)}>
        <Inside />
      </div>
    </div>
    <ToggleButton on={show_inside} onClick={() => set_show_inside(!show_inside)} />
  </div>;
}`} />      
      </CenterSep>

      <p>One advantage of using Javascript vs. TeX is the ability to define abstractions at a higher level than macros. For example, the BNF grammar above is automatically generated by a <C>Language</C> class that takes a grammar specification as input, and generates both the grammar and the TeX macros. The Oxide language is defined like this:</p>

      <CenterSep>
        <TsxViewer 
          code={r`export let Oxide = new Language([
  ["Variable", "vr", "x", []],
  ["Function", "fname", "f", []],
  ["Number", "num", "n", []],  
  ["Path", "path", "q", [
    [r${bt}empty${bt}, 0, r${bt}\varepsilon${bt}, []], 
    [r${bt}elem${bt}, 2, r${bt}{#1}.{#2}${bt}, [r${bt}\num${bt}, r${bt}\path${bt}]]]],
  ["Place", "plc", r${bt}\pi${bt}, [
    [r${bt}form${bt}, 2, r${bt}{#1}.{#2}${bt}, [r${bt}\vr${bt}, r${bt}\path${bt}]]]],
  ["Place Expression", "pexp", "p", [
    [${bt}var${bt}, 1, r${bt}#1${bt}, [r${bt}\vr${bt}]], 
    [${bt}elem${bt}, 2, r${bt}{#1}.{#2}${bt}, [r${bt}\pexp${bt}, r${bt}\num${bt}]], 
    [${bt}deref${bt}, 1, r${bt}\ast {#1}${bt}, [r${bt}\pexp${bt}]]]],
  ...
  ]);`} />
      </CenterSep>

      <p>Then the <C>Oxide</C> object has two methods to generate the TeX macros and BNF, like so:</p>

      <CenterSep>
        <TsxViewer 
          code={r`<Oxide.Commands />
<Oxide.BNF layout={{columns: 2}} />`} />
      </CenterSep>
      
      <p>In our experience writing Nota features, it is far easier to define new components in Javascript than in TeX. Abstraction boundaries are less fragile, and orthogonal features are more likely to work together.</p>
    </Section>
    <Section title="Discussion">
      <p>What will be the academic paper of the future? Our goal with Nota is to show what's already possible today. We believe adopting Nota, or a system like it, could help make PL papers more readable to both novices and experts alike. It does not require any special design skills from authors, mostly just additional metadata around pieces of the document to enable rich references.</p>

      <p>Of course, Nota is one of many possible visions for the future. Alternatives include:</p>
      <ul>
        <li><em>Notebooks:</em> mixed text/code media like <AEx href="https://jupyter.org/">Jupyter</AEx>, <AEx href="https://observablehq.com/">Observable</AEx>, and <AEx href="https://rmarkdown.rstudio.com/">R Markdown</AEx> have grown in popularity especially in the non-computer sciences. The goal of a notebook is to put the explanation of an object as close as possible to the code that generated it. In fields like psychology, this usually means analyzing datasets and generating graphs. Perhaps the future for PL is literate Agda/Lean/Coq programs.</li>
        <li><em>Enhanced PDFs:</em> creating a new browser-based medium will inevitably require reinventing a number of wheels that already exist for LaTeX/PDFs: IDEs (like <AEx href="https://www.overleaf.com/">Overleaf</AEx>), documentation, accessibility features, and so on. A far simpler approach would be to make LaTeX and PDFs as powerful as possible, like <Cite v="head2021augmenting" f /> recently explored.</li>
        <li><em>Beyond papers:</em> the academic paper is a concept extending back hundreds of years. It persists with the momentum of history, millions of adherents, and the myriad incentive structures of academia. Perhaps systems like Nota merely prolong the lifespan of this outdated practice, and academic contributions should be reimagined outside the frame of <q>a new kind of paper.</q></li>
      </ul>

      <p>Nota itself also has drawbacks for academic communication. The web ecosystem changes rapidly, meaning what works today may not work tomorrow. While some <AEx href="https://www.spacejam.com/1996/">venerable websites</AEx> survive the test of time, would a Nota paper still work properly in 100 or 1,000 years? Such longevity is arguably much more likely for a PDF than a website. Moreover, important infrastructure for Nota like KaTeX would need feature-parity with existing TeX engines like pdfTeX to match the wide range of notation needed for PL research.</p>

      <p>Regardless, we hope that this paper draws attention to the pressing issue of how we communicate in PL research. As the field progresses, the conceptual infrastructure of new ideas grows ever larger. Interactive mediums like Nota can provide cognitive support for understanding ideas in context. And support doesn't have to stop at the individual level &mdash; a public platform could support crowd-sourced annotations on each paragraph of a research paper. In classic PL fashion, we could maybe design a medium so great that everyone else adopts it... in 30 years.</p>
    </Section>
    <References bibtex={bibtex} />
  </Document>
};

ReactDOM.render(<Paper />, document.getElementById("container"));
