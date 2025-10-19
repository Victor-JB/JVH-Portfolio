// session-handling/idb-photos.js
// Minimal IndexedDB wrapper for storing photo Blobs by session/order/item.

/* 
Might be better as a class lol, idk why I keep just putting these as functions...
oop my balls
*/

import { logger } from "../log-handling/logger.js";

const DB_NAME = "qc_photos";
const DB_VERSION = 1;
const STORE = "photos";

let _db = null;
let _dbPromise = null;

/** Open (and upgrade) DB once; cache the promise. */
function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = (e) => {
			const db = req.result;
			// Create or fetch the object store
			const store = db.objectStoreNames.contains(STORE)
				? req.transaction.objectStore(STORE)
				: db.createObjectStore(STORE, { keyPath: "id" });

			// Ensure required indexes exist (idempotent)
			if (!store.indexNames.contains("by_order")) {
				store.createIndex("by_order", "orderNo", { unique: false });
			}
			if (!store.indexNames.contains("by_order_item")) {
				store.createIndex("by_order_item", ["orderNo", "itemIndex"], {
					unique: false,
				});
			}
		};

		req.onblocked = () => {
			// Another tab holds the old version open.
			// Consider surfacing a toast: "Close other tabs to complete upgrade."
			// (No reject; we’ll resolve once unblocked & success fires.)
			logger.warn("[IDB] upgrade blocked; another tab may be open");
		};

		req.onsuccess = () => {
			const db = req.result;

			// Reset cache if version changes from another context
			db.onversionchange = () => {
				try {
					db.close();
				} catch {}
				_db = null;
				_dbPromise = null;
				logger.warn("[IDB] versionchange → closed and cache reset");
			};

			// Be resilient to unexpected closure
			db.onclose = () => {
				_db = null;
				_dbPromise = null;
			};
			db.onerror = () => {
				logger.error("[IDB] db error", db.error);
			};

			resolve(db);
		};

		req.onerror = () => reject(req.error);
	});
}

export function initIDB() {
	// Fast path: already opened once and still valid
	if (_db && _dbPromise) return _dbPromise;

	if (!_dbPromise) {
		_dbPromise = openDB()
			.then((db) => {
				_db = db;
				// Log once per actual open, not per call
				logger.log("[idb-photos] DB opened");
				return db;
			})
			.catch((err) => {
				// If open failed, clear cache so next call can retry
				_db = null;
				_dbPromise = null;
				throw err;
			});
	}
	return _dbPromise;
}
/** Correct transaction helper: returns { tx, store, done }.
 *  `done` resolves when the transaction commits (or rejects on error/abort).
 */
async function getStore(mode) {
	const db = await initIDB();
	const tx = db.transaction(STORE, mode);
	const store = tx.objectStore(STORE);
	const done = new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
	return { tx, store, done };
}

export async function saveBlob({
	id,
	orderNo,
	itemIndex,
	blob,
	mime,
	timestamp,
}) {
	const { store, done } = await getStore("readwrite");
	store.put({ id, orderNo, itemIndex, blob, mime, timestamp });
	await done;
}

export async function getBlobRecord(id) {
	const { store } = await getStore("readonly");
	return new Promise((resolve, reject) => {
		const req = store.get(id);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

export async function deleteBlob(id) {
	const { store, done } = await getStore("readwrite");
	store.delete(id);
	await done;
}

export async function deleteByOrder(orderNo) {
	const db = await initIDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		const ix = tx.objectStore(STORE).index("by_order");
		const req = ix.openCursor(IDBKeyRange.only(orderNo));
		req.onsuccess = (e) => {
			const cur = e.target.result;
			if (cur) {
				cur.delete();
				cur.continue();
			}
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

export async function getStats() {
	const db = await initIDB();

	// Start with default storage estimation values, in case navigator.storage is not available
	let storageInfo = {
		usage: 0,
		quota: 0,
	};

	if (navigator.storage && navigator.storage.estimate) {
		try {
			const { usage, quota } = await navigator.storage.estimate();
			storageInfo.usage = usage;
			storageInfo.quota = quota;
		} catch (error) {
			logger.error("Error estimating storage:", error);
		}
	} else {
		logger.warn(
			"StorageManager API not fully supported. Cannot estimate total available storage."
		); // 1.3.2, 1.1.1
	}

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readonly");
		const store = tx.objectStore(STORE);
		const req = store.openCursor();

		let count = 0;
		let bytes = 0;

		req.onsuccess = (e) => {
			const cur = e.target.result;
			if (cur) {
				const v = cur.value;
				const b = v?.blob;
				if (b && typeof b.size === "number") bytes += b.size;
				count++;
				cur.continue(); // 1.1.3, 1.1.6
			}
		};

		tx.oncomplete = () => {
			resolve({
				count: count,
				bytes: bytes,
				usage: storageInfo.usage, // Merge the storage estimation results
				quota: storageInfo.quota,
			});
		};
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}
