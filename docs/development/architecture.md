# アーキテクチャ設計

Cheatdex のアプリケーション構成。インフラ詳細は [infrastructure.md](./infrastructure.md)、データ構造は [data-model.md](./data-model.md)、採用技術は [tech-stack.md](./tech-stack.md) を参照。

## 全体像

```
[ブラウザ]                  [Chrome 拡張]
   │  HTTPS                  │  HTTPS + Bearer PAT
   ▼                          ▼
[Cloudflare（エッジ）]
   ├─ 静的アセット ──▶ [Workers Assets]
   │
   ▼  動的リクエスト
[Worker: Next.js server (OpenNext Cloudflare / workerd)]
   ├─ Server Components / Server Actions   ← Web UI
   ├─ Route Handlers                       ← 拡張 / Web 共通 API、zip 出力、認証コールバック
   ├─ Auth.js (Google OAuth, @auth/d1-adapter)   ← Web セッション
   ├─ PAT 認証ミドルウェア                  ← 拡張用 API トークン
   ├─ zip 生成 (fflate)
   └─ Drizzle ORM
        │  D1 binding
        ▼
   [Cloudflare D1 (SQLite)]

  ISR/キャッシュ: incremental cache → R2 / tag cache → D1(or KV) / queue → Durable Object
  （OpenNext Cloudflare が管理。infrastructure.md 参照）
```

バインディング（D1 / R2 / KV など）には `getCloudflareContext()` 経由でアクセスする。

## 設計方針

Web UI と Chrome 拡張の双方から叩ける **API ファースト** を主軸とする。Web は「箱」（一覧・編集・PAT 発行・zip 出力）の役割に絞り、収集の入口は拡張に寄せる。価値の源泉は拡張による bulk 収集であり、Web 単体ではこのプロダクトの価値は成立しない。

## レイヤ構成

App Router を前提に、以下の責務で分離する。

| レイヤ | 責務 | 配置の例 |
|--------|------|----------|
| UI（Server / Client Components） | 画面描画・操作 | `app/**` |
| Route Handlers | 認証コールバック、zip ダウンロード、Chrome 拡張 / Web 共通の登録・取得 API | `app/api/**/route.ts` |
| Server Actions | Web UI からの編集・ON/OFF・削除 | `app/**/actions.ts` |
| ドメイン / サービス層 | チート整理ロジック、フォーマット変換 | `lib/**` |
| データアクセス | Drizzle 経由の永続化（D1 binding） | `lib/db/**` |

> DRY / YAGNI（[philosophy.md](./philosophy.md)）に従い、層の抽出は重複が現れた時点で行う。最初から過度に分割しない。

## 主要フロー

### 認証

#### Web（Google ログイン）

1. ユーザーが `signIn("google")` を実行
2. Auth.js が Google OAuth へリダイレクト
3. コールバックを `app/api/auth/[...nextauth]/route.ts` が受け、`@auth/d1-adapter` が User/Account/Session を D1 に永続化
4. 以降はセッション（database 戦略）でユーザーを識別

#### Chrome 拡張（PAT）

1. ユーザーが Web 上で API トークン（PAT）を発行する。発行時に平文を 1 度だけ表示し、サーバ側はハッシュのみ保存
2. 拡張は API リクエストに `Authorization: Bearer <token>` ヘッダを付与
3. Route Handler 側のミドルウェアがハッシュ照合で User を識別。失効・削除されたトークンは弾く

> MVP では Chrome 拡張内で OAuth フローを完結させない。Web のセッション系統と完全に独立した経路として扱う。

### チート管理（Web UI）

- プラットフォーム → ゲーム → チートコードの階層を Server Components で表示
- 編集・ON/OFF 切替・削除は Server Actions で実行し、対象パスを `revalidatePath` で再検証

### Chrome 拡張からのチート登録

1. ユーザーが Web で発行した PAT を拡張に設定（初回のみ）。PAT は拡張の `chrome.storage.local` に保存し、同期ストレージには載せない
2. チートコード掲載ページで拡張アイコンを押すと、`activeTab` + `chrome.scripting.executeScript` で現在のタブに都度注入してページテキストを取得し、正規表現で **GameShark 系 hex** と **PCSX2 `.pnach`** にマッチする行を抽出（常時 `<all_urls>` 注入はしない）
3. 検出された各コードに対し、近接テキスト（GameShark は直前見出し、`.pnach` は `//` / `comment=`）を候補名として埋め、一覧表示
4. ユーザーが取り込み対象を選択。Game（既存の Game ID）を 1 度だけ指定して **`POST /api/cheatcodes/bulk`** に 1 リクエストで bulk 送信
5. Route Handler が PAT を検証し、全 item を先にバリデーション（all-or-nothing）して CheatCode を **1 回のバッチ挿入**で D1 に登録。件数を返す

#### bulk 登録 API（`POST /api/cheatcodes/bulk`）

拡張の「1 操作で 30+ 件」を素直に満たすため、登録 API に bulk エンドポイントを設ける（Web の一括登録でも再利用可能）。

- **リクエスト**: `{ game_id: number, items: [{ name, code, description? }] }`（Game/Platform はトップレベルで 1 度だけ指定。`items` は最大 200 件）
- **認証**: 既存単件 API と同一の `authenticate(req)`（Bearer PAT / セッション）
- **部分失敗ポリシー**: all-or-nothing。1 件でも不正なら何も挿入せず `400`（不正な index と理由）。`game_id` 不在は `400`
- **レスポンス**: `201 { created: [...], count: N }`
- **DRY**: 単件 item の検証は単件 `POST /api/cheatcodes` と共通の純粋関数 `app/lib/cheatcode/validate.ts` に集約。実スキーマ（`app/lib/db/schema.ts`）に合わせ本体カラムは `code`、`game.platform_id`、`platform.slug`（data-model.md の論理名 `body`/`enabled` ではない）

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

## 関連する設計判断（確定）

- **データ所有モデル**: 案A 採用。User は Game / CheatCode を所有。Platform は全ユーザー共通の固定マスタ → [../business/model.md](../business/model.md)
- **対応プラットフォーム**: MVP は PS2 のみ（PCSX2 / NetherSX2 の `.pnach`） → [data-model.md](./data-model.md)
- **認証の二系統**: Web は Auth.js（Google OAuth）、Chrome 拡張は PAT → [tech-stack.md](./tech-stack.md)
- **Chrome 拡張の検出形式**: 初期は GameShark 系 hex と PCSX2 `.pnach` の 2 系統に限定
- **Chrome 拡張の配置**: pnpm workspace の `apps/extension`（WXT / vanilla TS）。ルートの Next.js は据え置き（`apps/web` への移設はしない）。拡張は API を HTTP で叩くのみで Next.js コードへは依存しない → [tech-stack.md](./tech-stack.md)
- **bulk 登録**: `POST /api/cheatcodes/bulk` を追加し、拡張からの 1 リクエスト bulk 送信を実現（all-or-nothing）
