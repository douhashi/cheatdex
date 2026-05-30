# Cheatdex Collector（Chrome 拡張）

チート掲載ページから GameShark 系 hex / PCSX2 `.pnach` のコードを検出し、
候補名を付けて一覧表示・選択し、Cheatdex API に一括登録（bulk）する Chrome 拡張。

- フレームワーク: [WXT](https://wxt.dev/)（vanilla TS / Manifest V3）
- 認証: Cheatdex で発行した PAT を `Authorization: Bearer <token>` で送信
- 権限: `activeTab` / `scripting` / `storage` のみ（host_permissions なし）

## ビルド

リポジトリルートで:

```sh
pnpm install
pnpm --filter cheatdex-extension build
```

成果物は `apps/extension/.output/chrome-mv3/`（MV3 manifest を含む）に出力される。

API baseURL のデフォルトはビルド時に変更できる:

```sh
CHEATDEX_DEFAULT_BASE_URL=https://your-cheatdex.example.com \
  pnpm --filter cheatdex-extension build
```

## Chrome への読み込み（unpacked）

1. `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `apps/extension/.output/chrome-mv3/` を選択

## 使い方

1. 拡張のオプション画面（拡張アイコン → 設定、または `chrome://extensions` の「拡張機能のオプション」）で
   - **API baseURL**（必要なら）
   - **PAT**（Cheatdex の Web で発行したトークン）
   を保存する。PAT は `chrome.storage.local` にのみ保存され、同期されない。
2. チート掲載ページを開き、拡張アイコンをクリックしてポップアップを開く。
   - activeTab + `chrome.scripting.executeScript` で現在のタブのテキストを取得し、コードを検出する。
3. 検出された [候補名, コード] の一覧でチェックボックスにより取り込み対象を選択し、
   候補名を必要に応じて編集する。
4. **Game ID**（Cheatdex で作成済みの Game の ID）を 1 度だけ入力する。
5. 「選択分を一括登録」を押すと `POST /api/cheatcodes/bulk` に 1 リクエストで送信する。
   - PAT が無効な場合は 401 が通知され、オプション画面で再設定を促す。

## 開発

```sh
pnpm --filter cheatdex-extension dev        # WXT 開発モード
pnpm --filter cheatdex-extension test       # vitest（detect / api-client）
pnpm --filter cheatdex-extension typecheck  # tsc --noEmit
```
