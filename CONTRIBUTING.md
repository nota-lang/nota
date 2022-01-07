# Contributing to Nota

If you would like to make a contribution to Nota, thanks for the help! 

## Installation

First, you need to install a development version of Nota on your machine. Ensure you have the versions of node and npm listed on https://nota-lang.org/. Then install `yarn` and `lerna`, e.g. via

```bash
npm install --global yarn lerna
```

Then download and build the repository via:

```bash
git clone https://github.com/nota-lang/nota/
cd nota
yarn init-repo
```

You can test the CLI by running:

```bash
cd packages/nota
yarn link
cd $(mktemp -d)
echo "@h1{Hello world}" > index.nota
nota build index.nota
open dist/index.html
```

## Development cycle

We use a monorepo repository structure. All packages are contained in the `packages` directory, and [lerna](https://github.com/lerna/lerna) is used to execute commands on each package. Common lerna commands are provided in the root `package.json`, which can be executed via `yarn` such as `yarn build`, `yarn lint`, and so on.

### Building

From the root of the repository, you can run `yarn watch` to automatically rebuild packages and their dependents when a source file changes.

### Testing

We use [jest](https://jestjs.io/) for testing and follow its conventions. Run `yarn test` from the root of the repository to run the tests. See https://jestjs.io/docs/cli for more on jest's CLI options. For example, you can run `yarn test -t editor` to run tests that have the name "editor".

### Linting

We [eslint](https://eslint.org/) for linting. Run `yarn lint` in a package or from the root to check for lint issues.

### Committing

Before you commit, you should run `yarn commit-check`. This will clean the repository, install/rebuild everything from scratch, and run tests and lints.
