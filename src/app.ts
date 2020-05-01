import type {SupportedLanguage} from './examples';

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
import {getSampleCodeForLanguage} from './examples';

type GrammarConfiguration = {language: string; scopeName: string; url: string};

main('hack');

async function main(language: SupportedLanguage) {
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

  await registerEncodedTokensProviders(grammarConfigurations);

  const value = getSampleCodeForLanguage(language);
  monaco.editor.create(nullthrows(document.getElementById('container')), {
    value,
    language,
    theme: 'vs', // 'vs' or 'vs-dark' should both work here
    minimap: {
      enabled: false,
    },
  });
}

async function registerEncodedTokensProviders(grammarConfigurations: GrammarConfiguration[]) {
  const scopeNameToTextMateGrammarURL: Map<string, string> = new Map(
    grammarConfigurations.map(({scopeName, url}) => [scopeName, url]),
  );
  const grammarStore = await createGrammarStore(scopeNameToTextMateGrammarURL);

  for (const {language, scopeName} of grammarConfigurations) {
    const tokensProvider = await grammarStore.createEncodedTokensProvider(scopeName);
    monaco.languages.setTokensProvider(language, tokensProvider);
  }
}
