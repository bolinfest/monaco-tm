import type {GrammarStore} from './index';

import * as monaco from 'monaco-editor';
import nullthrows from 'nullthrows';
import {createGrammarStore} from './index';
import {INITIAL} from 'vscode-textmate';

declare global {
  interface Window {
    MonacoEnvironment: {
      getWorkerUrl(moduleId: string, label: string): string;
    } | null;
  }
}

async function main() {
  window['MonacoEnvironment'] = {
    getWorkerUrl(_moduleId: string, label: string) {
      if (label === 'json') {
        return './json.worker.bundle.js';
      }
      if (label === 'css') {
        return './css.worker.bundle.js';
      }
      if (label === 'html') {
        return './html.worker.bundle.js';
      }
      if (label === 'typescript' || label === 'javascript') {
        return './ts.worker.bundle.js';
      }
      return './editor.worker.bundle.js';
    },
  };

  // We have to specify a LanguageConfiguration for Hack before we can register
  // a tokens provider for it.
  const hackLanguageIdForMonaco = 'hack';
  monaco.languages.register({
    id: hackLanguageIdForMonaco,
    extensions: ['.php'],
  });

  // Apparently we have to tell Monaco about Smarty, as well.
  const smartyLanguageIdForMonaco = 'smarty';
  monaco.languages.register({
    id: smartyLanguageIdForMonaco,
    extensions: ['.tpl'],
  });

  // Note that Hack lists text.html.basic as an embedded grammar, so we must
  // provide that grammar (and all of its transitive deps) as well.
  //
  // [language, scopeName, textMateGrammarURL]
  const grammars = [
    ['css', 'source.css', '/grammars/css.plist'],
    [hackLanguageIdForMonaco, 'source.hack', '/grammars/hack.json'],
    ['html', 'text.html.basic', '/grammars/html.json'],
    ['javascript', 'source.js', '/grammars/JavaScript.tmLanguage.json'],
    ['python', 'source.python', '/grammars/MagicPython.tmLanguage.json'],
    [smartyLanguageIdForMonaco, 'source.smarty', '/grammars/smarty.tmLanguage.json'],
    ['sql', 'source.sql', '/grammars/SQL.plist'],
  ];
  const scopeNameToTextMateGrammarURL: Map<string, string> = new Map(
    grammars.map(([, scopeName, textMateGrammarURL]) => [scopeName, textMateGrammarURL]),
  );
  const grammarStore = await createGrammarStore(scopeNameToTextMateGrammarURL);

  for (const [language, scopeName] of grammars) {
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
