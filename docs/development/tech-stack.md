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
| デプロイ | wrangler | Cloudflare 公式 CLI。Workers / バインディングを管理 |
| パッケージマネージャ | pnpm | 省ディスク・高速（任意） |

## 補足

- **OpenNext Cloudflare の役割**: Next.js の `standalone` ビルドを workerd で動かすアダプタ。AWS 版（`@opennextjs/aws`）を拡張し、KV / R2 / D1 / Durable Objects / Assets / Images の各バインディングを統合する。ビルドは `opennextjs-cloudflare build`、ローカル確認は `opennextjs-cloudflare preview`、デプロイは wrangler。
- **認証のセッション戦略**: D1 adapter を使うため `database` 戦略を採用できる。Google の `refresh_token` を得るには `access_type: "offline"`, `prompt: "consent"` を指定する。
- **ORM の選定**: Auth.js は `@auth/d1-adapter` で D1 を直接扱う（ORM 不問）。アプリ側のチートデータは Drizzle を採用する。Prisma も D1 driver adapter に対応するが、Workers での軽量性・Edge 親和性から Drizzle を提案する。
- **zip フォーマット**: プラットフォームごとにエミュレータのチートファイル形式が異なる（例: PCSX2 の `.pnach`、SNES 系の `.cht`）。変換ロジックは [data-model.md](./data-model.md) のフォーマット定義に従う。

## 外部依存の検証方針

[philosophy.md](./philosophy.md) の「外部境界の正しさはモックで担保しない」に従い、OpenNext / Auth.js / Drizzle などの新規依存は、

1. 実装前に公式ドキュメント（Context7 等）で使用法を確認する
2. 実装後、実環境（Workers / D1）で 1 度疎通させた証拠を残す
