import type {GrammarStore} from './index';

// Recall we are using MonacoWebpackPlugin. According to the
// monaco-editor-webpack-plugin docs, we must use:
//
// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
//
// instead of
//
// import * as monaco from 'monaco-editor';
//
// because we are shipping only a subset of the languages.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import nullthrows from 'nullthrows';
import {createGrammarStore} from './index';
import {INITIAL} from 'vscode-textmate';

async function main() {
  // Note that Hack lists text.html.basic as an embedded grammar, so we must
  // provide that grammar (and all of its transitive deps) as well.
  //
  // This sort of looks like:
  // https://github.com/microsoft/vscode-textmate/blob/0730e8ef740d87401764d76e9193f74c6f458b37/test-cases/themes/grammars.json
  const grammarConfigurations = [
    {language: 'css', scopeName: 'source.css', url: '/grammars/css.plist'},
    {language: 'hack', scopeName: 'source.hack', url: '/grammars/hack.json'},
    {language: 'html', scopeName: 'text.html.basic', url: '/grammars/html.json'},
    {language: 'javascript', scopeName: 'source.js', url: '/grammars/JavaScript.tmLanguage.json'},
    {language: 'python', scopeName: 'source.python', url: '/grammars/MagicPython.tmLanguage.json'},
    {language: 'smarty', scopeName: 'source.smarty', url: '/grammars/smarty.tmLanguage.json'},
    {language: 'sql', scopeName: 'source.sql', url: '/grammars/SQL.plist'},
  ];

  // We have to register all of the languages with Monaco before we can configure them.
  for (const {language} of grammarConfigurations) {
    monaco.languages.register({
      id: language,
      extensions: [],
    });
  }

  const scopeNameToTextMateGrammarURL: Map<string, string> = new Map(
    grammarConfigurations.map(({scopeName, url}) => [scopeName, url]),
  );
  const grammarStore = await createGrammarStore(scopeNameToTextMateGrammarURL);

  for (const {language, scopeName} of grammarConfigurations) {
    // const tokensProvider = await grammarStore.createTokensProvider(scopeName);
    const tokensProvider = await grammarStore.createEncodedTokensProvider(scopeName);
    monaco.languages.setTokensProvider(language, tokensProvider);
  }

  const options = [
    {
      language: 'hack',
      value: `<?hh // strict

class Example {
}
`,
    },
    {
      language: 'html',
      value: `<!DOCTYPE HTML>
<html>
<head>
</head>
<body>
</body>
</html>
`,
    },
    {
      language: 'javascript',
      value: `
const React = require('react');

function create() {
  return (
    <div>
      hello world
    </div>
  );
}
`,
    },
  ];
  const {language, value} = options[0];

  const theme = 'hackTheme';
  defineTheme(theme);
  monaco.editor.create(nullthrows(document.getElementById('container')), {
    value,
    language,
    // theme,
    minimap: {
      enabled: false,
    },
  });

  // Although the web demo doesn't work, this seems to have sensible output.
  await tryCodeOnVSCodeTextMateReadme(grammarStore);
}

async function tryCodeOnVSCodeTextMateReadme(grammarStore: GrammarStore) {
  const grammar = nullthrows(await grammarStore.getGrammar('source.hack'));
  const text = `<?hh // strict

class Example {
}
`.split('\n');
  let ruleStack = INITIAL;
  for (let i = 0; i < text.length; i++) {
    const line = text[i];
    const lineTokens = grammar.tokenizeLine(line, ruleStack);
    console.log(`\nTokenizing line: ${line}`);
    for (let j = 0; j < lineTokens.tokens.length; j++) {
      const token = lineTokens.tokens[j];
      console.log(
        ` - token from ${token.startIndex} to ${token.endIndex} ` +
          `(${line.substring(token.startIndex, token.endIndex)}) ` +
          `with scopes ${token.scopes.join(', ')}`,
      );
    }
    ruleStack = lineTokens.ruleStack;
  }
}

main();

function defineTheme(name: string): void {
  // This code is ported from this playground:
  // https://microsoft.github.io/monaco-editor/playground.html#customizing-the-appearence-tokens-and-colors
  // It seems to work there, so we ignore these errors.
  // @ts-ignore
  monaco.editor.defineTheme(name, {
    base: 'vs', // can also be vs-dark or hc-black
    inherit: true, // can also be false to completely replace the builtin rules
    rules: [
      {token: 'comment', foreground: 'ffa500', fontStyle: 'italic underline'},
      {token: 'keyword', foreground: '008800', fontStyle: 'bold'},
      {token: 'entity.name.type.class.php', foreground: '008800', fontStyle: 'bold'},
      {token: 'keyword.operator.comparison.php', foreground: 'ff0000'},
    ],
  });
}
