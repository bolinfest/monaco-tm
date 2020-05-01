# monaco-tm

This attempts to get TextMate grammars working in standalne Monaco by leveraging
`vscode-oniguruma` and `vscode-textmate`. For more context, see:
https://github.com/microsoft/monaco-editor/issues/1915.

## Run demo

- `yarn install`
- `yarn demo`
- open http://localhost:8084/

## Status

Currently, I am trying to use this to verify I can get the Hack grammar working
in standalone Monaco. Unfortunately, it is not working yet.

To try other languages, play with `options` at the bottom of `app.ts`.

I also took a brief look at:

- https://github.com/NeekSandhu/monaco-textmate
- https://github.com/NeekSandhu/monaco-editor-textmate

I believe that demo reimplements some of what `vscode-textmate` provides.
I would prefer to have something as close to the VS Code implementation as
possible.
