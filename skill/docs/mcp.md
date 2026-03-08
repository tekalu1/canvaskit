# CanvasKit MCP Tools Reference

MCP サーバー経由で利用可能な全ツールの詳細リファレンス。
サーバー起動: `canvaskit serve` (stdio) / `canvaskit serve --transport http` (HTTP)。

## Server State

MCP サーバーはステートフル。`canvas:create` または `canvas:open` で「現在のドキュメント」をロードし、以降のツール呼び出しはそのドキュメントに対して操作する。mutation 後は自動保存される。

---

## Canvas Management

### `canvas:create`
新しい `.canvas.json` ファイルを作成し、現在のドキュメントとしてロードする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `path` | string | Yes | ファイルパス |
| `name` | string | No | キャンバス名 |
| `width` | number | No | キャンバス幅 (default: 1440) |

レスポンス: `{ path, pageId, name }`

### `canvas:open`
既存のファイルを開き、現在のドキュメントとしてロードする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `path` | string | Yes | ファイルパス |

レスポンス: `{ meta, pages, tokenCount, nodeCount }`

### `canvas:save`
現在のドキュメントを保存する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `path` | string | No | 別名保存先パス |
| `format` | boolean | No | Pretty-print (default: true) |

レスポンス: `{ path, size, modified }`

### `canvas:list_pages`
ドキュメント内の全ページを一覧する。

レスポンス: `{ pages: [{ id, name, nodeCount }] }`

---

## Page Operations

### `page:update`
ページのプロパティを更新する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `name` | string | No | 新しいページ名 |
| `width` | number | No | 新しい幅 (px) |
| `height` | number/null | No | 新しい高さ (`null` で無制限) |

レスポンス: `{ updated: { id, name, width, height } }`

### `page:list`
全ページを一覧する。

レスポンス: `{ pages: [{ id, name, width, height, nodeCount }], count }`

---

## Node Operations

### `node:add`
ノードを追加する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodes` | array | Yes | ノード定義の配列 |

各ノード定義:
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | No | カスタム ID (省略時自動生成) |
| `type` | enum | Yes | `frame\|text\|image\|icon\|component\|vector` |
| `name` | string | Yes | ノード名 |
| `parentId` | string | No* | 親フレーム ID (`parentName` と排他) |
| `parentName` | string | No* | 親フレーム名 (`parentId` の代替。名前でノードを検索) |
| `insertIndex` | number | No | 兄弟間の挿入位置 |
| `content` | string | No | テキスト内容 |
| `componentRef` | string | No | コンポーネント参照 |
| `props` | object | No | コンポーネント props |
| `layout` | object | No | レイアウト (`direction` (`row`/`column`/`none`), `gap` (string/number), `align`, `justify`, `wrap`) |
| `clip` | boolean | No | frame 用: `overflow: hidden` (default: false) |
| `stroke` | object | No | 構造化ストローク `{ color, width, style? }` |
| `effects` | array | No | エフェクト配列 (shadow/blur/backdrop-blur) |
| `gradient` | object | No | グラデーション `{ type, angle?, colors }` |
| `autoFix` | boolean | No | スタイルタイポを自動修正 |
| `styles` | object | No | スタイル |
| `icon` | string | No | アイコン参照 |
| `src` | string | No | 画像 URL |
| `alt` | string | No | alt テキスト |

レスポンス: `{ created: [{ id, name }] }`

**`parentName` について:**
- `parentId` の代わりにノード名で親を指定可能
- 一致が0件 → エラー、複数一致 → エラー
- 同一バッチ内で先に追加されたノードの名前も解決可能
- `parentId` と `parentName` のどちらか一方を必ず指定

### `node:add_tree`
ネストされたツリー構造のノードを一括追加する。`children` 配列を再帰的にフラット化して追加する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `parentId` | string | Yes | ツリーのルートの親フレーム ID |
| `tree` | object/array | Yes | ネストされたツリー定義 |

ツリーノード定義:
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `type` | enum | Yes | `frame\|text\|image\|icon\|component\|vector` |
| `name` | string | Yes | ノード名 |
| `children` | array | No | 子ノードの配列 (再帰) |
| `content` | string | No | テキスト内容 |
| `icon` | string | No | アイコン参照 |
| `layout` | object | No | レイアウト (`direction`: `row`/`column`/`none`) |
| `clip` | boolean | No | frame 用: `overflow: hidden` |
| `stroke` | object | No | 構造化ストローク |
| `effects` | array | No | エフェクト配列 |
| `gradient` | object | No | グラデーション |
| `styles` | object | No | スタイル |
| その他 | | No | `src`, `alt`, `componentRef`, `props` |

レスポンス: `{ created: [{ id, name }] }`

**配列サポート:** `tree` パラメータは単一オブジェクトに加えて配列もサポート。複数のルートノードを一括追加可能。

### `node:update`
既存ノードを更新する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `updates` | array | Yes | 更新定義の配列 |

各更新定義:
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | No* | ノード ID (`nodeName` と排他) |
| `nodeName` | string | No* | ノード名で検索 (`id` の代替) |
| `name` | string | No | 新しい名前 |
| `content` | string | No | 新しいテキスト内容 |
| `styles` | object | No | マージされるスタイル |
| `layout` | object | No | マージされるレイアウト (`direction`: `row`/`column`/`none`) |
| `clip` | boolean | No | frame 用: `overflow: hidden` |
| `stroke` | object | No | 構造化ストローク `{ color, width, style? }` |
| `effects` | array | No | エフェクト配列 |
| `gradient` | object | No | グラデーション `{ type, angle?, colors }` |
| `props` | object | No | マージされる props |
| `overrides` | object | No | マージされる overrides |

`*` `id` または `nodeName` のいずれかが必須。`id` が優先。`nodeName` は一意でなければエラー。

レスポンス: `{ updated: [nodeId, ...] }`

**スタイルバリデーション:** `styles` に一般的な CSS プロパティのタイポが含まれている場合、レスポンスに `warnings` 配列が含まれる:
```json
{ "updated": [...], "warnings": [{ "property": "backgroudColor", "message": "...", "suggestion": "backgroundColor" }] }
```

**`autoFix` について:**
`node:add` および `node:update` で `autoFix: true` を指定すると、タイポ警告の対象プロパティを自動修正してから適用する。レスポンスに `fixes` 配列が含まれる:
```json
{ "updated": [...], "fixes": [{ "original": "backgroudcolor", "corrected": "backgroundColor" }] }
```

**`layout.gap` の型:**
`gap` は文字列 (`"16px"`) と数値 (`16`) の両方を受け入れる。数値は内部で文字列に変換される。

### `node:delete`
ノードを削除する (frame の子も再帰削除)。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | Yes | ノード ID |

レスポンス: `{ deleted: nodeId }`

### `node:move`
ノードを別の親に移動する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | Yes | 移動するノード ID |
| `newParentId` | string | Yes | 新しい親フレーム ID |
| `index` | number | No | 挿入位置 |

レスポンス: `{ moved: nodeId, newParent: parentId }`

### `node:list`
ノードを一覧・検索する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `parentId` | string | No | 親でフィルタ |
| `type` | string | No | タイプでフィルタ |
| `search` | string | No | 名前で検索 |
| `depth` | number | No | 最大探索深度 |

レスポンス: `{ nodes: [{ id, type, name, parentId, childCount }], count }`

### `node:get`
単一ノードの全プロパティを取得する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | Yes | ノード ID |

レスポンス: `{ id, type, name, ... }` (ノードの全プロパティ)

### `node:inspect`
ノードの computed layout (計算済みレイアウト) を取得する。ページを Puppeteer でレンダリングし、各ノードの実際の寸法・位置・overflow 状態・flex プロパティを返す。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | No | 特定ノード (省略時は root) |
| `depth` | number | No | 最大探索深度 |

レスポンス: `{ pageId, nodes: [{ nodeId, name, type, dimensions, position, overflow, flex, padding }] }`

---

## Design Tokens

カテゴリ: `colors`, `spacing`, `typography`, `borderRadius`, `shadows`, `breakpoints`

### `token:set`
トークンを設定する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `tokens` | array | Yes | トークン定義の配列 |

各トークン定義:
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `category` | enum | Yes | カテゴリ名 |
| `key` | string | Yes | トークンキー |
| `value` | string/object | Yes | 値 (typography の場合はオブジェクト) |
| `description` | string | No | 説明 |

レスポンス: `{ set: count, total: totalTokenCount }`

### `token:get`
単一トークンを取得する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `category` | enum | Yes | カテゴリ名 |
| `key` | string | Yes | トークンキー |

レスポンス: `{ category, key, value }`

### `token:list`
全トークンを一覧する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `category` | enum | No | カテゴリでフィルタ |

レスポンス: トークン全体のオブジェクト

### `token:export_css`
トークンを CSS Custom Properties としてエクスポートする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `outputPath` | string | No | 出力ファイルパス (省略時はレスポンスに含む) |

レスポンス: `{ css }` or `{ outputPath, size }`

---

## Components

### `component:create`
再利用可能なコンポーネント定義を作成する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | Yes | コンポーネント名 (ID) |
| `description` | string | No | 説明 |
| `variants` | object | No | バリアント定義 |
| `props` | string[] | No | プロパティ名の配列 |
| `defaultProps` | object | No | デフォルトプロパティ |
| `template` | object | No | テンプレートツリー |

レスポンス: `{ created: name }`

### `component:list`
全コンポーネントを一覧する。

レスポンス: `{ components: [{ name, description, variantCount, propsCount }] }`

---

## Variables & Themes

テーマ対応のデザイン変数を管理する。`$variableName` でノードスタイルから参照可能。

### `variable:set`
変数を設定・更新する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | Yes | 変数名 (例: `primary`, `spacing-md`) |
| `type` | enum | Yes | `color`/`spacing`/`number`/`string` |
| `value` | string | Yes | 値 |
| `theme` | object | No | テーマコンテキスト (例: `{ mode: "dark" }`) |

レスポンス: `{ set, type, value, theme }`

### `variable:get`
変数を取得する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | Yes | 変数名 |
| `theme` | object | No | テーマコンテキスト (値の解決に使用) |

レスポンス: `{ name, variable, resolved }`

### `variable:delete`
変数を削除する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | Yes | 変数名 |

レスポンス: `{ deleted }`

### `variable:list`
全変数を一覧する。

レスポンス: `{ variables, count }`

### `variable:theme-axis`
テーマ軸を設定・更新する (例: mode → [light, dark])。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | Yes | 軸名 (例: `mode`, `density`) |
| `values` | string[] | Yes | 利用可能な値 |

レスポンス: `{ axis, values }`

### `variable:export-css`
変数を CSS Custom Properties としてエクスポートする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `theme` | object | No | テーマコンテキスト |

レスポンス: `{ css }`

出力例:
```css
:root { --primary: #3B82F6; --spacing-md: 16px; }
[data-theme="dark"] { --primary: #60A5FA; }
```

---

## Image Generation

### `image:generate`
Stock (Unsplash) または AI 画像を生成し、image ノードの `src` を更新する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | Yes | image ノード ID |
| `type` | enum | Yes | `stock`/`ai` |
| `prompt` | string | Yes | 検索キーワードまたは生成プロンプト |
| `width` | number | No | 幅 |
| `height` | number | No | 高さ |

レスポンス: `{ nodeId, url, attribution?, width?, height? }`

環境変数:
- `UNSPLASH_ACCESS_KEY` — Unsplash API キー (未設定時はフォールバック URL)
- `IMAGE_AI_API_KEY` / `OPENAI_API_KEY` — AI 画像生成 API キー
- `IMAGE_AI_API_URL` — カスタム API エンドポイント (default: OpenAI)
- `IMAGE_AI_MODEL` — モデル名 (default: `dall-e-3`)

---

## Export

デザインをコード (HTML, Vue, React, SVG) に変換する。

> **Note:** `export` は最終的なコード生成用。デザイン作業中の視覚確認には
> `preview:screenshot` を使うこと。プレビューサーバー起動中はノード操作の
> レスポンスにスクリーンショットが自動付与される。

### `export:html`
HTML + Tailwind CSS にエクスポートする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | No | サブツリーのルート (default: root) |
| `outputPath` | string | Yes | 出力ファイルパス |
| `tailwindConfig` | boolean | No | tailwind.config.js も生成する |

### `export:vue`
Vue SFC にエクスポートする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | No | サブツリーのルート |
| `outputDir` | string | Yes | 出力ディレクトリ |
| `options.composition` | boolean | No | Composition API (default: true) |
| `options.typescript` | boolean | No | TypeScript (default: true) |
| `options.scoped` | boolean | No | Scoped styles (default: false) |
| `tailwindConfig` | boolean | No | tailwind.config.js も生成する |

### `export:react`
React JSX/TSX にエクスポートする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | No | サブツリーのルート |
| `outputDir` | string | Yes | 出力ディレクトリ |
| `options.typescript` | boolean | No | TypeScript (default: true) |
| `tailwindConfig` | boolean | No | tailwind.config.js も生成する |

### `export:svg`
SVG にエクスポートする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | No | 特定ノード |
| `outputPath` | string | No | 出力パス (省略時はレスポンスに含む) |

---

## Preview & Screenshot

### `preview:start`
ライブプレビューサーバーを起動する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `port` | number | No | ポート (default: 3456) |

レスポンス: `{ url, port, pageId, message }`

### `preview:stop`
プレビューサーバーを停止する。

### `preview:screenshot`
Puppeteer でスクリーンショットを撮影する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `pageId` | string | Yes | ページ ID |
| `nodeId` | string | No | 特定ノード |
| `format` | enum | No | `png\|jpeg` (default: png) |
| `width` | number | No | ビューポート幅 (default: 1440) |
| `height` | number | No | ビューポート高さ (default: 900) |
| `outputPath` | string | No | 出力パス (省略時は base64) |

---

## Import

### `import:figma`
Figma API からデザインをインポートする。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `fileKey` | string | Yes | Figma ファイルキー |
| `accessToken` | string | Yes | Personal Access Token |
| `nodeIds` | string[] | No | 特定ノードのみ |
| `outputPath` | string | No | 出力パス |
| `options.importImages` | boolean | No | 画像参照を取り込む (default: true) |
| `options.importComponents` | boolean | No | コンポーネントを取り込む (default: true) |
| `options.extractTokens` | boolean | No | トークンを抽出する (default: true) |

レスポンス: `{ outputPath, pages, nodes, tokens, components }`

---

## Guidelines

### `guidelines:get`
デザインガイドラインを取得する。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `topic` | string | No | `layout\|typography\|color\|spacing\|components\|responsive\|accessibility` |

省略時は全トピックを返す。

---

## Response Pattern

全ツールの戻り値は統一フォーマット:

**成功:**
```json
{ "content": [{ "type": "text", "text": "{ ... }" }] }
```

**成功 (スクリーンショット付き):**
ノード操作ツール (`node:add`, `node:add_tree`, `node:update`, `node:delete`, `node:move`, `node:list`, `node:get`) は、プレビューサーバー起動中にスクリーンショットを自動キャプチャし、レスポンスに `ImageContent` を含める:
```json
{
  "content": [
    { "type": "text", "text": "{ ... }" },
    { "type": "image", "data": "<base64>", "mimeType": "image/png" }
  ]
}
```

スクリーンショットロジックは `src/services/node-screenshot.ts` に共通サービスとして実装されており、CLI (`--screenshot` オプション) と MCP の両方から利用される。

**失敗:**
```json
{ "content": [{ "type": "text", "text": "{ \"error\": \"...\" }" }], "isError": true }
```
