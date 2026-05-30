# データモデル

提案する論理データモデル。[../business/model.md](../business/model.md) の **案A（ユーザーがチートを所有）** を前提とする。確定前の提案であり、要件確定後に見直す。

永続化は Cloudflare D1（SQLite）。アプリのチートデータは Drizzle ORM、認証関連テーブルは Auth.js の `@auth/d1-adapter` が管理する（[tech-stack.md](./tech-stack.md)）。

> 実装メモ（Phase 1）:
> - Drizzle スキーマの真実源 (SSoT) は `app/lib/db/schema.ts` の 1 ファイル。`drizzle-kit generate` でマイグレーション SQL を生成し、`wrangler d1 migrations apply cheatdex` で適用する（適用経路を 1 本に統一）。
> - アプリ独自テーブル（platform / game / cheat_code / api_token）に加え、Auth.js (@auth/d1-adapter) の標準 4 表（users / accounts / sessions / verification_tokens）も同一ファイル・同一マイグレーション系列で定義する。Auth.js 標準テーブルの列名は adapter の DDL に合わせ camelCase（`userId` / `providerAccountId` / `sessionToken` / `emailVerified`）、日時列（`expires` / `emailVerified`）は adapter が ISO8601 文字列を保存するため TEXT とする。
> - 本ドキュメントの ApiToken の物理テーブル名は **`api_token`**（列定義は ApiToken に一致）。
> - アプリ独自テーブルの主キーは物理上 `INTEGER PRIMARY KEY AUTOINCREMENT`（cuid/UUID への追加依存を避ける）。日時カラム（`created_at` / `updated_at` / `last_used_at`）は epoch ミリ秒（INTEGER, デフォルト `(unixepoch() * 1000)`）。

## エンティティ関連（概要）

```
User 1 ──< Platform 1 ──< Game 1 ──< CheatCode
```

- ユーザーは複数のプラットフォームを持つ（あるいはプラットフォームは共有マスタにする案もある。下記「要確認」参照）
- プラットフォームは複数のゲームを持つ
- ゲームは複数のチートコードを持つ

## エンティティ定義（案）

### User

Auth.js が管理。Google ログインのアカウント。

| フィールド | 型 | 説明 |
|-----------|----|------|
| id | string | PK |
| name / email / image | string | Google プロフィール |

> Auth.js の `User` / `Account` / `Session` / `VerificationToken` は `@auth/d1-adapter` が D1 に作成する（スキーマはアダプタ定義に従う）。アプリ側テーブルからは `userId` で参照する。

### Platform

| フィールド | 型 | 説明 |
|-----------|----|------|
| id | string | PK |
| code | string | 識別子（例: `ps2`, `ps`, `snes`） |
| name | string | 表示名（例: PlayStation 2） |
| format | enum | zip 出力時のチートファイル形式（例: `pnach`, `cht`） |

> Platform は全ユーザー共通の固定マスタとして提供する。MVP は PS2 のみ定義する。

### Game

| フィールド | 型 | 説明 |
|-----------|----|------|
| id | string | PK |
| platformId | string | FK → Platform |
| ownerId | string | FK → User（案A） |
| title | string | ゲームタイトル |
| serial | string? | ゲーム識別子（例: PS2 のシリアル `SLUS-xxxxx`）。フォーマットによっては必須 |

### CheatCode

| フィールド | 型 | 説明 |
|-----------|----|------|
| id | string | PK |
| gameId | string | FK → Game |
| name | string | チート名（表示用） |
| body | text | チートコード本体 |
| enabled | boolean | ON/OFF 状態（案A: レコード属性） |
| description | text? | 補足説明 |

### ApiToken

Chrome 拡張など、Web セッションを介さないクライアントから API を叩くための個人アクセストークン（PAT）。

| フィールド | 型 | 説明 |
|-----------|----|------|
| id | string | PK |
| userId | string | FK → User |
| tokenHash | string | トークンのハッシュ（平文は発行時のみ 1 度だけ表示） |
| name | string | 用途名（例: `Chrome 拡張`） |
| createdAt | datetime | 発行日時 |
| lastUsedAt | datetime? | 最終利用日時 |

> ハッシュ方式: 平文トークンは 32byte 乱数（`crypto.getRandomValues`）を base64url 化し `cdx_` プレフィックスを付与する。DB には SHA-256（`crypto.subtle.digest`、ソルト無し）ハッシュ（hex）のみを保存し、平文は発行 API のレスポンスで 1 度だけ返す（再取得不可）。検証は受領トークンを同方式でハッシュ化して `token_hash` と突合する。

### Auth.js 標準テーブル

Auth.js（@auth/d1-adapter, database セッション戦略）が利用する標準テーブル。スキーマは adapter の DDL に準拠する。

| テーブル | 役割 |
|----------|------|
| `users` | ログインユーザー。`cheat_code.user_id` / `api_token.user_id` の参照先 |
| `accounts` | OAuth プロバイダ（Google）との紐付け |
| `sessions` | database セッション（サーバ側で永続化・無効化できる） |
| `verification_tokens` | メール検証等のトークン（MVP では未使用だが adapter が要求） |

## zip 出力フォーマット

プラットフォームごとにエミュレータのチートファイル形式が異なるため、`Platform.format` に応じた変換を行う。

| プラットフォーム | エミュレータ | フォーマット |
|--------------------|----------------|--------------|
| **PS2 (MVP)** | PCSX2 / NetherSX2 | `.pnach`（シリアル単位、ゲームごとに 1 ファイル） |
| SNES（将来候補） | snes9x 等 | `.cht` |
| PS（将来候補） | 各種 | 要調査 |

> MVP は PS2 のみ。フォーマット仕様は外部依存（エミュレータの仕様）なので、実ファイルで 1 度疎通確認する（[philosophy.md](./philosophy.md)）。

## 要確認の論点

- zip 出力は「ON のチートのみ」か「全件＋有効フラグ」か（フォーマットが無効行コメントをサポートするかに依存）
