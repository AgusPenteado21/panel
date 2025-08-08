module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json"], // Ruta a tsconfig.json de las funciones
    sourceType: "module",
    tsconfigRootDir: __dirname, // Raíz del proyecto para resolución de tsconfig
  },
  settings: {
    "import/resolver": {
      typescript: {
        project: "./tsconfig.json", // Configura el resolver de import para TypeScript
      },
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    },
    "import/extensions": [".js", ".jsx", ".ts", ".tsx"],
  },
  ignorePatterns: [
    "/lib/**/*", // Ignorar archivos compilados
  ],
  rules: {
    // Reglas de formato y estilo - ajustadas para ser menos estrictas o corregir problemas
    "linebreak-style": ["error", "unix"], // Asegura que los saltos de línea sean LF
    indent: ["error", 2, { SwitchCase: 1 }], // Indentación de 2 espacios, casos de switch 1 nivel
    quotes: ["error", "double"], // Mantener comillas dobles
    "comma-dangle": ["error", "always-multiline"], // Comas colgantes para multilínea
    "max-len": [
      "warn",
      {
        code: 120,
        ignoreComments: true,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ], // Advertir, no error; ignorar varios elementos
    "arrow-parens": ["error", "always"], // Siempre requerir paréntesis en funciones flecha
    "object-curly-spacing": ["error", "always"], // Espacios dentro de llaves de objetos
    "no-trailing-spaces": "error", // No permitir espacios al final de las líneas
    "eol-last": ["error", "always"], // Asegurar un salto de línea al final del archivo

    // Reglas específicas de TypeScript - ajustadas
    "no-unused-vars": "off", // Deshabilita la regla base de ESLint
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ], // Advertir sobre variables no usadas, ignorar las que empiezan con _
    "@typescript-eslint/no-explicit-any": "warn", // Advertir sobre el uso de 'any'
    "guard-for-in": "off", // Deshabilitar si está causando problemas
    "padded-blocks": "off", // Deshabilitar si está causando problemas
    "require-jsdoc": "off", // Deshabilitar si no necesitas JSDoc
    "valid-jsdoc": "off", // Deshabilitar si no necesitas JSDoc

    // Deshabilitar import/namespace si sigue dando problemas, ya que el código compila
    "import/namespace": "off",
  },
};
