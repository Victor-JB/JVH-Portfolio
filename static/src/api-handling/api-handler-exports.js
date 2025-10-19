// api-handler.js — centralizes all API calls (SharePoint + logs)
import {
	API,
	GENIUS_URL,
	SHAREPOINT_UPLOAD_URL,
	LOG_UPLOAD_URL,
} from "../config.js";
import { authenticatedFetch } from "./api-client.js";
import { qs, compressImage } from "./api-handler-utils.js";

const W_MAX = 1280;
const JPEG_QUALITY = 0.7;

/* NOTE: you should probably make a generalized uploader function with error handling 
and retry, given that essentially all of my uploading functions follow the same structure
minus some changing variable inputs; a generalized sned_request() that handles
errors, retry, all of that jazz */

// --------------------------- wrapper for fetching ------------------------- //
export async function fetchSalesOrder(orderNo, tries = 3) {
	const url = GENIUS_URL + orderNo;

	class NonRetryError extends Error {
		constructor(errorDetails) {
			super(errorDetails.msg);
			this.code = errorDetails.code;
		}
	}

	for (let i = 0; i < tries; i++) {
		try {
			const res = await authenticatedFetch(url, {
				headers: { Accept: "application/json" },
			});

			if (res.ok) return res.json();
			else if (res.status == 404)
				throw new NonRetryError({
					code: 404,
					msg: `Order ${orderNo} not found in Genius`,
				});
			else if (res.status < 501)
				throw new NonRetryError({
					code: res.status,
					msg: `Server responded ${res.status}: ${await res.text()}`,
				});
			// else fall through → retry only 5xx errors
		} catch (err) {
			if (err instanceof NonRetryError) throw err;
			if (i === tries - 1) throw err;
			await new Promise((r) => setTimeout(r, 500));
		}
	}
}

// ---------------------- SHAREPOINT -------------------------------------------
// Read or ensure SharePoint folders.
// NOTE: Backend expects `create` as a *query param* ("true"/"false").
export async function querySharepointFolders({
	customer,
	orderNo,
	timeoutMs = 15000,
} = {}) {
	const u = (SHAREPOINT_UPLOAD_URL || "").replace(/\/$/, "") + "/check";
	const url = `${u}?${qs({
		customer,
		order_no: orderNo,
	})}`;

	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await authenticatedFetch(url, {
			method: "GET",
			signal: ctrl.signal,
		});
		const json = await res.json().catch(() => ({}));
		if (!res.ok)
			throw new Error(`CHECK HTTP ${res.status}: ${JSON.stringify(json)}`);
		return json;
	} finally {
		clearTimeout(t);
	}
}

// ------------------------- Upload session photo --------------------------- //
// Upload single photo at a time, since we are tracking upload progress
export async function sendSinglePhoto(
	orderNo,
	client,
	checklistObj,
	blob,
	filename,
	folderId,
	fileSignal,
	timeoutMs = 15000
) {
	const url = (SHAREPOINT_UPLOAD_URL || "").replace(/\/$/, "") + "/upload";
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);

	try {
		// Wrap the Blob so FormData sends proper filename & type
		const file = new File([blob], filename, {
			type: blob.type || "image/jpeg",
		});

		const fd = new FormData();
		fd.append("orderNo", orderNo);
		fd.append("client", client);
		if (checklistObj) fd.append("checklist", JSON.stringify(checklistObj));
		if (folderId) fd.append("folderId", folderId);
		fd.append("files", file, file.name); // can append multiple files if batching
		fd.append("fileSignal", fileSignal);

		const res = await authenticatedFetch(url, {
			method: "POST",
			body: fd,
			signal: ctrl.signal,
			headers: {},
		});
		const json = await res.json().catch(() => ({}));
		if (!res.ok || json?.ok === false) {
			throw new Error(`SP HTTP ${res.status}: ${JSON.stringify(json)}`);
		}
		return json;
	} finally {
		clearTimeout(t);
	}
}

// ------------------------- Logs route ----------------------------------------
export async function uploadSessionLogs(payload, { timeoutMs = 12000 } = {}) {
	const url = (LOG_UPLOAD_URL || "").replace(/\/$/, "") + "/session";
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await authenticatedFetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: ctrl.signal,
		});
		if (res.status != 200 || !res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(`LOG HTTP ${res.status}: ${text}`);
		}
		return;
	} finally {
		clearTimeout(t);
	}
}

// ---------------------- send photo to API ------------------------------------
export async function getVisionResponse({ file, orderId, useDino }) {
	if (!file) throw new Error("No photo selected.");
	if (!orderId) throw new Error("Work-order not scanned.");

	/* 1. compress */
	let compressed;
	try {
		compressed = await compressImage(file, W_MAX, JPEG_QUALITY);
	} catch (err) {
		alert(err);
		return;
	}

	const form = new FormData();
	form.append("file", compressed, file.name);

	const ep = useDino ? API.dino : API.yolo;
	const res = await authenticatedFetch(ep, { method: "POST", body: form });
	if (!res.ok) throw new Error(await res.text());

	const blob = await res.blob();
	const count = parseInt(res.headers.get("X-Objects-Count") || "0", 10);
	const meanConf = parseFloat(res.headers.get("X-Mean-Conf") || "0");

	return [blob, count, meanConf];
}
