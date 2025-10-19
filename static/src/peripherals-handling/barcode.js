/* barcode.js  ------------------------------------------------------------ */

let buffer = "";
let timer = null;

/**
 * Listen for a scan; resolves with the scanned string.
 * Usage:  await waitBarcode(timeout)   // the timeout between barcode entries
 */
export function waitBarcode(timeout) {
	buffer = "";
	return new Promise((res) => {
		function onKey(e) {
			if (timer) clearTimeout(timer);
			if (e.key === "Enter") {
				cleanup();
				return res(buffer);
			} else {
				buffer += e.key;
				timer = setTimeout(() => (buffer = ""), timeout);
			}
		}
		function cleanup() {
			window.removeEventListener("keydown", onKey);
		}
		window.addEventListener("keydown", onKey, { passive: true });
	});
}
