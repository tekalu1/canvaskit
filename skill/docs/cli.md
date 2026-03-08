# CanvasKit CLI Reference

CanvasKit の全 CLI コマンドの詳細リファレンス。

## Document Management

### `canvaskit init [name]`
新しい `.canvas.json` ファイルを作成する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--template <name>` | No | テンプレートを使用 (例: `landing`) |
| `--list-templates` | No | 利用可能なテンプレート一覧を表示 |

```bash
# 空のキャンバス作成
canvaskit init my-design
# → my-design.canvas.json (page1 + root ノード付き)

# テンプレートから作成
canvaskit init my-landing --template landing
# → my-landing.canvas.json (navbar, hero, features, CTA + デザイントークン付き)

# テンプレート一覧
canvaskit init --list-templates
```

利用可能なテンプレート:
- `landing` — ランディングページ (Navbar, Hero, Features×3カード, CTA セクション + フルデザイントークン)

### `canvaskit open <file>`
ドキュメントのサマリー（メタ情報、ページ一覧、トークン数、コンポーネント数）を表示する。

```bash
canvaskit open design.canvas.json
```

### `canvaskit validate <file>`
Zod スキーマに対してバリデーションを実行する。

```bash
canvaskit validate design.canvas.json
# → [ok] design.canvas.json is valid.
```

> **Note:** `save()` はドキュメント保存前にバリデーションを実行します。無効なドキュメントは保存されません。

---

## Page Commands

ページの追加・更新・一覧・削除を管理する。

### `canvaskit page add <file>`
新しいページを追加する。root フレームノードが自動作成される。

| オプション | 必須 | 説明 |
|---|---|---|
| `--id <pageId>` | Yes | ページ ID |
| `--name <name>` | No | ページ名 (省略時は ID と同じ) |
| `--width <number>` | No | ページ幅 (default: `1440`) |
| `--height <number>` | No | ページ高さ (省略時は auto) |

```bash
# 基本的なページ追加
canvaskit page add design.canvas.json --id page2 --name "Mobile View" --width 375 --height 812

# ID のみ指定 (名前はID、幅は1440、高さはauto)
canvaskit page add design.canvas.json --id page2
```

出力例:
```json
{ "added": { "id": "page2", "name": "Mobile View", "width": 375, "height": 812 } }
```

### `canvaskit page update <file>`
ページのプロパティを更新する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--name <name>` | No | 新しいページ名 |
| `--width <number>` | No | 新しい幅 (px) |
| `--height <number>` | No | 新しい高さ (px, `null` で無制限に戻す) |
| `--stdin` | No | stdin から JSON を読み取る |
| `--screenshot [path]` | No | スクリーンショット撮影 |

```bash
# 幅と高さを変更 (例: iPhone サイズ)
canvaskit page update design.canvas.json --page page1 --width 375 --height 812

# ページ名のみ変更
canvaskit page update design.canvas.json --page page1 --name "Mobile View"

# 高さを無制限に戻す
canvaskit page update design.canvas.json --page page1 --height null

# stdin からバッチ更新
echo '{"name":"Desktop","width":1440,"height":null}' \
  | canvaskit page update design.canvas.json --page page1 --stdin
```

出力例:
```json
{ "updated": { "id": "page1", "name": "Mobile View", "width": 375, "height": 812 } }
```

### `canvaskit page list <file>`
全ページを一覧する（読み取り専用）。

```bash
canvaskit page list design.canvas.json
```

出力例:
```json
{
  "pages": [
    { "id": "page1", "name": "Page 1", "width": 1440, "height": null, "nodeCount": 5 }
  ],
  "count": 1
}
```

### `canvaskit page delete <file>`
ページを削除する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 削除するページ ID |

```bash
canvaskit page delete design.canvas.json --page page2
```

出力例:
```json
{ "deleted": "page2" }
```

---

## Node Commands

ページ上のノード (frame, text, image, icon, component, vector) を操作する。
全 mutation コマンドはファイルを自動保存する。出力は JSON。

### `canvaskit node add <file>`
ノードを追加する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--parent <parentId>` | No | 親フレーム ID (default: `root`) |
| `--parent-name <name>` | No | 親フレーム名 (`--parent` の代替。名前でノードを検索) |
| `--type <type>` | Yes* | `frame\|text\|image\|icon\|component\|vector` |
| `--name <name>` | Yes* | ノード名 |
| `--content <content>` | No | テキスト内容 (text ノード用) |
| `--icon <icon>` | No | アイコン参照 (icon ノード用) |
| `--src <src>` | No | 画像 URL (image ノード用) |
| `--alt <alt>` | No | alt テキスト (image ノード用) |
| `--component-ref <ref>` | Yes* | コンポーネント参照 (component ノード用、component では必須) |
| `--stdin` | No | stdin から JSON を読み取る (配列または単一オブジェクト。`--type`/`--name` 不要) |
| `--auto-fix` | No | スタイルプロパティのタイポを自動修正する |
| `--tree` | No | stdin からネストツリー JSON を読み取る (子ノードを再帰的に作成) |
| `--tree-file <path>` | No | ファイルからネストツリー JSON を読み取る (`--tree` のファイル版。シェルエスケープ不要) |
| `--screenshot [path]` | No | スクリーンショット撮影 (パス省略でインライン表示) |

> **Note:** component ノードでは `componentRef` は必須です。未指定の場合はエラーになります。

```bash
# 単発追加
canvaskit node add design.canvas.json \
  --page page1 --parent root --type text --name "Hello" --content "World"

# 親名で参照 (ID不要)
canvaskit node add design.canvas.json \
  --page page1 --parent-name "Header" --type text --name "Logo" --content "MyApp"

# バッチモード (stdin)
echo '[{"type":"text","name":"A","parentId":"root","content":"aaa"},
       {"type":"text","name":"B","parentId":"root","content":"bbb"}]' \
  | canvaskit node add design.canvas.json --page page1 --stdin

# ネストツリー (--tree) — 10+コマンドを1コマンドに
echo '{"type":"frame","name":"Hero","children":[
  {"type":"text","name":"Title","content":"Hello World"},
  {"type":"text","name":"Subtitle","content":"Welcome"}
]}' | canvaskit node add design.canvas.json --page page1 --parent root --tree

# ファイルからツリーを読み込む (シェルエスケープ不要)
canvaskit node add design.canvas.json \
  --page page1 --parent root --tree-file hero.json

# 配列で複数ルートノードを一括追加 (--tree / --tree-file 両対応)
echo '[{"type":"text","name":"A","content":"aaa"},
       {"type":"text","name":"B","content":"bbb"}]' \
  | canvaskit node add design.canvas.json --page page1 --parent root --tree
```

**`--parent-name` について:**
- ページ内のノードを名前で検索し、一致するノードを親として使用
- 一致が0件 → エラー、複数一致 → エラー (ID を使うよう促す)
- 同一バッチ内で先に追加されたノードの名前も解決可能

**`--tree` について:**
- ネストされた JSON の `children` 配列を再帰的にフラット化
- 各ノードに自動 ID を生成し、親子関係を維持
- 単一オブジェクトと配列の両方をサポート
- `componentId` を `componentRef` の代替として使用可能 (tree モードのみ)

**ビジュアルプリミティブ (stdin/tree 内で指定):**
ノードに構造化ビジュアルプロパティを直接指定可能:
- `clip: true` — frame のオーバーフローを隠す
- `stroke: { color: "#000", width: 2, style: "solid" }` — ストローク
- `effects: [{ type: "shadow", offsetX: "0", offsetY: "4px", blur: "8px", color: "rgba(0,0,0,0.2)" }]` — エフェクト
- `gradient: { type: "linear", angle: 90, colors: [{ color: "#f00", position: 0 }, { color: "#00f", position: 1 }] }` — グラデーション
- `layout.direction: "none"` — 絶対配置モード (子要素を `position: absolute` + `top/left` で配置)

出力例:
```json
{ "created": [{ "id": "a1b2c3d4", "name": "Hello" }] }
```

### `canvaskit node update <file>`
既存ノードのプロパティを更新する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--id <nodeId>` | Yes* | 更新するノード ID (`--node-name` と排他) |
| `--node-name <name>` | Yes* | ノード名で検索 (`--id` の代替) |
| `--name <name>` | No | 新しい名前 |
| `--content <content>` | No | 新しいテキスト内容 |
| `--style <key=value>` | No | スタイルプロパティ設定 (複数指定可: `--style "color=#fff" --style "fontSize=20"`) |
| `--stdin` | No | stdin から更新 JSON を読み取る (配列または単一オブジェクト。styles, layout, props 等も指定可能) |
| `--auto-fix` | No | スタイルプロパティのタイポを自動修正する |
| `--screenshot [path]` | No | スクリーンショット撮影 (パス省略でインライン表示) |

`*` `--id` または `--node-name` のいずれかが必須。`--stdin` 使用時は JSON 内に `id` または `nodeName` を含める。

```bash
# ID で更新 (従来通り)
canvaskit node update design.canvas.json \
  --page page1 --id a1b2c3d4 --content "Updated text"

# 名前で更新 (ID 不要)
canvaskit node update design.canvas.json \
  --page page1 --node-name "Hero Title" --content "New Title"

# --style でスタイルを直接指定 (--stdin 不要)
canvaskit node update design.canvas.json \
  --page page1 --node-name "Hero Title" --style "color=#e53e3e" --style "fontSize=22"

# stdin でも nodeName が使える (配列・単一オブジェクト両対応)
echo '{"nodeName":"Hero Title","content":"Updated via name"}' \
  | canvaskit node update design.canvas.json --page page1 --stdin

# --auto-fix でタイポを自動修正
echo '[{"nodeName":"Title","styles":{"backgroudcolor":"#ff0000"}}]' \
  | canvaskit node update design.canvas.json --page page1 --stdin --auto-fix
# → [fix] "backgroudcolor" → "backgroundColor"
```

**`--node-name` について:**
- ページ内のノードを名前で検索し、一致するノードを更新
- 一致が0件 → エラー、複数一致 → エラー (ID を使うよう促す)
- `--id` と `--node-name` の両方が指定された場合、`--id` が優先

**`--style` について:**
- `key=value` 形式でスタイルプロパティを直接指定 (複数回指定可)
- 値が数値として解釈可能な場合は自動的に数値に変換される (例: `fontSize=22` → `22`)
- `--stdin` と組み合わせ不可

**スタイルバリデーション:**
ノードの `styles` プロパティに一般的な CSS プロパティのタイポが含まれている場合、stderr に警告が出力される (操作はブロックされない)。
```
[warn] Unknown style property "backgroudColor". Did you mean "backgroundColor"?
```

**`--auto-fix` について:**
タイポ警告の対象プロパティを自動的に正しい名前に修正してから適用する。
```bash
canvaskit node add design.canvas.json --page page1 --parent root \
  --type text --name "Title" --stdin --auto-fix < styles-with-typos.json
# → [fix] "backgroudcolor" → "backgroundColor"
```

### `canvaskit node delete <file>`
ノードを削除する。frame ノードの場合、子ノードも再帰的に削除される。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--id <nodeId>` | Yes | 削除するノード ID |
| `--screenshot [path]` | No | スクリーンショット撮影 (パス省略でインライン表示) |

```bash
canvaskit node delete design.canvas.json --page page1 --id a1b2c3d4
```

### `canvaskit node move <file>`
ノードを別の親フレームに移動する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--id <nodeId>` | Yes | 移動するノード ID |
| `--to <parentId>` | Yes | 新しい親フレーム ID |
| `--index <number>` | No | 兄弟間の挿入位置 |
| `--screenshot [path]` | No | スクリーンショット撮影 (パス省略でインライン表示) |

```bash
canvaskit node move design.canvas.json \
  --page page1 --id a1b2c3d4 --to container1 --index 0
```

### `canvaskit node list <file>`
ノードを一覧・検索する（読み取り専用）。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--parent <parentId>` | No | この親の子のみ表示 |
| `--type <type>` | No | タイプでフィルタ |
| `--search <term>` | No | 名前で検索 (case-insensitive) |
| `--depth <number>` | No | 最大探索深度 |
| `--screenshot [path]` | No | スクリーンショット撮影 (パス省略でインライン表示) |

```bash
canvaskit node list design.canvas.json --page page1 --type text
```

出力例:
```json
{
  "nodes": [
    { "id": "a1b2c3d4", "type": "text", "name": "Hello", "parentId": "root", "childCount": 0 }
  ],
  "count": 1
}
```

### `canvaskit node get <file>`
単一ノードの詳細を取得する（読み取り専用）。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--id <nodeId>` | Yes | ノード ID |
| `--screenshot [path]` | No | スクリーンショット撮影 (パス省略でインライン表示) |

```bash
canvaskit node get design.canvas.json --page page1 --id root
```

### `canvaskit node inspect <file>`
ノードの computed layout (計算済みレイアウト) を取得する。Puppeteer でページをレンダリングし、各ノードの実際の寸法・位置・overflow 状態を返す。レイアウトデバッグに有用。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | 対象ページ ID |
| `--id <nodeId>` | No | 特定ノード (省略時は root) |
| `--depth <number>` | No | 最大探索深度 |

```bash
# ページ全体のレイアウトを調査
canvaskit node inspect design.canvas.json --page page1

# 特定ノードとその子のレイアウトを調査
canvaskit node inspect design.canvas.json --page page1 --id header --depth 2
```

出力例:
```json
{
  "pageId": "page1",
  "nodes": [
    {
      "nodeId": "root",
      "name": "Root",
      "type": "frame",
      "dimensions": { "width": 1440, "height": 900 },
      "position": { "x": 0, "y": 0 },
      "overflow": { "clipped": false, "overflowX": "visible", "overflowY": "visible" },
      "flex": { "display": "flex", "flexDirection": "column", "alignItems": "stretch", "justifyContent": "flex-start", "flexWrap": "nowrap", "gap": "0px" },
      "padding": { "top": "0px", "right": "0px", "bottom": "0px", "left": "0px" }
    }
  ]
}
```

---

## Token Commands

デザイントークン (colors, spacing, typography, borderRadius, shadows, breakpoints) を管理する。

### `canvaskit token set <file>`
トークンを設定する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--category <cat>` | Yes* | `colors\|spacing\|typography\|borderRadius\|shadows\|breakpoints` |
| `--key <key>` | Yes* | トークンキー |
| `--value <value>` | Yes* | 値 (文字列、または typography の場合 JSON オブジェクト) |
| `--description <desc>` | No | 説明 |
| `--stdin` | No | stdin から JSON 配列を読み取る |

```bash
# 単一トークン
canvaskit token set design.canvas.json \
  --category colors --key primary --value "#3B82F6"

# 説明付き
canvaskit token set design.canvas.json \
  --category colors --key brand --value "#00FF00" --description "Brand green"

# typography (JSON)
canvaskit token set design.canvas.json \
  --category typography --key heading \
  --value '{"fontFamily":"Inter","fontSize":"32px","fontWeight":"bold","lineHeight":"1.2"}'

# バッチモード
echo '[{"category":"colors","key":"a","value":"#111"},
       {"category":"spacing","key":"sm","value":"8px"}]' \
  | canvaskit token set design.canvas.json --stdin
```

> **Note:** 数値の `fontWeight`, `fontSize`, `lineHeight` は自動的に文字列に変換されます（例: `700` → `"700"`）。

### `canvaskit token get <file>`
トークンを取得する（読み取り専用）。

```bash
canvaskit token get design.canvas.json --category colors --key primary
# → { "category": "colors", "key": "primary", "value": "#3B82F6" }
```

### `canvaskit token delete <file>`
トークンを削除する。

```bash
canvaskit token delete design.canvas.json --category colors --key primary
```

### `canvaskit tokens <file>` (既存コマンド)
全トークンをフォーマット出力する。`token` コマンドとは別。

```bash
canvaskit tokens design.canvas.json                  # JSON
canvaskit tokens design.canvas.json --format css      # CSS Custom Properties
canvaskit tokens design.canvas.json --format tailwind  # tailwind.config.js
```

---

## Component Commands

再利用可能なコンポーネント定義を管理する。

### `canvaskit component create <file>`
コンポーネントを作成する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--name <name>` | Yes* | コンポーネント名 |
| `--description <desc>` | No | 説明 |
| `--stdin` | No | stdin から完全な定義 JSON を読み取る (variants, props, template 含む) |

```bash
# シンプル作成
canvaskit component create design.canvas.json \
  --name Button --description "Primary button"

# フル定義 (stdin)
echo '{
  "name": "Card",
  "description": "Content card",
  "props": ["title", "body"],
  "defaultProps": { "title": "Card" },
  "variants": { "outlined": { "border": "1px solid #ccc" } },
  "template": { "type": "frame", "children": [{ "type": "text", "content": "Card" }] }
}' | canvaskit component create design.canvas.json --stdin
```

### `canvaskit component get <file>`
コンポーネント定義を取得する（読み取り専用）。

| オプション | 必須 | 説明 |
|---|---|---|
| `--name <name>` | Yes | コンポーネント名 |

```bash
canvaskit component get design.canvas.json --name Button
```

出力例:
```json
{
  "name": "Button",
  "description": "Primary button",
  "variants": {},
  "props": [],
  "defaultProps": {}
}
```

### `canvaskit component list <file>`
全コンポーネントを一覧する（読み取り専用）。

```bash
canvaskit component list design.canvas.json
```

出力例:
```json
{
  "components": [
    { "name": "Button", "description": "Primary button", "variantCount": 0, "propsCount": 0 }
  ],
  "count": 1
}
```

### `canvaskit component delete <file>`
コンポーネントを削除する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--name <name>` | Yes | コンポーネント名 |

```bash
canvaskit component delete design.canvas.json --name Button
```

出力例:
```json
{ "deleted": "Button" }
```

---

## Screenshot & Preview

デザインの視覚確認に使う。**Export の前に必ず screenshot で見た目を確認すること。**

### `canvaskit screenshot <file> -o <path>`
Puppeteer でスクリーンショットを撮影する。

```bash
canvaskit screenshot design.canvas.json -o preview.png --format png --width 1440 --height 900
```

### `canvaskit preview <file>`
ライブプレビューサーバー (SSE hot reload) を起動する。

```bash
canvaskit preview design.canvas.json --port 3456
```

### `--screenshot` オプション (全 node コマンド共通)

全ての `canvaskit node` サブコマンド (`add`, `update`, `delete`, `move`, `list`, `get`) で `--screenshot` オプションが利用可能。

```bash
# インライン表示 (対応ターミナル)
canvaskit node add design.canvas.json \
  --page page1 --parent root --type text --name "Title" --content "Hello" --screenshot
# → JSON 出力 + ターミナルに画像がインライン表示される

# ファイルに保存
canvaskit node list design.canvas.json --page page1 --screenshot /tmp/preview.png
# → JSON 出力 + /tmp/preview.png が生成される

# 非対応ターミナルの場合、インラインモードは一時ファイルにフォールバック
# → [+] Screenshot saved to /tmp/canvaskit-1234567890.png
```

対応ターミナルプロトコル:
- **iTerm2** (OSC 1337): iTerm.app, WezTerm, VSCode 内蔵ターミナル
- **Kitty** (Graphics Protocol): Kitty

---

## Export Commands

> **Note:** `export` は最終的なコード生成用。デザイン作業中の視覚確認には
> `screenshot` コマンドまたは `--screenshot` オプションを使うこと。

### `canvaskit export html <file> -o <dir>`
HTML + Tailwind CSS にエクスポートする。

```bash
canvaskit export html design.canvas.json -o ./dist --page page1
```

### `canvaskit export vue <file> -o <dir>`
Vue SFC + Tailwind にエクスポートする。

```bash
canvaskit export vue design.canvas.json -o ./src/components --page page1 --no-typescript
```

### `canvaskit export react <file> -o <dir>`
React JSX/TSX + Tailwind にエクスポートする。

```bash
canvaskit export react design.canvas.json -o ./src/components --page page1
```

### `canvaskit export svg <file> -o <path>`
SVG にエクスポートする。

```bash
canvaskit export svg design.canvas.json -o ./assets/design.svg --page page1 --node hero
```

---

## Variable Commands

テーマ対応のデザイン変数を管理する。既存の tokens とは別に、テーマ切替 (`light`/`dark` 等) をサポートする変数システム。

### `canvaskit variable set <file>`
変数を設定する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--name <name>` | `--stdin` 不使用時 Yes | 変数名 (例: `primary`, `spacing-md`) |
| `--type <type>` | `--stdin` 不使用時 Yes | `color`/`spacing`/`number`/`string` |
| `--value <value>` | `--stdin` 不使用時 Yes | 値 |
| `--theme <key=value\|json>` | No | テーマコンテキスト (`mode=dark` または `{"mode":"dark"}`) |
| `--stdin` | No | stdin から JSON 配列で一括設定 |

```bash
# デフォルト値を設定
canvaskit variable set design.canvas.json \
  --name primary --type color --value "#3B82F6"

# ダークテーマの値を設定 (key=value 形式)
canvaskit variable set design.canvas.json \
  --name primary --type color --value "#60A5FA" --theme mode=dark

# ダークテーマの値を設定 (JSON 形式)
canvaskit variable set design.canvas.json \
  --name primary --type color --value "#60A5FA" --theme '{"mode":"dark"}'

# stdin から一括設定
echo '[
  {"name":"primary","type":"color","value":"#3B82F6"},
  {"name":"primary","type":"color","value":"#1e293b","theme":{"mode":"dark"}},
  {"name":"spacing-md","type":"spacing","value":"16px"}
]' | canvaskit variable set design.canvas.json --stdin
```

### `canvaskit variable get <file>`
変数を取得する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--name <name>` | Yes | 変数名 |
| `--theme <key=value\|json>` | No | テーマコンテキストを指定して解決済み値も取得 |

```bash
canvaskit variable get design.canvas.json --name primary
canvaskit variable get design.canvas.json --name primary --theme mode=dark
canvaskit variable get design.canvas.json --name primary --theme '{"mode":"dark"}'
```

### `canvaskit variable delete <file>`
変数を削除する。

```bash
canvaskit variable delete design.canvas.json --name primary
```

### `canvaskit variable list <file>`
全変数を一覧する。

```bash
canvaskit variable list design.canvas.json
```

### `canvaskit variable theme-axis <file>`
テーマ軸を定義または削除する (例: mode → light, dark)。

| オプション | 必須 | 説明 |
|---|---|---|
| `--name <name>` | Yes | テーマ軸名 |
| `--values <csv>` | Yes* | カンマ区切りの値 (`--delete` 使用時は不要) |
| `--delete` | No | テーマ軸を削除する |

```bash
# テーマ軸を定義
canvaskit variable theme-axis design.canvas.json --name mode --values "light,dark"

# テーマ軸を削除
canvaskit variable theme-axis design.canvas.json --name mode --delete
```

### `canvaskit variable export-css <file>`
変数を CSS Custom Properties としてエクスポートする。

```bash
canvaskit variable export-css design.canvas.json
# → :root { --primary: #3B82F6; }
#   [data-theme="dark"] { --primary: #60A5FA; }
```

---

## Image Generation

### `canvaskit image generate <file>`
Stock (Unsplash) または AI で画像を生成し、image ノードの `src` を更新する。

| オプション | 必須 | 説明 |
|---|---|---|
| `--page <pageId>` | Yes | ページ ID |
| `--node <nodeId>` | Yes | image ノード ID |
| `--type <type>` | Yes | `stock`/`ai` |
| `--prompt <prompt>` | Yes | 検索キーワードまたはプロンプト |
| `--width <number>` | No | 幅 |
| `--height <number>` | No | 高さ |

```bash
# Stock image (Unsplash)
canvaskit image generate design.canvas.json \
  --page page1 --node img1 --type stock --prompt "modern office"

# AI image (OpenAI DALL-E)
canvaskit image generate design.canvas.json \
  --page page1 --node img1 --type ai --prompt "abstract art, vibrant colors"
```

環境変数: `UNSPLASH_ACCESS_KEY`, `IMAGE_AI_API_KEY` / `OPENAI_API_KEY`, `IMAGE_AI_API_URL`, `IMAGE_AI_MODEL`

---

## Server & Import

### `canvaskit serve`
MCP サーバーを起動する。

```bash
canvaskit serve                           # stdio (デフォルト)
canvaskit serve --transport http --port 3100  # HTTP
```

### `canvaskit import figma`
Figma からデザインをインポートする。

```bash
canvaskit import figma --file-key abc123 --token fig_pat_xxx -o design.canvas.json
```

---

## Typical Workflows

### 基本ワークフロー: 構築 → screenshot → 確認
```bash
canvaskit init my-app
canvaskit node add my-app.canvas.json --page page1 --parent root --type frame --name "Header"
canvaskit node add my-app.canvas.json --page page1 --parent root --type text --name "Title" --content "Welcome"
canvaskit screenshot my-app.canvas.json -o preview.png  # 視覚確認
# → preview.png でデザインの見た目を確認してから次のステップへ
```

### テンプレートから構築 → screenshot → export
```bash
canvaskit init my-landing --template landing
canvaskit screenshot my-landing.canvas.json -o preview.png  # まず視覚確認
# → 確認して問題なければエクスポート
canvaskit export html my-landing.canvas.json -o ./dist
```

### ネストツリーで複雑な構造を一括追加
```bash
echo '{"type":"frame","name":"Hero","layout":{"direction":"column","align":"center"},
  "children":[
    {"type":"text","name":"Title","content":"Hello World","styles":{"fontSize":"48px"}},
    {"type":"frame","name":"CTA Row","layout":{"direction":"row","gap":"16px"},"children":[
      {"type":"text","name":"Primary","content":"Get Started"},
      {"type":"text","name":"Secondary","content":"Learn More"}
    ]}
  ]}' | canvaskit node add my-app.canvas.json --page page1 --parent root --tree

# 親名で子ノードを追加 (ID不要)
canvaskit node add my-app.canvas.json --page page1 \
  --parent-name "Hero" --type icon --name "HeroIcon" --icon "lucide:rocket"
```

### 完成デザイン → コードエクスポート
```bash
# React にエクスポート
canvaskit export react design.canvas.json -o ./src/components

# Vue にエクスポート
canvaskit export vue design.canvas.json -o ./src/components

# Figma → screenshot で確認 → エクスポート
canvaskit import figma --file-key abc123 --token fig_pat_xxx -o design.canvas.json
canvaskit screenshot design.canvas.json -o preview.png  # インポート結果を確認
canvaskit export vue design.canvas.json -o ./src/components
```

### ライブプレビューしながら編集
```bash
canvaskit preview design.canvas.json --port 3456
# 別ターミナルで:
canvaskit node add design.canvas.json --page page1 --parent root --type text --name "New" --content "Hello"
# ブラウザが自動更新される
```
