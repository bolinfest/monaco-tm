const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const path = require('path');

module.exports = {
  target: 'web',
  entry: {
    app: './src/app.ts',
    // Package each language's worker and give these filenames in `getWorkerUrl`
    'editor.worker': 'monaco-editor/esm/vs/editor/editor.worker.js',
    'json.worker': 'monaco-editor/esm/vs/language/json/json.worker',
    'css.worker': 'monaco-editor/esm/vs/language/css/css.worker',
    'html.worker': 'monaco-editor/esm/vs/language/html/html.worker',
    'ts.worker': 'monaco-editor/esm/vs/language/typescript/ts.worker',
  },
  output: {
    globalObject: 'self',
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  devServer: {
    static: {
      directory:  __dirname
    },
    compress: true,
    port: 8084,
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        use: ['file-loader'],
      },
      {
        test: /\.wasm$/,
        use: ['wasm-loader'],
      },
    ],
  },
  // As suggested on:
  // https://github.com/NeekSandhu/monaco-editor-textmate/blame/45e137e5604504bcf744ef86215becbbb1482384/README.md#L58-L59
  //
  // Use the MonacoWebpackPlugin to disable all built-in tokenizers/languages.
  plugins: [new MonacoWebpackPlugin({languages: []})],
};
