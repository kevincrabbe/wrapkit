import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.test.ts', 'src/**/*.test-d.ts'],
    rules: {
      // Relax rules for test files
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'max-lines': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/**/*.test-d.ts'],
    rules: {
      'max-nested-callbacks': ['error', 3],
      'max-lines': [
        'error',
        { max: 350, skipBlankLines: true, skipComments: true },
      ],
      'max-depth': ['error', 3],
      complexity: ['warn', 6],
      'max-lines-per-function': [
        'error',
        { max: 40, skipComments: true, skipBlankLines: true },
      ],
      'max-params': ['error', 4],
      'max-statements': ['warn', 20],
      'max-statements-per-line': ['error', { max: 1 }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "Identifier[name='dto']",
          message:
            'Do not use dto. Instead, use Zod schemas for validation.',
        },
        {
          selector:
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, TSDeclareFunction, TSFunctionType, TSMethodSignature, TSCallSignatureDeclaration) ' +
            '> :matches(Identifier, ObjectPattern, ArrayPattern, RestElement, AssignmentPattern)[typeAnnotation] ' +
            '> TSTypeAnnotation > TSTypeLiteral',
          message:
            'Inline object type literals in parameters are not allowed. Extract a named type (type/interface).',
        },
        {
          selector:
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, TSDeclareFunction, TSFunctionType, TSMethodSignature, TSCallSignatureDeclaration) ' +
            '> TSTypeAnnotation TSTypeLiteral',
          message:
            'Inline object type literals in return types are not allowed. Extract a named type (type/interface).',
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js'],
  }
);
