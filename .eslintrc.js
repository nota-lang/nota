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
        "@typescript-eslint"
    ],
    "globals": {
        "MutationObserverInit": true,
        "MutationCallback": true,
        "ScrollLogicalPosition": true,
        "JSX": true
    },
    "ignorePatterns": ["*.d.ts"],
    "rules": {
        "react/prop-types": "off",
        "no-empty-pattern": "off",
        "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
        "no-constant-condition": ["error", {"checkLoops": false}]
    }
};
