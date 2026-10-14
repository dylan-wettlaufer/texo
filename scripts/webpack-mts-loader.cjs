// Webpack loads this build-only loader through CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require("typescript");

// Next's webpack loader matches .ts/.tsx only. Strip .mts types before its
// normal transforms, keeping the native Node CLI sources and imports intact.
module.exports = function webpackMtsLoader(source) {
  const result = ts.transpileModule(source, {
    fileName: this.resourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      sourceMap: true,
      inlineSources: true,
    },
  });
  this.callback(null, result.outputText, result.sourceMapText ? JSON.parse(result.sourceMapText) : undefined);
};
