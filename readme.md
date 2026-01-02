Mainly to be used by backend. It can be used to wrap things like openai client, airtable client and a million other things by being able to run things before certain fns get called after they get called, rate limit certain fns, queue for calls to certain fns. Also allowlist and blacklist for operations. Return type of this wrapper should be based on the type of the client itself. 
- npm package
- typesafe
- use these eslint rules
    'max-nested-callbacks': ['error', 3],
    'max-lines': [
      'error',
      { max: 1500, skipBlankLines: true, skipComments: true },
    ],
    'max-depth': ['error', 6],
    complexity: ['warn', 12],
    'max-lines-per-function': [
      'error',
      { max: 75, skipComments: true, skipBlankLines: true },
    ],
    'max-params': ['error', 10],
    'max-statements': ['warn', 25],
    'max-statements-per-line': ['error', { max: 1 }],
    'no-restricted-syntax': [
      'error',
      {
        selector: "Identifier[name='dto']",
        message:
          'Do not use dto. Instead, use Zod schemas within the hypnova-api-schema package and, if necessary, add to there.',
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
- 