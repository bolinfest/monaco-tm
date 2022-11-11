# monaco-tm

![TypeScript build](https://github.com/bolinfest/monaco-tm/actions/workflows/verify-build.yml/badge.svg)

This gets TextMate grammars working in standalone Monaco by leveraging
`vscode-oniguruma` and `vscode-textmate`. For more context, see:
https://github.com/microsoft/monaco-editor/issues/1915.

## Run demo

- `yarn install`
- `yarn demo`
- open http://localhost:8084/

Currently, only the Python grammar and VS Code Dark+ themes are included in the
demo.
