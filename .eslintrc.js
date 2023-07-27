module.exports = {
    parser: '@typescript-eslint/parser',
    env: {
        node: true,
        jest: true,
    },
    plugins: ['@typescript-eslint', 'prettier'],
    extends: ['eslint:recommended', 'plugin:prettier/recommended'],
    rules: {
        'no-unused-vars': 'off',
        'no-prototype-builtins': 'off',
        '@typescript-eslint/no-unused-vars': 'error',
    },
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
        ecmaFeatures: {
            modules: true,
        },
    },
};