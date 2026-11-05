# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-06

### Added

- Initial public release of `@local/user-bubble-markdown` 1.0.0.
- Markdown rendering for sent user message bubbles by overriding the `text` renderer of the official `conversation.user.text.node` keyed Slot at priority 50.
- Supported syntax: headings, paragraphs, ordered and unordered lists, GFM task lists, fenced code blocks with a copy button, inline code, blockquotes, horizontal rules, tables with column alignment, links, bare-URL autolinks, bold, italic and strikethrough; image syntax renders as a link.
- Safety handling: a link protocol allowlist, React-escaped text without `innerHTML`, and a plain-text fallback for messages longer than 20000 characters.
- Colors from `--dsw-alias-*` theme tokens with conservative fallbacks; block containers sized with `inline-block` and `fit-content`.
- Optional bundle settings in `cordis.patch.yml`: `mode` (`full` / `inline` / `off`), `taskLists`, `codeCopy`, `autolink`.
- English and Chinese locale metadata (`locale/en.json`, `locale/zh.json`).
- Offline renderer tests (`tests/render.test.cjs`, `react-dom/server`), `npm run check` syntax checks, and a GitHub Actions workflow for pushes to `main` and pull requests.
- MIT license, English README, and changelog.
