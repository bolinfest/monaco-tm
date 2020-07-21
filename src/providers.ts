import type * as monaco from 'monaco-editor';
type Monaco = typeof monaco;
import type {IGrammar, IRawGrammar, IRawTheme, IOnigLib, StackElement} from 'vscode-textmate';
import type {LanguageId, LanguageInfo} from './register';

import {INITIAL, Registry, parseRawGrammar} from 'vscode-textmate';
// @ts-ignore
import {generateTokensCSSForColorMap} from 'monaco-editor/esm/vs/editor/common/modes/supports/tokenization.js';

/** String identifier for a "scope name" such as 'source.cpp' or 'source.java'. */
type ScopeName = string;

export type SimpleLanguageInfoProviderManifest = {
  baseResourceURI: string;
  // Key is a ScopeName.
  grammars: {[scopeName: string]: ScopeNameInfo};
  configurations: LanguageId[];
  // This must be available synchronously to the SimpleLanguageInfoProvider
  // constructor, so the user is responsible for fetching the theme data rather
  // than SimpleLanguageInfoProvider.
  theme: IRawTheme;
};

type ScopeNameInfo = {
  /**
   * If set, this is the id of an ILanguageExtensionPoint. This establishes the
   * mapping from a MonacoLanguage to a TextMate grammar.
   */
  language?: LanguageId;

  /**
   * Scopes that are injected *into* this scope. For example, the
   * `text.html.markdown` scope likely has a number of injections to support
   * fenced code blocks.
   */
  injections?: ScopeName[];

  /** Relative to baseResourceURI: should end in '.plist' or '.json'. */
  path: string;
};

/**
 * Basic provider to implement the fetchLanguageInfo() function needed to
 * power registerLanguages(). It is designed to fetch all resources
 * asynchronously based on a simple layout of static resources on the server.
 */
export class SimpleLanguageInfoProvider {
  private registry: Registry;
  private tokensProviderCache: TokensProviderCache;

  constructor(
    private manifest: SimpleLanguageInfoProviderManifest,
    oniguruma: Promise<IOnigLib>,
    private monaco: Monaco,
  ) {
    const {baseResourceURI, grammars, theme} = manifest;
    this.registry = new Registry({
      onigLib: oniguruma,

      async loadGrammar(scopeName: ScopeName): Promise<IRawGrammar | null> {
        const scopeNameInfo = grammars[scopeName];
        if (scopeNameInfo == null) {
          return null;
        }

        const {path} = scopeNameInfo;
        const uri = `${baseResourceURI}/grammars/${path}`;
        const response = await fetch(uri);
        const grammar = await response.text();
        // If this is a JSON grammar, filePath must be specified with a `.json`
        // file extension or else parseRawGrammar() will assume it is a PLIST
        // grammar.
        return parseRawGrammar(grammar, path);
      },

      /**
       * For the given scope, returns a list of additional grammars that should be
       * "injected into" it (i.e., a list of grammars that want to extend the
       * specified `scopeName`). The most common example is other grammars that
       * want to "inject themselves" into the `text.html.markdown` scope so they
       * can be used with fenced code blocks.
       *
       * In the manifest of a VS Code extension, a grammar signals that it wants
       * to do this via the "injectTo" property:
       * https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#injection-grammars
       */
      getInjections(scopeName: ScopeName): string[] | undefined {
        const grammar = grammars[scopeName];
        return grammar ? grammar.injections : undefined;
      },

      // Note that nothing will display without the theme!
      theme,
    });

    this.tokensProviderCache = new TokensProviderCache(this.registry);
  }

  /**
   * Be sure this is done after Monaco injects its default styles so that the
   * injected CSS overrides the defaults.
   */
  injectCSS() {
    const colorMap = this.registry.getColorMap();
    const css = generateTokensCSSForColorMap(colorMap);
    const style = createStyleElementForColorsCSS();
    style.innerHTML = css;
  }

  async fetchLanguageInfo(language: LanguageId): Promise<LanguageInfo> {
    const [tokensProvider, configuration] = await Promise.all([
      this.getTokensProviderForLanguage(language),
      this.getConfigurationForLanguage(language),
    ]);
    return {tokensProvider, configuration};
  }

  private async getConfigurationForLanguage(
    language: LanguageId,
  ): Promise<monaco.languages.LanguageConfiguration | null> {
    const uri = `${this.manifest.baseResourceURI}/configurations/${language}.json`;
    const response = await fetch(uri);
    const rawConfiguration = await response.text();
    return rehydrateRegexps(rawConfiguration);
  }

  private getTokensProviderForLanguage(
    language: string,
  ): Promise<monaco.languages.EncodedTokensProvider | null> {
    const scopeName = this.getScopeNameForLanguage(language);
    if (scopeName == null) {
      return Promise.resolve(null);
    }

    const encodedLanguageId = this.monaco.languages.getEncodedLanguageId(language);
    // Ensure the result of createEncodedTokensProvider() is resolved before
    // setting the language configuration.
    return this.tokensProviderCache.createEncodedTokensProvider(scopeName, encodedLanguageId);
  }

  private getScopeNameForLanguage(language: string): string | null {
    for (const [scopeName, grammar] of Object.entries(this.manifest.grammars)) {
      if (grammar.language === language) {
        return scopeName;
      }
    }
    return null;
  }
}

class TokensProviderCache {
  private scopeNameToGrammar: Map<string, Promise<IGrammar>> = new Map();

  constructor(private registry: Registry) {}

  async createEncodedTokensProvider(
    scopeName: string,
    encodedLanguageId: number,
  ): Promise<monaco.languages.EncodedTokensProvider> {
    const grammar = await this.getGrammar(scopeName, encodedLanguageId);

    return {
      getInitialState() {
        return INITIAL;
      },

      tokenizeEncoded(
        line: string,
        state: monaco.languages.IState,
      ): monaco.languages.IEncodedLineTokens {
        const tokenizeLineResult2 = grammar.tokenizeLine2(line, state as StackElement);
        const {tokens, ruleStack: endState} = tokenizeLineResult2;
        return {tokens, endState};
      },
    };
  }

  getGrammar(scopeName: string, encodedLanguageId: number): Promise<IGrammar> {
    const grammar = this.scopeNameToGrammar.get(scopeName);
    if (grammar != null) {
      return grammar;
    }

    // This is defined in vscode-textmate and has optional embeddedLanguages
    // and tokenTypes fields that might be useful/necessary to take advantage of
    // at some point.
    const grammarConfiguration = {};
    // We use loadGrammarWithConfiguration() rather than loadGrammar() because
    // we discovered that if the numeric LanguageId is not specified, then it
    // does not get encoded in the TokenMetadata.
    //
    // Failure to do so means that the LanguageId cannot be read back later,
    // which can cause other Monaco features, such as "Toggle Line Comment",
    // to fail.
    const promise = this.registry
      .loadGrammarWithConfiguration(scopeName, encodedLanguageId, grammarConfiguration)
      .then((grammar: IGrammar | null) => {
        if (grammar) {
          return grammar;
        } else {
          throw Error(`failed to load grammar for ${scopeName}`);
        }
      });
    this.scopeNameToGrammar.set(scopeName, promise);
    return promise;
  }
}

function createStyleElementForColorsCSS(): HTMLStyleElement {
  // We want to ensure that our <style> element appears after Monaco's so that
  // we can override some styles it inserted for the default theme.
  const style = document.createElement('style');

  // We expect the styles we need to override to be in an element with the class
  // name 'monaco-colors' based on:
  // https://github.com/microsoft/vscode/blob/f78d84606cd16d75549c82c68888de91d8bdec9f/src/vs/editor/standalone/browser/standaloneThemeServiceImpl.ts#L206-L214
  const monacoColors = document.getElementsByClassName('monaco-colors')[0];
  if (monacoColors) {
    monacoColors.parentElement?.insertBefore(style, monacoColors.nextSibling);
  } else {
    // Though if we cannot find it, just append to <head>.
    let {head} = document;
    if (head == null) {
      head = document.getElementsByTagName('head')[0];
    }
    head?.appendChild(style);
  }
  return style;
}

/**
 * Fields that, if present in a LanguageConfiguration, must be a RegExp object
 * rather than a string literal.
 */
const REGEXP_PROPERTIES = [
  // indentation
  'indentationRules.decreaseIndentPattern',
  'indentationRules.increaseIndentPattern',
  'indentationRules.indentNextLinePattern',
  'indentationRules.unIndentedLinePattern',

  // code folding
  'folding.markers.start',
  'folding.markers.end',

  // language's "word definition"
  'wordPattern',
];

/**
 * Configuration data is read from JSON and JSONC files, which cannot contain
 * regular expression literals. Although Monarch grammars will often accept
 * either the source of a RegExp as a string OR a RegExp object, certain Monaco
 * APIs accept only a RegExp object, so we must "rehydrate" those, as appropriate.
 *
 * It would probably save everyone a lot of trouble if we updated the APIs to
 * accept a RegExp or a string literal. Possibly a small struct if flags need
 * to be specified to the RegExp constructor.
 */
function rehydrateRegexps(rawConfiguration: string): monaco.languages.LanguageConfiguration {
  const out = JSON.parse(rawConfiguration);
  for (const property of REGEXP_PROPERTIES) {
    const value = getProp(out, property);
    if (typeof value === 'string') {
      setProp(out, property, new RegExp(value));
    }
  }
  return out;
}

function getProp(obj: {string: any}, selector: string): any {
  const components = selector.split('.');
  // @ts-ignore
  return components.reduce((acc, cur) => (acc != null ? acc[cur] : null), obj);
}

function setProp(obj: {string: any}, selector: string, value: RegExp): void {
  const components = selector.split('.');
  const indexToSet = components.length - 1;
  components.reduce((acc, cur, index) => {
    if (acc == null) {
      return acc;
    }

    if (index === indexToSet) {
      // @ts-ignore
      acc[cur] = value;
      return null;
    } else {
      // @ts-ignore
      return acc[cur];
    }
  }, obj);
}
