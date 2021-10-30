# Nota: A Web Framework for Documents

Nota is a framework for writing documents, like LaTeX. It uses the browser's document layout engine and interactive capabilities to make papers easier to both write and read.

To see an example, or to read about Nota's design philosophy, please check out my [HATRA '21](https://2021.splashcon.org/home/hatra-2021) paper: ["A New Medium for Communicating Research on Programming Languages"](https://willcrichton.net/nota/)

## Usage

### Step 1. Write the document

The core of Nota is [`@wcrichto/nota`](https://github.com/willcrichton/nota/tree/master/packages/nota), a [React](https://reactjs.org/) library that contains LaTeX-like components for structuring a document. For instance, you can write a simple document in [JSX](https://reactjs.org/docs/jsx-in-depth.html) syntax like so:

```jsx
import {Document, Title, Section} from '@wcrichto/nota';

export default () => <Document>
  <Title>Hello, World!</Title>
  <Section title="Introduction" name="sec:intro">
    <p>This is my document: <$>{String.raw`\underlinesegment{AB}`}</$></p>
    <p>This is a reference to <Ref name="sec:intro" /></p>
  </Section>
</Document>;
```

TODO: ADD AN IMAGE OF THE OUTPUT HERE

I am developing a more concise syntax for writing Nota documents as an extension of [MDX](https://mdxjs.com/), a Markdown syntax that interoperates with JSX, in [`@wcrichto/nota-markdown`](https://github.com/willcrichton/nota/tree/master/packages/nota-markdown) For example, the document above would be written as:

```md
<Title>Hello World!</Title>

#[sec:intro] Introduction

This is my document: $\underlinesegment{AB}$

This is a reference to @[sec:intro]
```

Right now, Nota-flavored Markdown is unstable and has particularly bad error messages, so use it as your own peril.

### Step 2. Build the document

You can either use Nota to generate a standalone web page, or use it as a component on your website.

#### Standalone page

The [`@wcrichto/nota-cli`](https://github.com/willcrichton/nota/tree/master/packages/nota-cli) package contains a Node script that will generate a web page from a set of source files. Internally it uses [esbuild](https://esbuild.github.io), so it supports ES6 imports and JSX files. For example:

```bash
# Build the web page
yarn add @wcrichto/nota-cli
echo '# Hello World!\nThis is my <Smallcaps>Paper</Smallcaps>' > paper.mdx
yarn run nota paper.mdx

# Serve the web page
yarn add http-server
yarn run http-server dist/page
```

Then visit [http://localhost:8080](http://localhost:8080).

#### Integrate into existing page

The `<Document>` component shown above is a React component, and so can be integrated into any React application. Nota has the following peerDependencies which you need to have installed: `react react-dom mobx mobx-react @codemirror/basic-setup`

If you want support for Markdown, you need to add `@mdx-js/react` as a dependency. `@wcrichto/nota-markdown` exports an esbuild plugin `notaMarkdown` which processes files with an `.mdx` extension.