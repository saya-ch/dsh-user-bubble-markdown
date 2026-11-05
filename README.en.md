# Markdown in Sent Messages

A plugin for the agent harness Web GUI that renders Markdown inside your own sent message bubbles.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/saya-ch/dsh-user-bubble-markdown/actions/workflows/ci.yml/badge.svg)](https://github.com/saya-ch/dsh-user-bubble-markdown/actions/workflows/ci.yml)

## What it does

In the agent harness Web GUI, model replies are rendered as Markdown, but the messages you send are displayed as plain text inside their bubbles. This plugin replaces the plain-text renderer for those bubbles, so Markdown in your own messages appears as formatted text.

Only the browser presentation layer is affected. The plugin does not write to sessions, does not change configuration, and does not touch model context. It is a local bundle with no runtime dependencies and no build step: the Host half is a minimal `apply()`, and the Client half is self-contained.

## Features

- Renders the Markdown syntax listed under [Supported syntax](#supported-syntax) inside sent message bubbles.
- Uses the official keyed Slot extension point instead of DOM scanning, so the bubble shell, image and file attachments, conversation reference chips, and the copy and edit controls stay with the host unchanged.
- Text is escaped by React, links are checked against a protocol allowlist, and long or unsafe content falls back to plain text.
- Colors come from `--dsw-alias-*` theme tokens with conservative fallbacks; no palette is hard-coded.
- Optional settings: `mode`, `taskLists`, `codeCopy`, `autolink`.
- Zero runtime dependencies, zero build step.

## Installation

Install from a local directory into the web profile:

```sh
dsh plugin --profile web add "link:<absolute path>"
```

Replace `<absolute path>` with the absolute path to this repository. The same operation is available as "Install from local directory" on the plugins page of the agent harness.

An optional alternative source after publication is `github:saya-ch/dsh-user-bubble-markdown` (not verified on the maintainer's machine).

After editing the source, restart the agent harness and refresh the page so the new renderer is loaded.

## Configuration

Settings are optional and live under the `config` key of the bundle entry in `cordis.patch.yml`. All values have defaults.

| Key | Type / values | Default | Effect |
| --- | --- | --- | --- |
| `mode` | `full` \| `inline` \| `off` | `full` | Selects the rendering mode. |
| `taskLists` | boolean | `true` | Enables GFM task lists. |
| `codeCopy` | boolean | `true` | Enables the copy button on fenced code blocks. |
| `autolink` | boolean | `true` | Enables automatic linking of bare URLs. |

`mode: full` renders both block and inline syntax. `mode: inline` renders inline syntax only and shows block-level content as ordinary text with line breaks. `mode: off` does not register the renderer at all, fully restoring the host's plain-text behavior.

## Supported syntax

| Syntax | Behavior |
| --- | --- |
| Headings `h1`–`h6` | Distinguished by weight only; font size is deliberately not enlarged inside a bubble. |
| Paragraphs | Rendered as paragraphs. |
| Ordered and unordered lists | Rendered as lists. |
| GFM task lists `- [ ]` / `- [x]` | Rendered as read-only checkboxes. |
| Fenced code blocks | Shown with a language label and a one-click copy button. |
| Inline code | Rendered as inline code. |
| Blockquotes | Rendered as blockquotes. |
| Horizontal rules | Rendered as horizontal rules. |
| Tables | Column alignment via `:---`, `:---:`, `---:`. |
| Links `[text](url)` | Open in a new tab. |
| Bare URLs | Automatically linked. |
| Bold, italic, strikethrough | Rendered as emphasis. |
| Image syntax | Degraded to a link. |

Block-level containers use `inline-block` and `fit-content`, so formatted content does not stretch the bubble to full width.

## How it works

The plugin registers and overrides the `text` renderer of the official `conversation.user.text.node` keyed Slot at priority 50; the official renderer sits at priority 100, so the lower number takes precedence and replaces the plain-text renderer. It does not register `conversation.chat.node`, does not use a `MutationObserver` or DOM scanning, and does not inject `innerHTML`.

Because only that renderer is replaced, the host keeps ownership of the bubble shell, attachments, reference chips, and the copy and edit controls. All nodes are React elements created with `React.createElement`, and text is escaped by React.

Links are checked against a protocol allowlist (`http`, `https`, `mailto`, `tel`, relative paths, and `#` fragments); `javascript:` and `data:` URLs are reduced to plain text. Messages longer than 20000 characters also fall back to plain text.

## Related work

[towardsdawn/dsh-user-markdown](https://github.com/towardsdawn/dsh-user-markdown) (MIT) is a community plugin with the same goal. It uses a `MutationObserver` to scan the DOM and skips messages that contain reference chips or attachments. This repository is an independent implementation, not a fork: it replaces a keyed Slot renderer instead of observing the DOM. The difference is in the extension mechanism; the two codebases are otherwise separate.

## Limitations

- Only the syntax listed above is rendered. Image syntax becomes a link and task-list checkboxes are read-only.
- Messages longer than 20000 characters and links with disallowed protocols fall back to plain text.
- The plugin affects only the browser presentation layer of the Web GUI.

## Development and tests

```sh
npm install
npm run check
npm test
```

`npm run check` runs `node --check client.js && node --check index.js`. `npm test` runs `node tests/render.test.cjs`, an offline renderer test using `react-dom/server`. The same two checks run in CI on pushes to `main` and on pull requests.

Recorded verification consists of the offline renderer test and the JS syntax check. The plugin has been installed and enabled in the official Desktop profile of the agent harness 0.2.2-rc.1 on the maintainer's machine.

## Credits

`icon.svg` uses the official Markdown "M↓" mark path from [Simple Icons](https://simpleicons.org/?q=markdown), released under CC0 1.0 (public domain). The outer frame is removed and a blue rounded background is added. The unmodified original is kept at `assets/markdown-simple-icons.svg`.

## License

MIT. See [LICENSE](LICENSE).

For the Chinese documentation, see [README.md](README.md).
