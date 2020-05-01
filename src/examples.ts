export type SupportedLanguage = keyof typeof examples;

const examples = {
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

export function getSampleCodeForLanguage(language: keyof typeof examples): string {
  return examples[language];
}
