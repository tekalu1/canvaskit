---
name: canvaskit
description: CLI-first MCP-native design canvas tool. Use this skill when working with .canvas.json design files, exporting designs to HTML/Vue/React/SVG, importing from Figma, managing design tokens, previewing designs, or starting the CanvasKit MCP server.
user-invocable: true
argument-hint: [command]
---

# CanvasKit

You are assisting with **CanvasKit**, a CLI-first MCP-native design canvas tool that uses `.canvas.json` files.

## Architecture

CLI と MCP の両方が同じコアロジックの薄いラッパーとして動作する。

```
         Core (ビジネスロジック)
         ┌──────────────────────────┐
         │ src/core/node.ts         │  NodeManager
         │ src/core/token.ts        │  TokenManager
         │ src/core/variable.ts     │  VariableManager
         │ src/core/component.ts    │  ComponentRegistry
         │ src/core/canvas.ts       │  CanvasManager
         │ src/core/document.ts     │  Document
         │ src/export/              │  HTML, Vue, React, SVG, CSS
         └────────────┬────────────┘
                      │
           ┌──────────┴──────────┐
           │                     │
      CLI ラッパー           MCP ラッパー
      src/cli/*-commands.ts  src/tools/*-tools.ts
      src/index.ts           src/mcp-server.ts
      (Commander.js)         (Zod + ok/fail)
```

## Detailed References

タスクに応じて以下のドキュメントを参照する:

- **CLI 操作** → [docs/cli.md](docs/cli.md)
  - ドキュメント管理: `init`, `open`, `validate`
  - ページ操作: `page update/list` (幅・高さ・名前の変更)
  - ノード操作: `node add/update/delete/move/list/get/inspect` (`--tree`, `--tree-file`, `--parent-name`, `--node-name` 対応)
  - ビジュアルプリミティブ: `stroke`, `effects`, `gradient`, `clip` (ノード追加・更新時に指定)
  - トークン操作: `token set/get/delete`, `tokens`
  - 変数・テーマ: `variable set/get/delete/list`, `variable theme-axis`, `variable export-css`
  - コンポーネント操作: `component create/list`
  - エクスポート: `export html/vue/react/svg`
  - 画像生成: `image generate` (stock/AI)
  - プレビュー・スクリーンショット・インポート
  - スタイルバリデーション: タイポ検出 (警告のみ、非ブロック)

- **MCP ツール** → [docs/mcp.md](docs/mcp.md)
  - Canvas 管理: `canvas:create/open/save/list_pages`
  - ページ操作: `page:update/list`
  - ノード操作: `node:add/add_tree/update/delete/move/list/get/inspect` (`nodeName` で名前ベース更新可)
  - ビジュアルプリミティブ: `stroke`, `effects`, `gradient`, `clip` (ノードスキーマ拡張)
  - トークン操作: `token:set/get/list`, `token:export_css`
  - 変数・テーマ: `variable:set/get/delete/list`, `variable:theme-axis`, `variable:export-css`
  - コンポーネント: `component:create/list`
  - エクスポート: `export:html/vue/react/svg`
  - 画像生成: `image:generate` (stock/AI)
  - プレビュー: `preview:start/stop/screenshot`
  - インポート: `import:figma`
  - ガイドライン: `guidelines:get`

## Quick Start

```bash
# テンプレートからランディングページを即座に構築
canvaskit init my-landing --template landing
canvaskit screenshot my-landing.canvas.json -o preview.png  # 視覚確認

# または空のドキュメントから構築
canvaskit init my-design

# ネストツリーで一括追加 (10+コマンド → 1コマンド)
echo '{"type":"frame","name":"Hero","children":[
  {"type":"text","name":"Title","content":"Hello World"}
]}' | canvaskit node add my-design.canvas.json --page page1 --parent root --tree

# 親名で参照 (ID不要)
canvaskit node add my-design.canvas.json \
  --page page1 --parent-name "Hero" --type text --name "Sub" --content "Welcome"

# エクスポート
canvaskit export react my-design.canvas.json -o ./src/components

# MCP サーバー起動 (AI エージェントから操作する場合)
canvaskit serve
```

## Design Workflow — スクリーンショットで状態を把握する

`.canvas.json` はテキスト形式だが、デザインの正しさは**視覚的にしか判断できない**。
**書き込み操作 (mutation) の後には必ずスクリーンショットを撮り、結果を目視確認すること。**

### 必須ルール

1. **mutation 後のスクリーンショットは必須** — `node add`, `node update`, `node delete`, `node move` の後は**毎回** `--screenshot /tmp/<name>.png` を付けるか、直後に `canvaskit screenshot` を実行して結果を確認する。スクリーンショットなしで次の操作に進んではいけない。
2. **既存デザインを修正する前にもスクリーンショットを撮る** — 変更前の状態を把握してから修正に入る。
3. **レイアウト崩れは `node inspect` で調査する** — overflow やサイズの問題は computed layout を確認する。スクリーンショットで問題を検知したら、`node inspect --depth 2` で原因を特定する。
4. **`screenshot` で確認、`export` でコード生成** — 視覚確認には `screenshot` を使い、`export` は最終的なコード出力のみに使用する。デバッグ目的で `export` に逃げてはいけない。

> **なぜ必須か:** レイアウトの `justify: space-between` が効かない、要素が詰まる等の問題は JSON 上では見えない。スクリーンショットを撮らなければ気づけず、壊れたまま作業を進めてしまう。

### CLI での方法

```bash
# 方法1: --screenshot オプション (mutation コマンドに直接付ける — 推奨)
canvaskit node add design.canvas.json \
  --page page1 --parent root --type text --name "Title" --content "Hello" \
  --screenshot /tmp/preview.png

# 方法2: 独立した screenshot コマンド (ツリー一括追加の後など)
canvaskit screenshot design.canvas.json -o /tmp/preview.png
# → 必ず Read ツールで /tmp/preview.png を確認する

# レイアウトデバッグ (スクリーンショットで問題を発見した場合)
canvaskit node inspect design.canvas.json --page page1 --id problematic-node --depth 2
```

### MCP での方法

MCP ではプレビューサーバー起動中、ノード操作のレスポンスに `ImageContent` (スクリーンショット) が自動付与される。
```
preview:start → node:add → レスポンスに画像が含まれる → 視覚確認 → 次の操作
```

### 必須ワークフロー

```
[既存修正時] screenshot → 現状把握 → 変更 → screenshot → 確認 → (問題あれば inspect → 修正 → screenshot) → 完了
[新規作成時] 変更 → screenshot → 確認 → (問題あれば inspect → 修正 → screenshot) → 次のセクション → ...
```

## .canvas.json File Format

```json
{
  "version": "1.0.0",
  "meta": { "name": "Design", "created": "...", "modified": "..." },
  "tokens": {
    "colors": { "primary": { "value": "#3b82f6" } },
    "spacing": {}, "typography": {}, "borderRadius": {}, "shadows": {}, "breakpoints": {}
  },
  "variables": {
    "themeAxes": { "mode": ["light", "dark"] },
    "definitions": {
      "primary": { "type": "color", "values": [
        { "value": "#3B82F6" },
        { "value": "#60A5FA", "theme": { "mode": "dark" } }
      ]}
    }
  },
  "components": {},
  "pages": {
    "page1": {
      "name": "Page 1", "width": 1440, "height": null,
      "nodes": {
        "root": { "type": "frame", "name": "Root", "layout": { "direction": "column" }, "children": [] }
      }
    }
  }
}
```

Node types: `frame`, `text`, `image`, `icon`, `component`, `vector`

### Visual Primitives (ノードプロパティ)

ノードに直接指定可能な構造化ビジュアルプロパティ。`styles` 内の自由な CSS 文字列より優先される。

| プロパティ | 型 | 説明 |
|---|---|---|
| `clip` | boolean | frame ノード専用。`true` → `overflow: hidden` |
| `stroke` | `{ color, width, style? }` | 構造化ストローク (`style`: `solid`/`dashed`/`dotted`) |
| `effects` | `Effect[]` | `shadow`, `blur`, `backdrop-blur` の配列 |
| `gradient` | `{ type, angle?, colors }` | `linear`/`radial`/`conic` グラデーション |

Layout の `direction` は `"row"`, `"column"`, `"none"` をサポート。`"none"` は絶対配置モードで、子要素が `styles.position: "absolute"` + `top/left` で自由配置される。

## Key Conventions

- ESM modules — imports use `.js` extension
- TypeScript strict mode, target ES2022
- Zod for schema validation
- Flat node map with ID references (not nested tree)
- Node IDs: 8-char UUID prefix from `crypto.randomUUID()`
- MCP response pattern: `ok(data)` / `fail(error)`
- CLI mutation commands: `withDocument()` で open → mutate → auto-save
- Auto-save after mutations via `doc.touch()`

## Testing

```bash
npm test              # All tests (600+)
npm run test:coverage # Coverage report
npm run test:unit     # Core + tools only
npm run test:e2e      # CLI smoke tests (node/token/component commands 含む)
```

Framework: Vitest with `@vitest/coverage-v8`
Test dirs: `tests/{core,tools,export,import,preview,integration,e2e}/`

## Project Structure

```
src/
├── core/        # Schema, Document, CanvasManager, NodeManager, TokenManager, VariableManager, ComponentRegistry, PageManager, StyleValidator
├── cli/         # CLI command wrappers: helpers.ts, node-commands.ts, token-commands.ts, component-commands.ts, page-commands.ts, flatten-tree.ts
├── tools/       # MCP tool handlers: canvas, node, token, variable, component, page, export, tailwind-config
├── services/    # Shared services: node-screenshot.ts, terminal-image.ts, image-generation.ts
├── templates/   # Scaffold templates: index.ts (registry), landing.ts
├── export/      # Exporters: html.ts (Lucide CDN対応), shared.ts, vue-sfc.ts, react-jsx.ts, svg.ts, css-tokens.ts
├── import/      # Figma: figma-mapper.ts (gradient/stroke mapping), figma.ts
├── preview/     # server.ts (Express + SSE), screenshot.ts (Puppeteer)
├── index.ts     # CLI entry (Commander.js)
└── mcp-server.ts # MCP server (stdio + HTTP transports)
```
