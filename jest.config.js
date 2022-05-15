module.exports = {
  transform: {
    "^.+\\.(j|t)sx?$": [
      "esbuild-jest",
      {
        sourcemap: true,
      },
    ],
  },
  transformIgnorePatterns: [],
};
