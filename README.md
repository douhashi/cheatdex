# Cheatdex

ゲームエミュレータのチートコードを、プラットフォーム・ゲーム単位で整理・管理し、エミュレータが読み込める形式でまとめて書き出せる Web アプリケーション。

## 主な機能

- プラットフォーム（PS2 / PS / SNES など）ごと、ゲームごとのチートコード管理
- チートコードの ON/OFF 切替
- 全体／プラットフォーム単位での zip ダウンロード
- Google アカウントによるログイン

## 技術スタック

Next.js (App Router) / OpenNext for Cloudflare / Cloudflare Workers / D1 / Drizzle / Auth.js。
詳細は [docs/development/tech-stack.md](./docs/development/tech-stack.md) を参照。

## ドキュメント

ドキュメントは `docs/` 配下に Document System として整理している（運用方針: [docs/document_system.md](./docs/document_system.md)）。
全体目次は [docs/INDEX.md](./docs/INDEX.md)、各カテゴリの目次は以下を参照。

- [docs/business/INDEX.md](./docs/business/INDEX.md): プロダクト概要・利用者像などのビジネス文書
- [docs/development/INDEX.md](./docs/development/INDEX.md): 技術スタック・アーキテクチャ・データモデル・インフラなどの開発文書
- [docs/operations/INDEX.md](./docs/operations/INDEX.md): デプロイ・監視など運用文書（今後整備）
