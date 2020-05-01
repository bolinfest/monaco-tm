# monaco-tm

This gets TextMate grammars working in standalone Monaco by leveraging
`vscode-oniguruma` and `vscode-textmate`. For more context, see:
https://github.com/microsoft/monaco-editor/issues/1915.

## Run demo

- `yarn install`
- `yarn demo`
- open http://localhost:8084/

This shows off the Hack grammar working by default, as it is a language for
which a TextMate grammar exists, but no Monarch grammar.
