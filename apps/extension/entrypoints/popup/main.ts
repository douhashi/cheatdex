import { submitBulk } from "../../src/lib/api-client";
import { type DetectedCheat, detectCheats } from "../../src/lib/detect";
import { getActiveTabText } from "../../src/lib/page-text";
import { loadSettings } from "../../src/lib/settings";

interface Row {
	cheat: DetectedCheat;
	selected: boolean;
	name: string;
}

let rows: Row[] = [];

const byId = <T extends HTMLElement>(id: string): T => {
	const el = document.getElementById(id);
	if (!el) throw new Error(`element not found: ${id}`);
	return el as T;
};

const statusEl = byId("status");
const listEl = byId<HTMLUListElement>("cheat-list");
const summaryEl = byId("summary");
const gameIdEl = byId<HTMLInputElement>("game-id");
const submitEl = byId<HTMLButtonElement>("submit");

function showStatus(kind: "error" | "success" | "info", message: string): void {
	statusEl.textContent = message;
	statusEl.className = `status ${kind}`;
	statusEl.hidden = false;
}

function clearStatus(): void {
	statusEl.hidden = true;
	statusEl.textContent = "";
}

function render(): void {
	listEl.replaceChildren();
	const selectedCount = rows.filter((r) => r.selected).length;
	summaryEl.textContent = `検出 ${rows.length} 件 / 選択 ${selectedCount} 件`;
	submitEl.disabled = selectedCount === 0;

	rows.forEach((row, index) => {
		const li = document.createElement("li");

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = row.selected;
		checkbox.addEventListener("change", () => {
			rows[index].selected = checkbox.checked;
			render();
		});

		const body = document.createElement("div");

		const nameInput = document.createElement("input");
		nameInput.type = "text";
		nameInput.className = "cheat-name";
		nameInput.value = row.name;
		nameInput.placeholder = "チート名（候補が無ければ入力）";
		nameInput.addEventListener("input", () => {
			rows[index].name = nameInput.value;
		});

		const meta = document.createElement("div");
		meta.className = "cheat-meta";
		meta.textContent = `形式: ${row.cheat.format}`;

		const code = document.createElement("pre");
		code.className = "cheat-code";
		code.textContent = row.cheat.code;

		body.append(nameInput, meta, code);
		li.append(checkbox, body);
		listEl.append(li);
	});
}

async function scan(): Promise<void> {
	clearStatus();
	try {
		const cheats = detectCheats(await getActiveTabText());
		rows = cheats.map((cheat) => ({
			cheat,
			selected: cheat.name !== "",
			name: cheat.name,
		}));
		if (rows.length === 0) {
			showStatus(
				"info",
				"このページで対応形式のコードは見つかりませんでした。",
			);
		}
		render();
	} catch (err) {
		showStatus(
			"error",
			`ページの読み取りに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

async function submit(): Promise<void> {
	clearStatus();
	const gameId = Number(gameIdEl.value);
	if (!Number.isInteger(gameId) || gameId <= 0) {
		showStatus("error", "有効な Game ID を入力してください。");
		return;
	}

	const selected = rows.filter((r) => r.selected);
	if (selected.some((r) => r.name.trim() === "")) {
		showStatus("error", "選択したコードにチート名が未入力のものがあります。");
		return;
	}

	submitEl.disabled = true;
	showStatus("info", `${selected.length} 件を登録中...`);

	const settings = await loadSettings();
	const result = await submitBulk({
		baseUrl: settings.baseUrl,
		pat: settings.pat,
		gameId,
		cheats: selected.map((r) => ({ name: r.name.trim(), code: r.cheat.code })),
	});

	if (result.ok) {
		showStatus("success", `${result.count} 件を登録しました。`);
	} else {
		showStatus("error", result.message);
		if (result.unauthorized) {
			byId("open-options").focus();
		}
	}
	render();
}

byId("scan").addEventListener("click", scan);
byId("submit").addEventListener("click", submit);
byId("open-options").addEventListener("click", () =>
	chrome.runtime.openOptionsPage(),
);
byId("select-all").addEventListener("click", () => {
	rows = rows.map((r) => ({ ...r, selected: true }));
	render();
});
byId("select-none").addEventListener("click", () => {
	rows = rows.map((r) => ({ ...r, selected: false }));
	render();
});

void scan();
