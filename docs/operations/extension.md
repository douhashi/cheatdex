# Chrome 拡張（Cheatdex Collector）の運用

チート収集用 Chrome 拡張（`apps/extension`、WXT / Manifest V3）のビルド・ローカル読み込み・PAT 設定手順。
設計は [../development/architecture.md](../development/architecture.md)、技術選定は [../development/tech-stack.md](../development/tech-stack.md) を参照。

## ビルド

リポジトリルートで:

```sh
pnpm install
pnpm --filter cheatdex-extension build
```

成果物は `apps/extension/.output/chrome-mv3/`（MV3 manifest を含む）に出力される。

API baseURL のデフォルトはビルド時に上書きできる（未指定なら `http://localhost:3000`）:

```sh
CHEATDEX_DEFAULT_BASE_URL=https://your-cheatdex.example.com \
  pnpm --filter cheatdex-extension build
```

## Chrome への読み込み（unpacked）

1. `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を ON にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `apps/extension/.output/chrome-mv3/` を選択する

## PAT の設定

1. Cheatdex の Web で Personal Access Token（PAT）を発行する（発行時に平文を 1 度だけ表示）
2. 拡張のオプション画面（拡張アイコン → 設定、または `chrome://extensions` の「拡張機能のオプション」）を開く
3. **API baseURL**（必要時）と **PAT** を入力して保存する
   - PAT は `chrome.storage.local` にのみ保存され、端末間同期（`chrome.storage.sync`）には載せない

## 使い方（収集 → 一括登録）

1. チート掲載ページを開き、拡張アイコンをクリックしてポップアップを開く
   - `activeTab` + `chrome.scripting.executeScript` で現在のタブのテキストを取得して検出する
2. 検出された [候補名, コード] 一覧で取り込み対象を選択し、候補名を必要に応じて編集する
3. **Game ID**（Cheatdex で作成済みの Game の ID）を 1 度だけ入力する
4. 「選択分を一括登録」を押すと `POST /api/cheatcodes/bulk` に 1 リクエストで送信する
   - PAT が無効な場合は 401 が通知され、オプション画面での再設定を促す

## 権限（最小権限）

manifest の `permissions` は `activeTab` / `scripting` / `storage` のみ。`host_permissions` は宣言しない
（ページアクセスはユーザーが操作したタブへ activeTab により一時的に限定される）。
