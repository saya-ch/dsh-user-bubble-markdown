# 用户消息 Markdown 渲染

让 DeepSeek Harness（DSH）Web GUI 里**自己发出的消息气泡**也正常渲染 Markdown。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/saya-ch/dsh-user-bubble-markdown/actions/workflows/ci.yml/badge.svg)](https://github.com/saya-ch/dsh-user-bubble-markdown/actions/workflows/ci.yml)
[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-2f6f9f)](https://github.com/topics/dsh-plugin)

> DSH 默认只对模型回复渲染 Markdown，用户消息气泡里是纯文本：`**重点**`、`` `命令` ``、列表和代码块都会以字面符号显示。本插件补上这一半，只改浏览器展示层，不写会话、不改配置、不动模型上下文。

- [能做什么](#能做什么)
- [快速开始](#快速开始)
- [配置](#配置)
- [支持的语法](#支持的语法)
- [工作原理](#工作原理)
- [与其它插件的关系](#与其它插件的关系)
- [已知限制与验证状态](#已知限制与验证状态)
- [开发与测试](#开发与测试)
- [致谢](#致谢)
- [许可](#许可)

英文文档见 [README.en.md](README.en.md)。

## 能做什么

- 把用户消息里的标题、列表、代码块、表格、链接、粗斜体等渲染成对应排版。
- 走官方 Slot 扩展点，**气泡外壳、图片/文件附件、会话引用 chip、复制与编辑控件全部由宿主保留**。
- 标题刻意不放大字号、块容器按内容收缩，避免一条消息变成占满宽度的一整篇文档。
- 文本由 React 自动转义，不做 `innerHTML` 注入；链接走协议白名单。
- 颜色取自 `--dsw-alias-*` 主题 token，深浅主题自适应。
- 零运行时依赖、零构建：Host 半只有一个最小 `apply()`，Client 半是手写的自包含模块。

## 快速开始

本包是本地 bundle（`private: true`，不发布到 npm），通过目录安装。

**官方 Desktop**：打开应用的「插件」页面 → 从本地目录安装，选择本仓库目录。

**DSH Web**：

```powershell
dsh plugin --profile web add "link:<本仓库绝对路径>"
dsh --profile web
```

仓库发布到 GitHub 后，也可以尝试 `dsh plugin --profile web add "github:saya-ch/dsh-user-bubble-markdown"`，该方式未在本机验证。

修改源码后需要重启 DSH 并刷新页面，新的 Client 模块才会被加载。已启用时，在插件详情里禁用再启用通常也能触发重新加载。

验证是否装配成功：

```powershell
dsh --profile web --dump-config | Select-String user-bubble-markdown
```

## 配置

配置写在 bundle 的 `cordis.patch.yml` 对应条目的 `config` 下，全部可选，默认值如下：

| 键 | 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `mode` | `full` / `inline` / `off` | `full` | 渲染模式 |
| `taskLists` | 布尔 | `true` | GFM 任务列表 |
| `codeCopy` | 布尔 | `true` | 围栏代码块的复制按钮 |
| `autolink` | 布尔 | `true` | 裸 URL 自动链接 |

- `full`：块级与行内语法都渲染。
- `inline`：只渲染行内语法，标题/列表等块级标记按普通文字与换行显示，气泡观感最接近原版。
- `off`：完全不注册渲染器，恢复宿主自带的纯文本显示。

改配置属于 profile 装配变更，需要重启 DSH。

## 支持的语法

| 语法 | 行为 |
| --- | --- |
| `#` ~ `######` | 标题（只用字重区分，不放大字号） |
| 段落与段内换行 | 保留原有换行 |
| `-` / `*` / `+` / `1.` | 无序、有序列表 |
| `- [ ]` / `- [x]` | 只读复选框 |
| 三个反引号围栏 | 代码块，带语言标签与一键复制 |
| `` `行内代码` `` | 行内代码 |
| `>` | 引用 |
| `---` | 分隔线 |
| `\| a \| b \|` + 分隔行 | 表格，支持 `:---` / `:---:` / `---:` 列对齐 |
| `[文本](url)` | 链接，新标签打开 |
| 裸 `https://…` | 自动链接 |
| `**粗体**` `*斜体*` `~~删除线~~` | 行内强调 |
| `![alt](url)` | 降级为链接，不加载远程图片 |

安全边界：链接只放行 `http(s)`、`mailto`、`tel`、相对路径与 `#`；`javascript:`、`data:` 等会降级为纯文本；超过 20000 字符的消息整体回退为纯文本。

## 工作原理

DSH 的 Conversation 层把用户消息切成若干文本片段，交给 `conversation.user.text.node` 这个 **keyed slot** 按 `entryKey` 分发渲染。官方为普通文本注册了 `key: "text"` 的渲染器（priority 100）。

本插件通过 `ctx.slots.inject` 注册同 key、priority 50 的渲染器；数字更小的优先，于是纯文本渲染器被替换，而气泡、附件、引用与消息操作完全不经过这个 slot，因此不受影响。

不注册 `conversation.chat.node`、不使用 `MutationObserver` 或 DOM 扫描、不注入 `innerHTML`；所有节点都是 `React.createElement` 构造的 React 元素。

## 与其它插件的关系

社区已有 [towardsdawn/dsh-user-markdown](https://github.com/towardsdawn/dsh-user-markdown)（MIT）实现同样的目标：它用 `MutationObserver` 扫描 DOM 找出纯文本容器再增强，并主动跳过含引用 chip / 附件的消息。

本仓库是独立实现，不是 fork。差别只在扩展机制：这里替换官方 Slot 的渲染器，不观察 DOM，因此不依赖气泡的 DOM 属性约定，也不需要跳过含附件的消息。两套实现互不引用，同时安装会由 Slot 优先级与 DOM 增强层各自作用，不建议一起启用。

## 已知限制与验证状态

- 只支持上表列出的语法；不做语法高亮，任务列表复选框只读，图片语法不加载远程图片。
- 只影响 Web GUI 的展示层；TUI / ACP 不涉及。
- 依赖 DSH 的 `conversation.user.text.node` Slot 契约。若上游改动该 Slot 名称或渲染器键，插件会静默失效，需要相应调整一行注册代码。
- 没有 GUI 截图，也**没有做过浏览器端到端验收**。已记录的验证是：`node --check` 语法检查、`tests/render.test.cjs` 的 16 条离线渲染用例（含模式开关、任务列表、表格对齐、XSS 过滤），以及在维护者本机官方 Desktop 0.2.2-rc.1 的 profile 中安装并启用。
- 块级渲染依赖浏览器对 `inline-block` 内块级子元素的布局，未在各内核上逐一验证。

## 开发与测试

```powershell
npm install
npm run check
npm test
```

`npm run check` 检查 `client.js` 与 `index.js` 语法；`npm test` 用 `react-dom/server` 在 Node 中加载 Client 模块、捕获注册的渲染器并渲染样例，不需要浏览器或运行中的 DSH。CI 在 push `main` 与 pull request 时执行同样两步。

目录：`client.js`（浏览器半）、`index.js`（宿主半）、`cordis.patch.yml`（装配与默认配置）、`locale/`（中英文标题与描述）、`tests/`、`assets/`（图标原始素材）。

## 致谢

`icon.svg` 使用 [Simple Icons](https://simpleicons.org/?q=markdown) 的官方 Markdown `M↓` 标志路径（CC0 1.0，公有领域），去掉外框后配蓝色圆角底；未改动原版保留在 `assets/markdown-simple-icons.svg`。

同类项目 [towardsdawn/dsh-user-markdown](https://github.com/towardsdawn/dsh-user-markdown) 提供了 DOM 增强层这一不同思路的参考。

## 许可

[MIT](LICENSE)
