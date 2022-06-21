module.exports = {
  transform: {
    "^.+\\.(((j|t)sx?)|(wasm))$": [
      "esbuild-jest",
      {
        sourcemap: true,
        loaders: {
          ".wasm": "dataurl",
        },
      },
    ],
  },
  transformIgnorePatterns: [],
};
