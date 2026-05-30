# インフラ設計（Cloudflare Workers / OpenNext）

Next.js を OpenNext Cloudflare アダプタで Cloudflare Workers にデプロイする構成。採用技術は [tech-stack.md](./tech-stack.md)、アプリ構成は [architecture.md](./architecture.md) を参照。

## 構成図

```
[ブラウザ]
     │
     ▼
[Cloudflare エッジ]
   ├─ 静的アセット ─▶ [Workers Assets]
   │
   ▼ 動的リクエスト
[Worker: Next.js server (workerd, nodejs_compat)]
   │
   ├─ D1 binding ───────▶ [D1: アプリDB + Auth.js]
   ├─ R2 binding ───────▶ [R2: incremental cache (ISR/SSG)]
   ├─ tag cache ────────▶ [D1 or KV]
   └─ revalidate queue ─▶ [Durable Object]
```

## Cloudflare リソース

| リソース | 役割 |
|----------|------|
| Workers | Next.js server function（workerd ランタイム、Node.js 互換レイヤ） |
| Workers Assets | `_next/static` などの静的アセット配信 |
| R2 | ISR / SSG の incremental cache |
| D1 | アプリの永続データ（チート）＋ Auth.js（User/Account/Session） |
| KV | tag cache の代替（D1 を使わない場合）、軽量キャッシュ用途 |
| Durable Objects | ISR 再検証キュー（`queue`）。OpenNext Cloudflare が利用 |
| Images（任意） | Cloudflare Images による画像最適化 |

> OpenNext Cloudflare は AWS 版を拡張し、KV / R2 / D1 / Durable Objects / Assets / Images のバインディングを統合する。tag cache / queue の具体的バックエンドはバージョンにより異なるため、採用時に公式ドキュメントで最新の override を確認する（[philosophy.md](./philosophy.md)）。

## `open-next.config.ts`（提案ベース）

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  // tagCache / queue は採用バージョンの overrides を公式ドキュメントで確認して設定する
});
```

## `wrangler.jsonc`（提案ベース）

```jsonc
{
  "main": ".open-next/worker.js",
  "name": "cheatdex",
  "compatibility_date": "2024-12-30",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "r2_buckets": [
    { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "cheatdex-inc-cache" }
  ],
  "d1_databases": [
    { "binding": "DB", "database_name": "cheatdex", "database_id": "<id>" }
  ]
}
```

> バインディング名は OpenNext Cloudflare が期待する名前に合わせる（incremental cache 用 R2 など）。採用時に公式ドキュメントで確認する。

## ビルド / デプロイ

| 操作 | コマンド |
|------|----------|
| ビルド | `opennextjs-cloudflare build` |
| ローカルプレビュー（Workers ランタイム） | `opennextjs-cloudflare preview` |
| デプロイ | `wrangler deploy`（または `opennextjs-cloudflare deploy`） |
| D1 マイグレーション | `wrangler d1 migrations apply`（Drizzle で生成） |

## D1 マイグレーション / seed 運用

Drizzle スキーマ（`app/lib/db/schema.ts`、SSoT）からマイグレーション SQL を生成し、`wrangler d1 migrations apply` で適用する（適用経路を 1 本に統一）。`wrangler.jsonc` の `d1_databases[].migrations_dir` を `drizzle` に設定しているため、`drizzle/` 配下の SQL がマイグレーションとして適用される。

```bash
pnpm db:generate        # drizzle-kit generate（スキーマ → SQL）
pnpm db:migrate:local   # wrangler d1 migrations apply cheatdex --local
pnpm db:migrate:remote  # wrangler d1 migrations apply cheatdex --remote
```

Platform 初期データ（ps2）は冪等 seed SQL（`drizzle/seed.sql`、`INSERT ... ON CONFLICT(slug) DO NOTHING`）で投入する。何度流しても安全。

```bash
pnpm db:seed:local      # wrangler d1 execute cheatdex --local  --file ./drizzle/seed.sql
pnpm db:seed:remote     # wrangler d1 execute cheatdex --remote --file ./drizzle/seed.sql
```

remote 初期セットアップ:

1. `wrangler d1 create cheatdex` で remote D1 を作成し、出力 `database_id` を `wrangler.jsonc` に設定（現状はプレースホルダ `REPLACE_WITH_D1_DATABASE_ID`）。
2. `pnpm db:migrate:remote` でスキーマ適用。
3. `pnpm db:seed:remote` で Platform 初期データ投入。

## シークレット / 環境変数

| 変数 | 用途 | 管理 |
|------|------|------|
| `AUTH_SECRET` | Auth.js のセッション/トークン署名鍵（`openssl rand -base64 32` 等で生成） | `wrangler secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth クライアント | `wrangler secret` |
| D1 / R2 | DB・キャッシュ | wrangler バインディング |

```bash
wrangler secret put AUTH_SECRET
wrangler secret put AUTH_GOOGLE_ID
wrangler secret put AUTH_GOOGLE_SECRET
```

> シークレットは `wrangler secret put` で登録し、リポジトリにコミットしない。ローカル開発は `.dev.vars` を使用（gitignore 対象）。

### Google OAuth リダイレクト URI

Google Cloud Console の OAuth クライアント設定で、以下の「承認済みリダイレクト URI」を登録する。

- 本番: `https://<本番ドメイン>/api/auth/callback/google`
- ローカル: `http://localhost:3000/api/auth/callback/google`

## 要確認 / 今後

- 独自ドメイン・Cloudflare ルートの設定
- tag cache（D1 / KV）と queue（Durable Object）の最終構成
- D1 の容量・行サイズ上限がチートデータ規模に対し十分かの確認
- 運用手順（デプロイ・ロールバック・監視）は確定後 `docs/operations/` に記載する
