import { SessionManager } from "../session-handling/session-manager.js";
import { listCameras } from "../peripherals-handling/camera/camera-utils.js";
import { getCameraInfo } from "../peripherals-handling/camera/camera.js";
import { fpsMonitor } from "../debug/performance-monitor.js";
import { memoryMonitor } from "../debug/memory-monitor.js";

// debug-hud.js - Class for debug hud controls
const debugSelect = document.getElementById("debug");
const hudOption = document.createElement("option");
const hudElm = document.getElementById("debug-hud");
const debugFps = document.getElementById("debug-fps");
const debugMemDropdown = document.getElementById("debug-mem");
const debugMemPrev = document.getElementById("debug-mem-pre");
const debugLocalStor = document.getElementById("debug-localstor");
const tableBody = document.getElementById("table-body");
const debugOrder = document.getElementById("debug-order");
const debugPhotos = document.getElementById("debug-photos");
const debugItem = document.getElementById("debug-item");
const debugCam = document.getElementById("debug-camera");
const debugRender = document.getElementById("debug-render");
const debugMaxCam = document.getElementById("debug-max-cam");
const listCams = document.getElementById("list-cams");
const debugReady = document.getElementById("debug-ready");
const details = document.getElementById("debug-logs");
const preEl = document.getElementById("debug-logs-pre");
const debugIDBMem = document.getElementById("idb-mem");
const totalMem = document.getElementById("total-mem");
const debugIDBPhotoNum = document.getElementById("idb-photonum");

export class DebugHUD {
	constructor() {
		this.isActive = false;
		this.stats = { fps: 0, frameCount: 0, lastTime: performance.now() };
		this.sessionEvents = [
			"session:init",
			"session:load",
			"session:item-selected",
			"session:photo-added",
			"session:photo-removed",
			"session:checks-updated",
			"session:quota-exceeded",
			"session:session-removed",
		];
		this._escapeHtml = (s = "") =>
			String(s)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
		const pad2 = (n) => String(n).padStart(2, "0");
		this.fmtTime = (ts) => {
			if (!ts) return "—";
			const d = new Date(ts);
			return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
		};
		this.fmtNow = () => {
			const d = new Date();
			return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
		};
		this.updateStorageUI = this.updateStorageUI.bind(this);
		this.renderLogs = this.renderLogs.bind(this);
	}

	mount() {
		// 1) update immediately
		this.updateStorageUI();
		this.updateCameraInfo();

		this.sessionEvents.forEach((type) => {
			document.addEventListener(type, this.updateStorageUI, { passive: true });
			document.addEventListener(type, this.updateIDBStats, { passive: true });
		});

		document.addEventListener("session:logs-changed", this.renderLogs, {
			passive: true,
		});

		// 3) changes from OTHER tabs/windows
		window.addEventListener("storage", this.updateStorageUI, { passive: true });

		if (debugSelect) {
			// Add new debug option to your existing select

			hudOption.value = "Show Debug HUD";
			hudOption.textContent = "Show Debug HUD";
			debugSelect.appendChild(hudOption);

			debugSelect.addEventListener("change", (e) => {
				if (e.target.value === "Show Debug HUD") {
					this.toggleHUD();
				} else if (e.target.value === "") {
					this.hideHUD();
				}
			});
		}
	}

	unmount() {
		this.sessionEvents.forEach((type) => {
			document.removeEventListener(type, this.updateStorageUI);
		});
		window.removeEventListener("storage", this.updateStorageUI);
	}

	toggleHUD() {
		this.isActive = !this.isActive;
		hudElm.style.display = this.isActive ? "block" : "none";

		if (this.isActive) {
			fpsMonitor.start();
			memoryMonitor.start(1000); // Check every 2 seconds
			this.updateInfo();
		} else {
			fpsMonitor.stop();
			memoryMonitor.stop();
		}
	}

	hideHUD() {
		this.isActive = false;
		hudElm.style.display = "none";
	}

	_formatValueCell(raw) {
		let preview = String(raw);
		let full = String(raw);

		try {
			const obj = JSON.parse(raw);
			preview = JSON.stringify(obj); // one-line preview
			full = JSON.stringify(obj, null, 2); // pretty for <pre>
		} catch {
			/* not JSON; keep raw strings */
		}

		if (preview.length > 140) preview = preview.slice(0, 140) + "…";

		return `
			<details class="ls-details">
			<summary class="ls-summary">
				<span class="dropdown-caret" aria-hidden="true"></span>
				<span class="ls-preview">${this._escapeHtml(preview)}</span>
			</summary>
			<pre class="ls-pre">${this._escapeHtml(full)}</pre>
			</details>
		`;
	}

	updateStorageUI() {
		if (!tableBody) return;

		// Collect & sort keys to keep the table stable
		const keys = [];
		for (let i = 0; i < localStorage.length; i++) {
			keys.push(localStorage.key(i));
		}
		keys.sort();

		const rows = keys.map((k) => {
			const v = localStorage.getItem(k);
			return `
			<tr>
				<td>${this._escapeHtml(k)}</td>
				<td>${this._formatValueCell(v)}</td>
			</tr>
			`;
		});

		tableBody.innerHTML = rows.join("");

		// Optional: show total localStorage size approximation
		if (debugLocalStor) {
			const totalBytes = keys.reduce(
				(sum, k) => sum + k.length + (localStorage.getItem(k)?.length || 0),
				0
			);
			const storUsed = (totalBytes / (1024 * 1024)).toFixed(2);
			debugLocalStor.textContent = `${storUsed} MB / 5 MB`;
		}
	}

	async updateIDBStats() {
		if (!debugIDBMem || !debugIDBPhotoNum) return;

		try {
			const stats = await SessionManager.getIDBStats();
			const idbMb = (stats.bytes / (1024 * 1024)).toFixed(2);
			const totalUseMb = (stats.usage / (1024 * 1024)).toFixed(2);
			const quotaMb = (stats.quota / (1024 * 1024)).toFixed(2);
			debugIDBMem.textContent = `${idbMb} MB`;
			totalMem.textContent = `${totalUseMb} / ${quotaMb} MB`;
			debugIDBPhotoNum.textContent = String(stats.count);
		} catch (e) {
			debugIDBMem.textContent = "--";
			debugIDBPhotoNum.textContent = "--";
		}
	}

	updatePerformanceInfo() {
		if (this.isActive) {
			debugFps.textContent = fpsMonitor.getAverageFPS().toFixed(1);
			const memStats = memoryMonitor.getStats();

			if (memStats) {
				const previewEl = debugMemDropdown.querySelector(".ls-preview");
				previewEl.textContent = `${memStats.current} MB`;

				const expanded = memStats.details
					? Object.entries(memStats.details) // Get an array of [key, value] pairs
							.map(([key, value]) => `${key}: ${value}`) // Convert each pair to a "key: value" string
							.join("\n") // Join all strings with a newline character
					: "—";

				debugMemPrev.textContent = expanded;
			}
		}
	}

	updateInfo() {
		if (!this.isActive) return;
		this.updatePerformanceInfo();
		this.updateSessionInfo();
		setTimeout(() => this.updateInfo(), 300);
	}

	updateSessionInfo() {
		// Get info from your global variables
		debugOrder.textContent = SessionManager.currentOrderNo || "--";
		debugItem.textContent = SessionManager.currentItemIndex + 1 ?? "--";
		debugPhotos.textContent = SessionManager.getPhotos().length;
	}

	async updateCameraInfo() {
		const { currCam, maxCam } = getCameraInfo();
		try {
			debugRender.textContent = `(on init) ${currCam.width}x${currCam.height}`;
			// wxh flipped to hxw bc tab takes init dimensions in horizontal
			debugMaxCam.textContent = `(on init) ${maxCam.height}x${maxCam.width}`;
			debugCam.textContent = `(on init) ${maxCam.height}x${maxCam.width}`;
			listCams.textContent = await listCameras();
			debugReady.textContent = "Yes";
		} catch {
			debugRender.textContent = "--";
			debugMaxCam.textContent = "--";
			debugCam.textContent = "--";
			listCams.textContent = "--";
			debugReady.textContent = "No";
		}
	}

	renderLogs() {
		if (!details) return;
		const previewEl = details.querySelector(".ls-preview");

		let logs = [];
		try {
			logs = (SessionManager.getLogs && SessionManager.getLogs()) || [];
		} catch {
			logs = [];
		}

		const count = logs.length;
		const lastTs = count ? logs[count - 1]?.ts || null : null;

		// Preview like: "Logs (12) · last 14:03:21" or "No logs"
		previewEl.textContent = count
			? `(${count}) · last ${this.fmtTime(lastTs)}`
			: "No logs";

		// Expanded: JSON-lines (objects pretty-printed, separated by blank line)
		const expanded = count
			? logs.map((entry) => JSON.stringify(entry, null, 2)).join("\n\n")
			: "—";

		preEl.textContent = expanded;
	}
}
