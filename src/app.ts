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

// From monaco-editor-textmate README.
import {Registry} from 'monaco-textmate';
import {wireTmGrammars} from 'monaco-editor-textmate';
import {loadWASM} from 'onigasm';

type GrammarConfiguration = {language: string; scopeName: string; url: string};

const useEncodedTokens = false;
main(useEncodedTokens, 'hack');

const testOptions = {
  hack: `<?hh // strict

type SomeShape = shape(
  'frame_type' => FrameType,
  ?'commit_id' => ?string,
);

abstract final class ClassDefWithLotsOfKeywords {
  const int BIG_NUMBER = 30000000;

  public static async function genRender(): Awaitable<Stuff> {
    return <xhp:div>
      hello world
    </xhp:div>;
  }
}
`,
  html: `<!DOCTYPE HTML>
<html>
<head>
</head>
<body>
</body>
</html>
`,
  javascript: `\
const React = require('react');

function create() {
  return (
    <div>
      hello world
    </div>
  );
}
`,
  python: `\
import foo

async def bar(): string:
  f = await foo()
  f_string = f"Hooray {f}! format strings are not supported in current Monarch grammar"
  return foo_string
`,
};

async function main(useEncodedTokens: boolean, testLanguage: keyof typeof testOptions) {
  // Note that Hack lists text.html.basic as an embedded grammar, so we must
  // provide that grammar (and all of its transitive deps) as well.
  //
  // This sort of looks like:
  // https://github.com/microsoft/vscode-textmate/blob/0730e8ef740d87401764d76e9193f74c6f458b37/test-cases/themes/grammars.json
  const grammarConfigurations: GrammarConfiguration[] = [
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

  if (useEncodedTokens) {
    await tryEncodedTokensProvider(grammarConfigurations);
  } else {
    await tryMonacoEditorTextMate(grammarConfigurations);
  }

  const value = testOptions[testLanguage];

  const theme = 'hackTheme';
  defineTheme(theme);
  monaco.editor.create(nullthrows(document.getElementById('container')), {
    value,
    language: testLanguage,
    theme,
    minimap: {
      enabled: false,
    },
  });
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

async function tryEncodedTokensProvider(grammarConfigurations: GrammarConfiguration[]) {
  const scopeNameToTextMateGrammarURL: Map<string, string> = new Map(
    grammarConfigurations.map(({scopeName, url}) => [scopeName, url]),
  );
  const grammarStore = await createGrammarStore(scopeNameToTextMateGrammarURL);

  for (const {language, scopeName} of grammarConfigurations) {
    // const tokensProvider = await grammarStore.createTokensProvider(scopeName);
    const tokensProvider = await grammarStore.createEncodedTokensProvider(scopeName);
    monaco.languages.setTokensProvider(language, tokensProvider);
  }

  // Although the web demo doesn't work, this seems to have sensible output.
  await tryCodeOnVSCodeTextMateReadme(grammarStore);
}

function defineTheme(name: string): void {
  // This code is ported from this playground:
  // https://microsoft.github.io/monaco-editor/playground.html#customizing-the-appearence-tokens-and-colors
  // It seems to work there, so we ignore these errors.
  // @ts-ignore
  monaco.editor.defineTheme(name, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      {token: 'constant.numeric', foreground: 'B5CEA8'},
      {token: 'constant.other', foreground: 'D4D4D4'},
      {token: 'keyword.operator.comparison', foreground: 'D4D4D4'},
      {token: 'entity.name.function', foreground: 'DCDCAA'},
      {token: 'entity.name.tag', foreground: '569CD6'},
      {token: 'entity.name.type', foreground: '4EC9B0'},
      {token: 'storage.modifier', foreground: '569CD6'},
      {token: 'storage.type', foreground: '569CD6'},
      {token: 'support.class', foreground: '4EC9B0'},

      // Multiple comment defs necessary?
      {token: 'comment', foreground: '6A9955'},
      {token: 'punctuation.definition.comment', foreground: '6A9955'},

      // Multiple string defs necessary?
      {token: 'string', foreground: 'CE9178'},
      {token: 'string.quoted.single', foreground: 'CE9178'},
      {token: 'meta.string-contents.quoted.single', foreground: 'CE9178'},
      {token: 'punctuation.definition.string', foreground: 'CE9178'},

      // Multiple variable defs necessary?
      {token: 'punctuation.definition.variable', foreground: '9CDCFE'},
      {token: 'variable', foreground: '9CDCFE'},
    ],
  });
}

// Adapted from the README for monaco-editor-textmate.
async function tryMonacoEditorTextMate(grammarConfigurations: GrammarConfiguration[]) {
  await loadWASM('/node_modules/onigasm/lib/onigasm.wasm');

  const registry = new Registry({
    getGrammarDefinition: async (scopeName) => {
      const config = grammarConfigurations.find((config) => config.scopeName === scopeName);
      if (config == null) {
        throw Error(`no URL for ${scopeName}`);
      }

      const {url} = config;
      const format = url.endsWith('.json') ? 'json' : 'plist';
      return {
        format,
        content: await (await fetch(url)).text(),
      };
    },
  });

  const grammars = new Map(
    grammarConfigurations.map(({language, scopeName}) => [language, scopeName]),
  );

  await wireTmGrammars(monaco, registry, grammars);
}
