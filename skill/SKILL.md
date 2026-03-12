---
name: canvaskit
description: CLI-first MCP-native design canvas tool. Use this skill when working with .canvas.json design files, exporting designs to HTML/Vue/React/SVG, importing from Figma, managing design tokens, previewing designs, or starting the CanvasKit MCP server.
user-invocable: true
argument-hint: [command]
---

# CanvasKit

`.canvas.json` ファイルを操作するデザインキャンバスツール。CLI (`canvaskit`) と MCP (`canvaskit serve`) の両インターフェースが同じコアロジックを共有する。

## Quick Start

```bash
# テンプレートからランディングページを構築
canvaskit init my-landing --template landing
canvaskit screenshot my-landing.canvas.json -o preview.png

# 空のドキュメントから構築
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

# MCP サーバー起動
canvaskit serve
```

## Design Workflow — スクリーンショット必須

`.canvas.json` はテキスト形式だが、デザインの正しさは視覚的にしか判断できない。

### ルール

1. **mutation 後は毎回スクリーンショットを撮る** — `node add/update/delete/move` の後は `--screenshot /tmp/<name>.png` を付けるか `canvaskit screenshot` を実行。スクリーンショットなしで次の操作に進まない。
2. **既存デザイン修正前にもスクリーンショットを撮る** — 変更前の状態を把握する。
3. **レイアウト崩れは `node inspect --depth 2` で調査** — overflow やサイズの問題は computed layout で確認。
4. **`screenshot` で確認、`export` はコード生成のみ** — デバッグ目的で `export` に逃げない。

> **理由:** `justify: space-between` が効かない等の問題は JSON 上では見えない。スクリーンショットなしでは気づけず壊れたまま進む。

### CLI での方法

```bash
# --screenshot オプション (推奨)
canvaskit node add design.canvas.json \
  --page page1 --parent root --type text --name "Title" --content "Hello" \
  --screenshot /tmp/preview.png

# 独立した screenshot コマンド
canvaskit screenshot design.canvas.json -o /tmp/preview.png
# → Read ツールで /tmp/preview.png を確認する
```

### MCP での方法

プレビューサーバー起動中、ノード操作のレスポンスに `ImageContent` が自動付与される:
```
preview:start → node:add → レスポンスに画像含む → 視覚確認 → 次の操作
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

## Visual Primitives

ノードに直接指定可能な構造化プロパティ。`styles` 内の CSS 文字列より優先。

| プロパティ | 型 | 説明 |
|---|---|---|
| `clip` | boolean | frame 専用。`true` → `overflow: hidden` |
| `stroke` | `{ color, width, style? }` | `style`: `solid`/`dashed`/`dotted` |
| `effects` | `Effect[]` | `shadow`, `blur`, `backdrop-blur` の配列 |
| `gradient` | `{ type, angle?, colors }` | `linear`/`radial`/`conic` |

`layout.direction`: `"row"` / `"column"` / `"none"` (`"none"` = 絶対配置。子に `position: absolute` + `top/left`)

## Detailed References

タスクに応じて以下を参照:

- **CLI コマンド詳細** → [references/cli.md](references/cli.md) — 全 CLI コマンドのパラメータ・使用例
- **MCP ツール詳細** → [references/mcp.md](references/mcp.md) — 全 MCP ツールのパラメータ・レスポンス形式
