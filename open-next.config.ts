import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// incremental cache（R2）は scaffold 段階では無効化している。
// OpenNext 1.19.x の populate-cache が CLOUDFLARE_API_TOKEN 環境で OAuth ログインを
// 要求して失敗するため。ISR/SSG を使う実装段階で r2IncrementalCache を再有効化する。
// tag cache / queue も要件確定後に overrides を追加する（docs/development/infrastructure.md 参照）。
export default defineCloudflareConfig({});
