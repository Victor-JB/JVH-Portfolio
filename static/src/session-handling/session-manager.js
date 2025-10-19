// session-manager.js  — SessionManager (single source of truth) w/ INDEXDB (not localstorage)

import { logger } from "../log-handling/logger.js";
import { uploadLogs, uploadSession } from "./session-sync-exports.js";
import * as PhotoStore from "./idb-photos.js";

const PREFIX = "qc:session:";
const INDEX = "qc:session:index";

const now = () => Date.now();
const key = (orderNo) => `${PREFIX}${orderNo}`;

function debounce(fn, ms = 300) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
}

function loadIndex() {
	try {
		return JSON.parse(localStorage.getItem(INDEX) || "{}");
	} catch {
		return {};
	}
}
function saveIndex(ix) {
	localStorage.setItem(INDEX, JSON.stringify(ix));
}

function enforceSingleDraft(keepOrderNo) {
	if (!keepOrderNo) return;

	const ix = loadIndex();
	const victims = [];

	for (const k of Object.keys(ix)) {
		if (k !== keepOrderNo) {
			try {
				localStorage.removeItem(key(k));
			} catch {}
			delete ix[k];
			victims.push(k); // <-- collect raw orderNos
		}
	}
	saveIndex(ix);
	if (victims.length) {
		Promise.resolve()
			.then(() =>
				Promise.allSettled(victims.map((o) => PhotoStore.deleteByOrder(o)))
			)
			.catch((e) => logger.warn("[enforce-single] IDB purge failed:", e));
	}
}

function emit(type, detail) {
	document.dispatchEvent(new CustomEvent(`session:${type}`, { detail }));
}

function itemsFromSO(so) {
	return (so?.items || []).map((it) => ({
		meta: {
			code: it.code,
			family: it.family,
			description: it.description,
			qty: it.qty,
			eta: it.eta,
		},
		photos: [],
		checks: {},
		comments: {},
	}));
}

function pad2(number) {
	// Prepends a zero to a number if it's a single digit.
	return (number < 10 ? "0" : "") + number;
}

function getPeriodSeparatedTimestamp() {
	const date = new Date();

	const year = date.getFullYear();
	const month = pad2(date.getMonth() + 1); // Month is 0-indexed
	const day = pad2(date.getDate());

	return `${year}.${month}.${day}`;
}

// ---- the store ---------------------------------------------------------
export const SessionManager = {
	currentOrderNo: null,
	currentItemIndex: null,
	state: null, // { orderNo, so, items[], logs[], createdAt, updatedAt, version }
	logBuffer: [],

	init(orderNo, so) {
		enforceSingleDraft(orderNo);
		this.currentOrderNo = orderNo;
		this.currentItemIndex = 0;
		this.state = {
			version: 1,
			orderNo,
			so,
			items: itemsFromSO(so),
			logs: this.logBuffer.length ? this.logBuffer : [],
			createdAt: now(),
			updatedAt: now(),
		};
		persist();
		emit("init", { orderNo });
		return this.state;
	},

	loadFromStorage(orderNo) {
		try {
			const raw = localStorage.getItem(key(orderNo));
			if (!raw) return null;
			const snap = JSON.parse(raw);
			// backward-compat: older drafts may have "soObj"
			if (!snap.so && snap.soObj) snap.so = snap.soObj;
			this.state = snap;
			this.state.logs = this.state.logs.concat(this.logBuffer);
			this.currentOrderNo = snap.orderNo;
			this.currentItemIndex = 0;
			enforceSingleDraft(snap.orderNo);
			emit("load", { orderNo });
			return snap;
		} catch {
			return null;
		}
	},
	getDraft() {
		return Object.entries(loadIndex())
			.map(([orderNo, updatedAt]) => ({ orderNo, updatedAt }))
			.sort((a, b) => b.updatedAt - a.updatedAt);
	},

	removeFromStorage(orderNo) {
		try {
			localStorage.removeItem(key(orderNo));
		} catch {}
		const ix = loadIndex();
		if (orderNo in ix) {
			delete ix[orderNo];
			saveIndex(ix);
		}
		emit("session-removed", { orderNo });
		// Also clean IDB blobs
		PhotoStore.deleteByOrder(orderNo).catch(() => {});
		return true;
	},

	async uploadSession() {
		const counts = this.counts();
		logger.logUploadStarted(counts.photos, counts.checks, counts.items);

		const session = this.serialize();

		const res = await uploadSession(session);
		logger.log("[UPLOAD_SESSION] Session uploaded successfully");

		const rawLogs = this.drainLogs();
		const ok = await uploadLogs(session, rawLogs);

		if (ok) logger.log("[UPLOAD_SESSION] Logs uploaded successfully");
		return res;
	},

	endSession() {
		this.removeFromStorage(this.currentOrderNo);

		this.state = null;
		this.currentOrderNo = null;
		this.currentItemIndex = null;

		logger.logUploadCompleted();
	},

	setCurrentItem(idx) {
		if (!this.state) throw new Error("No active session");
		if (idx < 0 || idx >= this.state.items.length)
			throw new Error("Bad item index");
		this.currentItemIndex = idx;
		emit("item-selected", { orderNo: this.currentOrderNo, itemIndex: idx });
	},

	// ---- photos ----------------------------------------------------------
	async savePhoto(blob, previewDataUrl) {
		if (!this.state) throw new Error("No active session");
		const idx = this.currentItemIndex;
		const item = this.state.items[idx];
		if (!item) throw new Error("No item selected");

		const ts = now();
		const id = `${item.meta.code}_${getPeriodSeparatedTimestamp()}_${Math.random().toString(36).slice(2, 6)}`;
		const mime = blob?.type || "image/jpeg";

		// Store full-res in IndexedDB
		await PhotoStore.saveBlob({
			id,
			orderNo: this.currentOrderNo,
			itemIndex: idx,
			blob,
			mime,
			timestamp: ts,
		});

		const photo = {
			id,
			base64: previewDataUrl,
			timestamp: ts,
			itemIndex: idx,
			mime,
		};
		item.photos.push(photo);

		updateInternalTime();
		persistAsync();
		emit("photo-added", {
			itemIndex: idx,
			totalPhotos: item.photos.length,
		});
	},

	async removePhoto(photoId) {
		if (!this.state) return false;
		const item = this.state.items[this.currentItemIndex];
		if (!item) return false;
		const i = item.photos.findIndex((p) => p.id === photoId);
		if (i > -1) {
			item.photos.splice(i, 1);
			try {
				await PhotoStore.deleteBlob(photoId);
			} catch {}
			updateInternalTime();
			persistAsync();
			emit("photo-removed", {
				itemIndex: this.currentItemIndex,
				remaining: item.photos.length,
			});
			return true;
		}
		return false;
	},

	getPhotos(itemIndex = this.currentItemIndex) {
		if (!this.state) return [];
		const item = this.state.items[itemIndex];
		return item ? item.photos : [];
	},

	async getIDBStats() {
		try {
			return await PhotoStore.getStats();
		} catch {
			return {};
		}
	},

	// ---- checks / QC -----------------------------------------------------
	updateCheckState(itemIndex, checkId, state) {
		// state ∈ {"pass","fail",""} ; "" = clear (remove key)
		if (!this.state || itemIndex == null || !checkId) return;
		const item = this.state.items[itemIndex];
		if (!item) return;

		item.checks = item.checks || {};
		if (state === "pass" || state === "fail") {
			item.checks[checkId] = state;
		} else {
			// clear / ignore unset
			delete item.checks[checkId];
		}
		updateInternalTime();
		persistAsync();
		// keep event name; payload is tri-state now
		emit("checks-updated", {
			orderNo: this.currentOrderNo,
			itemIndex,
			patch: { [checkId]: state },
		});
	},

	// Batch helpers (tri-state map). Keep names but now tri-state.
	updateChecklist(itemIndex, patch) {
		// patch: { [checkId]: "pass" | "fail" | "" }
		if (!this.state || itemIndex == null || !patch) return;
		const item = this.state.items[itemIndex];
		if (!item) return;

		item.checks = item.checks || {};
		for (const [k, v] of Object.entries(patch)) {
			if (v === "pass" || v === "fail") item.checks[k] = v;
			else delete item.checks[k]; // clear
		}
		updateInternalTime();
		persistAsync();
		emit("checks-updated", { orderNo: this.currentOrderNo, itemIndex, patch });
	},

	updateComment(itemIndex, sectionId, text) {
		if (!this.state) return;
		const item = this.state.items[itemIndex];
		if (!item || !sectionId) return;
		item.comments = item.comments || {};
		const v = (text || "").trim();
		if (v) item.comments[sectionId] = v;
		else delete item.comments[sectionId];
		updateInternalTime();
		persistAsync();
		emit("comments-updated", {
			orderNo: this.currentOrderNo,
			itemIndex,
			sectionId,
		});
	},

	getCheckState(itemIndex, checkId) {
		// returns "pass" | "fail" | ""
		if (!this.state || itemIndex == null || !checkId) return "";
		const item = this.state.items[itemIndex];
		const v = item?.checks?.[checkId];
		return v === "pass" || v === "fail" ? v : "";
	},

	getChecklist(itemIndex) {
		// tri-state map (only keys with a state are present)
		if (!this.state || itemIndex == null) return {};
		const item = this.state.items[itemIndex];
		return item?.checks || {};
	},

	getComments(itemIndex) {
		if (!this.state) return {};
		const item = this.state.items[itemIndex];
		return item ? item.comments || {} : {};
	},

	// ---- logs ------------------------------------------------------------
	appendLog(entry) {
		if (!this.state) {
			this.logBuffer.push({ ...entry, ts: now() });
			return;
		}
		this.state.logs.push({ ...entry, ts: now() });
		updateInternalTime();
		persistAsync();
		emit("logs-changed", {});
	},
	getLogs() {
		if (!this.state) return [];
		return this.state.logs.slice();
	},
	drainLogs() {
		if (!this.state) return [];
		const out = this.state.logs.slice();
		this.state.logs.length = 0;
		updateInternalTime();
		persistAsync();
		return out;
	},

	// ---- serialization ---------------------------------------------------
	serialize() {
		return JSON.parse(JSON.stringify(this.state || null));
	},

	counts() {
		if (!this.state) return { photos: 0, checks: 0, items: 0 };
		let photos = 0;
		let checks = 0;
		for (const it of this.state.items) {
			photos += it.photos?.length || 0;
			checks += Object.values(it.checks || {}).filter(Boolean).length;
		}
		return { photos, checks, items: this.state.items.length };
	},
	hasAnyData() {
		const { photos, checks } = this.counts();
		const hasComments =
			this.state?.items?.some(
				(it) => it.comments && Object.values(it.comments).some(Boolean)
			) || false;
		return photos > 0 || checks > 0 || hasComments;
	},
};

// ---- internal helpers --------------------------------------------------
function updateInternalTime() {
	if (SessionManager.state) SessionManager.state.updatedAt = now();
}

function persist() {
	if (!SessionManager.state) return;
	try {
		localStorage.setItem(
			key(SessionManager.state.orderNo),
			JSON.stringify(SessionManager.state)
		);
		const ix = loadIndex();
		ix[SessionManager.state.orderNo] = SessionManager.state.updatedAt;
		saveIndex(ix);
	} catch (e) {
		if (e instanceof QuotaExceededError) {
			alert(`Tablet storage memory is full and cannot append more data`);
			logger.warn("[SESSON PERSIST()] Session storage quota exceeded");
		} else {
			logger.warn("[SESSON PERSIST()] Failed to persist changes: ", e);
		}
	}
}
const persistAsync = debounce(() => persist(), 300);
