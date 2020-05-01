import type * as monaco from 'monaco-editor';
import type {IGrammar, IRawGrammar, StackElement} from 'vscode-textmate';

import {createOnigScanner, createOnigString, loadWASM} from 'vscode-oniguruma';
import {INITIAL, Registry, parseRawGrammar} from 'vscode-textmate';
type IState = monaco.languages.IState;

import DEFAULT_THEME from './dark_vs';

export async function createGrammarStore(
  scopeNameToTextMateGrammarURL: Map<string, string>,
): Promise<GrammarStore> {
  const registry = await createRegistry(scopeNameToTextMateGrammarURL);
  return new GrammarStore(registry);
}

export class GrammarStore {
  private scopeNameToGrammar: Map<string, Promise<IGrammar | null>> = new Map();

  constructor(private registry: Registry) {}

  // This does not seem to work. Note VS Code does not appear to be going this route.
  async createTokensProvider(scopeName: string): Promise<monaco.languages.TokensProvider> {
    const grammar = await this.getGrammar(scopeName);
    if (grammar == null) {
      throw Error(`no grammar for ${scopeName}`);
    }

    return {
      getInitialState(): IState {
        return INITIAL;
      },

      tokenize(line: string, state: IState): monaco.languages.ILineTokens {
        const lineTokens = grammar.tokenizeLine(line, <StackElement>state);
        const {tokens, ruleStack} = lineTokens;
        // @ts-ignore: probably should not be ignoring this
        return {tokens, endState: ruleStack};
      },
    };
  }

  // https://github.com/NeekSandhu/monaco-editor-textmate/issues/11#issuecomment-561984387
  // provides some insight as to why this isn't working.
  async createEncodedTokensProvider(
    scopeName: string,
  ): Promise<monaco.languages.EncodedTokensProvider> {
    const grammar = await this.getGrammar(scopeName);
    if (grammar == null) {
      throw Error(`no grammar for ${scopeName}`);
    }

    return {
      getInitialState(): IState {
        return INITIAL;
      },

      tokenizeEncoded(line: string, state: IState): monaco.languages.IEncodedLineTokens {
        // It looks like src/vs/editor/standalone/common/monarch/monarchLexer.ts
        // does a check to see whether state.embeddedModeData is set, and if so,
        // performs slightly different logic?

        const tokenizeLineResult2 = grammar.tokenizeLine2(line, <StackElement>state);
        const endState = <IState>tokenizeLineResult2.ruleStack;
        const {tokens} = tokenizeLineResult2;
        // convertToEndOffset(tokens, line.length);
        return {tokens, endState};
      },
    };
  }

  async getGrammar(scopeName: string): Promise<IGrammar | null> {
    const grammar = this.scopeNameToGrammar.get(scopeName);
    if (grammar != null) {
      return grammar;
    }

    const promise = this.registry.loadGrammar(scopeName);
    this.scopeNameToGrammar.set(scopeName, promise);
    return promise;
  }
}

async function createRegistry(
  scopeNameToTextMateGrammarURL: Map<string, string>,
): Promise<Registry> {
  const data: ArrayBuffer | Response = await loadVSCodeOnigurumWASM();
  loadWASM(data);

  return new Registry({
    onigLib: Promise.resolve({
      createOnigScanner,
      createOnigString,
    }),
    async loadGrammar(scopeName: string): Promise<IRawGrammar | undefined | null> {
      const url = scopeNameToTextMateGrammarURL.get(scopeName);
      if (url == null) {
        throw Error(`no URL for ${scopeName}`);
      }

      const response = await fetch(url);
      if (response.ok) {
        const content = await response.text();
        // If this is a JSON grammar, filePath must be specified with a `.json`
        // file extension or else parseRawGrammar() will assume it is a PLIST
        // grammar.
        const match = url.match(/\/([^\/]+\.json)$/);
        const filePath = match && match != null ? match[1] : undefined;
        return parseRawGrammar(content, filePath);
      }

      throw Error(`request to ${url} failed: ${response}`);
    },
    theme: DEFAULT_THEME,
  });
}

// Taken from https://github.com/microsoft/vscode/blob/829230a5a83768a3494ebbc61144e7cde9105c73/src/vs/workbench/services/textMate/browser/textMateService.ts#L33-L40
async function loadVSCodeOnigurumWASM(): Promise<Response | ArrayBuffer> {
  const response = await fetch('/node_modules/vscode-oniguruma/release/onig.wasm');
  const contentType = response.headers.get('content-type');
  if (contentType === 'application/wasm') {
    return response;
  }

  // Using the response directly only works if the server sets the MIME type 'application/wasm'.
  // Otherwise, a TypeError is thrown when using the streaming compiler.
  // We therefore use the non-streaming compiler :(.
  return await response.arrayBuffer();
}

// Found this function in vscode/src/vs/editor/common/model/textModelTokens.ts.
function convertToEndOffset(tokens: Uint32Array, lineTextLength: number): void {
  const tokenCount = tokens.length >>> 1;
  const lastTokenIndex = tokenCount - 1;
  for (let tokenIndex = 0; tokenIndex < lastTokenIndex; tokenIndex++) {
    tokens[tokenIndex << 1] = tokens[(tokenIndex + 1) << 1];
  }
  tokens[lastTokenIndex << 1] = lineTextLength;
}
