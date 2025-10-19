// session-sync.js — builds upload payloads + offline queue + orchestrates POSTs
import {
	querySharepointFolders,
	uploadSessionLogs,
	sendSinglePhoto,
} from "../api-handling/api-handler-exports.js";
import { logger } from "../log-handling/logger.js";
import {
	loadQueue,
	saveQueue,
	buildFolderResponse,
	buildLogPayload,
} from "./session-sync-utils.js";
import { getBlobRecord } from "./idb-photos.js";
import { setProgress } from "../ui/ux-elements.js";

// ---------- offline queue (logs only) ------------------------------------- */
export async function flushOfflineQueue() {
	const q = loadQueue();
	if (!q.length || !navigator.onLine) return;
	logger.log(`[FLUSH_OFFLINE] ${q.length} offline logs found, uploading...`);
	const remaining = [];
	for (const payload of q) {
		try {
			await uploadSessionLogs(payload);
		} catch {
			remaining.push(payload);
		}
	}
	if (remaining.length > 0) {
		logger.warn(
			`Flush errored on at least one payload; ${remaining.length} remaining offline sessions to push`
		);
	}
	saveQueue(remaining);
}

export async function hydrateOfflineQueue(logPayload) {
	if (navigator.onLine) return;
	logger.log("Offline... hydrating offline queue");
	const q = loadQueue();
	q.push(logPayload);
	saveQueue(q);
}

// ------------------ helper wrapper for uploading logs --------------------- //
export function uploadLogs(session, rawLogs) {
	const logPayload = buildLogPayload(session, rawLogs);
	uploadSessionLogs(logPayload);
	return;
}

// ------------------ helper wrapper for uploading session ------------------ //
export async function uploadSession(session) {
	const orderNo = String(session.orderNo);
	const clientName = String(session.so.client);

	// minimal checklist (only what the backend needs for XLSX)
	const checklist = {
		items: (session.items || []).map((it, i) => ({
			code: String(it.meta.code || `item-${i + 1}`),
			checks: it.checks || {},
			comments: it.comments || {},
		})),
	};

	// flatten photos across items (keep order by timestamp)
	const photos = (session.items || [])
		.flatMap((it, idx) =>
			(it.photos || []).map((p) => ({
				id: p.id,
				itemIndex: Number.isFinite(p.itemIndex) ? p.itemIndex : idx,
				timestamp: p.timestamp || Date.now(),
				mime: p.mime || "image/jpeg",
			}))
		)
		.sort((a, b) => a.timestamp - b.timestamp || a.itemIndex - b.itemIndex);

	let folderId = null;
	setProgress(0, 0, {
		newPText: `Initializing folder Multimedia/Photos - Pictures/USA/${clientName}/${orderNo}.${clientName}…`,
		spinner: true,
	});
	for (const [index, p] of photos.entries()) {
		const isFirst = index === 0;
		const isLast = index === photos.length - 1;

		const rec = await getBlobRecord(p.id);
		const fname = `${p.id}.jpg`;

		const resp = await sendSinglePhoto(
			orderNo,
			clientName,
			isFirst ? checklist : null, // Pass checklist only on first call
			rec.blob,
			fname,
			folderId, // reuse after first response,
			isFirst ? "first" : isLast ? "eof" : ""
		);
		folderId = resp.folderId || folderId;

		setProgress(index + 1, photos.length, {
			newPText: `${index + 1}. ${fname} --> Multimedia/Photos - Pictures/USA/${clientName}`,
		});
	}
	setProgress(0, 0, {
		newPText: `Finishing up...`,
		spinner: true,
	});
	return { ordNo: orderNo, cName: clientName, totalPhotos: photos.length };
}

// ------------------------ preflight (read-only) --------------------------- //
export async function checkSPFolderExists(sessionInfo) {
	const orderNo = sessionInfo.orderNo;
	const customer = sessionInfo.soClient;

	// Read-only check (no creation)
	const info = await querySharepointFolders({
		customer,
		orderNo,
	});
	if (info.has_photos) {
		const formatted_res = buildFolderResponse(info);
		return {
			photo_count: info?.photo_count || 0,
			formatted_res: formatted_res,
		};
	} else {
		return;
	}
}
