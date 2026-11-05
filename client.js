/**
 * Client half: render the Markdown text of a sent user message inside its bubble.
 *
 * The shipped Conversation Factory splits a user message into inline "text"
 * nodes and dispatches them to the `conversation.user.text.node` keyed Slot.
 * We replace only that Slot's `text` renderer with a lower priority, so the
 * bubble chrome, attachments, reference chips, copy and edit actions stay
 * exactly as the host renders them. We never register `conversation.chat.node`,
 * never scan the DOM and never inject HTML.
 *
 * No HTML is injected: every node is a React element built from plain text,
 * and links are limited to safe protocols. Theme tokens provide every colour.
 */
window.__ModuleLoader__.load({
  id: '@local/user-bubble-markdown',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Cascadia Mono", monospace';
    const LINE = 'var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.32))';
    const STRONG_LINE = 'var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.55))';
    const ACCENT = 'var(--dsw-alias-brand-primary, #247bbf)';
    const MUTED = 'var(--dsw-alias-label-secondary, inherit)';
    // Derive a very light tint from the current text colour so inline code is
    // not a stark white box on the tinted user bubble, in either theme.
    const SOFT_FILL = 'color-mix(in srgb, var(--dsw-alias-label-primary, #333) 7%, transparent)';
    const SOFT_LINE = 'color-mix(in srgb, var(--dsw-alias-label-primary, #333) 14%, transparent)';

    const PLAIN_STYLE = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
    // Shrink-wrap block content instead of stretching the bubble to full width.
    const ROOT_STYLE = {
      display: 'inline-block', width: 'fit-content', maxWidth: '100%',
      verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word',
      lineHeight: 'inherit',
    };
    const P_STYLE = {
      margin: '0 0 3px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 'inherit',
    };
    const CODE_STYLE = {
      fontFamily: MONO, fontSize: '0.94em', padding: '0 3px', borderRadius: '3px',
      background: SOFT_FILL,
    };
    const CODE_WRAP_STYLE = {
      margin: '0 0 4px', border: '1px solid ' + SOFT_LINE, borderRadius: '5px',
      overflow: 'hidden', background: SOFT_FILL, width: 'fit-content', maxWidth: '100%',
    };
    const CODE_HEADER_STYLE = {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '2px 6px', fontSize: '0.8em', color: MUTED,
      borderBottom: '1px solid ' + SOFT_LINE,
    };
    const CODE_LANG_STYLE = { fontFamily: MONO, opacity: 0.85 };
    const COPY_BTN_STYLE = {
      appearance: 'none', border: 0, background: 'transparent', color: MUTED,
      cursor: 'pointer', font: 'inherit', padding: '2px 4px', borderRadius: '3px',
    };
    const PRE_STYLE = { margin: 0, padding: '5px 7px', overflowX: 'auto', lineHeight: 1.4 };
    const CODE_BLOCK_STYLE = { fontFamily: MONO, fontSize: '0.92em', whiteSpace: 'pre' };
    const LINK_STYLE = { color: ACCENT, textDecoration: 'underline', textUnderlineOffset: '2px' };
    const LIST_STYLE = { margin: '0 0 3px', paddingLeft: '18px', lineHeight: 'inherit' };
    const LI_STYLE = { margin: 0 };
    const TASK_LI_STYLE = { margin: 0, listStyle: 'none', marginLeft: '-18px' };
    const CHECKBOX_STYLE = {
      marginRight: '6px', verticalAlign: 'middle', accentColor: ACCENT, cursor: 'default',
    };
    const QUOTE_STYLE = {
      margin: '0 0 3px', padding: '1px 0 1px 8px', borderLeft: '2px solid ' + STRONG_LINE,
      color: MUTED, whiteSpace: 'pre-wrap', lineHeight: 'inherit',
    };
    const HR_STYLE = { border: 0, borderTop: '1px solid ' + LINE, margin: '4px 0' };
    const TABLE_STYLE = {
      borderCollapse: 'collapse', margin: '0 0 4px', maxWidth: '100%', width: 'fit-content',
    };
    const CELL_STYLE = { border: '1px solid ' + LINE, padding: '2px 6px', textAlign: 'left' };

    function headingStyle(level) {
      // Keep headings at body size: a user bubble should not turn into a document.
      return { margin: '0 0 3px', fontSize: '1em', fontWeight: 600, lineHeight: 'inherit' };
    }

    const DEFAULTS = { mode: 'full', taskLists: true, codeCopy: true, autolink: true };
    let settings = { ...DEFAULTS };

    function normalizeConfig(config) {
      const raw = config && typeof config === 'object' ? config : {};
      const mode = raw.mode === 'inline' || raw.mode === 'off' ? raw.mode : 'full';
      const flag = (value, fallback) => typeof value === 'boolean' ? value : fallback;
      return {
        mode,
        taskLists: flag(raw.taskLists, DEFAULTS.taskLists),
        codeCopy: flag(raw.codeCopy, DEFAULTS.codeCopy),
        autolink: flag(raw.autolink, DEFAULTS.autolink),
      };
    }

    /** Reject javascript:, data: and other active URL schemes. */
    function safeUrl(value) {
      const url = String(value || '').trim();
      if (!url) return null;
      if (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) return url;
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
      return url;
    }

    /** Push a plain-text run, optionally linkifying bare http(s) URLs. */
    function pushText(out, text, keyPrefix) {
      if (!text) return;
      if (!settings.autolink || !/https?:\/\//.test(text)) { out.push(text); return; }
      const re = /(https?:\/\/[^\s<>()]+)/g;
      const outKey = keyPrefix + '-auto';
      let last = 0;
      let seq = 0;
      let match;
      while ((match = re.exec(text)) !== null) {
        if (match.index > last) out.push(text.slice(last, match.index));
        const url = safeUrl(match[1]);
        if (url) {
          out.push(h('a', {
            key: outKey + seq++, href: url, target: '_blank',
            rel: 'noopener noreferrer', style: LINK_STYLE,
          }, match[1]));
        } else {
          out.push(match[1]);
        }
        last = re.lastIndex;
      }
      if (last < text.length) out.push(text.slice(last));
    }

    /** Inline Markdown -> React children. Text is escaped by React itself. */
    function renderInline(text, keyPrefix) {
      if (!text) return [];
      if (text.length > 20000) return [text];
      const re = /!\[([^\]\n]*)\]\(([^)\s]*)\)|\[([^\]\n]*)\]\(([^)\s]*)\)|`([^`\n]+)`|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([^*\n]+?)\*|_([^_\n]+?)_/g;
      const out = [];
      let last = 0;
      let seq = 0;
      let match;
      while ((match = re.exec(text)) !== null) {
        pushText(out, text.slice(last, match.index), keyPrefix + seq);
        const key = keyPrefix + '-' + seq++;
        const m = match;
        if (m[1] !== undefined || m[3] !== undefined) {
          const isImage = m[1] !== undefined;
          const label = isImage ? m[1] : m[3];
          const url = safeUrl(isImage ? m[2] : m[4]);
          const shown = label || (isImage ? m[2] : m[4]);
          if (url) {
            out.push(h('a', {
              key, href: url, target: '_blank', rel: 'noopener noreferrer', style: LINK_STYLE,
            }, renderInline(shown, key)));
          } else {
            pushText(out, shown, key);
          }
        } else if (m[5] !== undefined) {
          out.push(h('code', { key, style: CODE_STYLE }, m[5]));
        } else if (m[6] !== undefined || m[7] !== undefined) {
          out.push(h('strong', { key, style: { fontWeight: 600 } },
            renderInline(m[6] !== undefined ? m[6] : m[7], key)));
        } else if (m[8] !== undefined) {
          out.push(h('del', { key }, renderInline(m[8], key)));
        } else {
          out.push(h('em', { key },
            renderInline(m[9] !== undefined ? m[9] : m[10], key)));
        }
        last = re.lastIndex;
      }
      pushText(out, text.slice(last), keyPrefix + '-tail');
      return out;
    }

    /** Fenced code block with a language label and an optional copy button. */
    function CodeBlock(props) {
      const code = props.code;
      const language = props.language || '';
      const [copied, setCopied] = React.useState(false);
      React.useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(false), 1600);
        return () => clearTimeout(timer);
      }, [copied]);
      const onCopy = () => {
        try {
          const clipboard = navigator.clipboard;
          if (!clipboard || !clipboard.writeText) return;
          clipboard.writeText(code).then(() => setCopied(true)).catch(() => {});
        } catch (error) { /* clipboard unavailable */ }
      };
      return h('div', { style: CODE_WRAP_STYLE },
        h('div', { style: CODE_HEADER_STYLE },
          h('span', { style: CODE_LANG_STYLE }, language || 'code'),
          settings.codeCopy ? h('button', {
            type: 'button', onClick: onCopy, 'aria-label': 'Copy code', style: COPY_BTN_STYLE,
          }, copied ? 'Copied' : 'Copy') : null),
        h('pre', { style: PRE_STYLE }, h('code', { style: CODE_BLOCK_STYLE }, code)));
    }

    const BLOCK_LINE = /^\s{0,3}(#{1,6}\s|```|~~~|>\s|[-*+]\s|\d+\.\s|\||(-{3,}|\*{3,}|_{3,})\s*$)/;
    const FENCE_LINE = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)\s*$/;
    const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

    function isBlockStart(line) {
      return BLOCK_LINE.test(line) || FENCE_LINE.test(line);
    }

    function hasBlockSyntax(text) {
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) if (isBlockStart(lines[i])) return true;
      return false;
    }

    function splitRow(line) {
      return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
    }

    function parseAlign(line) {
      return splitRow(line).map(cell => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return null;
      });
    }

    /** Block Markdown -> React children; each block also runs inline Markdown. */
    function renderBlocks(text) {
      const lines = text.replace(/\r\n?/g, '\n').split('\n');
      const out = [];
      let i = 0;
      let seq = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i += 1; continue; }
        const key = 'b' + seq++;

        const fence = FENCE_LINE.exec(line);
        if (fence) {
          const marker = fence[1].charAt(0) === '`' ? '`' : '~';
          const closing = new RegExp('^\\s{0,3}' + marker + '{3,}\\s*$');
          const body = [];
          i += 1;
          while (i < lines.length && !closing.test(lines[i])) { body.push(lines[i]); i += 1; }
          if (i < lines.length) i += 1;
          out.push(h(CodeBlock, { key, code: body.join('\n'), language: fence[2] }));
          continue;
        }

        const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
          const level = heading[1].length;
          out.push(h('h' + level, { key, style: headingStyle(level) },
            renderInline(heading[2], key)));
          i += 1;
          continue;
        }

        if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          out.push(h('hr', { key, style: HR_STYLE }));
          i += 1;
          continue;
        }

        if (/^\s{0,3}>\s?/.test(line)) {
          const body = [];
          while (i < lines.length && /^\s{0,3}>\s?/.test(lines[i])) {
            body.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
            i += 1;
          }
          out.push(h('blockquote', { key, style: QUOTE_STYLE },
            renderInline(body.join('\n'), key)));
          continue;
        }

        const list = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/.exec(line);
        if (list) {
          const ordered = /\d/.test(list[1].charAt(0));
          const items = [];
          while (i < lines.length) {
            const item = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
            if (!item || (/\d/.test(item[1].charAt(0)) !== ordered)) break;
            const itemKey = key + '-li-' + items.length;
            const task = settings.taskLists ? /^\[([ xX])\]\s+(.*)$/.exec(item[2]) : null;
            if (task) {
              const done = /[xX]/.test(task[1]);
              items.push(h('li', { key: itemKey, style: TASK_LI_STYLE },
                h('input', {
                  type: 'checkbox', disabled: true, readOnly: true, checked: done,
                  'aria-label': done ? 'Completed' : 'Not completed', style: CHECKBOX_STYLE,
                }),
                renderInline(task[2], itemKey)));
            } else {
              items.push(h('li', { key: itemKey, style: LI_STYLE },
                renderInline(item[2], itemKey)));
            }
            i += 1;
          }
          out.push(h(ordered ? 'ol' : 'ul', { key, style: LIST_STYLE }, items));
          continue;
        }

        if (/^\s*\|/.test(line) && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
          const header = splitRow(lines[i]);
          const align = parseAlign(lines[i + 1]);
          i += 2;
          const rows = [];
          while (i < lines.length && /^\s*\|/.test(lines[i]) && lines[i].trim()) {
            rows.push(splitRow(lines[i]));
            i += 1;
          }
          const cellStyle = ci => align[ci]
            ? { ...CELL_STYLE, textAlign: align[ci] } : CELL_STYLE;
          const head = h('thead', null,
            h('tr', null, header.map((cell, ci) =>
              h('th', { key: 'th' + ci, style: cellStyle(ci) },
                renderInline(cell, key + '-th' + ci)))));
          const body = h('tbody', null, rows.map((row, ri) =>
            h('tr', { key: 'tr' + ri }, row.map((cell, ci) =>
              h('td', { key: 'td' + ci, style: cellStyle(ci) },
                renderInline(cell, key + '-td' + ri + '-' + ci))))));
          out.push(h('table', { key, style: TABLE_STYLE }, head, body));
          continue;
        }

        const paragraph = [];
        while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
          paragraph.push(lines[i]);
          i += 1;
        }
        // A line flagged as a block start but not consumed above (for example a
        // stray "|" line) is still plain text. Never drop user content.
        if (!paragraph.length) {
          out.push(h('p', { key, style: P_STYLE }, renderInline(line, key)));
          i += 1;
          continue;
        }
        out.push(h('p', { key, style: P_STYLE }, renderInline(paragraph.join('\n'), key)));
      }
      return out;
    }

    function MarkdownText(props) {
      const node = props && props.node;
      const raw = props && props.raw;
      let text = typeof raw === 'string' ? raw : '';
      if (!text && node && node.data) {
        const data = node.data;
        text = typeof data.text === 'string' ? data.text
          : (typeof data.display === 'string' ? data.display : '');
      }
      if (!text) return null;
      if (text.length > 20000) {
        return h('span', { style: PLAIN_STYLE, 'data-user-bubble-markdown': 'plain' }, text);
      }
      if (settings.mode === 'inline') {
        return h('span', { style: PLAIN_STYLE, 'data-user-bubble-markdown': 'inline' },
          renderInline(text, 'inline'));
      }
      if (hasBlockSyntax(text)) {
        return h('div', { style: ROOT_STYLE, 'data-user-bubble-markdown': 'block' },
          renderBlocks(text));
      }
      return h('span', { style: PLAIN_STYLE, 'data-user-bubble-markdown': 'inline' },
        renderInline(text, 'inline'));
    }

    return {
      inject: ['slots'],
      apply(ctx, config) {
        settings = normalizeConfig(config);
        // `off` leaves the shipped plain-text renderer in place entirely.
        if (settings.mode === 'off') return;
        ctx.slots.inject('conversation.user.text.node', () => ctx.slots.register({
          name: 'conversation.user.text.node',
          key: 'text',
          priority: 50,
        }, MarkdownText));
      },
    };
  },
});
