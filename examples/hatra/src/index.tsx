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
  Smallcaps
} from "nota";
import {Commentary, Comment} from "nota/dist/commentary";
import {IR, Premise, PremiseRow} from "nota/dist/math";

import {Paper as SlicerPaper} from "slicing";

// @ts-ignore
import bibtex from "./bib.bib";

import "../node_modules/nota/dist/assets.css";

const r = String.raw;
const C: React.FC = props => <code {...props} />;

export let Paper: React.FC = _ => {  
  return <Document anonymous bibtex={bibtex}>
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
      TODO
    </Abstract>
    
    <$$>{r`
    \newcommand{\k}{\mathcal{K}}
    \newcommand{\m}{\footnotesize\text{M}}
    \newcommand{\nl}{\hspace{2em}}
    `}</$$>

    <Section title="Introduction" name="sec:intro">
      <p>Programming languages research is conveyed through the medium of <em>academic papers.</em> These papers use a combination of natural language and symbols to communicate ideas about languages, algorithms, and proofs. For example, an explanation of a typing rule for the simply-typed lambda calculus might look like this:</p>
 
      <div style={{border: '1px solid #ccc', borderRadius: '4px', padding: '1rem', margin: '1rem 2rem'}}>
        To type-check a function, we need to check that the body is well-typed given its argument. This is formally written as:
        <center>
        <IR
          Top={<$>{r`\Gamma, x : \tau_x \vdash e : \tau_e`}</$>}
          Bot={<$>{r`\Gamma \vdash \lambda x : \tau_x \, . \, e ~ : ~ \tau_x \rightarrow \tau_e`}</$>} 
          Right={<Smallcaps>(T-Lambda)</Smallcaps>}
          />
        </center>
        Here, the syntax "<$>{r`\Gamma, x : \tau_x`}</$>" means "add <$>x : \tau_x</$> to the type environment <$>\Gamma</$>." Therefore we recursively check that <$>e</$> is well-typed assuming <$>x : \tau_x</$>. If so, then the type of the function is <$>\tau_x \rightarrow \tau_e</$> because it takes a value of type <$>\tau_x</$> as input and returns a value of type <$>\tau_e</$> as output.
      </div>

      <p>The principle question underlying our work is: <em>how much work does it take to understand a PL paper?</em> In the example above, a key challenge is dealing with the notation. For a formal system as small as the simply-typed lambda calculus, these explanations only need to reference a few symbols. The <Smallcaps>T-Lambda</Smallcaps> rule uses 10 distinct symbols to reference 7 distinct kinds of formal objects: variables, types, functions, function types, typing contexts, typing judgments, and inference rules. However, PL has come a long way since the lambda calculus. Consider this rule reproduced from <Cite f v="cavallo2019higher" ex="p. 24"/>, a recent POPL paper about cubical type theory:</p>

      <div style={{border: '1px solid #ccc', borderRadius: '4px', margin: '1rem 2rem'}}>
      <center>
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
      </center>
      </div>

      {/* \Delta, \triangleright, \mathcal{E}, \k, \rightharpoonup, \delta, h, D, \Psi, [], \ell, \Gamma, (;;), I, \overline, \gamma, \Theta, x, \overrightharpoon, \xi, k, \hookrightarrow, \m, 
          \text{ht}, ||, :=, H, \eta, \lBrace, \text{ind}, \rho, \gg, \in, R, \text{intro}, /, \forall, \doteq, (|, ^_, 
       */}

      <p>This rule uses about 40 distinct symbols to communicate a significant number of formal objects. Some symbols, such as "<$>\forall</$>", are expected background for the reader. But most are defined solely within the context of the papers. Remembering and applying these paper-specific symbols is a known challenge in reading scientific papers <Cite v="head2021augmenting" />. Comprehension challenges also go beyond individual symbols. A person reading a complex expression may want to know: how do I mentally parse this string? Where is the nearby text that explains this particular part of the rule? What kind of related work defines rules similar to this one?</p>

      <p>The difficulty of these tasks is compounded by the two technologies underlying the modern academic paper: PDF and LaTeX. PDFs are designed to be static documents, and so the only forms of interaction they usually offer are internal hyperlinks and text search along with structuring mechanisms like a table of contents. LaTeX, a system designed in the 1980s, uses an archaic programming language where the only abstraction mechanism is a macro. Combined, these factors make certain visualizations and interactions nigh impossible to implement.</p>

      <p>On the SIGPLAN blog, <Cite v="placcessible" f /> argued for a new PL journal motivated by these challenges: to make PL research more accessible. Greenberg cited <a href="https://distill.pub/" target="_blank">Distill</a> as a primary inspiration for similar efforts in machine learning research. However, only three months after Greenberg's post, the Distill editors announced a potentially indefinite hiatus <Cite v="team2021distill" y />. A key reason was:</p>

      <blockquote>
        "We believed that many valuable scientific contributions — such as explanations, interactive articles, and visualizations — were held back by not being seen as “real scientific publications.” Our theory was that if a journal were to publish such artifacts, it would allow authors to benefit from the traditional academic incentive system and enable more of this kind of work. After four years, we no longer believe this theory of impact. [...] Instead, we believe the primary bottleneck is the amount of effort it takes to produce these articles and the unusual combination of scientific and design expertise required."
      </blockquote>

      <p className="noindent">In this way, Distill presents both an inspiration and a cautionary tale. We know papers can be improved to help readers better understand their concepts. But we cannot train every researcher to be an expert in graphic design or frontend web development. Part of the success of LaTeX is that so many CS researchers are able to use it to create papers without significant training (and despite its many flaws).</p>

      <p>Hence, our goal is to create a system for writing PL papers that (a) provides features for more effective reading, and (b) requires no special design knowledge to use. To that end, we designed Nota (as in <i>nota bene</i>), a web framework for writing academic papers. Its primitives closely mirror LaTeX's to provide a similar authoring experience. Nota improves the reading experience by taking advantage of the browser's powerful rendering engine as well as the abstraction capabilities of Javascript.</p>

      <p>We have two objectives in this paper. First, to demonstrate the capabilities of the browser in improving PL papers. And second, to show that writing Nota is close enough to LaTeX that researchers could plausibly adopt it without a significant learning curve. To start with the first objective, we have re-implemented one of the authors' PL papers in Nota. We will present the first three sections of that paper with commentary to draw attention to usage of Nota features.</p> 
    </Section>
    <Section title="demo" name="sec:demo">
      <Commentary Document={SlicerPaper} comment_width={350}>
        <Comment selector={'h1'}>
          <p>The left column contains a draft of a PL paper currently under submission. The white bubbles in the right column contain commentary about the usage of Nota. You can compare against the original LaTeX/PDF version <a href="#TODO">here</a>, and read the Nota version in a standalone page <a href="#TODO">here</a>.</p>
          <p>
            The general style (fonts, spacing, etc.) was designed to mimic the ACM Primary template as closely as possible. This demonstrates that the core visual style of a LaTeX-generated paper can still be represented in the browser.
          </p>
        </Comment>
        <Comment selector={'#def-sec-intro section:first-child h2 ~ p'}>
          <p>Try clicking on one of the purple citations. One click brings up a tooltip with the corresponding citation. (Click anywhere on the page to close it.) Then try double-clicking on a citation. You can use the browser's "back" function to jump back to where you were. Also note that the object you jump to is briefly highlighted in yellow to draw your attention after jumping.</p>
          <p>Some foundational concepts in Nota are definitions and references. For example, a bibliography defines sources, which can be referenced inline as a citation. A footnote defines asides, which can be referenced as a number. Try clicking on the footnote at the end of the first paragraph. Notice that the same tooltip mechanism can be used as with the citation.</p>
        </Comment>        
        <Comment selector={'#def-sec-intro ol'}>
          Unimplemented references are replaced with placeholders, rather than preventing the document from compiling.
        </Comment>
        <Comment selector={'#def-sec-places h3 ~ p'}>
          <p>Examples don't have to be static in the browser! Try editing this code example to say <code>x = z;</code>. then select <code>x</code> on line 5 and click "Slice". </p>
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
          When describing a large formal system, some elements are less important than others. For instance, the context <$>\Delta</$> is necessary for the typing judgment, but isn't relevant to most of the paper. Rather than having a giant syntax figure or punting <$>\Delta</$> to the appendix, we can introduce <em>expandable elements.</em> Try double-clicking the <$>\Delta</$>. It will jump to the "extra" grammar hidden by the "Show grammar" button.
        </Comment>
        <Comment selector={'#static-rule'}>
          A common pattern in PL papers is to present a formal rule full of symbols, then accompany that rule with a separate paragraph explaining it. The rule on the left shows a possible enhancement of this pattern: co-locating natural language explanations with the corresponding symbolic expressions. Try clicking the <$>\Sigma</$> buttons. 
        </Comment>
        <Comment selector={'#correspondence-principle-1'}>
          <p>Part of Nota's inspiration was our attempts to visually encode correspondences between objects (see page 10 of the <a href="#TODO">PDF</a>). LaTeX's brittle abstractions made it frustratingly hard to do something as simple as "draw a colored underline beneath a piece of math".</p>
          <p>By contrast, implementing this feature was trivial in HTML/CSS/Javascript. And we could extend the idea with interactions like drawing attention to corresponding objects on hover.</p>
        </Comment>
      </Commentary>
    </Section>
    <Section title="Implementation">
      TODO!
    </Section>
  </Document>
};

ReactDOM.render(<Paper />, document.getElementById("container"));
