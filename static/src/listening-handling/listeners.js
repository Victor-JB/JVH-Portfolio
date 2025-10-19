// listeners.js — all UI + lifecycle listeners live here

import { logger } from "../log-handling/logger.js";
import { stopStream } from "../peripherals-handling/camera/camera.js";
import { buildLogPayload } from "../session-handling/session-sync-utils.js";
import {
	flushOfflineQueue,
	hydrateOfflineQueue,
} from "../session-handling/session-sync-exports.js";
import { SessionManager } from "../session-handling/session-manager.js";

const wired = new WeakMap();

function wireOnce(el, type, handler, opts) {
	if (!el) return;
	const key = `${type}`;
	if (wired.get(el)?.has(key)) return;
	el.addEventListener(type, handler, opts);
	const set = wired.get(el) || new Set();
	set.add(key);
	wired.set(el, set);
}

/* --------------- exports: wiring global and logging listeners ------------- */
/** Global listeners that live for the whole app lifetime */
export function wireGlobalListeners({ hud, debugHud }) {
	// Network status badge / hints
	wireOnce(window, "online", () => flushOfflineQueue());
	wireOnce(window, "offline", () => {
		const logPayload = buildLogPayload(
			SessionManager.serialize(),
			SessionManager.getLogs()
		);
		hydrateOfflineQueue(logPayload);
	});
	wireOnce(window, "beforeunload", () => {
		stopStream();
		hud.unmount();
		debugHud.unmount();
	});
}

export function wireLoggingListeners() {
	/*
	Decidedly bloats the logs...
	document.addEventListener("session:photo-added", (e) => {
		const { itemIndex, totalPhotos } = e.detail || {};
		logger.logPhotoTaken(itemIndex, totalPhotos);
	});
	document.addEventListener("session:photo-removed", (e) => {
		const { itemIndex, remaining } = e.detail || {};
		logger.logPhotoDeleted(itemIndex, remaining);
	});
	*/
	/*
	document.addEventListener("session:checks-updated", (e) => {
		const { itemIndex, patch } = e.detail || {};
		const key = Object.keys(patch || {})[0];
		logger.logChecklistUpdated(itemIndex, key, patch?.[key]);
	});
	*/
	/*
	document.addEventListener("session:item-selected", (e) => {
		logger.log(`Item selected: ${e.detail?.itemIndex}`);
	});
	*/
	document.addEventListener("session:init", (e) =>
		logger.log(`[SESSION-MANAGER LISTENER] Session init ${e.detail.orderNo}`)
	);
	document.addEventListener("session:session-removed", (e) =>
		logger.log(`Session removed ${e.detail.orderNo}`)
	);
}
