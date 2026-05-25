# アーキテクチャ設計

Cheatdex のアプリケーション構成。インフラ詳細は [infrastructure.md](./infrastructure.md)、データ構造は [data-model.md](./data-model.md)、採用技術は [tech-stack.md](./tech-stack.md) を参照。

## 全体像

```
[ブラウザ]
   │  HTTPS
   ▼
[Cloudflare（エッジ）]
   ├─ 静的アセット ──▶ [Workers Assets]
   │
   ▼  動的リクエスト
[Worker: Next.js server (OpenNext Cloudflare / workerd)]
   ├─ Server Components / Route Handlers
   ├─ Auth.js (Google OAuth, @auth/d1-adapter)
   ├─ zip 生成 (fflate)
   └─ Drizzle ORM
        │  D1 binding
        ▼
   [Cloudflare D1 (SQLite)]

  ISR/キャッシュ: incremental cache → R2 / tag cache → D1(or KV) / queue → Durable Object
  （OpenNext Cloudflare が管理。infrastructure.md 参照）
```

バインディング（D1 / R2 / KV など）には `getCloudflareContext()` 経由でアクセスする。

## レイヤ構成

App Router を前提に、以下の責務で分離する。

| レイヤ | 責務 | 配置の例 |
|--------|------|----------|
| UI（Server / Client Components） | 画面描画・操作 | `app/**` |
| Route Handlers | 認証コールバック、zip ダウンロードエンドポイント | `app/api/**/route.ts` |
| Server Actions | 登録・編集・ON/OFF などの更新操作 | `app/**/actions.ts` |
| ドメイン / サービス層 | チート整理ロジック、フォーマット変換 | `lib/**` |
| データアクセス | Drizzle 経由の永続化（D1 binding） | `lib/db/**` |

> DRY / YAGNI（[philosophy.md](./philosophy.md)）に従い、層の抽出は重複が現れた時点で行う。最初から過度に分割しない。

## 主要フロー

### 認証（Google ログイン）

1. ユーザーが `signIn("google")` を実行
2. Auth.js が Google OAuth へリダイレクト
3. コールバックを `app/api/auth/[...nextauth]/route.ts` が受け、`@auth/d1-adapter` が User/Account/Session を D1 に永続化
4. 以降はセッション（database 戦略）でユーザーを識別

### チート管理

- プラットフォーム → ゲーム → チートコードの階層を Server Components で表示
- 登録・編集・ON/OFF 切替は Server Actions で実行し、対象パスを `revalidatePath` で再検証

### zip ダウンロード

1. ユーザーが「全体」または「プラットフォーム単位」のダウンロードを要求
2. Route Handler が対象チートを取得し、プラットフォームごとのフォーマットへ変換
3. fflate で生成した zip をレスポンスとして返す

> 出力対象は「ON のチートのみ」か「全件」か、要確認（[overview.md](../business/overview.md) の論点）。
> Workers にはリクエストごとの CPU 時間・メモリ制約があるため、大量チートの zip 生成はサイズ上限・ストリーミング方針を別途検討する。

## キャッシュ戦略

- 一覧などの読み取りは ISR + `revalidateTag` / `revalidatePath` で更新反映
- zip ダウンロードは動的生成のためキャッシュしない（または短 TTL）
- 認証が絡むユーザー固有データはキャッシュ対象から外す

## 関連する設計判断（要確認）

- データ所有モデル（案A: ユーザー所有 / 案B: 共有マスタ）→ [../business/model.md](../business/model.md)
- チートファイルフォーマットの確定 → [data-model.md](./data-model.md)
