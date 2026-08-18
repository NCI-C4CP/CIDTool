// Correctness rules only. No style rules: this codebase has never been linted and
// a formatting sweep would bury real findings in noise.
import js from '@eslint/js';

export default [
    {
        ignores: ['coverage/**', 'node_modules/**']
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                document: 'readonly',
                window: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                location: 'readonly',
                history: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                AbortController: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                Blob: 'readonly',
                File: 'readonly',
                FileReader: 'readonly',
                FormData: 'readonly',
                Headers: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                crypto: 'readonly',
                indexedDB: 'readonly',
                navigator: 'readonly',
                CustomEvent: 'readonly',
                Event: 'readonly',
                Node: 'readonly',
                HTMLElement: 'readonly',
                bootstrap: 'readonly',
                XLSX: 'readonly',
                JSZip: 'readonly'
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            // ignoreRestSiblings keeps `const { _sourceRow, ...rest } = x` omit patterns legal
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }]
        }
    },
    {
        files: ['tests/**/*.js', 'jest.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                jest: 'readonly',
                global: 'readonly',
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                document: 'readonly',
                window: 'readonly',
                setTimeout: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly'
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }]
        }
    }
];
