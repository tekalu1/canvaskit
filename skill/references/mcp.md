# CanvasKit MCP Tools Reference

MCP サーバー経由の全ツール。サーバー起動: `canvaskit serve` (stdio) / `canvaskit serve --transport http` (HTTP)。
サーバーはステートフル — `canvas:create` / `canvas:open` で「現在のドキュメント」をロード。mutation 後は自動保存。

## 目次

- [Canvas Management](#canvas-management) — canvas:create/open/save/list_pages
- [Page Operations](#page-operations) — page:update/list
- [Node Operations](#node-operations) — node:add/add_tree/update/delete/move/list/get/inspect
- [Design Tokens](#design-tokens) — token:set/get/list/export_css
- [Variables & Themes](#variables--themes) — variable:set/get/delete/list/theme-axis/export-css
- [Components](#components) — component:create/list
- [Image Generation](#image-generation) — image:generate
- [Export](#export) — export:html/vue/react/svg
- [Preview & Screenshot](#preview--screenshot) — preview:start/stop/screenshot
- [Import & Guidelines](#import--guidelines) — import:figma, guidelines:get

---

## Canvas Management

| ツール | パラメータ | レスポンス |
|---|---|---|
| `canvas:create` | `path` (必須), `name?`, `width?` (default: 1440) | `{ path, pageId, name }` |
| `canvas:open` | `path` (必須) | `{ meta, pages, tokenCount, nodeCount }` |
| `canvas:save` | `path?` (別名保存), `format?` (default: true) | `{ path, size, modified }` |
| `canvas:list_pages` | なし | `{ pages: [{ id, name, nodeCount }] }` |

---

## Page Operations

### `page:update`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `name` | string | No | 新しい名前 |
| `width` | number | No | 新しい幅 |
| `height` | number/null | No | 高さ (`null` で無制限) |

### `page:list`

レスポンス: `{ pages: [{ id, name, width, height, nodeCount }], count }`

---

## Node Operations

### `node:add`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodes` | array | Yes | ノード定義の配列 |

各ノード定義:

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `type` | enum | Yes | `frame\|text\|image\|icon\|component\|vector` |
| `name` | string | Yes | ノード名 |
| `parentId` | string | No* | 親 ID (`parentName` と排他) |
| `parentName` | string | No* | 親名で検索 (`parentId` の代替) |
| `content` | string | No | テキスト内容 |
| `layout` | object | No | `{ direction, gap, align, justify, wrap }` |
| `styles` | object | No | スタイル |
| `clip` | boolean | No | `overflow: hidden` |
| `stroke` | object | No | `{ color, width, style? }` |
| `effects` | array | No | shadow/blur/backdrop-blur |
| `gradient` | object | No | `{ type, angle?, colors }` |
| `icon`, `src`, `alt`, `componentRef`, `props`, `autoFix` | | No | |

`parentName`: 名前でノード検索。0件/複数一致→エラー。同一バッチ内の先行ノード名も解決可能。

### `node:add_tree`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `parentId` | string | Yes | ルートの親 ID |
| `tree` | object/array | Yes | ネストツリー定義 (`children` 配列で再帰) |

ツリーノードは `node:add` と同じフィールド + `children` 配列。配列で複数ルートノードも可。

### `node:update`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `updates` | array | Yes | 更新定義の配列 |

各更新定義: `id` または `nodeName` (排他、いずれか必須) + 更新フィールド (`name`, `content`, `styles`, `layout`, `clip`, `stroke`, `effects`, `gradient`, `props`, `overrides`)。

**スタイルバリデーション**: タイポ検出時は `warnings` 配列含む。`autoFix: true` で自動修正 (`fixes` 配列含む)。
**`layout.gap`**: 文字列 (`"16px"`) と数値 (`16`) の両方受付。

### `node:delete`

`pageId` + `nodeId` — frame の子も再帰削除。

### `node:move`

`pageId` + `nodeId` + `newParentId` + `index?`

### `node:list`

`pageId` + `parentId?` + `type?` + `search?` + `depth?`

### `node:get`

`pageId` + `nodeId` — 全プロパティ取得。

### `node:inspect`

`pageId` + `nodeId?` + `depth?` — Puppeteer で computed layout (寸法・位置・overflow・flex・padding)。

---

## Design Tokens

カテゴリ: `colors`, `spacing`, `typography`, `borderRadius`, `shadows`, `breakpoints`

| ツール | パラメータ | レスポンス |
|---|---|---|
| `token:set` | `tokens[]` (category, key, value, description?) | `{ set, total }` |
| `token:get` | `category`, `key` | `{ category, key, value }` |
| `token:list` | `category?` | トークン全体 |
| `token:export_css` | `outputPath?` | `{ css }` or `{ outputPath, size }` |

---

## Variables & Themes

`$variableName` でノードスタイルから参照可能。

| ツール | パラメータ | レスポンス |
|---|---|---|
| `variable:set` | `name`, `type` (color/spacing/number/string), `value`, `theme?` | `{ set, type, value, theme }` |
| `variable:get` | `name`, `theme?` | `{ name, variable, resolved }` |
| `variable:delete` | `name` | `{ deleted }` |
| `variable:list` | なし | `{ variables, count }` |
| `variable:theme-axis` | `name`, `values[]` | `{ axis, values }` |
| `variable:export-css` | `theme?` | `{ css }` |

---

## Components

| ツール | パラメータ | レスポンス |
|---|---|---|
| `component:create` | `name`, `description?`, `variants?`, `props?`, `defaultProps?`, `template?` | `{ created }` |
| `component:list` | なし | `{ components: [{ name, description, variantCount, propsCount }] }` |

---

## Image Generation

### `image:generate`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | Yes | image ノード ID |
| `type` | enum | Yes | `stock` (Unsplash) / `ai` (DALL-E) |
| `prompt` | string | Yes | 検索キーワードまたはプロンプト |
| `width`, `height` | number | No | サイズ |

環境変数: `UNSPLASH_ACCESS_KEY`, `IMAGE_AI_API_KEY` / `OPENAI_API_KEY`, `IMAGE_AI_API_URL`, `IMAGE_AI_MODEL`

---

## Export

> `export` は最終コード生成用。視覚確認にはプレビューサーバー起動中のノード操作レスポンス画像か `preview:screenshot` を使う。

| ツール | パラメータ | 説明 |
|---|---|---|
| `export:html` | `pageId`, `outputPath`, `nodeId?`, `tailwindConfig?` | HTML + Tailwind CSS |
| `export:vue` | `pageId`, `outputDir`, `nodeId?`, `options?` (composition, typescript, scoped), `tailwindConfig?` | Vue SFC |
| `export:react` | `pageId`, `outputDir`, `nodeId?`, `options?` (typescript), `tailwindConfig?` | React JSX/TSX |
| `export:svg` | `pageId`, `outputPath?`, `nodeId?` | SVG |

---

## Preview & Screenshot

| ツール | パラメータ | 説明 |
|---|---|---|
| `preview:start` | `pageId`, `port?` (default: 3456) | ライブプレビューサーバー起動 |
| `preview:stop` | なし | サーバー停止 |
| `preview:screenshot` | `pageId`, `nodeId?`, `format?` (png/jpeg), `width?`, `height?`, `outputPath?` | スクリーンショット |

**プレビュー起動中の自動スクリーンショット**: ノード操作ツール (`node:add`, `node:add_tree`, `node:update`, `node:delete`, `node:move`, `node:list`, `node:get`) のレスポンスに `ImageContent` が自動付与される。

---

## Import & Guidelines

### `import:figma`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `fileKey` | string | Yes | Figma ファイルキー |
| `accessToken` | string | Yes | Personal Access Token |
| `nodeIds` | string[] | No | 特定ノードのみ |
| `outputPath` | string | No | 出力パス |
| `options` | object | No | `importImages`, `importComponents`, `extractTokens` (全 default: true) |

### `guidelines:get`

`topic?` — `layout`/`typography`/`color`/`spacing`/`components`/`responsive`/`accessibility`。省略時は全トピック。

---

## Response Pattern

**成功**: `{ "content": [{ "type": "text", "text": "{ ... }" }] }`
**成功 + 画像** (プレビュー起動中): テキスト + `{ "type": "image", "data": "<base64>", "mimeType": "image/png" }`
**失敗**: `{ "content": [...], "isError": true }`
