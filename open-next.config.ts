import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// ISR/SSG の incremental cache を R2 に保存する。
// tag cache / queue は要件確定後に overrides を追加する（docs/development/infrastructure.md 参照）。
export default defineCloudflareConfig({
	incrementalCache: r2IncrementalCache,
});
