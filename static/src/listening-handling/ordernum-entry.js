import { waitBarcode } from "../peripherals-handling/barcode.js";

/**
 * Wait for an order number either via scanner or manual entry.
 * - Enables/toggles the #manual-input button while waiting.
 * - Uses modal.getInput() for manual entry (and modal.cancelInput() when toggling back).
 * - Resolves once either source returns a value { code, source: 'scan'|'manual' }.
 */
const btn = document.querySelector("#manual-input");
export function waitForOrderNo({ modal, scanPollMs = 40 } = {}) {
	const ac = new AbortController();
	let resolved = false;

	// Ensure button exists & is enabled during this wait
	if (btn) {
		btn.disabled = false;
		btn.textContent = "Enter Manually";
	}

	function cleanup() {
		resolved = true;
		try {
			ac.abort();
		} catch {}
		if (btn) {
			btn.disabled = true;
			btn.textContent = "Enter Manually";
		}
		// If modal was showing the input, collapse it
		try {
			modal.cancelInput();
		} catch {}
	}

	// Manual-entry branch (fires each time button is clicked; resolves on a non-empty value)
	const manualPromise = new Promise((resolve) => {
		if (!btn) return; // no button, can't do manual
		btn.addEventListener(
			"click",
			async () => {
				if (resolved) return;
				// Toggle into manual prompt
				btn.textContent = "Scan Barcode";
				const val = await modal.getInput({ title: "Enter Sales Order #" });
				// After prompt, toggle back
				btn.textContent = "Enter Manually";

				if (resolved) return;
				if (val && String(val).trim()) {
					cleanup();
					resolve({ code: String(val).trim(), source: "manual" });
				}
				// If canceled or empty, keep waiting (do not resolve)
			},
			{ signal: ac.signal }
		);
	});

	// Scanner branch (keep it simple—let it run; we’ll ignore it if manual wins first)
	const scanPromise = (async () => {
		const code = await waitBarcode(scanPollMs);
		return { code, source: "scan" };
	})();

	// Whichever finishes first wins
	return Promise.race([scanPromise, manualPromise])
		.then((winner) => {
			cleanup();
			return winner;
		})
		.catch((err) => {
			cleanup();
			throw err;
		});
}
