// ux-elements.js
const statusText = document.getElementById("status");
const modal = document.getElementById("standby-modal");
const titleEl = modal.querySelector("#standby-title");
const spin = modal.querySelector(".spinner");
const manualWrap = modal.querySelector(".manual-wrap");
const input = modal.querySelector("#orderInput");
const btnEnter = modal.querySelector("#orderSubmit");
const btnCancel = modal.querySelector("#orderCancel");
const headerH2 = modal.querySelector(".content > h2");
const pager = document.getElementById("app");
// confirm elements
const confirmContent = modal.querySelector("#confirm-content");
const confirmMessageBody = modal.querySelector("#modal-message-body");
const confirmMessageFooter = modal.querySelector("#modal-message-footer");
const btnConfirmOK = modal.querySelector("#confirm-ok");
const btnConfirmCancel = modal.querySelector("#confirm-cancel");
// progress bar
const progressWrap = document.getElementById("progress");
const progressBar = document.getElementById("progress-bar");
const progressLabel = document.getElementById("progress-label");
const progText = document.getElementById("progress-text");

/*
Note: there are unfortunately a lot of things that could be optimized in this file
Repeated functionality especially—like how I'm handling the progress bar in particular
Like this for the sake of time, but could definitely be cleaned up and modularized further

ALSO modal should probably be refactored into its own file and made into a class...
idk why I'm exporting this giant function....
*/

/* ———————————————————————— standby modal ——————————————————————————————————— */
export function standbyModal() {
	let timer = null;
	let token = 0;
	let inputAC = null;
	let resolveInput = null;
	let resolveConfirm = null; // New variable for confirm promise

	const setHeaderVisible = (on) => {
		if (headerH2) headerH2.hidden = !on;
	};

	function setMessage(
		text,
		{ spinner = false, ttl = null, close_modal = false } = {}
	) {
		const my = ++token; // invalidates previous timers & input sessions
		titleEl.textContent = text;
		spin.hidden = !spinner;

		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (ttl && Number.isFinite(ttl)) {
			if (close_modal) {
				timer = setTimeout(() => {
					if (my !== token) return;
					close();
				}, ttl);
			} else {
				timer = setTimeout(() => {
					if (my !== token) return;
					show("Waiting for scan…");
					setHeaderVisible(true);
				}, ttl);
			}
		}
	}

	function show(text) {
		setHeaderVisible(true);
		setMessage(text, { spinner: false });
		setManualVisible(false);
		setConfirmVisible(false); // Hide confirm content
	}

	function loading(text, progress = false) {
		setHeaderVisible(false);
		setMessage(text, { spinner: true });
		if (progress) {
			progressShow();
		}
	}

	function error(msg, opts = {}) {
		setHeaderVisible(false);
		progressHide();
		setMessage("❌ " + msg, { ttl: 3000, ...opts });
	}

	function success(msg, opts = {}) {
		setHeaderVisible(false);
		progressHide();
		setMessage("✅ " + msg, { ttl: 5000, ...opts });
	}

	function open() {
		modal.hidden = false;
		modal.style.display = "flex";
	}

	function close() {
		modal.hidden = true;
		modal.style.display = "none";
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		cancelInput();
		cancelConfirm();
		progressHide();
	}

	function confirm(message) {
		++token;
		cancelInput();
		cancelConfirm(); // Ensure any existing confirms are cancelled

		titleEl.textContent = message.header;
		open(); // Open the modal
		setConfirmVisible(true); // Make the confirm content visible
		setHeaderVisible(false);
		confirmMessageBody.innerHTML = message.body; // Use innerHTML for formatted string
		confirmMessageFooter.innerHTML = message.footer; // Use innerHTML for formatted string

		// Create a separate AbortController specifically for this confirm session
		const confirmAC = new AbortController();

		return new Promise((resolve) => {
			resolveConfirm = (result) => {
				resolveConfirm = null;

				// Clean up the event listeners first
				try {
					confirmAC.abort();
				} catch {}

				// Close the modal and resolve the promise with the result
				setConfirmVisible(false);
				close();
				resolve(result);
			};

			const handleOk = (e) => {
				e.preventDefault();
				e.stopPropagation();
				resolveConfirm?.(true);
			};

			const handleCancel = (e) => {
				e.preventDefault();
				e.stopPropagation();
				resolveConfirm?.(false);
			};

			// Add event listeners with the confirm-specific AbortController
			btnConfirmOK.addEventListener("click", handleOk, {
				signal: confirmAC.signal,
			});
			btnConfirmCancel.addEventListener("click", handleCancel, {
				signal: confirmAC.signal,
			});
		});
	}

	function setManualVisible(on) {
		manualWrap.hidden = !on;
		spin.hidden = true;
		// Ensure confirm is hidden when manual input is visible
		if (on) confirmContent.hidden = true;
	}

	function setConfirmVisible(on) {
		confirmContent.hidden = !on;
		spin.hidden = true;
		// Ensure manual input is hidden when confirm is visible
		if (on) manualWrap.hidden = true;
	}

	function cancelInput() {
		// gracefully end a pending getInput without validating
		if (resolveInput) {
			try {
				resolveInput(null);
			} catch {}
			resolveInput = null;
		}
		if (inputAC) {
			try {
				inputAC.abort();
			} catch {}
			inputAC = null;
		}
		setManualVisible(false);
		setHeaderVisible(true);
		show("Waiting for scan…");
	}

	function cancelConfirm() {
		if (resolveConfirm) {
			try {
				resolveConfirm(false); // Resolve with false for cancel
			} catch (err) {
				console.error("Error resolving confirm:", err);
			}
			resolveConfirm = null;
		}
		setConfirmVisible(false);
		setHeaderVisible(true);
	}

	function getInput({ title, prefill = "" } = {}) {
		// invalidate previous prompt
		++token;
		cancelInput();
		cancelConfirm(); // Ensure confirm is also cancelled

		open();
		show(title);
		setManualVisible(true);
		setHeaderVisible(false);

		input.value = prefill;
		setTimeout(() => {
			input.focus();
			input.select();
		}, 0);

		inputAC = new AbortController();

		return new Promise((resolve) => {
			resolveInput = (val) => {
				resolveInput = null;
				setManualVisible(false);
				show("Waiting for scan…");
				resolve(val);
			};

			const submit = () => {
				const val = (input.value || "").trim();
				resolveInput?.(val || null);
			};
			const cancel = () => resolveInput?.(null);

			btnEnter.addEventListener("click", submit, { signal: inputAC.signal });
			btnCancel.addEventListener("click", cancel, { signal: inputAC.signal });
			input.addEventListener(
				"keydown",
				(e) => {
					if (e.key === "Enter") submit();
					if (e.key === "Escape") cancel();
				},
				{ signal: inputAC.signal }
			);
		});
	}

	function progressShow(title = "Uploading") {
		if (!progressWrap) return;
		progressWrap.hidden = false;
		progressBar.style.width = "0%";
		progressLabel.textContent = `${title}: 0%`;
		progText.hidden = false;
		spin.hidden = true;
	}

	function progressHide() {
		if (!progressWrap) return;
		progressBar.style.width = "0%";
		progressLabel.textContent = "";
		progressWrap.hidden = true;
		progText.hidden = true;
		spin.hidden = true;
	}

	open();
	show("Waiting for scan…");
	return {
		show,
		loading,
		error,
		success,
		open,
		close,
		getInput,
		cancelInput,
		confirm,
	};
}

/* ------- helper progress functions for actually displaying progress ------- */
export function setProgress(
	done,
	total,
	{ title = "Uploading", newPText = null, spinner = null } = {}
) {
	if (newPText) {
		progText.textContent = newPText;
	}

	if (spinner) {
		spin.hidden = false;
		progressWrap.hidden = true;
	} else {
		spin.hidden = true;
		const frac = total > 0 ? Math.min(Math.max(done / total, 0), 1) : 0;
		const pct = Math.round(frac * 100);

		progressWrap.hidden = false;
		progressBar.style.width = pct + "%";
		progressLabel.textContent = `${title}: ${done}/${total} (${pct}%)`;
	}
}

/* ———————————————————————— visual flash ———————————————————————————————————— */
export function flashStatus(text) {
	statusText.classList.add("number-flash");
	statusText.textContent = text;
	setTimeout(() => statusText.classList.remove("number-flash"), 1250);
}

/* ───────────────────────── slide nav ──────────────────────────────── */
export function slidePage() {
	pager.style.transform = "translateX(-50%)"; // CSS does the animation
}
