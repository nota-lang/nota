module.exports = {
    "env": {
        "browser": true,
        "es2021": true,
        "node": true,
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaFeatures": {
            "jsx": true
        },
        "ecmaVersion": 13,
        "sourceType": "module"
    },
    "plugins": [
        "react",
        "@typescript-eslint",
        "prettier"
    ],
    "globals": {
        "MutationObserverInit": true,
        "MutationCallback": true,
        "ScrollLogicalPosition": true,
        "JSX": true
    },
    "ignorePatterns": [
        "*.d.ts",
        "packages/nota-syntax/lib/notajs.grammar.*",
        "packages/nota-syntax/lib/markdown.ts",
        "packages/nota-editor/lib/source-map.js"
    ],
    "rules": {
        "react/prop-types": "off",
        "no-empty-pattern": "off",
        "no-undef": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
        "no-constant-condition": ["error", {"checkLoops": false}],
        "prettier/prettier": "error"
    },
    "settings": {
        "react": {
            "version": "detect"
        }
    }
};
