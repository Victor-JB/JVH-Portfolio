import { OFFLINE_INDEXDB_KEY, WEBAPP_VERSION } from "../config.js";

// ----------------------- for offline log management ----------------------- //
export function loadQueue() {
	try {
		return JSON.parse(localStorage.getItem(OFFLINE_INDEXDB_KEY) || "[]");
	} catch {
		return [];
	}
}
export function saveQueue(q) {
	try {
		localStorage.setItem(OFFLINE_INDEXDB_KEY, JSON.stringify(q));
	} catch {}
}

// -------------- logging payload (matches backend SessionLogs) ------------- //
function parseDevice() {
	return { type: "web", model: navigator.userAgent || "unknown" };
}

// Format logs as human-readable lines:
// "YYYY-MM-DD HH:mm:ss [desktop] <message> {optional compact JSON data}"
function normalizeLogs(raw) {
	const a = Array.isArray(raw) ? raw : [];

	function platformTag() {
		try {
			const ua = navigator.userAgent || "";
			return /Mobi|Android/i.test(ua) ? "mobile" : "desktop";
		} catch {
			return "desktop";
		}
	}

	function fmtTime(iso) {
		try {
			const d = iso ? new Date(iso) : new Date();
			const pad = (n) => String(n).padStart(2, "0");
			const yyyy = d.getFullYear();
			const mm = pad(d.getMonth() + 1);
			const dd = pad(d.getDate());
			const HH = pad(d.getHours());
			const MM = pad(d.getMinutes());
			const SS = pad(d.getSeconds());
			return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
		} catch {
			return new Date().toISOString().replace("T", " ").slice(0, 19);
		}
	}

	return a.map((l) => {
		if (typeof l === "string") return l;
		if (!l || typeof l !== "object") {
			return `${fmtTime()} [${platformTag()}] ${String(l)}`;
		}
		const ts = fmtTime(l.time || l.ts);
		const msg =
			(l.message && String(l.message)) || (l.event && String(l.event)) || "";
		let extra = "";
		if (l.data && typeof l.data === "object") {
			try {
				extra = " " + JSON.stringify(l.data);
			} catch {}
		}
		return `${ts} [${platformTag()}] ${msg}${extra}`.trim();
	});
}

// -------------------------- log payload for api  -------------------------- //
export function buildLogPayload(sessionSnapshot, rawLogs) {
	const orderNo = sessionSnapshot?.orderNo ?? "unknown";
	const createdAt = sessionSnapshot?.createdAt ?? Date.now();
	const sessionId = `${orderNo}-${createdAt}`;

	return {
		sessionId,
		orderId: orderNo,
		device: parseDevice(),
		appVersion: WEBAPP_VERSION || "dev",
		logs: normalizeLogs(rawLogs),
		timestamp: new Date().toISOString(),
		startTime: createdAt,
	};
}

// --------------------- build sharepoint folder query res ------------------ //
/**
 * Builds a formatted response string for a JavaScript client, including a
 * bulleted, indented list of photos and their web URLs.
 *
 * @param {object} res The API response object.
 * @returns {string[]} An array of strings representing the formatted message.
 */
export function buildFolderResponse(res) {
	const files = Array.isArray(res.files) ? res.files : [];
	const photoFiles = files.filter(
		(f) =>
			(f.content_type || "").startsWith("image/") ||
			/\.(jpe?g|png|gif|heic|webp|tiff?)$/i.test(f.name || "")
	);

	const msgLines = [`Count: ${res.photo_count ?? photoFiles.length}`];

	if (photoFiles.length) {
		msgLines.push("\n\nPhotos:");
		photoFiles
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((f) => {
				// Use the webUrl from the API response
				msgLines.push(`\n\n  - Name: ${f.name}`);
				msgLines.push(`\n    - URL: ${f.webUrl}`);
			});
	}

	return {
		header: `Photos already exist for ${res.order_no}.${res.customer}`,
		body: msgLines.join("").replace(/\n/g, "<br>"),
		footer: "Append more photos?",
	};
}
