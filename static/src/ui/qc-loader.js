/* qc-loader.js  ──────────────────────────────────────────────────────────
   Fetches QC templates on-demand and merges them for an item family.
   ---------------------------------------------------------------------- */

import { QC_MAP, ALL_TEMPLATES } from "../config.js";
import { logger } from "../log-handling/logger.js";

/* cache → templateName : Promise<templateObj> */
const cache = Object.create(null);

/** fetch with timeout + retry */
async function fetchJSONWithRetry(url, { timeoutMs = 8000, retries = 2 } = {}) {
	for (let attempt = 0; attempt <= retries; attempt++) {
		const ac = new AbortController();
		const t = setTimeout(() => ac.abort("timeout"), timeoutMs);
		try {
			const res = await fetch(url, { signal: ac.signal, cache: "no-cache" });
			if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
			const json = await res.json();
			clearTimeout(t);
			return json;
		} catch (err) {
			clearTimeout(t);
			const last = attempt === retries;
			if (last) throw err;
			// small backoff
			await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
		}
	}
}

function urlForTemplate(name) {
	// Resolve relative to THIS module (works regardless of current page path)
	return new URL(`../resources/qc_lib/${name}.json`, window.location.href).href;
}

function getTemplate(name) {
	if (!cache[name]) {
		cache[name] = fetchJSONWithRetry(urlForTemplate(name)).catch((err) => {
			// Remove bad promise from cache so a future call can retry
			delete cache[name];
			throw new Error(`Failed to load template "${name}": ${err.message}`);
		});
	}
	return cache[name];
}

/**
 * Returns an array of template sections for a given Genius FamilyCode
 * e.g.  CUST_J → [ {category:"Structure", items:[…]}, … ]
 */
export async function qcForFamily(family) {
	let parts = QC_MAP[family] ?? [];
	if (parts.includes("all")) parts = ALL_TEMPLATES;

	// If one file fails, still proceed with others; surface which failed.
	const results = await Promise.allSettled(parts.map(getTemplate));
	const ok = [];
	const failed = [];

	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		const name = parts[i];
		if (r.status === "fulfilled") ok.push(r.value);
		else failed.push({ name, error: r.reason?.message ?? String(r.reason) });
	}

	if (failed.length) {
		// Log and let the caller decide how to message the user
		logger.warn("[qcForFamily] Some templates failed:", failed);
	}

	// Each template is an array of sections; merge them
	return ok.flat();
}

export async function preloadAllTemplates() {
	const names = new Set();
	for (const family in QC_MAP) {
		for (const n of QC_MAP[family] ?? []) {
			// Add a condition to skip the special "all" entry
			if (n !== "all") {
				names.add(n);
			}
		}
	}
	for (const n of ALL_TEMPLATES) names.add(n);

	// Fire requests in parallel but don’t blow up init if a few fail
	const results = await Promise.allSettled([...names].map(getTemplate));
	const failures = results
		.map((r, i) => ({ r, name: [...names][i] }))
		.filter((x) => x.r.status === "rejected");

	if (failures.length) {
		logger.warn(
			"[preloadAllTemplates] Failed templates:",
			failures.map((f) => f.name)
		);
	}
}
