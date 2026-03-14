# CanvasKit CLI Reference

全 CLI コマンドのパラメータと使用例。100 行超のため目次を付記。

## 目次

- [Document Management](#document-management) — init, open, validate
- [Page Commands](#page-commands) — page add/update/list/delete
- [Node Commands](#node-commands) — node add/update/delete/move/list/get/inspect
- [Token Commands](#token-commands) — token set/get/delete, tokens
- [Variable Commands](#variable-commands) — variable set/get/delete/list, theme-axis, export-css
- [Component Commands](#component-commands) — component create/get/list/delete
- [Screenshot & Preview](#screenshot--preview) — screenshot, preview, --screenshot
- [Export Commands](#export-commands) — export html/vue/react/svg
- [Image Generation](#image-generation) — image generate
- [Server & Import](#server--import) — serve, import figma

---

## Document Management

### `canvaskit init [name]`

新しい `.canvas.json` を作成。`--template landing` でランディングページテンプレート。`--list-templates` で一覧表示。

```bash
canvaskit init my-design
canvaskit init my-landing --template landing
```

### `canvaskit open <file>`

ドキュメントのサマリー（メタ情報、ページ一覧、トークン数）を表示。

### `canvaskit validate <file>`

Zod スキーマでバリデーション。`save()` も保存前にバリデーションを実行する。

---

## Page Commands

### `canvaskit page add <file>`

| オプション | 必須 | 説明 |
|---|---|---|
| `--id <pageId>` | Yes | ページ ID |
| `--name <name>` | No | ページ名 (省略時は ID) |
| `--width <number>` | No | 幅 (default: 1440) |
| `--height <number>` | No | 高さ (省略時 auto) |

### `canvaskit page update <file>`

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--name <name>` | No | 新しい名前 |
| `--width <number>` | No | 新しい幅 |
| `--height <number>` | No | 高さ (`null` で無制限) |
| `--stdin` | No | stdin から JSON |
| `--screenshot [path]` | No | スクリーンショット |

### `canvaskit page list <file>`

全ページ一覧 (読み取り専用)。

### `canvaskit page delete <file> --page <pageId>`

ページ削除。

---

## Node Commands

全 mutation コマンドはファイルを自動保存。出力は JSON。

### `canvaskit node add <file>`

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | ページ ID |
| `--parent <parentId>` | No | 親フレーム ID (default: `root`) |
| `--parent-name <name>` | No | 親フレーム名 (`--parent` の代替) |
| `--type <type>` | Yes* | `frame\|text\|image\|icon\|component\|vector` |
| `--name <name>` | Yes* | ノード名 |
| `--content <content>` | No | テキスト内容 |
| `--icon <icon>` | No | アイコン参照 |
| `--src <src>` | No | 画像 URL |
| `--alt <alt>` | No | alt テキスト |
| `--component-ref <ref>` | * | component ノードでは必須 |
| `--stdin` | No | stdin から JSON 配列/オブジェクト |
| `--tree` | No | stdin からネストツリー JSON |
| `--tree-file <path>` | No | ファイルからツリー JSON |
| `--auto-fix` | No | スタイルタイポを自動修正 |
| `--screenshot [path]` | No | スクリーンショット |

**`--parent-name`**: 名前でノード検索。0件→エラー、複数一致→エラー。同一バッチ内で先に追加されたノード名も解決可能。

**`--tree`**: ネスト JSON の `children` を再帰フラット化。自動 ID 生成、親子関係維持。単一オブジェクトと配列の両方対応。

```bash
# ネストツリー一括追加
echo '{"type":"frame","name":"Hero","layout":{"direction":"column","align":"center"},
  "children":[
    {"type":"text","name":"Title","content":"Hello","styles":{"fontSize":"48px"}},
    {"type":"frame","name":"CTA","layout":{"direction":"row","gap":"16px"},"children":[
      {"type":"text","name":"Primary","content":"Get Started"},
      {"type":"text","name":"Secondary","content":"Learn More"}
    ]}
  ]}' | canvaskit node add my-app.canvas.json --page page1 --parent root --tree
```

**ビジュアルプリミティブ** (stdin/tree 内で指定):
```json
{
  "clip": true,
  "stroke": { "color": "#000", "width": 2, "style": "solid" },
  "effects": [{ "type": "shadow", "offsetX": "0", "offsetY": "4px", "blur": "8px", "color": "rgba(0,0,0,0.2)" }],
  "gradient": { "type": "linear", "angle": 90, "colors": [{ "color": "#f00", "position": 0 }, { "color": "#00f", "position": 1 }] },
  "layout": { "direction": "none" }
}
```

### `canvaskit node update <file>`

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | ページ ID |
| `--id <nodeId>` | * | ノード ID (`--node-name` と排他) |
| `--node-name <name>` | * | ノード名で検索 (`--id` の代替) |
| `--name <name>` | No | 新しい名前 |
| `--content <content>` | No | 新しいテキスト |
| `--style <key=value>` | No | スタイル直接指定 (複数可: `--style "color=#fff" --style "fontSize=20"`) |
| `--stdin` | No | stdin から更新 JSON (styles, layout, props 等) |
| `--auto-fix` | No | タイポ自動修正 |
| `--screenshot [path]` | No | スクリーンショット |

`--id` か `--node-name` のいずれか必須。`--id` 優先。`--style` と `--stdin` は排他。

**スタイルバリデーション**: タイポ検出時は stderr に警告 (非ブロック)。`--auto-fix` で自動修正。

### `canvaskit node delete <file>`

`--page <pageId> --id <nodeId>` — frame の子も再帰削除。

### `canvaskit node move <file>`

`--page <pageId> --id <nodeId> --to <parentId> [--index <n>]`

### `canvaskit node list <file>`

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | ページ ID |
| `--parent <parentId>` | No | 親でフィルタ |
| `--type <type>` | No | タイプでフィルタ |
| `--search <term>` | No | 名前で検索 (case-insensitive) |
| `--depth <number>` | No | 最大探索深度 |

### `canvaskit node get <file>`

`--page <pageId> --id <nodeId>` — 単一ノードの全プロパティ取得。

### `canvaskit node inspect <file>`

Puppeteer で computed layout を取得。各ノードの実寸法・位置・overflow・flex を返す。

`--page <pageId> [--id <nodeId>] [--depth <n>]` — id 省略時は root。

---

## Token Commands

カテゴリ: `colors`, `spacing`, `typography`, `borderRadius`, `shadows`, `breakpoints`

### `canvaskit token set <file>`

| オプション | 必須 | 説明 |
|---|---|---|
| `--category <cat>` | Yes* | カテゴリ |
| `--key <key>` | Yes* | トークンキー |
| `--value <value>` | Yes* | 値 (typography は JSON オブジェクト) |
| `--description <desc>` | No | 説明 |
| `--stdin` | No | stdin から JSON 配列 |

```bash
canvaskit token set design.canvas.json --category colors --key primary --value "#3B82F6"
```

### `canvaskit token get <file>`

`--category <cat> --key <key>`

### `canvaskit token delete <file>`

`--category <cat> --key <key>`

### `canvaskit tokens <file>`

全トークンをフォーマット出力。`--format css` で CSS Custom Properties、`--format tailwind` で tailwind.config.js。

---

## Variable Commands

テーマ対応の変数システム。`$variableName` でノードスタイルから参照可能。

### `canvaskit variable set <file>`

| オプション | 必須 | 説明 |
|---|---|---|
| `--name <name>` | Yes* | 変数名 |
| `--type <type>` | Yes* | `color`/`spacing`/`number`/`string` |
| `--value <value>` | Yes* | 値 |
| `--theme <key=value\|json>` | No | テーマコンテキスト (`mode=dark` or JSON) |
| `--stdin` | No | stdin から JSON 配列で一括設定 |

```bash
canvaskit variable set design.canvas.json --name primary --type color --value "#3B82F6"
canvaskit variable set design.canvas.json --name primary --type color --value "#60A5FA" --theme mode=dark
```

### `canvaskit variable get/delete/list <file>`

`get`: `--name <name> [--theme ...]` / `delete`: `--name <name>` / `list`: オプションなし

### `canvaskit variable theme-axis <file>`

`--name <axisName> --values "light,dark"` — テーマ軸定義。`--delete` で削除。

### `canvaskit variable export-css <file>`

CSS Custom Properties としてエクスポート。`:root { --primary: #3B82F6; }` + `[data-theme="dark"] { ... }`

---

## Component Commands

### `canvaskit component create <file>`

`--name <name> [--description <desc>]` — シンプル作成。`--stdin` でフル定義 (variants, props, template)。

### `canvaskit component get/list/delete <file>`

`get`: `--name <name>` / `list`: 全一覧 / `delete`: `--name <name>`

---

## Screenshot & Preview

### `canvaskit screenshot <file> -o <path>`

Puppeteer でスクリーンショット撮影。`--format png|jpeg --width <n> --height <n>`

### `canvaskit preview <file>`

ライブプレビューサーバー (SSE hot reload)。`--port 3456`

### `--screenshot` オプション (全 node コマンド共通)

パス指定でファイル保存、パス省略で対応ターミナルにインライン表示 (iTerm2/Kitty)。非対応時は一時ファイルにフォールバック。

---

## Export Commands

> `export` は最終コード生成用。視覚確認には `screenshot` を使う。

| コマンド | 出力 | 主要オプション |
|---|---|---|
| `export html <file> -o <dir>` | HTML + Tailwind CSS | `--page <pageId>` |
| `export vue <file> -o <dir>` | Vue SFC + Tailwind | `--page`, `--no-typescript` |
| `export react <file> -o <dir>` | React JSX/TSX + Tailwind | `--page` |
| `export svg <file> -o <path>` | SVG | `--page`, `--node <nodeId>` |

---

## Image Generation

### `canvaskit image generate <file>`

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | ページ ID |
| `--node <nodeId>` | Yes | image ノード ID |
| `--type <type>` | Yes | `stock` (Unsplash) / `ai` (DALL-E) |
| `--prompt <prompt>` | Yes | 検索キーワードまたはプロンプト |
| `--width/--height` | No | サイズ |

環境変数: `UNSPLASH_ACCESS_KEY`, `IMAGE_AI_API_KEY` / `OPENAI_API_KEY`, `IMAGE_AI_API_URL`, `IMAGE_AI_MODEL`

---

## Server & Import

### `canvaskit serve`

MCP サーバー起動。デフォルト stdio。`--transport http --port 3100` で HTTP。

### `canvaskit import figma`

`--file-key <key> --token <pat> -o <output>` — Figma API からインポート。
