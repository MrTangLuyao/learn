# README

> [Read in English](#english-version)

---

## 架构概览

**零编译、零后端、按需懒加载每一节课。**

- SQL 和 Python 100% 在浏览器跑——sql.js（SQLite asm.js）和 Skulpt——通过 `<script>` 标签加载。`file://` 本地能跑。
- C 体量大些：通过 [emception](https://github.com/jprendes/emception) 在隐藏 `<iframe>` 里跑真实的 **clang** 编译器。iframe 同源（镜像在 `lib/runtime/webC/`），所以 `<script>` 和 Worker 创建都不会撞跨域。**C 课程必须 HTTPS 或 `http://localhost`**；纯 `file://` 会被 C-family 模态框拦下。
- 课程的元数据 + 课时索引在用户打开课程时加载；每节课的完整内容（以及它引用的 SQL schema）等用户点进那一节才加载。

每门课首次访问的下载量（之后浏览器缓存，免费）：
- SQL：~8 KB 课程索引 + 每节 ~5–15 KB
- Python：~6 KB 课程索引 + 每节 ~3–10 KB
- **C：~25–30 MB**（clang.wasm + libc/libc++ 归档）首次进任意 C-family 课程（`c` 基础语法 / `c-algo` 算法）或 playground 时；之后免费。`c` 和 `c-algo` 共享同一份 emception 缓存。

---

## 目录结构

> 注意：本仓库的 HTML 入口是根目录下的 **`index.html`**（同时充当 GitHub Pages 根页和历史上的 `learn.html`，JS 注释里还叫它 `learn.html`）。README 在两处都有：仓库根目录（`README.md` 加遗留的 `learn_readme.md` / `learn_readme_c.md`），和应用内可发现的 `learn/learn_data/` 下的副本。

```
<repo root>
├── index.html                          ← 交互 UI（routing, rendering, engines）
├── README.md                           ← 本文件
├── learn_readme.md                     ← 遗留英文版 README
├── learn_readme_c.md                   ← 遗留中文版 README
├── CNAME                               ← CF Pages 自定义域名
├── LICENSE
│
├── learn/
│   ├── learn-core.js                   ← loadCourse / loadLesson / loadSchema,
│   │                                     涟漪、分隔条、进度、课程缓存
│   ├── learn-engines.js                ← sql.js + Skulpt + Monaco + emception 封装、
│   │                                     结果表格渲染辅助
│   ├── learn-terminal.js               ← Python / C 课时和 playground 共用的 xterm 终端
│   │                                     （SQL 保持表格输出）
│   ├── learn-i18n.js                   ← zh / en 翻译 + applyLang / tt / pickLang
│   ├── learn-lesson-parser.js          ← `@@key` 解析器 + LEARN.{course,lesson,schema}
│   │                                     注册函数 + assembleOneLesson
│   ├── learn-views.js                  ← 课程列表、课时列表、playgrounds
│   ├── learn-lesson.js                 ← 课时运行器（SQL/Python/C 判题）、hash 路由、启动
│   ├── learn.css                       ← 共享样式（含 .editor-pane 布局）
│   └── learn_data/
│       ├── learn_readme.md             ← 应用内英文 README 副本
│       ├── learn_readme_c.md           ← 应用内中文 README 副本
│       ├── manifest.js                 ← 课程目录（window.__LEARN_MANIFEST）
│       ├── sql/
│       │   ├── course.js               ← 元数据 + 课时索引 + schema manifest
│       │   ├── schemas/<name>.js       ← 共享 SQL schema
│       │   └── lessons/<NN>-<slug>.js  ← 每节内容
│       ├── python/
│       │   ├── course.js               ← 元数据 + 课时索引（无 schemas）
│       │   └── lessons/<NN>-<slug>.js
│       ├── c/
│       │   ├── course.js               ← 元数据 + 课时索引（无 schemas）；
│       │   │                             'main'（语法）和 'stdlib' 两段
│       │   └── lessons/<NN>-<slug>.js  ← 共 44 节（30 节语法 + 14 节标准库）
│       └── c-algo/                     ← C 算法入门（Beta），与 c 共享 emception 运行时
│           ├── course.js               ← 元数据 + 课时索引；family: 'c'
│           └── lessons/<NN>-<slug>.js  ← 共 25 节（算法 + 数据结构）
│
└── lib/
    ├── design/                         ← 视觉资源（fonts, M3 tokens, shared CSS）
    ├── resources/                      ← 静态图片（po.webp 等）
    └── runtime/
        ├── sql-asm.js                  ← sql.js 引擎（模块加载时立即初始化）
        ├── webPython/                  ← Skulpt Python 解释器（懒加载）
        ├── webC/                       ← emception clang 镜像（~450 MB，懒加载）
        │   ├── iframe.html             ← C 运行时 iframe 入口
        │   ├── postmsg-bridge.js       ← parent ↔ wasm postMessage 适配器
        │   ├── main.bundle.js          ← upstream emception webpack bundle (3 MB)
        │   ├── emception.worker.bundle.worker.js  (530 KB)
        │   ├── cecdfcda360457a8f204.br ← 压缩后的 clang (22 MB)
        │   └── 249 × *.a / *.gz        ← libc、libc++、libGL 等——按需 fetch
        ├── xterm/                      ← xterm.js 终端（learn-terminal.js 用）
        │   ├── xterm.min.js
        │   ├── xterm.min.css
        │   └── xterm-addon-fit.min.js
        └── monaco/vs/                  ← Monaco 编辑器（~3 MB，loader.js 立即加载，
                                          editor.main 懒加载）
```

---

## 加载流程

```
manifest.js (立即) ─┐
                    │
                    ▼
        用户点击课程卡片
                    │
                    ▼
   loadCourse(slug)        ← 注入 <slug>/course.js
                    │
                    ▼
   课程元数据 + 课时索引就绪（卡片渲染）
                    │
                    ▼
        用户点击某节课
                    │
                    ▼
   loadLesson(slug, id)    ← 注入 lessons/<NN>-<slug>.js
                    │
                    ▼
   该课设置了 @@schema 吗？
          │            │
         是             否
          │            │
          ▼            ▼
   loadSchema(...)   就绪
          │
          ▼
   注入 schemas/<name>.js
          │
          ▼
   lesson.setup ← LEARN._schemas[<slug>:<name>]
```

`loadCourse`、`loadLesson`、`loadSchema` 都做"飞行中请求去重"和"成功结果缓存"。一节课或 schema 拉过一次，整个会话里都在内存。

---

## `manifest.js` 字段

```js
window.__LEARN_MANIFEST = {
  version: 1,
  updated: 'YYYY-MM-DD',
  courses: [
    {
      slug: 'sql',                              // 必填——和文件夹名一致
      icon: 'SQL',                              // 卡片图标文字（也支持双语对象，
                                                //   如 c-algo: { zh: 'C 算法', en: 'C Algo' }）
      title: { zh: '...', en: '...' },
      desc:  { zh: '...', en: '...' },
      level: { zh: '入门', en: 'Beginner' },
      lessonsCount: 42,
      coming: false,                            // true → 灰显"Coming Soon"
      family: 'c',                              // 可选——会被 C-resource 模态框拦截
    }
  ]
};
```

manifest 只决定课程列表显示哪些卡片。课程**内容**藏在 `loadCourse(slug)` 后面。`family: 'c'` 目前是唯一的 family 值，触发 `gateCFamilyAccess()` 警告下载量再加载该 C 系课程。

---

## `course.js` 字段

每个课程文件调用 `LEARN.course(slug, meta)`。它带元数据、课时**索引**，以及（SQL 才有的）schema manifest：

```js
LEARN.course('sql', {
  slug: 'sql',
  type: 'sql',                                  // 'sql' | 'python' | 'c'
  title: { zh: '...', en: '...' },
  desc:  { zh: '...', en: '...' },

  hasPlayground: true,
  playgroundTitle:  { zh: '...', en: '...' },
  playgroundSchema: 'final_schema',             // 仅 SQL —— 来自下面的 `schemas`

  // 仅 SQL。schema 名 → 文件路径。loadSchema() 懒加载。
  schemas: {
    c1_schema:    'schemas/c1_schema.js',
    final_schema: 'schemas/final_schema.js',
    // ...
  },

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

`section` 默认 `'main'`。路由把 `'final'` 和 `'stdlib'` 当成独立分组渲染（"最终挑战" / "标准库" 各有自己的小标题）。C 课程同时用 `'main'`（语法部分）和 `'stdlib'`（`<stdio.h>`、`<string.h>` 等）。

---

## 课时文件格式（`@@key` 语法）

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

### `@@key` 规则

- `@@key value`（同一行剩余）—— 单行标量
- `@@key` 后接若干行直到下一个 `@@` —— 多行标量
- `@@key:zh` / `@@key:en` —— 双语变体；组装成 `{zh, en}`
- `@@`（双 @）是字段标记。单 `@` 会和 Python 装饰器在代码示例的列 0 处冲撞；`@@` 不会和任何真东西冲突。

### 末尾换行

解析器原样保留值——包括末尾的 `\n`。约定是**"下一个 `@@key` 前留一空行表示这个值末尾有 `\n`"**：

```
@@starter:zh
-- 在这里写你的 SQL              ← 值末尾没有 '\n'
@@starter:en

@@starter:zh
-- 在这里写你的 SQL
                                 ← 值末尾有 '\n'（光标停在干净的下一行）
@@starter:en
```

这影响 `starter`（Monaco 光标位置）和 `answer` / `expectedOutput`（Python、C 判题严格对比 stdout）。

### 双语规则

1. **每个散文字段都需要 `@@key:zh` 和 `@@key:en` 都给。** 课程是端到端双语的。
2. **HTML 原样输出。** `intro` / `task` / `hint` 用裸 HTML（`<p class="lead">`、`<pre><code>`、`<strong>`、`<code>`）。别切到 Markdown——解析器是原样透传，不是 Markdown 渲染器。

### 字段速查

| 字段             | 类型            | 位置                  | 备注                                           |
|------------------|-----------------|-----------------------|------------------------------------------------|
| `id`             | int             | `LEARN.lesson` 第 2 参数 + `course.js` 索引 | 稳定身份，路由和进度都用 |
| `section`        | string          | `course.js` 索引      | `'main'`（默认）、`'final'` 或 `'stdlib'`     |
| `slug`           | string          | `course.js` 索引      | URL 友好；用于文件名                           |
| `title`          | 双语            | `course.js` 索引      |                                                |
| `chapter`        | 双语            | `course.js` 索引      | 课时标题下的副标签                             |
| `chapterRef`     | string          | 课时文件              | 可选。<br>· `sql` / `python` / `c-algo`：链到 `blog.html#<chapterRef>`<br>· `c`（基础语法）：忽略，固定链到菜鸟教程主页 |
| `difficulty`     | 双语            | 课时文件              | "入门" / "Beginner" 等                         |
| `intro`          | 双语 HTML       | 课时文件              | 长篇课时讲解                                   |
| `task`           | 双语 HTML       | 课时文件              | 用户要完成什么                                 |
| `hint`           | 双语 HTML       | 课时文件              | 可选，按需展示                                 |
| `warning`        | 双语 HTML       | 课时文件              | 可选 —— 警告 / 浏览器沙箱说明                   |
| `subtitle`       | 双语 HTML       | 课时文件              | 可选                                           |
| `starter`        | 双语代码        | 课时文件              | 编辑器初始内容                                 |
| **仅 SQL**       |                 |                       |                                                |
| `schema`         | string          | 课时文件              | 来自 `course.schemas` 的名字；解析为 `setup`  |
| `tables`         | array           | 课时文件              | 在左面板预览的表名                             |
| `expectedSql`    | string          | 课时文件              | 判题在同一个 fresh DB 上跑这条                 |
| `checkOrder`     | bool            | 课时文件              | `true` → 行顺序也要匹配（ORDER BY/LIMIT）      |
| **Python / C**   |                 |                       |                                                |
| `answer`         | code            | 课时文件              | 参考答案（"显示答案"揭开）                     |
| `expectedOutput` | string          | 课时文件              | 判题对比 stdout（trim 后）                     |
| `testInputs`     | array           | 课时文件              | 判题时喂给 `input()` (Py) / stdin (C) 的字符串 |

双语字段是 `@@key:zh` 和 `@@key:en` 块。string/int/bool 标量字段是普通 `@@key` 块。`tables` 是逗号或空格分隔。`testInputs` 一行一项。

---

## Schema 文件格式（仅 SQL）

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

完全限定名是 `<courseSlug>:<schemaName>`。课程文件只引用 `<schemaName>`（`@@schema c1_schema`），课程 slug 自动加上。

### 复用规则（保守）

- **`final_schema`** —— 大共享图书馆/书店数据库。每节"最终挑战"和 playground 都用它。
- **`c<N>_schema`** —— 第 N 节独占（大多数课时）。
- **多节共享时取最小成员的 id 做名字**（L3 + L5 共享则叫 `c3_schema`）。
- **必须字节相同才能合并**。两节哪怕差一行就分开。别为美观合并——原则是"作者特意挑了这些行，尊重它"。
- **真正可命名的共享概念**（如 `students_basic`、`books_with_genre`）可以给语义名字，但用得克制。

---

## 引擎

### SQL —— sql.js（SQLite，asm.js）
- 通过 `<script src="lib/runtime/sql-asm.js">` 立即加载。
- `ensureSql()` 初始化一次后缓存。
- 每节课跑在**全新内存 DB**上——前一节的查询不会泄露状态。
- SQL Playground 整个会话**保持同一个 DB**。"加载示例表"懒加载 `playgroundSchema` 然后跑；"重置表"清空。

### Python —— Skulpt
- 第一次进 Python 课时或 playground 才加载（`ensurePython()`）。
- 输出被捕获用于判题。`input()` 在交互运行时由页内终端泵；判题运行时按顺序从 `testInputs` 拉。
- 硬运行时上限：`yieldLimit: 100`（事件循环 yield 节奏），`execLimit: 10000`（10 秒后超时）。
- Skulpt 是 Python 3 风格但不 100%。f-strings、列表/字典/集合推导式、基础 stdlib（`math`、`random`、`re`）能用；`numpy`、`pandas`、`requests` 等不行。

### 终端 —— xterm.js

`learn-terminal.js` 把 **xterm.js**（`lib/runtime/xterm/xterm.min.js` + `xterm-addon-fit.min.js`）封装成 Python 和 C 课时 / playground 共用的交互式终端。SQL 仍走表格结果渲染。

### 代码编辑器 —— Monaco
- 住在 `lib/runtime/monaco/vs/`。安装方式：下载 monaco-editor 的 npm tarball，把 `package/min/vs/` 解压到这里。
- `vs/loader.js`（小型 AMD loader）由 `index.html` 立即拉。`vs/editor/editor.main`（~3 MB）由 `ensureMonaco()` 在第一次打开课时或 playground 时懒加载。
- 通过 `createCodeEditor(container, opts)` 创建。两种高度模式：
  - `fillParent: true` —— 容器高度由父级 CSS 决定（课时视图带 `.editor-pane` 用这个）；函数会在创建后多次调 `ed.layout()` 解决初始渲染竞态。
  - 默认 —— 按内容从 `minLines` 到 `maxLines` 自动扩展（类 Ace）。
- Worker 路由到空 `data:` URL，让语言服务降级到主线程跑（`file://` 兼容必需）。DevTools 里那些 `data:text/javascrip…` 0 字节请求是正常的，过滤 `-data:` 隐藏。

### C —— emception（浏览器内真实 clang）

C 是个特殊场景。浏览器没有好用的"C 解释器"库（试过 JSCPP、TCC.wasm，都坏）。唯一可行的方案是用 [emception](https://github.com/jprendes/emception) 把真正的 LLVM/clang 编译成 WebAssembly——它是个完整的 IDE 应用，不是干净的库。

**架构**（`learn/learn-engines.js` 的 `ensureC()`）：

```
index.html（父）
  │ 创建隐藏 <iframe src="lib/runtime/webC/iframe.html">
  ▼
iframe.html
  │ <script src="postmsg-bridge.js">
  ▼
postmsg-bridge.js
  ├─ 流式拉 main.bundle.js（带字节进度 UI）
  ├─ 通过 <script src=> 注入（让 webpack auto-publicPath 找得到 bundle）
  ├─ 等 window.emception（上游 demo bundle 设置的）
  ├─ 隐藏上游 demo UI 元素
  └─ 通过 postMessage 接收 {type:'run', id, code, stdin?, mode?}
       mode: 'preinput'（默认，同步 stdin 从字符串）
           | 'jspi'（实时挂起 wasm）
       │
       ├─ writeFile /working/main.c → emcc → read /working/main.js
       │  使用: emcc -O0 -sSINGLE_FILE=1 -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1
       │  （NO -fexceptions —— JS-based EH 的 invoke_* 蹦床会引入 JS 帧，
       │    JSPI 不能穿过 JS 帧挂起）
       │
       ├─ 临时 patch WebAssembly.instantiate / instantiateStreaming:
       │   · 替换 fd_write / __syscall_write / __syscall_writev (fd 1/2)
       │     → 直接调 onStdout / onStderr，绕过 emcc 的 TTY 行缓冲
       │     （之前 printf("Name? ") 没 \n 会卡在 emcc 内部 buffer 里）
       │   · JSPI 模式额外：包装 fd_read / __syscall_read /
       │     __syscall_readv / __syscall_pread64 (fd 0) 用
       │     new WebAssembly.Suspending(asyncFn)。asyncFn 向 parent 发
       │     'input-request' 并等 'input-response'；wasm 栈在此期间真挂起。
       │   · JSPI 还包装入口 export（__main_argc_argv / _main）用
       │     WebAssembly.promising()，否则 Suspending 抛 "no active suspender"。
       │
       ├─ 通过 `new Function('Module', code)(Module)` 执行 main.js
       │   Module.noInitialRun = useJspi（JSPI 模式我们自己 await promisingMain）
       │   Module.stdin = () => null  ← 兜底防 emcc TTY 默认 fallback 调 window.prompt()
       │
       ├─ 回 {type:'runtime-start', id} —— 编译完、程序开跑。
       │   parent 据此打印 "[compiled — running]" cyan 分隔。
       ├─ 回 {type:'stdout'|'stderr', id, text} —— 程序输出。
       ├─ JSPI 模式：stdin 读取时回 {type:'input-request', id}。
       │   parent 用 xterm 等用户回车，再 {type:'input-response', id, text} 回来。
       └─ 回 {type:'done', id, exitCode, error?} —— 收工。
```

整个 emception demo 分支**本地镜像**在 `lib/runtime/webC/`（~450 MB，522 个文件）。必须这样因为：
- 浏览器禁止跨域 Worker（CORS 解锁不了）
- 从 jsDelivr 加载会让 `main.bundle.js` 跨域 → 它的 worker 报 `SecurityError`
- 同源镜像绕开所有跨域限制

Cloudflare Pages 处理 450 MB 不在话下（25 GB / 20k 文件上限，**带宽无限**）。浏览器只 fetch 程序需要的部分——首次进 C 通常 **~25–30 MB**，之后永久缓存。

**C-family 模态框拦截**：任何 manifest 条目里有 `family: 'c'` 的课程在渲染前都触发 `gateCFamilyAccess()`（`learn/learn-core.js`）。模态框警告下载量和 `file://` 不兼容。确认会持久化到 `localStorage['louie-learn:cfamily-loaded']`。要重新提示：清这个 key。

**当前编译参数**：
```
emcc -O0 -sSINGLE_FILE=1 -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 main.c -o main.js
```

- `-sSINGLE_FILE=1` —— 把 wasm 以 base64 嵌进 JS（单文件输出）
- `-sEXIT_RUNTIME=1` —— main 返回时触发 `Module.onExit(status)`（拿到退出码）
- `-sFORCE_FILESYSTEM=1` —— 把 `/dev/stdin` 接到 `Module.stdin`（否则 emcc 可能裁掉 FS 初始化）

### C 运行时 —— 之前的限制 & 现状

1. ~~**没有交互式 `scanf`/`getchar`**~~ **已解决。**
   现在用 **JSPI**（JavaScript Promise Integration）—— `WebAssembly.Suspending(asyncFn)` 包 stdin import（`fd_read` / `__syscall_read*`），`WebAssembly.promising` 包入口 export。wasm 栈在 `scanf` 处真挂起，parent 通过 postMessage 从 xterm 终端取一行，用户按 Enter 后 wasm 恢复。完全没用 ASYNCIFY（早期试过；emception 那套 emscripten 构建在首次调用时把 ASYNCIFY 状态机搞坏了。JSPI 用浏览器原生的 promise 集成，和 ASYNCIFY 无关）。
   **浏览器要求**：Chromium 137+ / Safari 26+ / Firefox 144+。老浏览器走 fallback —— 每个 C 课时页面右上角有一个"预输入模式（不推荐）"toggle。默认 OFF（JSPI）；手动 ON 则从 textarea 同步排空 stdin。
   **判分始终走预输入模式**（不管 toggle 状态）—— 自动测试需要确定性输入。

2. ~~**stdout 缓冲会让输出在 `scanf` 周围乱序**~~ **已解决。**
   不再依赖 libc 行缓冲：`postmsg-bridge.js` 运行时把 `fd_write` / `__syscall_writev` / `__syscall_write` import (fd 1/2) 整个替换成"直通 onStdout / onStderr"的非挂起 JS 函数，**完全绕过 emcc 的 TTY 行缓冲管道**。`printf("Name? ")` 没 `\n` 也立刻显示。
   ⇒ 课时作者不再需要为这件事 hack 加 `\n` 或 `fflush(stdout);`。

3. **冷缓存下首次加载 C 慢**（~25–30 MB）。缓解：
   - C-family 模态框先警告用户
   - playground 的进度条显示真实下载字节
   - 浏览器 HTTP 缓存 + Cloudflare 边缘缓存让后续访问秒开

4. **`file://` 用户会看到 "needs HTTPS" 提示**而不是 playground/课时。emception 的 Worker 创建需要 HTTPS 或 `http://localhost`。

5. **`-fexceptions` 不能用。** JS-based C++ EH 装 `invoke_*` JS 蹦床；JSPI 不能穿过 JS 帧挂起（抛 `SuspendError: trying to suspend JS frames`）。所以编译参数故意省掉 `-fexceptions`，libc++ 链 no-exceptions 变体。如果将来真需要 C++ 异常，得换 `-fwasm-exceptions`（wasm 原生 EH，不插 JS 帧）。

### C playground —— 默认值

用户打开 `#c/playground`（在 C-family 模态框确认后），编辑器预加载一段示教 demo，覆盖 playground 支持的每个 C 概念：

```c
#include <stdio.h>

int main(void) {
    char name[64];
    int  age;
    char *p = name;          // 指向 name 首元素的指针

    printf("What's your name?\n");
    scanf("%63s", p);        // 通过指针 p 写名字

    printf("How old are you?\n");
    scanf("%d", &age);       // &age 是 age 的地址（也是指针）

    printf("Hello, %s! You are %d years old.\n", p, age);
    return 0;
}
```

stdin textarea 预填 `Louie\n19`，所以一键 Run 就能得到完整输出，用户不用打字。注释根据 `currentLang` 在 zh/en 间切换。定义在 `learn/learn-views.js` 的 `renderCPlayground()`。

### emcc stderr 格式化

emception 把 emcc 的编译消息逐行转发到 `Module.printErr`，但每次调用末尾不带换行。不处理的话多行错误会挤成一坨。`postmsg-bridge.js` 的编译期 `onOut` / `onErr` 包装通过 `withTrailingNl()` 让每行单独成行。ANSI 颜色码（如 `\x1b[32m`）被剥掉，匹配 `^[a-z_]+:(INFO|DEBUG):` 的 emscripten 内部信息（如 `shared:INFO: (Emscripten: Running sanity checks)`）被丢弃——对学生是噪声。

---

## 右面板编辑器布局

课时和 playground 共用一套右面板结构（`.editor-pane`）。用绝对定位给 Monaco 一个稳定的容器尺寸——`flex` + `overflow:auto` 同用会让 Monaco 锁在 ~10 行。

```
┌──────────────────────────────────────┐  ← .editor-pane（背景: var(--surface)）
│  ╭────────────────────────────────╮  │
│  │                                │  │  ← .tab-pane.code-tab.is-active（背景: #1e1e1e）
│  │   Monaco editor (.editor-fill) │  │     position: absolute; top: 0; bottom: 50px;
│  │   [reset][hint][answer]        │  │     border-bottom-radius: 14px（Chrome-tab 融合）
│  │   ← .tab-actions（右上）       │  │
│  ╰╮                              ╭╯  │
│   │                              │   │
│   │ [Code][Input][Output] ▶ ✓    │   │  ← .editor-foot（height: 50px）
│   │                              │   │     ↑ tabs（左）        ↑ Run/Submit（右）
│   ╰──────────────────────────────╯   │
└──────────────────────────────────────┘
```

关键 CSS（`learn/learn.css` 里都用 `!important`，因为要打败更高优先级的 `body.lesson-mode .lesson-pane { padding; overflow }`）：

- `.editor-pane` —— `padding: 0; position: relative; overflow: hidden; background: var(--surface)`
- `.editor-pane .tab-pane` —— `position: absolute; top: 0; left: 0; right: 0; bottom: 50px; background: #1e1e1e; border-bottom-{left,right}-radius: 14px; overflow: hidden`。默认 `display: none`；激活 tab 显示 `display: block`。
- `.editor-pane .editor-fill` —— Monaco 容器，`position: absolute; inset: 0; width: 100%; height: 100%`。
- `.editor-pane .editor-foot` —— `position: absolute; bottom: 0; left: 0; right: 0; height: 50px` —— 底部操作栏。
- `.tab-strip` / `.tab-btn` —— Excel 风格的工作表标签从 foot 顶边悬挂。激活 tab 用 `background: #1e1e1e`（和编辑器同色）+ `margin-top: -1px` 无缝融入上方编辑器卡片。

Monaco 内部渲染自己的滚动条 / overflow-guard 层，有时绕过父容器的 `border-radius` 裁剪——`learn/learn.css` 在 `.editor-pane .tab-pane.code-tab .monaco-editor` 和它的 `.overflow-guard` 上显式加 `border-bottom-{left,right}-radius` 让两个底角都干净。

`createCodeEditor(container, { fillParent: true })` 是入口。它在 4 个时刻调 `ed.layout({ width, height })`（RAF、+50ms、+200ms、+600ms）以恢复创建时父布局未稳定的情况。

---

## 添加新课时（SQL）

1. 挑 `id`（课程里下一个空整数）。
2. 挑 `slug`（小写、连字符：`having-filter`、`cross-join-basics`）。
3. 决定 schema：
   - 现有 schema 合适，`@@schema` 里复用其名。
   - 否则建 `learn/learn_data/sql/schemas/c<id>_schema.js`，并在 `learn/learn_data/sql/course.js` 的 `course.schemas` 里加条目。
4. 用上面的格式建 `learn/learn_data/sql/lessons/<NN>-<slug>.js`。
5. 把索引条目追加到 `learn/learn_data/sql/course.js` 的 `course.lessons`。
6. 如果可见数有变，改 `learn/learn_data/manifest.js` 的 `lessonsCount`。
7. 跑 `node tools/build-search-broadcast.mjs` 刷新搜索广播（见「搜索广播」一节）。

**SQL 判题规则：**

1. **`expectedSql` 严格对应任务**：任务说 "name 和 age"，`expectedSql` 必须 `SELECT name, age` —— 不能 `SELECT *`。
2. **SQLite 方言**：日期是 ISO 字符串（`'YYYY-MM-DD'`）；对该格式而言字典序和时间序一致。**没有** `RIGHT JOIN` 或 `FULL OUTER JOIN`。
3. **`checkOrder: false`（默认）**：两边结果集都先排序再比对。只有 `ORDER BY` / `LIMIT` 课时才设 `true`。
4. **提示是引导，不是答案**："试试 `WHERE`" 胜过直接给答案。
5. **先写 schema，再写任务，再写 `expectedSql`**——确认题目能解、数据集够。

## 添加新课时（Python）

1. 挑 `id`。
2. 挑 `slug`（从英文标题派生，如 `for-loop-basics`）。
3. 建 `learn/learn_data/python/lessons/<NN>-<slug>.js`。
4. 把索引条目追加到 `learn/learn_data/python/course.js` 的 `course.lessons`。
5. 不需要 schema 工作——Python 课时自包含。
6. 跑 `node tools/build-search-broadcast.mjs` 刷新搜索广播（见「搜索广播」一节）。

**Python 判题规则：**

1. **`expectedOutput` 必须严格匹配 stdout**（trim 后）。任务说 "打印总和"，`answer` 必须**只**输出那个，带正确的末尾 `\n`。
2. **`testInputs` 顺序与 `input()` 调用顺序一致**。inputs 是字符串（Python 的 `input()` 返回字符串）。
3. **沙箱限制**：没文件 I/O、没网络。需要文件的话，把内容模拟成字符串变量。
4. **Skulpt 是 Python 3 风格但不 100%**——见上面"引擎 / Python"里能用什么。

## 添加新课时（C）

1. 挑 `id`（下一个空整数；`c` 基础语法课程是 1–44，`c-algo` 是 1–25——两个课程独立编号）。
2. 挑 `slug`（`hello-c`、`pointers`、`malloc-free`……）。
3. 决定 section：基础语法课用 `'main'`，`<header.h>` 课时用 `'stdlib'`；`c-algo` 全部用 `'main'`。
4. 建 `learn/learn_data/<course-slug>/lessons/<NN>-<slug>.js`（course-slug 是 `c` 还是 `c-algo`）。
5. 把索引条目追加到对应 `course.lessons`。`manifest.js` 的 `lessonsCount` 也 +1。
6. 跑 `node tools/build-search-broadcast.mjs` 刷新搜索广播（见「搜索广播」一节）。

**C 判题规则：**

1. **`expectedOutput` 是空白容忍的 trim 比对**对 stdout。stderr 也加进来，所以编译错误可见。
2. **`testInputs` 数组用换行 join 后预填进 stdin**。判分**始终走预输入模式**（即使用户的 toggle 在 JSPI/实时模式），保证测试确定性。
3. **prompt 不需要末尾 `\n`**——bridge 已运行时绕过 emcc 的 TTY 行缓冲，`printf("Name? ")` 立刻显示。事实上为了好看的交互体验，prompt 末尾**不要**加 `\n`——这样光标 inline 停留，判题输出是一行如 `Please enter your name: Hello, Alice!`。
4. **固定 RNG / 时间相关的输出**。`srand(time(NULL))` 会判题失败因为输出每次不同；用固定种子（`srand(42)`）或只检查不变量（`time(NULL) > 0`）。

## 添加新课程

1. 挑 slug（小写、连字符）。文件夹名 = slug。
2. 建 `learn/learn_data/<slug>/course.js` 并用 `LEARN.course('<slug>', { type: 'sql' | 'python' | 'c', ... })` 注册。
3. 建 `lessons/`（SQL 还要 `schemas/`）。
4. 在 `learn/learn_data/manifest.js` 加条目。
5. 跑 `node tools/build-search-broadcast.mjs` 刷新搜索广播（见「搜索广播」一节）。

新语言类型（如 JavaScript、Rust）需要运行时工作——在 `learn/learn-engines.js` 加 `ensure<Language>()` engine 封装、在 `learn/learn-lesson.js` 加判题路径、在 `learn/learn-views.js` 加 playground。参照 C 课程的结构作为最复杂的运行时门控、最干净的示例。

---

## 搜索广播（louie. search）

全站搜索（louie1.com 的 ⌘K，已接入 home / blog / learn / design）能搜到
本站的**每一门课和每一节课**。它的数据来源是一个静态"广播"文件：

```
learn/learn_data/search_broadcast.json
```

由脚本从 `manifest.js` + 各课程的 `course.js` 课时索引生成（不依赖各课程
内部架构的差异，只读取所有课程共享的 `lessons` 索引字段）：

```bash
node tools/build-search-broadcast.mjs
```

**什么时候要跑：** 任何课程 / 课时 / `manifest.js` 的增删改之后。
忘了跑也不会坏——搜索引擎会回退到 `manifest.js` 只列课程，但课时
就搜不到新内容了。

**一劳永逸的做法：** 把 Cloudflare 控制台里的 Deploy command 设成

```bash
node tools/build-search-broadcast.mjs && npx wrangler deploy
```

这样每次部署自动重新广播，永远不会忘。

相关配套（改动时注意保持）：
- `_headers` 里 `/learn/learn_data/*` 的 `Access-Control-Allow-Origin: *`
  —— 其他 louie.* 站点跨域拉广播文件的前提。
- 搜索引擎本体在 homepage 仓库：`lib/search/louie-search.js`
  （文档：homepage 仓库 `search/README.md`）。

---

# English version

> [⬆ 回到中文](#readme)

---

## Architecture overview

**Zero build step. Zero backend. Lazy per-lesson loading.**

- SQL and Python run 100% in the browser — sql.js (SQLite asm.js) and Skulpt — loaded via `<script>` tags. `file://` works locally.
- C is heavier: it runs the real **clang** compiler in a hidden `<iframe>` via [emception](https://github.com/jprendes/emception). The iframe is same-origin (mirrored under `lib/runtime/webC/`), so `<script>` and Worker creation succeed without cross-origin issues. **C lessons require HTTPS or `http://localhost`**; raw `file://` is gated off by the C-family modal.
- A course's metadata + lesson index loads when the user opens that course; each lesson's full content (and any SQL schema it references) loads only when the user navigates into that lesson.

Per-course download cost (first visit, browser-cached after):
- SQL: ~8 KB course index + ~5–15 KB per lesson
- Python: ~6 KB course index + ~3–10 KB per lesson
- **C: ~25–30 MB** (clang.wasm + libc/libc++ archives) on first entry to any C-family course (`c` core syntax / `c-algo` algorithms) or playground; subsequent visits free. `c` and `c-algo` share the same emception cache.

---

## File layout

> Note: The HTML entry point in this repo is **`index.html`** at the repo root (it serves as both the GitHub Pages root and the historical "learn.html" — JS comments still call it `learn.html`). The READMEs and the live runtime code live in two places: bilingual READMEs at the repo root (`README.md` + the legacy `learn_readme.md` / `learn_readme_c.md`), and a duplicate copy under `learn/learn_data/` for in-app discoverability.

```
<repo root>
├── index.html                          ← interactive UI (routing, rendering, engines)
├── README.md                           ← THIS file
├── learn_readme.md                     ← legacy English-only README
├── learn_readme_c.md                   ← legacy Chinese-only README
├── CNAME                               ← Cloudflare Pages custom domain
├── LICENSE
│
├── learn/
│   ├── learn-core.js                   ← loadCourse / loadLesson / loadSchema, ripple,
│   │                                     splitter, progress, course caching
│   ├── learn-engines.js                ← sql.js + Skulpt + Monaco + emception wrappers,
│   │                                     result-table rendering helpers
│   ├── learn-terminal.js               ← shared xterm-based terminal used by Python and C
│   │                                     lessons / playgrounds (SQL keeps tabular output)
│   ├── learn-i18n.js                   ← zh / en translations + applyLang / tt / pickLang
│   ├── learn-lesson-parser.js          ← `@@key` parser + LEARN.{course,lesson,schema}
│   │                                     registrars + assembleOneLesson
│   ├── learn-views.js                  ← course list, lesson list, playgrounds (SQL/Py/C)
│   ├── learn-lesson.js                 ← lesson runners (SQL/Python/C grading),
│   │                                     hash router, boot
│   ├── learn.css                       ← shared styles incl. the .editor-pane layout
│   └── learn_data/
│       ├── learn_readme.md             ← in-app English mirror of the README
│       ├── learn_readme_c.md           ← in-app Chinese mirror of the README
│       ├── manifest.js                 ← course catalogue (window.__LEARN_MANIFEST)
│       ├── sql/
│       │   ├── course.js               ← metadata + lesson index + schema manifest
│       │   ├── schemas/<name>.js       ← shared SQL schemas (LEARN.schema)
│       │   └── lessons/<NN>-<slug>.js  ← per-lesson content (LEARN.lesson)
│       ├── python/
│       │   ├── course.js               ← metadata + lesson index (no schemas)
│       │   └── lessons/<NN>-<slug>.js
│       ├── c/
│       │   ├── course.js               ← metadata + lesson index (no schemas);
│       │   │                             'main' (syntax) and 'stdlib' sections
│       │   └── lessons/<NN>-<slug>.js  ← 44 lessons (30 syntax + 14 stdlib)
│       └── c-algo/                     ← C Algorithms (Beta), shares emception runtime with c
│           ├── course.js               ← metadata + lesson index; family: 'c'
│           └── lessons/<NN>-<slug>.js  ← 25 lessons (algorithms + data structures)
│
└── lib/
    ├── design/                         ← visual assets (fonts, M3 tokens, shared CSS)
    ├── resources/                      ← static images (po.webp etc.)
    └── runtime/
        ├── sql-asm.js                  ← sql.js engine (eager init at module load)
        ├── webPython/                  ← Skulpt Python interpreter (lazy)
        ├── webC/                       ← emception clang mirror (~450 MB, lazy)
        │   ├── iframe.html             ← C runtime iframe entry
        │   ├── postmsg-bridge.js       ← parent ↔ wasm postMessage adapter
        │   ├── main.bundle.js          ← upstream emception webpack bundle (3 MB)
        │   ├── emception.worker.bundle.worker.js  (530 KB)
        │   ├── cecdfcda360457a8f204.br ← compressed clang (22 MB)
        │   └── 249 × *.a / *.gz        ← libc, libc++, libGL, etc. — fetched on demand
        ├── xterm/                      ← xterm.js terminal (used by learn-terminal.js)
        │   ├── xterm.min.js
        │   ├── xterm.min.css
        │   └── xterm-addon-fit.min.js
        └── monaco/vs/                  ← Monaco editor (~3 MB, vs/loader.js eager,
                                          vs/editor/editor.main lazy)
```

---

## How loading works

```
manifest.js (eager) ─┐
                     │
                     ▼
            User clicks course card
                     │
                     ▼
       loadCourse(slug)        ← injects <slug>/course.js
                     │
                     ▼
   course meta + lesson index ready (cards rendered)
                     │
                     ▼
            User clicks a lesson
                     │
                     ▼
       loadLesson(slug, id)    ← injects lessons/<NN>-<slug>.js
                     │
                     ▼
       Does the lesson set @@schema?
              │            │
             yes           no
              │            │
              ▼            ▼
      loadSchema(...)   ready
              │
              ▼
       inject schemas/<name>.js
              │
              ▼
       lesson.setup ← LEARN._schemas[<slug>:<name>]
```

`loadCourse`, `loadLesson`, `loadSchema` all dedupe in-flight requests and cache successful loads. Once a schema or lesson is fetched, it stays in memory for the rest of the session.

---

## `manifest.js` schema

```js
window.__LEARN_MANIFEST = {
  version: 1,
  updated: 'YYYY-MM-DD',
  courses: [
    {
      slug: 'sql',                              // REQUIRED — matches folder name
      icon: 'SQL',                              // shown on the card (also accepts a { zh, en }
                                                //   bilingual object, e.g. c-algo: { zh: 'C 算法', en: 'C Algo' })
      title: { zh: '...', en: '...' },
      desc:  { zh: '...', en: '...' },
      level: { zh: '入门', en: 'Beginner' },
      lessonsCount: 42,
      coming: false,                            // true → greyed-out "Coming Soon"
      family: 'c',                              // OPTIONAL — gates entry behind the C-resource modal
    }
  ]
};
```

Manifest only tells the course list view what cards to show. The course's *contents* live behind `loadCourse(slug)`. `family: 'c'` is currently the only family value, and it triggers `gateCFamilyAccess()` to warn about download size before the C-family course loads.

---

## `course.js` schema

A course file calls `LEARN.course(slug, meta)`. It carries metadata, a lesson INDEX, and (for SQL) a schema manifest:

```js
LEARN.course('sql', {
  slug: 'sql',
  type: 'sql',                                  // 'sql' | 'python' | 'c'
  title: { zh: '...', en: '...' },
  desc:  { zh: '...', en: '...' },

  hasPlayground: true,
  playgroundTitle:  { zh: '...', en: '...' },
  playgroundSchema: 'final_schema',             // SQL only — name from `schemas` below

  // SQL only. Schema name → file path. Loaded lazily by loadSchema().
  schemas: {
    c1_schema:    'schemas/c1_schema.js',
    final_schema: 'schemas/final_schema.js',
    // ...
  },

  // Lesson INDEX. Just enough to render the lesson list.
  // Full content (intro/task/hint/setup/expectedSql/...) lives in `file`.
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

---

## Lesson file format (`@@key` syntax)

A lesson file calls `LEARN.lesson(courseSlug, id, raw)` once, with the content as a template literal in `raw`:

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

### `@@key` rules

- `@@key value` (rest-of-line) — single-line scalar
- `@@key` then lines until next `@@` — multi-line scalar
- `@@key:zh` / `@@key:en` — bilingual variant; assembled into `{zh, en}`
- `@@` (double-at) is the field marker. Single `@` would collide with Python decorators (`@property`, `@app.route`) appearing at column 0 inside code examples; `@@` doesn't collide with anything real.

### Trailing newlines

The parser preserves the value verbatim — including a trailing `\n`. The convention is **"blank line before the next `@@key` to encode a trailing `\n` in the value"**:

```
@@starter:zh
-- 在这里写你的 SQL              ← value ends without '\n'
@@starter:en

@@starter:zh
-- 在这里写你的 SQL
                                 ← value ends with '\n' (cursor lands on a clean line)
@@starter:en
```

This matters for `starter` (Monaco cursor placement) and `answer` / `expectedOutput` (Python and C grading compare stdout exactly).

### Bilingual content rules

1. **Every prose field needs both `@@key:zh` and `@@key:en`.** Lessons are bilingual end-to-end.
2. **Verbatim HTML.** `intro` / `task` / `hint` use raw HTML (`<p class="lead">`, `<pre><code>`, `<strong>`, `<code>`). Don't switch to Markdown — the parser is verbatim pass-through, not a Markdown renderer.

### Field reference

| Field            | Type            | Where                 | Notes                                          |
|------------------|-----------------|-----------------------|------------------------------------------------|
| `id`             | int             | `LEARN.lesson` 2nd arg + `course.js` index | Stable identity, used for routing & progress |
| `section`        | string          | `course.js` index     | `'main'` (default), `'final'`, or `'stdlib'`   |
| `slug`           | string          | `course.js` index     | URL-friendly; used in filename                 |
| `title`          | bilingual       | `course.js` index     |                                                |
| `chapter`        | bilingual       | `course.js` index     | Sub-label shown under the lesson title         |
| `chapterRef`     | string          | lesson file           | Optional.<br>· `sql` / `python` / `c-algo`: links to `blog.html#<chapterRef>`<br>· `c` (core syntax): ignored — link is hardcoded to runoob's main C tutorial |
| `difficulty`     | bilingual       | lesson file           | "入门" / "Beginner" etc.                       |
| `intro`          | bilingual HTML  | lesson file           | Long-form lesson explanation                   |
| `task`           | bilingual HTML  | lesson file           | What the user must accomplish                  |
| `hint`           | bilingual HTML  | lesson file           | Optional — shown on demand                     |
| `warning`        | bilingual HTML  | lesson file           | Optional — caveats / browser-sandbox notes     |
| `subtitle`       | bilingual HTML  | lesson file           | Optional                                       |
| `starter`        | bilingual code  | lesson file           | Initial editor contents                        |
| **SQL only**     |                 |                       |                                                |
| `schema`         | string          | lesson file           | Name from `course.schemas`; resolved to `setup` |
| `tables`         | array           | lesson file           | Table names to preview in the left pane        |
| `expectedSql`    | string          | lesson file           | Grader runs this against the same fresh DB    |
| `checkOrder`     | bool            | lesson file           | `true` → row order must match (ORDER BY/LIMIT) |
| **Python / C**   |                 |                       |                                                |
| `answer`         | code            | lesson file           | Reference solution (revealed by "Show answer") |
| `expectedOutput` | string          | lesson file           | Grader compares stdout (after trim) to this    |
| `testInputs`     | array           | lesson file           | Strings fed to `input()` (Py) / stdin (C) on grade |

Bilingual fields appear as `@@key:zh` and `@@key:en` blocks. Scalar string/int/bool fields appear as plain `@@key` blocks. `tables` is comma- or space-separated. `testInputs` is one input per line.

---

## Schema file format (SQL only)

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

### Schema dedup convention (conservative)

- **`final_schema`** — the big shared library/bookstore database. Used by every "final challenge" lesson + the playground.
- **`c<N>_schema`** — single-use schema owned by lesson `N` (most lessons).
- **Shared schemas keep the lowest member's id** in the name (`c3_schema` if shared by L3 + L5).
- **Identical bytes only.** If two lessons differ even by one row, they get separate files. Don't merge for cosmetic reasons — the principle is "the lesson author chose those exact rows on purpose; respect it."
- For *truly* shared concepts that read better with a name (e.g., `students_basic`, `books_with_genre`), give them semantic names. Use this sparingly.

---

## Engines

### SQL — sql.js (SQLite, asm.js)
- Loaded eagerly via `<script src="lib/runtime/sql-asm.js">`.
- `ensureSql()` initializes once and caches.
- Each lesson runs against a **fresh in-memory DB** — previous queries can't bleed state.
- The SQL Playground keeps a **persistent DB** for the session. "Load Demo Tables" lazy-loads `playgroundSchema` then runs it; "Reset Tables" wipes to empty.

### Python — Skulpt
- Lazy-loaded on first Python lesson or playground entry (`ensurePython()`).
- Output is captured for grading. `input()` is pumped through an in-page terminal during interactive runs; during grading runs it pulls from `testInputs` in order.
- Hard runtime limits: `yieldLimit: 100` (event-loop yield cadence), `execLimit: 10000` (10s timeout for runaway loops).
- Skulpt is Python 3-ish but not 100%. f-strings, list/dict/set comprehensions, basic stdlib (`math`, `random`, `re`) work; `numpy`, `pandas`, `requests` etc. don't.

### Terminal — xterm.js

`learn-terminal.js` wraps **xterm.js** (`lib/runtime/xterm/xterm.min.js` + `xterm-addon-fit.min.js`) into a shared interactive terminal used by both Python and C lessons / playgrounds. SQL stays on the tabular result-set renderer.

### Code editor — Monaco
- Lives at `lib/runtime/monaco/vs/`. Install: download monaco-editor's npm tarball, extract `package/min/vs/` into that path.
- `vs/loader.js` (small AMD loader) is fetched eagerly by `index.html`. `vs/editor/editor.main` (~3 MB) is loaded lazily by `ensureMonaco()` the first time a lesson or playground opens.
- Editors are created via `createCodeEditor(container, opts)`. Two height modes:
  - `fillParent: true` — the container's height is set by its parent's CSS (used by lesson views with `.editor-pane`); the function calls `ed.layout()` multiple times after creation to recover from initial-render race conditions.
  - default — auto-grow from `minLines` to `maxLines` based on content (Ace-like).
- Workers are routed to an empty `data:` URL so language services degrade to the main thread (required for `file://` compatibility). DevTools shows many `data:text/javascrip…` 0-byte requests; that's normal — filter `-data:` to hide.

### C — emception (real clang in the browser)

C is a special case. There's no good "C interpreter" library for browsers (we tried JSCPP, TCC.wasm — both broken). The only viable option is real LLVM/clang compiled to WebAssembly via [emception](https://github.com/jprendes/emception) — a complete IDE app, not a clean library.

**Architecture** (`ensureC()` in `learn/learn-engines.js`):

```
index.html (parent)
  │ creates hidden <iframe src="lib/runtime/webC/iframe.html">
  ▼
iframe.html
  │ <script src="postmsg-bridge.js">
  ▼
postmsg-bridge.js
  ├─ stream-fetch main.bundle.js (with byte-progress UI)
  ├─ inject via <script src=> (so webpack auto-publicPath finds the bundle)
  ├─ wait for window.emception (set by upstream demo bundle)
  ├─ hide upstream demo UI elements
  └─ accept {type:'run', id, code, stdin?, mode?} via postMessage
       mode: 'preinput' (default, sync stdin from string)
           | 'jspi' (real wasm suspend)
       │
       ├─ writeFile /working/main.c → emcc → read /working/main.js
       │  using: emcc -O0 -sSINGLE_FILE=1 -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1
       │  (NO -fexceptions — JS-based EH invoke_* trampolines insert
       │   JS frames between wasm frames, and JSPI cannot suspend through them)
       │
       ├─ temporarily patch WebAssembly.instantiate / instantiateStreaming:
       │   · replace fd_write / __syscall_write / __syscall_writev (fd 1/2)
       │     → call onStdout / onStderr, BYPASSING emcc's TTY line buffer
       │     (without this `printf("Name? ")` with no '\n' would sit trapped in
       │      emcc's internal line buffer until a newline shows up)
       │   · JSPI mode additionally: wrap fd_read / __syscall_read /
       │     __syscall_readv / __syscall_pread64 (fd 0) with
       │     new WebAssembly.Suspending(asyncFn). asyncFn posts 'input-request'
       │     to the parent and awaits 'input-response'; wasm stack truly parks.
       │   · JSPI also wraps the entry export (__main_argc_argv / _main)
       │     with WebAssembly.promising() — without that the Suspending import
       │     throws "no active suspender".
       │
       ├─ execute main.js via `new Function('Module', code)(Module)`
       │   Module.noInitialRun = useJspi (JSPI mode we await promisingMain ourselves)
       │   Module.stdin = () => null  ← defensive: prevents emcc's default TTY
       │                                fallback from calling window.prompt()
       │
       ├─ postMessage back {type:'runtime-start', id} — compile done, program about to run.
       │   parent prints a cyan "[compiled — running]" divider on receipt.
       ├─ postMessage back {type:'stdout'|'stderr', id, text} — program output.
       ├─ JSPI mode: postMessage back {type:'input-request', id} when stdin reads.
       │   parent reads a line from the xterm and replies {type:'input-response', id, text}.
       └─ postMessage back {type:'done', id, exitCode, error?} — wrapped up.
```

The whole emception demo branch is **mirrored locally** under `lib/runtime/webC/` (~450 MB, 522 files). This is necessary because:
- Cross-origin Workers are forbidden by browsers (CORS doesn't unlock them)
- Loading from jsDelivr would put `main.bundle.js` cross-origin → its workers fail with `SecurityError`
- Same-origin mirror sidesteps every cross-origin restriction

Cloudflare Pages handles 450 MB easily (25 GB / 20k file limits, **unlimited bandwidth**). The browser only fetches what each program needs — typically **~25–30 MB on first C entry**, cached forever after.

**C-family modal gate**: any course with `family: 'c'` in its manifest entry triggers `gateCFamilyAccess()` (in `learn/learn-core.js`) before render. The modal warns about download size and `file://` incompatibility. Confirmation is sticky in `localStorage['louie-learn:cfamily-loaded']`. To re-prompt: clear that key.

**Compile flags currently used**:
```
emcc -O0 -sSINGLE_FILE=1 -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 main.c -o main.js
```

- `-sSINGLE_FILE=1` — embed wasm as base64 in JS (one-file output)
- `-sEXIT_RUNTIME=1` — fire `Module.onExit(status)` when main returns (so we know exit code)
- `-sFORCE_FILESYSTEM=1` — wire `/dev/stdin` to `Module.stdin` (without it emcc may strip FS init)

### C runtime — past limitations & current status

1. ~~**No interactive `scanf`/`getchar`**~~ **Resolved.**
   We now use **JSPI** (JavaScript Promise Integration) — `WebAssembly.Suspending(asyncFn)` wraps stdin imports (`fd_read` / `__syscall_read*`), `WebAssembly.promising` wraps the entry export. The wasm stack truly suspends at `scanf`, the parent fetches a line from the xterm terminal via postMessage, and after the user presses Enter wasm resumes. No ASYNCIFY anywhere (we tried that early; emception's particular emscripten build corrupted the ASYNCIFY state machine on first call. JSPI uses the browser's native promise integration and has no relation to ASYNCIFY).
   **Browser requirements**: Chromium 137+ / Safari 26+ / Firefox 144+. Older browsers get a fallback — each C lesson page has a top-right "Pre-input mode (not recommended)" toggle. Default OFF (JSPI); manually ON drains stdin from a textarea synchronously.
   **Grading always uses pre-input mode** regardless of the user's toggle state — auto-tests need deterministic input.

2. ~~**stdout buffering can reorder output around `scanf`**~~ **Resolved.**
   We no longer rely on libc line buffering. `postmsg-bridge.js` swaps out `fd_write` / `__syscall_writev` / `__syscall_write` imports (fd 1/2) at runtime for non-suspending JS functions that pipe bytes straight to `onStdout` / `onStderr`, **completely bypassing emcc's TTY line-buffer pipeline**. `printf("Name? ")` with no `\n` shows up instantly.
   ⇒ Lesson authors no longer need to hack `\n` or `fflush(stdout);` around prompts.

3. **First-time C load is slow on cold cache** (~25–30 MB). Mitigated by:
   - The C-family modal warning users upfront
   - The progress bar in the playground showing real bytes-loaded
   - Browser HTTP cache + Cloudflare edge cache making subsequent loads instant

4. **`file://` users see a "needs HTTPS" message** instead of the playground/lesson. emception's worker construction needs HTTPS or `http://localhost`.

5. **`-fexceptions` cannot be used.** JS-based C++ EH installs `invoke_*` JS trampolines; JSPI cannot suspend through JS frames (throws `SuspendError: trying to suspend JS frames`). So the compile flags deliberately omit `-fexceptions` — libc++ links its no-exceptions variant. If C++ exceptions are ever needed, switch to `-fwasm-exceptions` (wasm-native EH, no JS frames inserted).

### C playground — defaults

When the user opens `#c/playground` (after dismissing the C-family modal), the editor pre-loads a teaching demo that touches every C concept the playground supports:

```c
#include <stdio.h>

int main(void) {
    char name[64];
    int  age;
    char *p = name;          // pointer to the array's first element

    printf("What's your name?\n");
    scanf("%63s", p);        // write the name through the pointer

    printf("How old are you?\n");
    scanf("%d", &age);       // &age is the address of `age` (also a pointer)

    printf("Hello, %s! You are %d years old.\n", p, age);
    return 0;
}
```

Stdin textarea is pre-filled with `Louie\n19` so a single click on Run produces a complete output without any user typing. Comments switch between zh and en based on `currentLang`. Definition lives in `renderCPlayground()` in `learn/learn-views.js`.

### emcc stderr formatting

emception forwards emcc's compiler messages line-by-line to `Module.printErr`, but each call carries no trailing newline. Without intervention, multi-line errors squash into one wrapped blob. `postmsg-bridge.js`'s compile-time `onOut` / `onErr` handlers wrap output through `withTrailingNl()` so each line lands on its own line in the terminal. ANSI color codes (e.g. `\x1b[32m`) are stripped, and emscripten internal info messages matching `^[a-z_]+:(INFO|DEBUG):` (like `shared:INFO: (Emscripten: Running sanity checks)`) are dropped — they're noise for students.

---

## Right-pane editor layout

The lesson and playground views share a single right-pane structure (`.editor-pane`). It uses absolute positioning to give Monaco a stable container size — `flex` and `overflow:auto` together caused several initial-render races where Monaco locked to ~10 lines.

```
┌──────────────────────────────────────┐  ← .editor-pane (background: var(--surface))
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

Key CSS rules (in `learn/learn.css`, all marked `!important` because they need to defeat the more-specific `body.lesson-mode .lesson-pane { padding; overflow }` rules):

- `.editor-pane` — `padding: 0; position: relative; overflow: hidden; background: var(--surface)`
- `.editor-pane .tab-pane` — `position: absolute; top: 0; left: 0; right: 0; bottom: 50px; background: #1e1e1e; border-bottom-{left,right}-radius: 14px; overflow: hidden`. Hidden by default (`display: none`); active tab gets `display: block`.
- `.editor-pane .editor-fill` — Monaco container, `position: absolute; inset: 0; width: 100%; height: 100%`.
- `.editor-pane .editor-foot` — `position: absolute; bottom: 0; left: 0; right: 0; height: 50px` — bottom action bar.
- `.tab-strip` / `.tab-btn` — Excel-style sheet tabs hanging from the foot's top edge. Active tab uses `background: #1e1e1e` (matching the editor) and `margin-top: -1px` to fuse seamlessly with the editor card above.

Monaco internally renders its own scrollbar / overflow-guard layers that sometimes bypass the parent's `border-radius` clip — `learn/learn.css` adds an explicit `border-bottom-{left,right}-radius` on `.editor-pane .tab-pane.code-tab .monaco-editor` and its `.overflow-guard` to keep both bottom corners clean.

`createCodeEditor(container, { fillParent: true })` is the entry point. It runs `ed.layout({ width, height })` at four points (RAF, +50ms, +200ms, +600ms) to recover from the case where the parent's layout isn't fully resolved at create-time.

---

## How to add a new lesson (SQL)

1. Pick an `id` (next free integer in the course).
2. Pick a `slug` (lowercase, hyphenated: `having-filter`, `cross-join-basics`).
3. Decide the schema:
   - If an existing schema fits, reuse its name in `@@schema`.
   - Otherwise create `learn/learn_data/sql/schemas/c<id>_schema.js` and add the entry to `course.schemas` in `learn/learn_data/sql/course.js`.
4. Create `learn/learn_data/sql/lessons/<NN>-<slug>.js` using the format above.
5. Append the index entry to `course.lessons` in `learn/learn_data/sql/course.js`.
6. Bump `lessonsCount` in `learn/learn_data/manifest.js` if visible.
7. Run `node tools/build-search-broadcast.mjs` to refresh the search broadcast (see "Search broadcast" below).

**SQL grader rules:**

1. **Match `expectedSql` to the task exactly**: if the task says "name and age", `expectedSql` must `SELECT name, age` — not `SELECT *`.
2. **SQLite dialect**: dates are ISO strings (`'YYYY-MM-DD'`); comparison is lexicographic AND chronological for that format. No `RIGHT JOIN` or `FULL OUTER JOIN`.
3. **`checkOrder: false` (default)**: both result sets are sorted before compare. Set `true` only for `ORDER BY` / `LIMIT` lessons.
4. **Hints nudge, don't solve**: "Try `WHERE`" beats giving the answer.
5. **Write the schema first, then the task, then `expectedSql`** — this proves the problem is solvable and the data set is sufficient.

## How to add a new lesson (Python)

1. Pick an `id`.
2. Pick a `slug` (derived from English title, e.g., `for-loop-basics`).
3. Create `learn/learn_data/python/lessons/<NN>-<slug>.js`.
4. Append the index entry to `course.lessons` in `learn/learn_data/python/course.js`.
5. No schema work — Python lessons are self-contained.
6. Run `node tools/build-search-broadcast.mjs` to refresh the search broadcast (see "Search broadcast" below).

**Python grader rules:**

1. **`expectedOutput` must match stdout exactly** (after trim). If the task says "print the sum", make sure `answer` produces *only* that, with the right trailing `\n`.
2. **`testInputs` order matches `input()` calls**. Inputs are strings (Python's `input()` returns string).
3. **Sandbox limits**: no file I/O, no network. If a topic needs a file, simulate the content as a string variable.
4. **Skulpt is Python 3-ish but not 100%** — see "Engines / Python" above for what works.

## How to add a new lesson (C)

1. Pick an `id` (next free integer; the `c` core-syntax course is 1–44, `c-algo` is 1–25 — they're independently numbered).
2. Pick a `slug` (`hello-c`, `pointers`, `malloc-free`, …).
3. Decide the section: `'main'` for syntax, `'stdlib'` for `<header.h>` lessons; `c-algo` uses `'main'` for everything.
4. Create `learn/learn_data/<course-slug>/lessons/<NN>-<slug>.js` (course-slug is either `c` or `c-algo`).
5. Append the index entry to `course.lessons` in `learn/learn_data/<course-slug>/course.js`. Bump `lessonsCount` in `learn/learn_data/manifest.js`.
6. Run `node tools/build-search-broadcast.mjs` to refresh the search broadcast (see "Search broadcast" below).

**C grader rules:**

1. **`expectedOutput` is whitespace-tolerant trim compare** against stdout. Stderr is included so compile errors are visible.
2. **`testInputs` array is joined by newlines and pre-filled into stdin.** Grading **always uses pre-input mode** (even when the user's toggle is in JSPI/live mode) so the test is deterministic.
3. **Prompts do NOT need a trailing `\n`.** The bridge now bypasses emcc's TTY line buffer at runtime, so `printf("Name? ")` shows up immediately. In fact for nicer interactive UX, leave the `\n` off so the cursor stays inline — the resulting graded output is a single line like `Please enter your name: Hello, Alice!`.
4. **Pin RNG / time-dependent output**. `srand(time(NULL))` will fail grading because output varies; use a fixed seed (`srand(42)`) or check only invariants (`time(NULL) > 0`).

## How to add a new course

1. Pick a slug (lowercase, hyphenated). The folder name = the slug.
2. Create `learn/learn_data/<slug>/course.js` registering with `LEARN.course('<slug>', { type: 'sql' | 'python' | 'c', ... })`.
3. Create `lessons/` (and `schemas/` if SQL).
4. Add an entry to `learn/learn_data/manifest.js`.
5. Run `node tools/build-search-broadcast.mjs` to refresh the search broadcast (see "Search broadcast" below).

A new language type (e.g., JavaScript, Rust) requires runtime work — adding an `ensure<Language>()` engine wrapper in `learn/learn-engines.js`, a grading path in `learn/learn-lesson.js`, and a playground in `learn/learn-views.js`. Match the C course's structure as the reference: it has the most complex runtime gating and is the cleanest example.


## Search broadcast (louie. search)

The site-wide search (the ⌘K overlay from louie1.com, wired into home /
blog / learn / design) indexes **every course and every lesson** here. Its
data source is a static "broadcast" file:

```
learn/learn_data/search_broadcast.json
```

generated from `manifest.js` + each course's `course.js` lesson index (it
does not depend on per-course internals — only the `lessons` index shape
all courses share):

```bash
node tools/build-search-broadcast.mjs
```

**When to run it:** after any course / lesson / `manifest.js` change.
Forgetting is non-fatal — the search engine falls back to `manifest.js`
and lists courses only, but new lessons won't be searchable.

**Set-and-forget:** point the Cloudflare dashboard Deploy command at

```bash
node tools/build-search-broadcast.mjs && npx wrangler deploy
```

so every deploy re-broadcasts automatically.

Related plumbing (keep intact when editing):
- `Access-Control-Allow-Origin: *` for `/learn/learn_data/*` in `_headers`
  — required for the other louie.* sites to fetch the broadcast cross-origin.
- The engine itself lives in the homepage repo: `lib/search/louie-search.js`
  (docs: `search/README.md` there).
