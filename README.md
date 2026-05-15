# README

> Notes for future-me. How `index.html` is wired together and how to add or extend interactive courses without breaking anything.
>
> 给未来自己的笔记。`index.html` 的内部结构、添加或扩展课程不会踩坑的步骤。
>
> Bilingual document. English first, 中文紧随其后 in each section.

---

## Architecture overview · 架构概览

**Zero build step. Zero backend. Lazy per-lesson loading.**

**零编译、零后端、按需懒加载每一节课。**

- SQL and Python run 100% in the browser — sql.js (SQLite asm.js) and Skulpt — loaded via `<script>` tags. `file://` works locally.
- C is heavier: it runs the real **clang** compiler in a hidden `<iframe>` via [emception](https://github.com/jprendes/emception). The iframe is same-origin (mirrored under `lib/runtime/webC/`), so `<script>` and Worker creation succeed without cross-origin issues. **C lessons require HTTPS or `http://localhost`**; raw `file://` is gated off by the C-family modal.
- A course's metadata + lesson index loads when the user opens that course; each lesson's full content (and any SQL schema it references) loads only when the user navigates into that lesson.

中文：

- SQL 和 Python 100% 在浏览器跑——sql.js（SQLite asm.js）和 Skulpt——通过 `<script>` 标签加载。`file://` 本地能跑。
- C 体量大些：通过 [emception](https://github.com/jprendes/emception) 在隐藏 `<iframe>` 里跑真实的 **clang** 编译器。iframe 同源（镜像在 `lib/runtime/webC/`），所以 `<script>` 和 Worker 创建都不会撞跨域。**C 课程必须 HTTPS 或 `http://localhost`**；纯 `file://` 会被 C-family 模态框拦下。
- 课程的元数据 + 课时索引在用户打开课程时加载；每节课的完整内容（以及它引用的 SQL schema）等用户点进那一节才加载。

Per-course download cost (first visit, browser-cached after) · 每门课首次访问的下载量（之后浏览器缓存，免费）：
- SQL: ~8 KB course index + ~5–15 KB per lesson · ~8 KB 课程索引 + 每节 ~5–15 KB
- Python: ~6 KB course index + ~3–10 KB per lesson · ~6 KB 课程索引 + 每节 ~3–10 KB
- **C: ~25–30 MB** (clang.wasm + libc/libc++ archives) on first entry to any C-family course (`c` core syntax / `c-algo` algorithms) or playground; subsequent visits free. `c` and `c-algo` share the same emception cache. · **C：~25–30 MB**（clang.wasm + libc/libc++ 归档）首次进任意 C-family 课程（`c` 基础语法 / `c-algo` 算法）或 playground 时；之后免费。`c` 和 `c-algo` 共享同一份 emception 缓存。

---

## File layout · 目录结构

> Note · 注意：The HTML entry point in this repo is **`index.html`** at the repo root (it serves as both the GitHub Pages root and the historical "learn.html" — JS comments still call it `learn.html`). The READMEs and the live runtime code live in two places: bilingual READMEs at the repo root (`README.md` + the legacy `learn_readme.md` / `learn_readme_c.md`), and a duplicate copy under `learn/learn_data/` for in-app discoverability. · 本仓库的 HTML 入口是根目录下的 **`index.html`**（同时充当 GitHub Pages 根页和历史上的 `learn.html`，JS 注释里还叫它 `learn.html`）。README 在两处都有：仓库根目录（`README.md` 加遗留的 `learn_readme.md` / `learn_readme_c.md`），和应用内可发现的 `learn/learn_data/` 下的副本。

```
<repo root>
├── index.html                          ← interactive UI · 交互 UI（routing, rendering, engines）
├── README.md                           ← THIS file · 本文件（merged bilingual）
├── learn_readme.md                     ← legacy English-only README · 遗留英文版 README
├── learn_readme_c.md                   ← legacy Chinese-only README · 遗留中文版 README
├── CNAME                               ← Cloudflare Pages custom domain · CF Pages 自定义域名
├── LICENSE
│
├── learn/
│   ├── learn-core.js                   ← loadCourse / loadLesson / loadSchema, ripple,
│   │                                     splitter, progress, course caching
│   │                                     涟漪、分隔条、进度、课程缓存
│   ├── learn-engines.js                ← sql.js + Skulpt + Monaco + emception wrappers,
│   │                                     result-table rendering helpers
│   │                                     封装、结果表格渲染辅助
│   ├── learn-terminal.js               ← shared xterm-based terminal used by Python and C
│   │                                     lessons / playgrounds (SQL keeps tabular output)
│   │                                     Python / C 课时和 playground 共用的 xterm 终端
│   │                                     （SQL 保持表格输出）
│   ├── learn-i18n.js                   ← zh / en translations + applyLang / tt / pickLang
│   ├── learn-lesson-parser.js          ← `@@key` parser + LEARN.{course,lesson,schema}
│   │                                     registrars + assembleOneLesson
│   │                                     解析器 + 注册函数 + assembleOneLesson
│   ├── learn-views.js                  ← course list, lesson list, playgrounds (SQL/Py/C)
│   │                                     课程列表、课时列表、playgrounds
│   ├── learn-lesson.js                 ← lesson runners (SQL/Python/C grading),
│   │                                     hash router, boot
│   │                                     课时运行器（SQL/Python/C 判题）、hash 路由、启动
│   ├── learn.css                       ← shared styles incl. the .editor-pane layout
│   │                                     共享样式（含 .editor-pane 布局）
│   └── learn_data/
│       ├── learn_readme.md             ← in-app English mirror of the README
│       ├── learn_readme_c.md           ← in-app Chinese mirror of the README
│       ├── manifest.js                 ← course catalogue · 课程目录（window.__LEARN_MANIFEST）
│       ├── sql/
│       │   ├── course.js               ← metadata + lesson index + schema manifest
│       │   │                             元数据 + 课时索引 + schema manifest
│       │   ├── schemas/<name>.js       ← shared SQL schemas (LEARN.schema)
│       │   │                             共享 SQL schema
│       │   └── lessons/<NN>-<slug>.js  ← per-lesson content (LEARN.lesson) · 每节内容
│       ├── python/
│       │   ├── course.js               ← metadata + lesson index (no schemas)
│       │   │                             元数据 + 课时索引（无 schemas）
│       │   └── lessons/<NN>-<slug>.js
│       ├── c/
│       │   ├── course.js               ← metadata + lesson index (no schemas);
│       │   │                             'main' (syntax) and 'stdlib' sections
│       │   │                             元数据 + 课时索引（无 schemas）；
│       │   │                             'main'（语法）和 'stdlib' 两段
│       │   └── lessons/<NN>-<slug>.js  ← 44 lessons (30 syntax + 14 stdlib)
│       │                                 共 44 节（30 节语法 + 14 节标准库）
│       └── c-algo/                     ← C Algorithms (Beta), shares emception runtime with c
│           │                             C 算法入门（Beta），与 c 共享 emception 运行时
│           ├── course.js               ← metadata + lesson index; family: 'c'
│           └── lessons/<NN>-<slug>.js  ← 25 lessons (algorithms + data structures)
│                                         共 25 节（算法 + 数据结构）
│
└── lib/
    ├── design/                         ← visual assets · 视觉资源（fonts, M3 tokens, shared CSS）
    ├── resources/                      ← static images · 静态图片（po.webp 等）
    └── runtime/
        ├── sql-asm.js                  ← sql.js engine (eager init at module load)
        │                                 sql.js 引擎（模块加载时立即初始化）
        ├── webPython/                  ← Skulpt Python interpreter (lazy)
        │                                 Skulpt Python 解释器（懒加载）
        ├── webC/                       ← emception clang mirror (~450 MB, lazy)
        │   │                             emception clang 镜像（~450 MB，懒加载）
        │   ├── iframe.html             ← C runtime iframe entry · C 运行时 iframe 入口
        │   ├── postmsg-bridge.js       ← parent ↔ wasm postMessage adapter · 适配器
        │   ├── main.bundle.js          ← upstream emception webpack bundle (3 MB)
        │   ├── emception.worker.bundle.worker.js  (530 KB)
        │   ├── cecdfcda360457a8f204.br ← compressed clang (22 MB) · 压缩后的 clang
        │   └── 249 × *.a / *.gz        ← libc, libc++, libGL, etc. — fetched on demand
        │                                 libc、libc++、libGL 等——按需 fetch
        ├── xterm/                      ← xterm.js terminal (used by learn-terminal.js)
        │   │                             xterm.js 终端（learn-terminal.js 用）
        │   ├── xterm.min.js
        │   ├── xterm.min.css
        │   └── xterm-addon-fit.min.js
        └── monaco/vs/                  ← Monaco editor (~3 MB, vs/loader.js eager,
                                          vs/editor/editor.main lazy)
                                          Monaco 编辑器（~3 MB，loader.js 立即加载，
                                          editor.main 懒加载）
```

---

## How loading works · 加载流程

```
manifest.js (eager / 立即) ─┐
                            │
                            ▼
            User clicks course card · 用户点击课程卡片
                            │
                            ▼
       loadCourse(slug)        ← injects · 注入 <slug>/course.js
                            │
                            ▼
   course meta + lesson index ready (cards rendered)
   课程元数据 + 课时索引就绪（卡片渲染）
                            │
                            ▼
            User clicks a lesson · 用户点击某节课
                            │
                            ▼
       loadLesson(slug, id)    ← injects · 注入 lessons/<NN>-<slug>.js
                            │
                            ▼
       Does the lesson set @@schema? · 该课设置了 @@schema 吗？
              │            │
             yes / 是      no / 否
              │            │
              ▼            ▼
      loadSchema(...)   ready / 就绪
              │
              ▼
       inject · 注入 schemas/<name>.js
              │
              ▼
       lesson.setup ← LEARN._schemas[<slug>:<name>]
```

`loadCourse`, `loadLesson`, `loadSchema` all dedupe in-flight requests and cache successful loads. Once a schema or lesson is fetched, it stays in memory for the rest of the session.

`loadCourse`、`loadLesson`、`loadSchema` 都做"飞行中请求去重"和"成功结果缓存"。一节课或 schema 拉过一次，整个会话里都在内存。

---

## `manifest.js` schema · 字段

```js
window.__LEARN_MANIFEST = {
  version: 1,
  updated: 'YYYY-MM-DD',
  courses: [
    {
      slug: 'sql',                              // REQUIRED — matches folder name
                                                // 必填——和文件夹名一致
      icon: 'SQL',                              // shown on the card (also accepts a { zh, en }
                                                //   bilingual object, e.g. c-algo: { zh: 'C 算法', en: 'C Algo' })
                                                // 卡片图标文字（也支持双语对象）
      title: { zh: '...', en: '...' },
      desc:  { zh: '...', en: '...' },
      level: { zh: '入门', en: 'Beginner' },
      lessonsCount: 42,
      coming: false,                            // true → greyed-out "Coming Soon" / 灰显
      family: 'c',                              // OPTIONAL — gates entry behind the C-resource modal
                                                // 可选——会被 C-resource 模态框拦截
    }
  ]
};
```

Manifest only tells the course list view what cards to show. The course's *contents* live behind `loadCourse(slug)`. `family: 'c'` is currently the only family value, and it triggers `gateCFamilyAccess()` to warn about download size before the C-family course loads.

manifest 只决定课程列表显示哪些卡片。课程**内容**藏在 `loadCourse(slug)` 后面。`family: 'c'` 目前是唯一的 family 值，触发 `gateCFamilyAccess()` 警告下载量再加载该 C 系课程。

---

## `course.js` schema · 字段

A course file calls `LEARN.course(slug, meta)`. It carries metadata, a lesson INDEX, and (for SQL) a schema manifest:

每个课程文件调用 `LEARN.course(slug, meta)`。它带元数据、课时**索引**，以及（SQL 才有的）schema manifest：

```js
LEARN.course('sql', {
  slug: 'sql',
  type: 'sql',                                  // 'sql' | 'python' | 'c'
  title: { zh: '...', en: '...' },
  desc:  { zh: '...', en: '...' },

  hasPlayground: true,
  playgroundTitle:  { zh: '...', en: '...' },
  playgroundSchema: 'final_schema',             // SQL only · 仅 SQL — name from `schemas` below

  // SQL only. Schema name → file path. Loaded lazily by loadSchema().
  // 仅 SQL。schema 名 → 文件路径。loadSchema() 懒加载。
  schemas: {
    c1_schema:    'schemas/c1_schema.js',
    final_schema: 'schemas/final_schema.js',
    // ...
  },

  // Lesson INDEX. Just enough to render the lesson list.
  // Full content (intro/task/hint/setup/expectedSql/...) lives in `file`.
  // 课时索引。够渲染课时列表就行。完整内容住在 `file` 里。
  lessons: [
    { id: 1, section: 'main', slug: 'select-basics',
      title:   { zh: '...', en: '...' },
      chapter: { zh: '...', en: '...' },
      file: 'lessons/01-select-basics.js' },
    // ...
  ],
});
```

`section` defaults to `'main'`. The router treats `'final'` and `'stdlib'` as separate groups with their own headers in the lesson list (e.g., "最终挑战" / "标准库"). The C course uses both `'main'` (syntax lessons) and `'stdlib'` (`<stdio.h>`, `<string.h>`, etc.).

`section` 默认 `'main'`。路由把 `'final'` 和 `'stdlib'` 当成独立分组渲染（"最终挑战" / "标准库" 各有自己的小标题）。C 课程同时用 `'main'`（语法部分）和 `'stdlib'`（`<stdio.h>`、`<string.h>` 等）。

---

## Lesson file format · 课时文件格式（`@@key` syntax · 语法）

A lesson file calls `LEARN.lesson(courseSlug, id, raw)` once, with the content as a template literal in `raw`:

每节课文件调用 `LEARN.lesson(courseSlug, id, raw)` 一次，正文用模板字符串放在 `raw` 里：

```js
LEARN.lesson('sql', 1, `
@@schema c1_schema
@@chapterRef sql-syntax-guide-1
@@expectedSql SELECT name, score FROM students
@@checkOrder false
@@tables students

@@difficulty:zh 入门
@@difficulty:en Beginner

@@intro:zh
<p class="lead"><strong>SELECT</strong> 是 SQL 的第一关键字 ——</p>
<pre><code>SELECT 列1, 列2 FROM 表名;</code></pre>
@@intro:en
<p class="lead"><strong>SELECT</strong> is the first SQL keyword —</p>
<pre><code>SELECT col1, col2 FROM table_name;</code></pre>

@@task:zh
从 <code>students</code> 表里只显示每个学生的 <code>name</code> 和 <code>score</code> 两列。
@@task:en
Return only the <code>name</code> and <code>score</code> of every student.

@@hint:zh
SELECT 后面把列名用逗号分开，再写 FROM 表名。
@@hint:en
List columns after SELECT separated by commas, then FROM <table>.

@@starter:zh
-- 在这里写你的 SQL

@@starter:en
-- write your SQL here
`);
```

### `@@key` rules · 规则

- `@@key value` (rest-of-line) — single-line scalar · 同一行剩余 — 单行标量
- `@@key` then lines until next `@@` — multi-line scalar · 多行标量
- `@@key:zh` / `@@key:en` — bilingual variant; assembled into `{zh, en}` · 双语变体
- `@@` (double-at) is the field marker. Single `@` would collide with Python decorators (`@property`, `@app.route`) appearing at column 0 inside code examples; `@@` doesn't collide with anything real.
- `@@`（双 @）是字段标记。单 `@` 会和 Python 装饰器在代码示例的列 0 处冲撞；`@@` 不会和任何真东西冲突。

### Trailing newlines · 末尾换行

The parser preserves the value verbatim — including a trailing `\n`. The convention is **"blank line before the next `@@key` to encode a trailing `\n` in the value"**:

解析器原样保留值——包括末尾的 `\n`。约定是**"下一个 `@@key` 前留一空行表示这个值末尾有 `\n`"**：

```
@@starter:zh
-- 在这里写你的 SQL              ← value ends without '\n' · 值末尾没有 '\n'
@@starter:en

@@starter:zh
-- 在这里写你的 SQL
                                 ← value ends with '\n' (cursor lands on a clean line)
                                   值末尾有 '\n'（光标停在干净的下一行）
@@starter:en
```

This matters for `starter` (Monaco cursor placement) and `answer` / `expectedOutput` (Python and C grading compare stdout exactly).

这影响 `starter`（Monaco 光标位置）和 `answer` / `expectedOutput`（Python、C 判题严格对比 stdout）。

### Bilingual content rules · 双语规则

1. **Every prose field needs both `@@key:zh` and `@@key:en`.** Lessons are bilingual end-to-end. · **每个散文字段都需要 `@@key:zh` 和 `@@key:en` 都给。** 课程是端到端双语的。
2. **Verbatim HTML.** `intro` / `task` / `hint` use raw HTML (`<p class="lead">`, `<pre><code>`, `<strong>`, `<code>`). Don't switch to Markdown — the parser is verbatim pass-through, not a Markdown renderer. · **HTML 原样输出。** `intro` / `task` / `hint` 用裸 HTML。别切到 Markdown——解析器是原样透传，不是 Markdown 渲染器。

### Field reference · 字段速查

| Field · 字段     | Type · 类型     | Where · 位置          | Notes · 备注                                   |
|------------------|-----------------|-----------------------|------------------------------------------------|
| `id`             | int             | `LEARN.lesson` 2nd arg + `course.js` index | Stable identity, used for routing & progress · 稳定身份，路由和进度都用 |
| `section`        | string          | `course.js` index     | `'main'` (default · 默认), `'final'`, or `'stdlib'` |
| `slug`           | string          | `course.js` index     | URL-friendly; used in filename · URL 友好；用于文件名 |
| `title`          | bilingual       | `course.js` index     |                                                |
| `chapter`        | bilingual       | `course.js` index     | Sub-label shown under the lesson title · 课时标题下的副标签 |
| `chapterRef`     | string          | lesson file · 课时文件 | Optional · 可选.<br>· `sql` / `python` / `c-algo`: links to `blog.html#<chapterRef>` · 链到 `blog.html#<chapterRef>`<br>· `c` (core syntax · 基础语法): ignored — link is hardcoded to runoob's main C tutorial · 忽略，固定链到菜鸟教程主页 |
| `difficulty`     | bilingual       | lesson file           | "入门" / "Beginner" etc.                       |
| `intro`          | bilingual HTML  | lesson file           | Long-form lesson explanation · 长篇课时讲解   |
| `task`           | bilingual HTML  | lesson file           | What the user must accomplish · 用户要完成什么 |
| `hint`           | bilingual HTML  | lesson file           | Optional — shown on demand · 可选，按需展示    |
| `warning`        | bilingual HTML  | lesson file           | Optional — caveats / browser-sandbox notes · 警告 / 浏览器沙箱说明 |
| `subtitle`       | bilingual HTML  | lesson file           | Optional · 可选                                |
| `starter`        | bilingual code  | lesson file           | Initial editor contents · 编辑器初始内容       |
| **SQL only · 仅 SQL** |            |                       |                                                |
| `schema`         | string          | lesson file           | Name from `course.schemas`; resolved to `setup` · 来自 `course.schemas` 的名字 |
| `tables`         | array           | lesson file           | Table names to preview in the left pane · 在左面板预览的表名 |
| `expectedSql`    | string          | lesson file           | Grader runs this against the same fresh DB · 判题在同一个 fresh DB 上跑这条 |
| `checkOrder`     | bool            | lesson file           | `true` → row order must match (ORDER BY/LIMIT) · 行顺序也要匹配 |
| **Python / C**   |                 |                       |                                                |
| `answer`         | code            | lesson file           | Reference solution (revealed by "Show answer") · 参考答案 |
| `expectedOutput` | string          | lesson file           | Grader compares stdout (after trim) to this · 判题对比 stdout |
| `testInputs`     | array           | lesson file           | Strings fed to `input()` (Py) / stdin (C) on grade · 判题时喂给 stdin 的字符串 |

Bilingual fields appear as `@@key:zh` and `@@key:en` blocks. Scalar string/int/bool fields appear as plain `@@key` blocks. `tables` is comma- or space-separated. `testInputs` is one input per line.

双语字段是 `@@key:zh` 和 `@@key:en` 块。string/int/bool 标量字段是普通 `@@key` 块。`tables` 是逗号或空格分隔。`testInputs` 一行一项。

---

## Schema file format · Schema 文件格式（SQL only · 仅 SQL）

```js
// learn/learn_data/sql/schemas/c1_schema.js

LEARN.schema('sql:c1_schema', `
  CREATE TABLE students (id INTEGER, name TEXT, age INTEGER, gender TEXT, score INTEGER);
  INSERT INTO students VALUES (1, 'Alice', 18, 'F', 85);
  INSERT INTO students VALUES (2, 'Bob',   19, 'M', 92);
  INSERT INTO students VALUES (3, 'Carol', 20, 'F', 78);
  INSERT INTO students VALUES (4, 'David', 18, 'M', 88);
`);
```

The fully-qualified name is `<courseSlug>:<schemaName>`. Lessons reference by `<schemaName>` only (`@@schema c1_schema`); the course slug is added automatically.

完全限定名是 `<courseSlug>:<schemaName>`。课程文件只引用 `<schemaName>`（`@@schema c1_schema`），课程 slug 自动加上。

### Schema dedup convention · 复用规则（conservative · 保守）

- **`final_schema`** — the big shared library/bookstore database. Used by every "final challenge" lesson + the playground. · 大共享图书馆/书店数据库。每节"最终挑战"和 playground 都用它。
- **`c<N>_schema`** — single-use schema owned by lesson `N` (most lessons). · 第 N 节独占（大多数课时）。
- **Shared schemas keep the lowest member's id** in the name (`c3_schema` if shared by L3 + L5). · **多节共享时取最小成员的 id 做名字**。
- **Identical bytes only.** If two lessons differ even by one row, they get separate files. Don't merge for cosmetic reasons — the principle is "the lesson author chose those exact rows on purpose; respect it." · **必须字节相同才能合并**。两节哪怕差一行就分开。别为美观合并——原则是"作者特意挑了这些行，尊重它"。
- For *truly* shared concepts that read better with a name (e.g., `students_basic`, `books_with_genre`), give them semantic names. Use this sparingly. · **真正可命名的共享概念**（如 `students_basic`、`books_with_genre`）可以给语义名字，但用得克制。

---

## Engines · 引擎

### SQL — sql.js (SQLite, asm.js)
- Loaded eagerly via `<script src="lib/runtime/sql-asm.js">`. · 通过 `<script src="lib/runtime/sql-asm.js">` 立即加载。
- `ensureSql()` initializes once and caches. · 初始化一次后缓存。
- Each lesson runs against a **fresh in-memory DB** — previous queries can't bleed state. · 每节课跑在**全新内存 DB**上——前一节的查询不会泄露状态。
- The SQL Playground keeps a **persistent DB** for the session. "Load Demo Tables" lazy-loads `playgroundSchema` then runs it; "Reset Tables" wipes to empty. · SQL Playground 整个会话**保持同一个 DB**。"加载示例表"懒加载 `playgroundSchema` 然后跑；"重置表"清空。

### Python — Skulpt
- Lazy-loaded on first Python lesson or playground entry (`ensurePython()`). · 第一次进 Python 课时或 playground 才加载。
- Output is captured for grading. `input()` is pumped through an in-page terminal during interactive runs; during grading runs it pulls from `testInputs` in order. · 输出被捕获用于判题。`input()` 在交互运行时由页内终端泵；判题运行时按顺序从 `testInputs` 拉。
- Hard runtime limits: `yieldLimit: 100` (event-loop yield cadence), `execLimit: 10000` (10s timeout for runaway loops). · 硬运行时上限：`yieldLimit: 100`，`execLimit: 10000`（10 秒后超时）。
- Skulpt is Python 3-ish but not 100%. f-strings, list/dict/set comprehensions, basic stdlib (`math`, `random`, `re`) work; `numpy`, `pandas`, `requests` etc. don't. · Skulpt 是 Python 3 风格但不 100%。f-strings、推导式、基础 stdlib 能用；`numpy`、`pandas`、`requests` 等不行。

### Terminal — xterm.js · 终端

`learn-terminal.js` wraps **xterm.js** (`lib/runtime/xterm/xterm.min.js` + `xterm-addon-fit.min.js`) into a shared interactive terminal used by both Python and C lessons / playgrounds. SQL stays on the tabular result-set renderer.

`learn-terminal.js` 把 **xterm.js**（`lib/runtime/xterm/xterm.min.js` + `xterm-addon-fit.min.js`）封装成 Python 和 C 课时 / playground 共用的交互式终端。SQL 仍走表格结果渲染。

### Code editor — Monaco · 代码编辑器
- Lives at `lib/runtime/monaco/vs/`. Install: download monaco-editor's npm tarball, extract `package/min/vs/` into that path. · 住在 `lib/runtime/monaco/vs/`。安装方式：下载 npm tarball，把 `package/min/vs/` 解压到这里。
- `vs/loader.js` (small AMD loader) is fetched eagerly by `index.html`. `vs/editor/editor.main` (~3 MB) is loaded lazily by `ensureMonaco()` the first time a lesson or playground opens. · `vs/loader.js` `index.html` 立即拉。`vs/editor/editor.main`（~3 MB）由 `ensureMonaco()` 懒加载。
- Editors are created via `createCodeEditor(container, opts)`. Two height modes: · 通过 `createCodeEditor(container, opts)` 创建。两种高度模式：
  - `fillParent: true` — the container's height is set by its parent's CSS (used by lesson views with `.editor-pane`); the function calls `ed.layout()` multiple times after creation to recover from initial-render race conditions. · 容器高度由父级 CSS 决定；函数会在创建后多次调 `ed.layout()` 解决初始渲染竞态。
  - default — auto-grow from `minLines` to `maxLines` based on content (Ace-like). · 默认 — 按内容从 `minLines` 到 `maxLines` 自动扩展（类 Ace）。
- Workers are routed to an empty `data:` URL so language services degrade to the main thread (required for `file://` compatibility). DevTools shows many `data:text/javascrip…` 0-byte requests; that's normal — filter `-data:` to hide. · Worker 路由到空 `data:` URL，让语言服务降级到主线程跑（`file://` 兼容必需）。DevTools 里那些 `data:` 0 字节请求是正常的，过滤 `-data:` 隐藏。

### C — emception (real clang in the browser · 浏览器内真实 clang)

C is a special case. There's no good "C interpreter" library for browsers (we tried JSCPP, TCC.wasm — both broken). The only viable option is real LLVM/clang compiled to WebAssembly via [emception](https://github.com/jprendes/emception) — a complete IDE app, not a clean library.

C 是个特殊场景。浏览器没有好用的"C 解释器"库（试过 JSCPP、TCC.wasm，都坏）。唯一可行的方案是用 [emception](https://github.com/jprendes/emception) 把真正的 LLVM/clang 编译成 WASM——它是个完整的 IDE 应用，不是干净的库。

**Architecture · 架构** (`ensureC()` in `learn/learn-engines.js`):

```
index.html (parent · 父)
  │ creates hidden · 创建隐藏 <iframe src="lib/runtime/webC/iframe.html">
  ▼
iframe.html
  │ <script src="postmsg-bridge.js">
  ▼
postmsg-bridge.js
  ├─ stream-fetch main.bundle.js (with byte-progress UI · 带字节进度 UI)
  ├─ inject via <script src=> (so webpack auto-publicPath finds the bundle)
  │   通过 <script src=> 注入（让 webpack auto-publicPath 找得到 bundle）
  ├─ wait for window.emception (set by upstream demo bundle)
  │   等 window.emception（上游 demo bundle 设置的）
  ├─ hide upstream demo UI elements · 隐藏上游 demo UI 元素
  └─ accept · 接收 {type:'run', id, code, stdin?, mode?} via postMessage
       mode: 'preinput' (default · 默认, sync stdin from string · 同步 stdin 从字符串)
           | 'jspi' (real wasm suspend · 实时挂起 wasm)
       │
       ├─ writeFile /working/main.c → emcc → read /working/main.js
       │  using · 使用: emcc -O0 -sSINGLE_FILE=1 -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1
       │  (NO -fexceptions — JS-based EH invoke_* trampolines insert
       │   JS frames between wasm frames, and JSPI cannot suspend through them)
       │  （NO -fexceptions —— JS-based EH 的 invoke_* 蹦床会引入 JS 帧，
       │    JSPI 不能穿过 JS 帧挂起）
       │
       ├─ temporarily patch · 临时 patch WebAssembly.instantiate / instantiateStreaming:
       │   · replace · 替换 fd_write / __syscall_write / __syscall_writev (fd 1/2)
       │     → call · 直接调 onStdout / onStderr, BYPASSING emcc's TTY line buffer
       │     (without this `printf("Name? ")` with no '\n' would sit trapped in
       │      emcc's internal line buffer until a newline shows up)
       │     （之前 printf("Name? ") 没 \n 会卡在 emcc 内部 buffer 里）
       │   · JSPI mode additionally · JSPI 模式额外: wrap fd_read / __syscall_read /
       │     __syscall_readv / __syscall_pread64 (fd 0) with
       │     new WebAssembly.Suspending(asyncFn). asyncFn posts 'input-request'
       │     to the parent and awaits 'input-response'; wasm stack truly parks.
       │     wasm 栈在此期间真挂起。
       │   · JSPI also wraps the entry export (__main_argc_argv / _main)
       │     with WebAssembly.promising() — without that the Suspending import
       │     throws "no active suspender".
       │     否则 Suspending 抛 "no active suspender"。
       │
       ├─ execute · 执行 main.js via `new Function('Module', code)(Module)`
       │   Module.noInitialRun = useJspi (JSPI 模式我们自己 await promisingMain)
       │   Module.stdin = () => null  ← defensive: prevents emcc's default TTY
       │                                fallback from calling window.prompt()
       │                                兜底防 emcc TTY 默认 fallback 调 window.prompt()
       │
       ├─ postMessage back · 回 {type:'runtime-start', id} — compile done, program about to run.
       │   编译完、程序开跑。parent prints a cyan "[compiled — running]" divider on receipt.
       │   parent 据此打印 "[compiled — running]" cyan 分隔。
       ├─ postMessage back · 回 {type:'stdout'|'stderr', id, text} — program output · 程序输出.
       ├─ JSPI mode · 模式: postMessage back {type:'input-request', id} when stdin reads.
       │   parent reads a line from the xterm and replies {type:'input-response', id, text}.
       │   parent 用 xterm 等用户回车，再 {type:'input-response', id, text} 回来。
       └─ postMessage back · 回 {type:'done', id, exitCode, error?} — wrapped up · 收工.
```

The whole emception demo branch is **mirrored locally** under `lib/runtime/webC/` (~450 MB, 522 files). This is necessary because:
- Cross-origin Workers are forbidden by browsers (CORS doesn't unlock them)
- Loading from jsDelivr would put `main.bundle.js` cross-origin → its workers fail with `SecurityError`
- Same-origin mirror sidesteps every cross-origin restriction

整个 emception demo 分支**本地镜像**在 `lib/runtime/webC/`（~450 MB，522 个文件）。必须这样因为：
- 浏览器禁止跨域 Worker（CORS 解锁不了）
- 从 jsDelivr 加载会让 `main.bundle.js` 跨域 → 它的 worker 报 `SecurityError`
- 同源镜像绕开所有跨域限制

Cloudflare Pages handles 450 MB easily (25 GB / 20k file limits, **unlimited bandwidth**). The browser only fetches what each program needs — typically **~25–30 MB on first C entry**, cached forever after.

Cloudflare Pages 处理 450 MB 不在话下（25 GB / 20k 文件上限，**带宽无限**）。浏览器只 fetch 程序需要的部分——首次进 C 通常 **~25-30 MB**，之后永久缓存。

**C-family modal gate · C-family 模态框拦截**: any course with `family: 'c'` in its manifest entry triggers `gateCFamilyAccess()` (in `learn/learn-core.js`) before render. The modal warns about download size and `file://` incompatibility. Confirmation is sticky in `localStorage['louie-learn:cfamily-loaded']`. To re-prompt: clear that key.

任何 manifest 条目里有 `family: 'c'` 的课程在渲染前都触发 `gateCFamilyAccess()`（`learn/learn-core.js`）。模态框警告下载量和 `file://` 不兼容。确认会持久化到 `localStorage['louie-learn:cfamily-loaded']`。要重新提示：清这个 key。

**Compile flags currently used · 当前编译参数**:
```
emcc -O0 -sSINGLE_FILE=1 -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 main.c -o main.js
```

- `-sSINGLE_FILE=1` — embed wasm as base64 in JS (one-file output) · 把 wasm 以 base64 嵌进 JS（单文件输出）
- `-sEXIT_RUNTIME=1` — fire `Module.onExit(status)` when main returns (so we know exit code) · main 返回时触发 `Module.onExit(status)`（拿到退出码）
- `-sFORCE_FILESYSTEM=1` — wire `/dev/stdin` to `Module.stdin` (without it emcc may strip FS init) · 把 `/dev/stdin` 接到 `Module.stdin`

### C runtime — past limitations & current status · C 运行时 — 之前的限制 & 现状

1. ~~**No interactive `scanf`/`getchar`**~~ **Resolved · 已解决.**
   We now use **JSPI** (JavaScript Promise Integration) — `WebAssembly.Suspending(asyncFn)` wraps stdin imports (`fd_read` / `__syscall_read*`), `WebAssembly.promising` wraps the entry export. The wasm stack truly suspends at `scanf`, the parent fetches a line from the xterm terminal via postMessage, and after the user presses Enter wasm resumes. No ASYNCIFY anywhere (we tried that early; emception's particular emscripten build corrupted the ASYNCIFY state machine on first call. JSPI uses the browser's native promise integration and has no relation to ASYNCIFY).
   现在用 **JSPI**（JavaScript Promise Integration）—— `WebAssembly.Suspending(asyncFn)` 包 stdin import，`WebAssembly.promising` 包 main entry。wasm 栈在 scanf 处真挂起，完全没用 ASYNCIFY。
   **Browser requirements · 浏览器要求**: Chromium 137+ / Safari 26+ / Firefox 144+. Older browsers get a fallback — each C lesson page has a top-right "Pre-input mode (not recommended)" toggle. Default OFF (JSPI); manually ON drains stdin from a textarea synchronously. 老浏览器走 fallback——课时页右上 "预输入模式（不推荐）" toggle 默认 OFF（JSPI）。
   **Grading always uses pre-input mode** regardless of the user's toggle state — auto-tests need deterministic input. **判分始终走预输入模式**（不管 toggle 状态）。

2. ~~**stdout buffering can reorder output around `scanf`**~~ **Resolved · 已解决.**
   We no longer rely on libc line buffering. `postmsg-bridge.js` swaps out `fd_write` / `__syscall_writev` / `__syscall_write` imports (fd 1/2) at runtime for non-suspending JS functions that pipe bytes straight to `onStdout` / `onStderr`, **completely bypassing emcc's TTY line-buffer pipeline**. `printf("Name? ")` with no `\n` shows up instantly.
   不再依赖 libc 行缓冲：`postmsg-bridge.js` 运行时把 `fd_write` / `__syscall_writev` / `__syscall_write` import 整个替换成"直通 onStdout / onStderr"的非挂起 JS 函数，**完全绕过 emcc 的 TTY 行缓冲管道**。
   ⇒ Lesson authors no longer need to hack `\n` or `fflush(stdout);` around prompts. ⇒ 课时作者不再需要为这件事 hack 加 `\n` 或 `fflush(stdout);`。

3. **First-time C load is slow on cold cache** (~25–30 MB). Mitigated by · 缓解:
   - The C-family modal warning users upfront · C-family 模态框先警告
   - The progress bar in the playground showing real bytes-loaded · playground 进度条显示真实下载字节
   - Browser HTTP cache + Cloudflare edge cache making subsequent loads instant · 浏览器 HTTP 缓存 + Cloudflare 边缘缓存让后续访问秒开

4. **`file://` users see a "needs HTTPS" message** instead of the playground/lesson. emception's worker construction needs HTTPS or `http://localhost`. · `file://` 用户看到 "needs HTTPS" 提示而不是 playground/课时。

5. **`-fexceptions` cannot be used.** JS-based C++ EH installs `invoke_*` JS trampolines; JSPI cannot suspend through JS frames (throws `SuspendError: trying to suspend JS frames`). So the compile flags deliberately omit `-fexceptions` — libc++ links its no-exceptions variant. If C++ exceptions are ever needed, switch to `-fwasm-exceptions` (wasm-native EH, no JS frames inserted). · `-fexceptions` 不能用。如果将来真需要 C++ 异常，得换 `-fwasm-exceptions`（wasm 原生 EH，不插 JS 帧）。

### C playground — defaults · 默认值

When the user opens `#c/playground` (after dismissing the C-family modal), the editor pre-loads a teaching demo that touches every C concept the playground supports:

用户打开 `#c/playground`（在 C-family 模态框确认后），编辑器预加载一段示教 demo，覆盖 playground 支持的每个 C 概念：

```c
#include <stdio.h>

int main(void) {
    char name[64];
    int  age;
    char *p = name;          // pointer to the array's first element · 指向 name 首元素的指针

    printf("What's your name?\n");
    scanf("%63s", p);        // write the name through the pointer · 通过指针 p 写名字

    printf("How old are you?\n");
    scanf("%d", &age);       // &age is the address of `age` (also a pointer) · &age 是 age 的地址

    printf("Hello, %s! You are %d years old.\n", p, age);
    return 0;
}
```

Stdin textarea is pre-filled with `Louie\n19` so a single click on Run produces a complete output without any user typing. Comments switch between zh and en based on `currentLang`. Definition lives in `renderCPlayground()` in `learn/learn-views.js`.

stdin textarea 预填 `Louie\n19`，所以一键 Run 就能得到完整输出，用户不用打字。注释根据 `currentLang` 在 zh/en 间切换。定义在 `learn/learn-views.js` 的 `renderCPlayground()`。

### emcc stderr formatting · emcc stderr 格式化

emception forwards emcc's compiler messages line-by-line to `Module.printErr`, but each call carries no trailing newline. Without intervention, multi-line errors squash into one wrapped blob. `postmsg-bridge.js`'s compile-time `onOut` / `onErr` handlers wrap output through `withTrailingNl()` so each line lands on its own line in the terminal. ANSI color codes (e.g. `\x1b[32m`) are stripped, and emscripten internal info messages matching `^[a-z_]+:(INFO|DEBUG):` (like `shared:INFO: (Emscripten: Running sanity checks)`) are dropped — they're noise for students.

emception 把 emcc 的编译消息逐行转发到 `Module.printErr`，但每次调用末尾不带换行。不处理的话多行错误会挤成一坨。`postmsg-bridge.js` 的编译期 `onOut` / `onErr` 包装通过 `withTrailingNl()` 让每行单独成行。ANSI 颜色码被剥掉，匹配 `^[a-z_]+:(INFO|DEBUG):` 的 emscripten 内部信息被丢弃——对学生是噪声。

---

## Right-pane editor layout · 右面板编辑器布局

The lesson and playground views share a single right-pane structure (`.editor-pane`). It uses absolute positioning to give Monaco a stable container size — `flex` and `overflow:auto` together caused several initial-render races where Monaco locked to ~10 lines.

课时和 playground 共用一套右面板结构（`.editor-pane`）。用绝对定位给 Monaco 一个稳定的容器尺寸——`flex` + `overflow:auto` 同用会让 Monaco 锁在 ~10 行。

```
┌──────────────────────────────────────┐  ← .editor-pane (background · 背景: var(--surface))
│  ╭────────────────────────────────╮  │
│  │                                │  │  ← .tab-pane.code-tab.is-active (background: #1e1e1e)
│  │   Monaco editor (.editor-fill) │  │     position: absolute; top: 0; bottom: 50px;
│  │   [reset][hint][answer]        │  │     border-bottom-radius: 14px (Chrome-tab merge)
│  │   ← .tab-actions (top-right)   │  │
│  ╰╮                              ╭╯  │
│   │                              │   │
│   │ [Code][Input][Output] ▶ ✓    │   │  ← .editor-foot (height: 50px)
│   │                              │   │     ↑ tabs (left)        ↑ Run/Submit (right)
│   ╰──────────────────────────────╯   │
└──────────────────────────────────────┘
```

Key CSS rules (in `learn/learn.css`, all marked `!important` because they need to defeat the more-specific `body.lesson-mode .lesson-pane { padding; overflow }` rules) · 关键 CSS（`learn/learn.css` 里都用 `!important`）:

- `.editor-pane` — `padding: 0; position: relative; overflow: hidden; background: var(--surface)`
- `.editor-pane .tab-pane` — `position: absolute; top: 0; left: 0; right: 0; bottom: 50px; background: #1e1e1e; border-bottom-{left,right}-radius: 14px; overflow: hidden`. Hidden by default (`display: none`); active tab gets `display: block`. · 默认 `display: none`；激活 tab 显示 `display: block`。
- `.editor-pane .editor-fill` — Monaco container, `position: absolute; inset: 0; width: 100%; height: 100%`.
- `.editor-pane .editor-foot` — `position: absolute; bottom: 0; left: 0; right: 0; height: 50px` — bottom action bar · 底部操作栏.
- `.tab-strip` / `.tab-btn` — Excel-style sheet tabs hanging from the foot's top edge. Active tab uses `background: #1e1e1e` (matching the editor) and `margin-top: -1px` to fuse seamlessly with the editor card above. · 激活 tab 用 `background: #1e1e1e`（和编辑器同色）+ `margin-top: -1px` 无缝融入上方编辑器卡片。

Monaco internally renders its own scrollbar / overflow-guard layers that sometimes bypass the parent's `border-radius` clip — `learn/learn.css` adds an explicit `border-bottom-{left,right}-radius` on `.editor-pane .tab-pane.code-tab .monaco-editor` and its `.overflow-guard` to keep both bottom corners clean.

Monaco 内部渲染自己的滚动条 / overflow-guard 层，有时绕过父容器的 `border-radius` 裁剪——`learn/learn.css` 在 `.editor-pane .tab-pane.code-tab .monaco-editor` 和它的 `.overflow-guard` 上显式加 `border-bottom-{left,right}-radius` 让两个底角都干净。

`createCodeEditor(container, { fillParent: true })` is the entry point. It runs `ed.layout({ width, height })` at four points (RAF, +50ms, +200ms, +600ms) to recover from the case where the parent's layout isn't fully resolved at create-time.

`createCodeEditor(container, { fillParent: true })` 是入口。它在 4 个时刻调 `ed.layout({ width, height })`（RAF、+50ms、+200ms、+600ms）以恢复创建时父布局未稳定的情况。

---

## How to add a new lesson (SQL) · 添加新课时（SQL）

1. Pick an `id` (next free integer in the course). · 挑 `id`（课程里下一个空整数）。
2. Pick a `slug` (lowercase, hyphenated: `having-filter`, `cross-join-basics`). · 挑 `slug`（小写、连字符）。
3. Decide the schema · 决定 schema:
   - If an existing schema fits, reuse its name in `@@schema`. · 现有 schema 合适，`@@schema` 里复用其名。
   - Otherwise create `learn/learn_data/sql/schemas/c<id>_schema.js` and add the entry to `course.schemas` in `learn/learn_data/sql/course.js`. · 否则建 `learn/learn_data/sql/schemas/c<id>_schema.js`，并在 `learn/learn_data/sql/course.js` 的 `course.schemas` 里加条目。
4. Create `learn/learn_data/sql/lessons/<NN>-<slug>.js` using the format above. · 用上面的格式建文件。
5. Append the index entry to `course.lessons` in `learn/learn_data/sql/course.js`. · 把索引条目追加到 `course.lessons`。
6. Bump `lessonsCount` in `learn/learn_data/manifest.js` if visible. · 如果可见数有变，改 `manifest.js` 的 `lessonsCount`。

**SQL grader rules · 判题规则:**

1. **Match `expectedSql` to the task exactly**: if the task says "name and age", `expectedSql` must `SELECT name, age` — not `SELECT *`. · **`expectedSql` 严格对应任务**。
2. **SQLite dialect**: dates are ISO strings (`'YYYY-MM-DD'`); comparison is lexicographic AND chronological for that format. No `RIGHT JOIN` or `FULL OUTER JOIN`. · **SQLite 方言**：日期是 ISO 字符串；**没有** `RIGHT JOIN` 或 `FULL OUTER JOIN`。
3. **`checkOrder: false` (default)**: both result sets are sorted before compare. Set `true` only for `ORDER BY` / `LIMIT` lessons. · 两边结果集都先排序再比对。
4. **Hints nudge, don't solve**: "Try `WHERE`" beats giving the answer. · **提示是引导，不是答案**。
5. **Write the schema first, then the task, then `expectedSql`** — this proves the problem is solvable and the data set is sufficient. · **先写 schema，再写任务，再写 `expectedSql`**——确认题目能解、数据集够。

## How to add a new lesson (Python) · 添加新课时（Python）

1. Pick an `id`. · 挑 `id`。
2. Pick a `slug` (derived from English title, e.g., `for-loop-basics`). · 挑 `slug`（从英文标题派生）。
3. Create `learn/learn_data/python/lessons/<NN>-<slug>.js`. · 建文件。
4. Append the index entry to `course.lessons` in `learn/learn_data/python/course.js`. · 把索引条目追加到 `course.lessons`。
5. No schema work — Python lessons are self-contained. · 不需要 schema 工作——Python 课时自包含。

**Python grader rules · 判题规则:**

1. **`expectedOutput` must match stdout exactly** (after trim). If the task says "print the sum", make sure `answer` produces *only* that, with the right trailing `\n`. · **`expectedOutput` 必须严格匹配 stdout**（trim 后）。
2. **`testInputs` order matches `input()` calls**. Inputs are strings (Python's `input()` returns string). · **`testInputs` 顺序与 `input()` 调用顺序一致**。
3. **Sandbox limits**: no file I/O, no network. If a topic needs a file, simulate the content as a string variable. · **沙箱限制**：没文件 I/O、没网络。
4. **Skulpt is Python 3-ish but not 100%** — see "Engines / Python" above for what works. · **Skulpt 是 Python 3 风格但不 100%**——见上面"引擎 / Python"。

## How to add a new lesson (C) · 添加新课时（C）

1. Pick an `id` (next free integer; the `c` core-syntax course is 1–44, `c-algo` is 1–25 — they're independently numbered). · 挑 `id`（下一个空整数；`c` 是 1–44，`c-algo` 是 1–25——两个课程独立编号）。
2. Pick a `slug` (`hello-c`, `pointers`, `malloc-free`, …). · 挑 `slug`。
3. Decide the section: `'main'` for syntax, `'stdlib'` for `<header.h>` lessons; `c-algo` uses `'main'` for everything. · 决定 section：基础语法课用 `'main'`，`<header.h>` 课时用 `'stdlib'`；`c-algo` 全部用 `'main'`。
4. Create `learn/learn_data/<course-slug>/lessons/<NN>-<slug>.js` (course-slug is either `c` or `c-algo`). · 建 `learn/learn_data/<course-slug>/lessons/<NN>-<slug>.js`（course-slug 是 `c` 还是 `c-algo`）。
5. Append the index entry to `course.lessons` in `learn/learn_data/<course-slug>/course.js`. Bump `lessonsCount` in `learn/learn_data/manifest.js`. · 把索引条目追加到对应 `course.lessons`。`manifest.js` 的 `lessonsCount` 也 +1。

**C grader rules · 判题规则:**

1. **`expectedOutput` is whitespace-tolerant trim compare** against stdout. Stderr is included so compile errors are visible. · **`expectedOutput` 是空白容忍的 trim 比对**对 stdout。stderr 也加进来。
2. **`testInputs` array is joined by newlines and pre-filled into stdin.** Grading **always uses pre-input mode** (even when the user's toggle is in JSPI/live mode) so the test is deterministic. · **`testInputs` 数组用换行 join 后预填进 stdin**。判分**始终走预输入模式**。
3. **Prompts do NOT need a trailing `\n`.** The bridge now bypasses emcc's TTY line buffer at runtime, so `printf("Name? ")` shows up immediately. In fact for nicer interactive UX, leave the `\n` off so the cursor stays inline — the resulting graded output is a single line like `Please enter your name: Hello, Alice!`. · **prompt 不需要末尾 `\n`**——bridge 已运行时绕过 emcc 的 TTY 行缓冲。事实上为了好看的交互体验，prompt 末尾**不要**加 `\n`。
4. **Pin RNG / time-dependent output**. `srand(time(NULL))` will fail grading because output varies; use a fixed seed (`srand(42)`) or check only invariants (`time(NULL) > 0`). · **固定 RNG / 时间相关的输出**。

## How to add a new course · 添加新课程

1. Pick a slug (lowercase, hyphenated). The folder name = the slug. · 挑 slug（小写、连字符）。文件夹名 = slug。
2. Create `learn/learn_data/<slug>/course.js` registering with `LEARN.course('<slug>', { type: 'sql' | 'python' | 'c', ... })`. · 建文件并注册。
3. Create `lessons/` (and `schemas/` if SQL). · 建 `lessons/`（SQL 还要 `schemas/`）。
4. Add an entry to `learn/learn_data/manifest.js`. · 在 `manifest.js` 加条目。

A new language type (e.g., JavaScript, Rust) requires runtime work — adding an `ensure<Language>()` engine wrapper in `learn/learn-engines.js`, a grading path in `learn/learn-lesson.js`, and a playground in `learn/learn-views.js`. Match the C course's structure as the reference: it has the most complex runtime gating and is the cleanest example.
