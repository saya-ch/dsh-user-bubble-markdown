/**
 * Renderer tests: load client.js with a fake ModuleLoader, capture the Slot
 * renderer it registers, and render samples through react-dom/server.
 *
 * No browser and no running DSH instance are required.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

const source = fs.readFileSync(path.join(__dirname, '..', 'client.js'), 'utf8');

function load(config) {
  let spec = null;
  const fakeRequire = name => {
    if (name === 'react') return React;
    throw new Error('unexpected require: ' + name);
  };
  const sandbox = {
    window: { __ModuleLoader__: { load: s => { spec = s; } } },
    require: fakeRequire,
    console,
  };
  vm.runInNewContext(source, sandbox, { filename: 'client.js' });
  if (!spec || spec.id !== '@local/user-bubble-markdown') {
    throw new Error('client.js did not register the expected module id');
  }
  const plugin = spec.factory(fakeRequire);
  let component = null;
  let registration = null;
  const ctx = {
    slots: {
      inject(name, callback) {
        if (name !== 'conversation.user.text.node') {
          throw new Error('wrong slot: ' + name);
        }
        callback();
        return () => {};
      },
      register(options, comp) {
        registration = options;
        component = comp;
        return () => {};
      },
    },
  };
  plugin.apply(ctx, config);
  return {
    registration,
    hasRenderer: () => component !== null,
    render(raw) {
      if (!component) return '';
      return ReactDOMServer.renderToStaticMarkup(
        React.createElement(component, { raw, node: { data: { text: raw } } })
      );
    },
  };
}

let failed = 0;
function expectHtml(name, runner, text, expect, reject) {
  const html = runner.render(text);
  const missing = expect.filter(s => !html.includes(s));
  const leaked = (reject || []).filter(s => html.includes(s));
  const ok = missing.length === 0 && leaked.length === 0;
  if (!ok) failed += 1;
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) {
    console.log('  missing: ' + JSON.stringify(missing) + ' leaked: ' + JSON.stringify(leaked));
    console.log('  html: ' + html.slice(0, 700));
  }
}
function expectTrue(name, condition, detail) {
  if (!condition) failed += 1;
  console.log((condition ? 'PASS' : 'FAIL') + ' - ' + name + (condition ? '' : ' (' + detail + ')'));
}

const full = load({ mode: 'full' });
expectTrue('registers the text renderer at a lower priority',
  full.registration && full.registration.key === 'text' && full.registration.priority < 100,
  JSON.stringify(full.registration));

expectHtml('inline formatting', full,
  '**粗体** 和 *斜体* 与 `code` 以及 [链接](https://example.com)',
  ['<strong', '<em', '<code', 'href="https://example.com"', 'data-user-bubble-markdown="inline"']);

expectHtml('block markdown with fenced code', full,
  '# 标题\n\n- 第一项\n- 第二项\n\n```js\nconst a = 1;\n```\n\n> 引用文本',
  ['<h1', '<ul', '<li', '<pre', '<blockquote', '<button', '>js<',
    'data-user-bubble-markdown="block"']);

expectHtml('table with column alignment', full,
  '| 列 A | 列 B |\n| :--- | ---: |\n| 1 | 2 |',
  ['<table', '<th', '<td', 'text-align:left', 'text-align:right']);

expectHtml('unsafe URLs are downgraded to text', full,
  '[点我](javascript:alert(1)) 与 ![图](data:text/html,x)',
  ['点我'], ['href="javascript', 'href="data:']);

expectHtml('plain text stays a compact inline span', full,
  '你好，世界',
  ['你好，世界', 'data-user-bubble-markdown="inline"'], ['<div']);

expectHtml('restrained block styling', full,
  '## 小标题\n\n- 一项\n\n```js\nconst x = 1;\n```',
  ['<h2', '<ul', '<pre', 'display:inline-block', 'font-size:1em'],
  ['font-size:1.25em', 'display:block']);

expectHtml('GFM task lists render read-only checkboxes', full,
  '- [ ] 待办\n- [x] 完成',
  ['type="checkbox"', 'checked=""', 'Completed', 'Not completed']);

expectHtml('bare URLs are linkified', full,
  '见 https://example.com/docs 这里',
  ['href="https://example.com/docs"']);

expectHtml('stray pipe line keeps its content', full,
  '| 不是表格',
  ['不是表格']);

expectHtml('oversized text falls back to plain text', full,
  'a'.repeat(20001),
  ['data-user-bubble-markdown="plain"'], ['<div', '<table']);

const inline = load({ mode: 'inline' });
expectHtml('mode=inline keeps block markers as text', inline,
  '## 标题\n\n- 项目\n\n```js\nx\n```',
  ['## 标题', 'data-user-bubble-markdown="inline"'], ['<h2', '<ul', '<pre']);

const off = load({ mode: 'off' });
expectTrue('mode=off registers nothing', !off.hasRenderer(), 'renderer was registered');

const noCopy = load({ mode: 'full', codeCopy: false });
expectHtml('codeCopy=false hides the copy button', noCopy,
  '```js\nx\n```',
  ['>js<', '<pre'], ['<button']);

const noAutolink = load({ mode: 'full', autolink: false });
expectHtml('autolink=false leaves bare URLs as text', noAutolink,
  '见 https://example.com/docs 这里',
  ['https://example.com/docs'], ['href="https://example.com/docs"']);

console.log(failed === 0 ? 'ALL PASS' : failed + ' FAILED');
process.exit(failed === 0 ? 0 : 1);
