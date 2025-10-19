// logger.js — lean event logger that writes into SessionManager

// Responsibilities:
//   - Append small, structured entries to SessionManager logs
//   - Provide a few domain-specific helpers (barcode, photo, checklist, upload)
// Non-responsibilities (moved out):
//   - Uploading / HTTP / retries       → session-sync.js
//   - Offline queue & online handler   → session-sync.js + listeners.js
//   - Session lifecycle / persistence  → session-manager.js

import { SessionManager } from "../session-handling/session-manager.js";

const nowISO = () => new Date().toISOString();

/** Internal: write a single entry to session logs + mirror to console */
function write(level, event, message, data) {
	const entry = { level, time: nowISO(), event, message };
	if (data && typeof data === "object") entry.data = data;

	try {
		SessionManager.appendLog(entry);
	} catch (_) {
		console.warn(`Log: ${message} could not be appended to session logs`);
	}

	// dev mirror (safe, non-blocking)
	const line = `[${entry.time}] ${event}: ${message}`;
	if (level === "error") console.error(line, data || "");
	else if (level === "warn") console.warn(line, data || "");
	else console.log(line, data || "");
}

export const logger = {
	// Generic
	log(msg, data) {
		write("info", "app/log", msg, data);
	},
	warn(msg, data) {
		write("warn", "app/warn", msg, data);
	},
	error(msg, data) {
		write("error", "app/error", msg, data);
	},

	// Domain shorthands — call these from driver/listeners to avoid noisy call-sites
	logBarcodeScanned(orderNo, itemCount, customer) {
		write(
			"info",
			"barcode/scanned",
			`[WAITING_SCAN] SO ${orderNo} • items: ${itemCount}`,
			{
				customer,
			}
		);
	},

	logPhotoTaken(itemIndex, totalPhotos) {
		write("info", "photo/taken", `Item ${itemIndex} • total ${totalPhotos}`, {
			itemIndex,
			totalPhotos,
		});
	},

	logPhotoDeleted(itemIndex, remaining) {
		write(
			"info",
			"photo/deleted",
			`item ${itemIndex} • remaining ${remaining}`,
			{ itemIndex, remaining }
		);
	},

	logChecklistUpdated(itemIndex, key, value) {
		write("info", "qc/updated", `item ${itemIndex} • ${key}=${String(value)}`, {
			itemIndex,
			key,
			value,
		});
	},

	logUploadStarted(photoCount, checkCount, itemCount) {
		write(
			"info",
			"upload/started",
			`[UPLOAD_SESSION] photos: ${photoCount} • checks: ${checkCount} • items: ${itemCount}`,
			{
				photoCount,
				checkCount,
				itemCount,
			}
		);
	},

	logUploadCompleted() {
		write("info", "upload/completed", "ok");
	},
};

// Optional helper: wrap async ops to auto-log errors (useful in driver)
export async function withLog(label, fn) {
	try {
		return await fn();
	} catch (e) {
		logger.error(`${label} failed`, { message: e?.message });
		throw e;
	}
}
