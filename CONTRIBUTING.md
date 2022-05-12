# Contributing to Nota

If you would like to make a contribution to Nota, thanks for the help! 

## Installation

First, you need to install a development version of Nota on your machine. Ensure you have the versions of node and npm listed on https://nota-lang.org/. Then install `pnpm`, e.g. via

```bash
npm install --global pnpm
```

Then download and build the repository via:

```bash
git clone https://github.com/nota-lang/nota/
cd nota
pnpm init-repo
```

You can test the CLI by running:

```bash
cd packages/nota
pnpm link --global
cd $(mktemp -d)
echo "@h1{Hello world}" > index.nota
nota build index.nota
open dist/index.html
```

## Development cycle

We use a monorepo repository structure. All packages are contained in the `packages` directory, and [pnpm](https://pnpm.io/) is used to execute commands on each package. We also use [lerna](https://lerna.js.org/) just for publishing new package versions. Common scripts are provided in the root `package.json`, which can be executed via `pnpm` such as `pnpm build`, `pnpm lint`, and so on.

Most source files are written in [Typescript](https://www.typescriptlang.org/), a version of Javascript with a static type system. Style sheets are written in [Sass](https://sass-lang.com/), an extended version of CSS.

### Building

From the root of the repository, you can run `pnpm build` to build all packages once, or `pnpm watch` to automatically rebuild packages and their dependents when a source file changes.

We use [tsc](https://www.typescriptlang.org/docs/handbook/compiler-options.html) to generate unminified output files for library packages, i.e. packages with code used by downstream applications such as `@nota-lang/nota-components`. We use [esbuild](https://esbuild.github.io/) to generate minified/bundled output files for binary packages, i.e. packages with scripts that are run by users such as `@nota-lang/nota`.

### Documenting

We use [typedoc](https://typedoc.org/) to generate documentation for each package. Run `pnpm doc` to create a `docs` directory containing the documentation, which is hosted at [https://nota-lang.github.io/nota](https://nota-lang.github.io/nota). See the [typedoc documentation](https://typedoc.org/guides/doccomments/) for what features are supported in doc comments.

### Testing

We use [jest](https://jestjs.io/) for testing and follow its conventions. Run `pnpm test` from the root of the repository to run the tests. See https://jestjs.io/docs/cli for more on jest's CLI options. For example, you can run `pnpm test -t editor` to run tests that have the name "editor".

### Linting

We use [eslint](https://eslint.org/) for linting. Run `pnpm lint` in a package or from the root to check for lint issues.

### Formatting

We use [prettier](https://prettier.io/) for code formatting. Run `pnpm fmt` to automatically format all files in the repository.

### Committing

Before you commit, you should run `pnpm commit-check`. This will clean the repository, install/rebuild everything from scratch, and run tests and lints.
