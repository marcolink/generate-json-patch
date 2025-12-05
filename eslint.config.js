const {
    defineConfig,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const globals = require("globals");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const prettier = require("eslint-plugin-prettier");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,

        globals: {
            ...globals.node,
            ...globals.jest,
        },

        ecmaVersion: 6,
        sourceType: "module",

        parserOptions: {
            ecmaFeatures: {
                modules: true,
            },
        },
    },

    plugins: {
        "@typescript-eslint": typescriptEslint,
        prettier,
    },

    extends: compat.extends("eslint:recommended", "plugin:prettier/recommended"),

    rules: {
        "no-unused-vars": "off",
        "no-prototype-builtins": "off",
        "@typescript-eslint/no-unused-vars": "error",
    },
}]);