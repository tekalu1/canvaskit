# CanvasKit

CLI-first, MCP-native design canvas tool. `.canvas.json` ファイルでデザインドキュメントを管理し、ノードツリー・デザイントークン・再利用可能コンポーネントを操作する。

## Install

```bash
npm install
npm run build
```

## Quick Start

```bash
# ドキュメント作成
canvaskit init my-design

# ノード追加
canvaskit node add my-design.canvas.json \
  --page page1 --parent root --type text --name "Title" --content "Hello"

# トークン設定
canvaskit token set my-design.canvas.json \
  --category colors --key primary --value "#3B82F6"

# 視覚確認
canvaskit screenshot my-design.canvas.json -o preview.png

# コード生成 (エクスポート)
canvaskit export react my-design.canvas.json -o ./src/components

# MCP サーバー起動
canvaskit serve
```

## Architecture

CLI と MCP の両方が同じコアロジックの薄いラッパーとして動作する。

```
         Core (ビジネスロジック)
         ┌──────────────────────────┐
         │ src/core/node.ts         │  NodeManager
         │ src/core/token.ts        │  TokenManager
         │ src/core/component.ts    │  ComponentRegistry
         │ src/core/canvas.ts       │  CanvasManager
         │ src/core/document.ts     │  Document
         │ src/core/schema.ts       │  Zod schemas
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

## Project Structure

```
src/
├── core/        # Schema, Document, CanvasManager, NodeManager, TokenManager, VariableManager, ComponentRegistry
├── cli/         # CLI command wrappers: helpers.ts, node-commands.ts, token-commands.ts, component-commands.ts, page-commands.ts, variable-commands.ts
├── tools/       # MCP tool handlers: canvas, node, token, variable, component, export, tailwind-config
├── services/    # Shared services: node-screenshot.ts, terminal-image.ts, image-generation.ts
├── export/      # html.ts, shared.ts, vue-sfc.ts, react-jsx.ts, svg.ts, css-tokens.ts
├── import/      # Figma: figma-mapper.ts (gradient/stroke mapping), figma.ts
├── preview/     # server.ts (Express + SSE), screenshot.ts (Puppeteer)
├── index.ts     # CLI entry (Commander.js)
└── mcp-server.ts # MCP server (stdio + HTTP)
```

## CLI Commands

### Document Management
```bash
canvaskit init [name]                      # 新規 .canvas.json 作成
canvaskit open <file>                      # サマリー表示
canvaskit validate <file>                  # スキーマバリデーション
```

### Node Operations
```bash
canvaskit node add <file>                  # ノード追加 (--page, --type, --name, --parent, --stdin, --tree, --tree-file, --screenshot)
canvaskit node update <file>               # ノード更新 (--page, --id, --name, --content, --stdin, --screenshot)
canvaskit node delete <file>               # ノード削除 (--page, --id, --screenshot)
canvaskit node move <file>                 # ノード移動 (--page, --id, --to, --index, --screenshot)
canvaskit node list <file>                 # ノード一覧 (--page, --parent, --type, --search, --depth, --screenshot)
canvaskit node get <file>                  # ノード取得 (--page, --id, --screenshot)
canvaskit node inspect <file>              # レイアウト調査 (--page, --id, --depth)
```

### Token Operations
```bash
canvaskit token set <file>                 # トークン設定 (--category, --key, --value, --stdin)
canvaskit token get <file>                 # トークン取得 (--category, --key)
canvaskit token delete <file>              # トークン削除 (--category, --key)
canvaskit tokens <file>                    # 全トークン出力 (--format json|css|tailwind)
```

### Component Operations
```bash
canvaskit component create <file>          # コンポーネント作成 (--name, --description, --stdin)
canvaskit component get <file>             # コンポーネント取得 (--name)
canvaskit component list <file>            # コンポーネント一覧
canvaskit component delete <file>          # コンポーネント削除 (--name)
```

### Page Operations
```bash
canvaskit page add <file>                  # ページ追加 (--id, --name, --width, --height)
canvaskit page update <file>               # ページ更新 (--page, --name, --width, --height, --stdin, --screenshot)
canvaskit page list <file>                 # ページ一覧 (--screenshot)
canvaskit page delete <file>               # ページ削除 (--page)
```

### Export
```bash
canvaskit export html <file> -o <dir>      # HTML + Tailwind CSS
canvaskit export vue <file> -o <dir>       # Vue SFC + Tailwind
canvaskit export react <file> -o <dir>     # React JSX/TSX + Tailwind
canvaskit export svg <file> -o <path>      # SVG
```

### Variable Operations
```bash
canvaskit variable set <file>              # 変数設定 (--name, --type, --value, --theme, --stdin)
canvaskit variable get <file>              # 変数取得 (--name, --theme)
canvaskit variable delete <file>           # 変数削除 (--name)
canvaskit variable list <file>             # 全変数一覧
canvaskit variable theme-axis <file>       # テーマ軸定義 (--name, --values)
canvaskit variable export-css <file>       # CSS Custom Properties 出力
```

### Image Generation
```bash
canvaskit image generate <file>            # 画像生成 (--page, --node, --type stock|ai, --prompt)
```

### Other
```bash
canvaskit serve                            # MCP server (stdio)
canvaskit serve --transport http           # MCP server (HTTP)
canvaskit preview <file>                   # Live preview (SSE hot reload)
canvaskit screenshot <file> -o <path>      # Screenshot (Puppeteer)
canvaskit import figma --file-key <key> --token <pat>  # Figma import
```

## .canvas.json File Format

```json
{
  "version": "1.0.0",
  "meta": { "name": "Design", "created": "...", "modified": "..." },
  "tokens": {
    "colors": {}, "spacing": {}, "typography": {},
    "borderRadius": {}, "shadows": {}, "breakpoints": {}
  },
  "components": {},
  "pages": {
    "page1": {
      "name": "Page 1",
      "width": 1440,
      "height": null,
      "nodes": {
        "root": {
          "type": "frame",
          "name": "Root",
          "layout": { "direction": "column" },
          "children": []
        }
      }
    }
  }
}
```

Node types: `frame`, `text`, `image`, `icon`, `component`, `vector`

### Visual Primitives

ノードに構造化ビジュアルプロパティを直接指定可能 (全ノード共通、全てオプション):
- `stroke: { color, width, style? }` — ストローク (`solid`/`dashed`/`dotted`)
- `effects: [{ type: "shadow"|"blur"|"backdrop-blur", ... }]` — エフェクト配列
- `gradient: { type: "linear"|"radial"|"conic", angle?, colors: [{ color, position }] }` — グラデーション
- `clip: true` — frame 用 `overflow: hidden`
- `layout.direction: "none"` — 絶対配置モード

### Variables & Themes

テーマ対応の変数システム。`$variableName` でスタイルから参照:
```json
"variables": {
  "themeAxes": { "mode": ["light", "dark"] },
  "definitions": {
    "primary": { "type": "color", "values": [
      { "value": "#3B82F6" },
      { "value": "#60A5FA", "theme": { "mode": "dark" } }
    ]}
  }
}
```

## Testing

```bash
npm test              # All tests (740+)
npm run test:coverage # Coverage report
npm run test:unit     # Core + tools only
npm run test:e2e      # CLI smoke tests
npm run test:watch    # Watch mode
```

## License

MIT
