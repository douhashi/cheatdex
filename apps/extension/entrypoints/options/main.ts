import { loadSettings, saveSettings } from "../../src/lib/settings";

const baseUrlEl = document.getElementById("base-url") as HTMLInputElement;
const patEl = document.getElementById("pat") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const formEl = document.getElementById("settings-form") as HTMLFormElement;

function showStatus(kind: "success" | "error", message: string): void {
	statusEl.textContent = message;
	statusEl.className = `status ${kind}`;
	statusEl.hidden = false;
}

async function init(): Promise<void> {
	const settings = await loadSettings();
	baseUrlEl.value = settings.baseUrl;
	patEl.value = settings.pat;
}

formEl.addEventListener("submit", async (event) => {
	event.preventDefault();
	try {
		await saveSettings({ baseUrl: baseUrlEl.value, pat: patEl.value });
		showStatus("success", "保存しました。");
	} catch (err) {
		showStatus(
			"error",
			`保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
});

void init();
