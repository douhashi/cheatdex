# データモデル

提案する論理データモデル。[../business/model.md](../business/model.md) の **案A（ユーザーがチートを所有）** を前提とする。確定前の提案であり、要件確定後に見直す。

永続化は Cloudflare D1（SQLite）。アプリのチートデータは Drizzle ORM、認証関連テーブルは Auth.js の `@auth/d1-adapter` が管理する（[tech-stack.md](./tech-stack.md)）。

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

> プラットフォームをユーザー所有にするか、全ユーザー共通のマスタにするかは要確認。マスタ化が素直（PS2 の定義をユーザーごとに重複させない）。

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

## zip 出力フォーマット（要定義）

プラットフォームごとにエミュレータのチートファイル形式が異なるため、`Platform.format` に応じた変換を行う。

| プラットフォーム例 | エミュレータ例 | フォーマット |
|--------------------|----------------|--------------|
| PS2 | PCSX2 | `.pnach`（シリアル単位、ゲームごとに 1 ファイル） |
| SNES | snes9x 等 | `.cht` |
| PS | 各種 | 要調査 |

> 上記は提案。対応プラットフォームと正確なフォーマット仕様は MVP のターゲットを決めて確定する。フォーマット仕様は外部依存（エミュレータの仕様）なので、実ファイルで 1 度疎通確認する（[philosophy.md](./philosophy.md)）。

## 要確認の論点

1. プラットフォームを共有マスタにするか、ユーザー所有にするか
2. zip 出力は「ON のチートのみ」か「全件＋有効フラグ」か（フォーマットが無効行コメントをサポートするかに依存）
3. 対応プラットフォームの初期スコープ
