# 技術スタック

ユーザー指定（Next.js / OpenNext / Cloudflare Workers）を前提に、Cheatdex の要件へ合わせて選定した提案。確定前提と提案を区別して記載する。

## 確定（ユーザー指定）

| 領域 | 採用 |
|------|------|
| フレームワーク | Next.js（App Router） |
| デプロイアダプタ | [OpenNext for Cloudflare](https://opennext.js.org/cloudflare)（`@opennextjs/cloudflare`） |
| 実行基盤 | Cloudflare Workers（workerd ランタイム） |

## 提案

| 領域 | 採用案 | 根拠 |
|------|--------|------|
| 言語 | TypeScript | Next.js 標準。型安全でデータ構造の変更に強い |
| ランタイム | Workers（Node.js 互換レイヤ有効） | OpenNext Cloudflare は standalone build を workerd 上で実行 |
| 認証 | Auth.js v5（NextAuth）+ Google Provider | App Router 対応。Google OAuth を公式実装で提供 |
| 認証アダプタ | `@auth/d1-adapter` | Cloudflare D1 を直接利用する公式アダプタ（ORM 非依存） |
| DB | Cloudflare D1（SQLite） | Workers ネイティブ。チート階層のリレーショナルデータに十分。バインディング経由で接続枯渇の懸念なし |
| ORM | Drizzle ORM | D1 / Workers に最適化。Edge で軽量、SQLite ドライバ公式対応 |
| zip 生成 | fflate | Workers ランタイムで動作（Node 専用の archiver は不可）。プラットフォーム別フォーマットへ変換して固める |
| Chrome 拡張 | Manifest V3 + TypeScript + [WXT](https://wxt.dev/)（vanilla TS、React 非依存） | チートコード収集の入口。GameShark 系 hex / `.pnach` の正規表現検出と bulk 登録を担う。MVP は Chrome のみ。Vite ベースで MV3 manifest を自動生成し、`apps/extension` に配置（pnpm workspace） |
| デプロイ | wrangler | Cloudflare 公式 CLI。Workers / バインディングを管理 |
| Lint / Format | Biome | lint + format 一体、Rust 製で高速、設定が少ない |
| パッケージマネージャ | pnpm | 省ディスク・高速 |
| ツール管理 | mise | node / pnpm / lefthook のバージョンを一元管理 |
| Git hooks | lefthook | pre-commit で lint / typecheck を実行 |
| CI | GitHub Actions | install → lint → typecheck → test → build（ルート）+ 拡張の typecheck → test → build |

## 開発環境 / ツールチェーン

ツールは [mise](https://mise.jdx.dev/) で一元管理する（`mise.toml`）。`mise install` で node（LTS）/ pnpm / lefthook が揃う。

| ツール | 用途 | コマンド / 設定 |
|--------|------|-----------------|
| mise | ランタイム・CLI のバージョン管理 | `mise.toml`（`node = "lts"`, `pnpm`, `lefthook`） |
| Biome | lint + format | `pnpm lint` / `pnpm format`（`biome.json`） |
| TypeScript | 型チェック | `pnpm typecheck`（`tsc --noEmit`） |
| lefthook | Git pre-commit hook | staged に Biome、全体に typecheck（`lefthook.yml`） |
| GitHub Actions | CI | `.github/workflows/ci.yml`: install → lint → typecheck → build |

`cloudflare-env.d.ts`（`wrangler types` の生成物）はコミットせず、`postinstall` で各環境で生成する。

### セットアップ手順

1. `mise install` — node / pnpm / lefthook を導入
2. `pnpm install` — 依存を導入（postinstall で `cloudflare-env.d.ts` を生成）
3. `lefthook install` — Git pre-commit フックを設置
4. `pnpm dev` — 開発サーバ / `pnpm preview` — Workers ランタイムでプレビュー / `pnpm deploy` — デプロイ

## 補足

- **OpenNext Cloudflare の役割**: Next.js の `standalone` ビルドを workerd で動かすアダプタ。AWS 版（`@opennextjs/aws`）を拡張し、KV / R2 / D1 / Durable Objects / Assets / Images の各バインディングを統合する。ビルドは `opennextjs-cloudflare build`、ローカル確認は `opennextjs-cloudflare preview`、デプロイは wrangler。
- **認証のセッション戦略**: D1 adapter を使うため `database` 戦略を採用できる。Google の `refresh_token` を得るには `access_type: "offline"`, `prompt: "consent"` を指定する。
- **拡張の認証（PAT）**: Chrome 拡張からの API アクセスは Auth.js のセッションを介さず、**Personal Access Token 方式**で行う。Web 上で発行したトークンを `Authorization: Bearer <token>` で送り、サーバ側はハッシュ照合で User を識別する。MVP では OAuth フローを拡張内で完結させない。
- **ORM の選定**: Auth.js は `@auth/d1-adapter` で D1 を直接扱う（ORM 不問）。アプリ側のチートデータは Drizzle を採用する。Prisma も D1 driver adapter に対応するが、Workers での軽量性・Edge 親和性から Drizzle を提案する。
- **zip フォーマット**: プラットフォームごとにエミュレータのチートファイル形式が異なる（例: PCSX2 の `.pnach`、SNES 系の `.cht`）。変換ロジックは [data-model.md](./data-model.md) のフォーマット定義に従う。
- **Chrome 拡張（WXT）の構成**: ルートの Next.js アプリは据え置き、拡張は pnpm workspace パッケージ `apps/extension`（`pnpm-workspace.yaml` の `packages: ["apps/*"]`）として配置する。検出/パース・候補名・API クライアントは DOM 非依存の純粋関数（`src/lib/`）に切り出し vitest で検証する。ビルドは `pnpm --filter cheatdex-extension build`（= WXT）で `.output/chrome-mv3/` に MV3 を出力する。権限は `activeTab` / `scripting` / `storage` のみ（host_permissions 無し）。読み込み・PAT 設定手順は `apps/extension/README.md` と [operations](../operations/INDEX.md) を参照。
  - **WXT のバージョン pin に関する注意**: npm 上に `wxt` を名乗る別パッケージ（リポジトリ情報の無い squatter, version 3.x）が存在し `npm view wxt version` は誤って 3.x を返す。本物の WXT は dist-tag `latest`（本実装時点で **0.20.26**, homepage=wxt.dev / repo=wxt-dev/wxt）。`package.json` ではこの実体バージョンを固定する。

## 外部依存の検証方針

[philosophy.md](./philosophy.md) の「外部境界の正しさはモックで担保しない」に従い、OpenNext / Auth.js / Drizzle などの新規依存は、

1. 実装前に公式ドキュメント（Context7 等）で使用法を確認する
2. 実装後、実環境（Workers / D1）で 1 度疎通させた証拠を残す
