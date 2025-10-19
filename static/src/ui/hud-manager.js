// hud-manager.js - Dedicated HUD management module
import { SessionManager } from "../session-handling/session-manager.js";
import { qcForFamily, preloadAllTemplates } from "./qc-loader.js";
import { capturePhoto } from "../peripherals-handling/camera/camera.js"; // ensure this path is correct in your project
import { logger } from "../log-handling/logger.js"; // add logger import
import { flashStatus } from "./ux-elements.js";

export class HUDManager {
	constructor() {
		this.currentOrder = null;
		this._swipe = null;

		this.elements = {
			panel: document.getElementById("sidePanel"),
			cust: document.getElementById("custName"),
			soInfo: document.getElementById("soInfo"),
			itemList: document.getElementById("itemList"),
			partDesc: document.getElementById("partDesc"),
			desc: document.getElementById("itemDesc"),
			thumbHeader: document.getElementById("thumbTrayHeader"),
			thumbTray: document.getElementById("thumbTray"),
			toggleHud: document.getElementById("toggleHud"),
			shutter: document.getElementById("shutter"),
			statusText: document.getElementById("status"),
			doneBtn: document.getElementById("doneBtn"),
		};
	}

	/** Call from the driver *after* HUD HTML is in the DOM */
	mount(dispatch) {
		this._abort = new AbortController();
		const on = (el, type, fn, opts = {}) =>
			el?.addEventListener(type, fn, { signal: this._abort.signal, ...opts });

		// no await here to not get stopped up
		preloadAllTemplates(); // fire-and-forget qc json loader; warms cache

		on(this.elements.toggleHud, "click", this.onToggleClick);
		on(this.elements.thumbHeader, "click", this.onPhotoCollapse);
		on(this.elements.itemList, "click", this.onItemListClick, {
			passive: true,
		});

		on(this.elements.desc, "click", this.onDescClick); // + button (delegated)
		on(this.elements.desc, "input", this.onCommentInput);
		on(this.elements.desc, "click", this.onStatusClick); // tap to cycle
		on(this.elements.desc, "pointerdown", this.onRowPointerDown); // swipe start
		on(this.elements.desc, "pointermove", this.onRowPointerMove); // swipe move
		on(this.elements.desc, "pointerup", this.onRowPointerUp); // swipe end
		on(this.elements.desc, "pointercancel", this.onRowPointerCancel);

		on(this.elements.thumbTray, "click", this.onThumbClick);
		on(this.elements.shutter, "click", this.onShutterClick);
		on(this.elements.doneBtn, "click", this.onDoneClick(dispatch));
	}

	unmount() {
		try {
			this._abort?.abort();
		} catch {}
		this._abort = null;
	}

	// ---------- handlers ----------
	onToggleClick = () => this.elements.panel.classList.toggle("open");

	onPhotoCollapse = () => {
		this.elements.thumbTray.classList.toggle("tray-collapsed");
		this.elements.thumbHeader.classList.toggle("collapsed");
	};

	onItemListClick = (e) => {
		const li = e.target.closest("li[data-idx]");
		if (!li) return;
		this.selectItem?.(Number(li.dataset.idx));
	};
	applyIndeterminate = () => {
		this.elements.desc.querySelectorAll("label.check-row").forEach((row) => {
			const cb = row.querySelector("input.checkbox");
			const s = row.dataset.state || "";
			if (cb) {
				cb.checked = s === "pass";
				cb.indeterminate = s === "fail";
			}
			row
				.querySelector(".primary")
				?.classList.toggle("completed", s === "pass");
		});
	};

	nextState = (s) => (s === "" ? "pass" : s === "pass" ? "fail" : "");

	setRowState = (row, cb, state) => {
		row.dataset.state = state;
		if (cb) {
			cb.checked = state === "pass";
			cb.indeterminate = state === "fail";
		}
		row
			.querySelector(".primary")
			?.classList.toggle("completed", state === "pass");
	};

	saveRowState = (checkId, state) => {
		const idx = SessionManager.currentItemIndex;
		if (idx == null) return;
		SessionManager.updateCheckState(idx, checkId, state); // "pass" | "fail" | ""
	};

	onStatusClick = (e) => {
		const cb = e.target.closest("input.checkbox");
		if (!cb) return;
		const row = cb.closest("label.check-row");
		const next = this.nextState(row.dataset.state || "");
		this.setRowState(row, cb, next);
		this.saveRowState(cb.dataset.checkId, next);
	};

	/* ---------------- swipe with improved sensitivity and toggle-back ---------------- */
	onRowPointerDown = (e) => {
		if (e.target.closest(".add-comment-btn, .item-comment, textarea")) return;
		const row = e.target.closest("label.check-row");
		if (!row) return;
		this._swipe = {
			row,
			x0: e.clientX,
			y0: e.clientY,
			dx: 0,
			dy: 0,
			active: false,
		};
		row.classList.add("swiping");
		try {
			row.setPointerCapture?.(e.pointerId);
		} catch {}
	};

	onRowPointerMove = (e) => {
		const s = this._swipe;
		if (!s) return;
		s.dx = e.clientX - s.x0;
		s.dy = e.clientY - s.y0;

		// Improved sensitivity - activate sooner for horizontal intent
		if (!s.active) {
			if (Math.abs(s.dx) > 6 && Math.abs(s.dx) > Math.abs(s.dy))
				s.active = true;
			else return; // let vertical scroll happen
		}

		// Increased range and smoother movement
		const dx = Math.max(-150, Math.min(150, s.dx * 1.9)); // increased range and sensitivity
		s.row.style.transform = `translateX(${dx}px)`;
		s.row.classList.toggle("swipe-pass", dx > 0);
		s.row.classList.toggle("swipe-fail", dx < 0);
	};

	onRowPointerUp = () => {
		const s = this._swipe;
		if (!s) return;
		const row = s.row,
			cb = row.querySelector("input.checkbox");
		const id = row.dataset.checkId;
		const TH = 35; // Reduced threshold for better sensitivity
		let state = row.dataset.state || "";
		const currentState = state;

		if (s.active) {
			if (s.dx > TH) {
				// Swiping right
				if (currentState === "pass") {
					// Already pass, so untoggle to empty
					state = "";
				} else {
					// Set to pass
					state = "pass";
				}
			} else if (s.dx < -TH) {
				// Swiping left
				if (currentState === "fail") {
					// Already fail, so untoggle to empty
					state = "";
				} else {
					// Set to fail
					state = "fail";
				}
			}
			// else keep current state (no commit - didn't swipe far enough)
		}

		this.setRowState(row, cb, state);
		this.saveRowState(id, state);

		row.style.transform = "";
		row.classList.remove("swiping", "swipe-pass", "swipe-fail");
		this._swipe = null;
	};

	onRowPointerCancel = () => {
		const s = this._swipe;
		if (!s) return;
		s.row.style.transform = "";
		s.row.classList.remove("swiping", "swipe-pass", "swipe-fail");
		this._swipe = null;
	};

	onDescClick = (e) => {
		const btn = e.target.closest(".add-comment-btn");
		if (!btn) return;

		const idx = SessionManager.currentItemIndex;
		const checkId = btn.dataset.checkId;
		const rowLabel = btn.closest("label.check-row");
		if (!rowLabel) return;

		const existing = rowLabel.nextElementSibling;
		if (existing && existing.classList.contains("comment-wrapper")) {
			// Smooth hide animation before removal
			existing.classList.add("hidden");

			// Remove element after transition completes
			setTimeout(() => {
				if (existing.parentNode) {
					existing.remove();
				}
			}, 300); // Match the CSS transition duration
			return;
		}

		// Create wrapper div
		const wrapper = document.createElement("div");
		wrapper.className = "comment-wrapper hidden"; // Start hidden

		// Create textarea
		const ta = document.createElement("textarea");
		ta.className = "item-comment";
		ta.dataset.checkId = checkId;
		ta.rows = 2;
		ta.placeholder = "Add comment…";

		const saved =
			(SessionManager.getComment && SessionManager.getComment(idx, checkId)) ||
			btn.dataset.comment ||
			"";
		if (saved) ta.value = saved;

		// Put textarea inside wrapper
		wrapper.appendChild(ta);

		// Insert the wrapper (hidden state)
		rowLabel.after(wrapper);

		// Force a reflow to ensure hidden state is applied
		wrapper.offsetHeight;

		// Smoothly show the wrapper
		requestAnimationFrame(() => {
			wrapper.classList.remove("hidden");
			// Focus after the transition starts for better UX
			setTimeout(() => ta.focus(), 150);
		});
	};

	onCommentInput = (e) => {
		const t = e.target;
		if (!t) return;

		// per-item comment
		if (t.classList.contains("item-comment")) {
			const idx = SessionManager.currentItemIndex;
			const checkId = t.dataset.checkId;
			SessionManager.updateComment(idx, checkId, t.value);
			// keep latest text on the button dataset for instant reopen
			const btn = this.elements.desc.querySelector(
				`.add-comment-btn[data-check-id="${checkId}"]`
			);
			if (btn) btn.dataset.comment = t.value;
			return;
		}
	};

	onThumbClick = (e) => {
		const btn = e.target.closest("[data-remove]");
		if (!btn) return;
		const id = btn.getAttribute("data-remove");
		this.removePhoto(id);
	};

	onShutterClick = async () => {
		try {
			if (!SessionManager.state || !SessionManager.currentOrderNo) {
				throw new Error("No active session");
			}
			this.disableShutter(true);
			flashStatus("Taking photo...");
			setTimeout(() => {
				flashStatus(`Order # ${SessionManager.currentOrderNo}`);
			}, 1500);

			await capturePhoto(); // saves into SessionManager
			this.onPhotoCaptured();
		} catch (error) {
			logger.warn(`Shutter error: ${error.message}`);
		} finally {
			this.disableShutter(false);
		}
	};

	onDoneClick = (dispatch) => (e) => {
		if (SessionManager.hasAnyData()) {
			dispatch({ type: "DONE_CLICKED" });
		} else {
			alert(
				"Please enter order data (checklist entries and/or photos) before uploading to SharePoint"
			);
		}
	};

	// ==================== HUD INITIALIZATION ====================
	async initializeOrder(salesOrder) {
		// Initialize order in photo queue
		this.currentOrder = salesOrder;

		// Update header info
		this.elements.cust.textContent = salesOrder.client ?? "—";
		this.elements.soInfo.textContent = `Ship ${salesOrder.ship_date.slice(0, 10)} • ${salesOrder.items.length} item(s)`;

		// Build and display item list
		this.updateItemList();

		// Open panel and select first item
		this.elements.panel.classList.add("open");
		await this.selectItem(0);

		this.showZoomHint();
		logger.log("[LOADING] HUD initialized with content");
	}

	// ==================== ITEM SELECTION ====================
	async selectItem(idx) {
		SessionManager.setCurrentItem(idx);

		this.elements.itemList
			.querySelectorAll("li")
			.forEach((li) => li.classList.toggle("active", li.dataset.idx == idx));

		const item = this.currentOrder.items[idx];
		const savedComments = SessionManager.getComments(idx) || {};

		this.elements.partDesc.innerHTML = this.escapeHtml(item.description);
		this.elements.desc.innerHTML = "<div class='qc-spin'></div>";

		const sections = await qcForFamily(item.family);

		if (!sections.length) {
			this.elements.desc.innerHTML =
				"<p>No QC required or checklists failed to load</p>";
			this.updatePhotoTray(idx);
			return;
		}

		this.elements.desc.innerHTML = sections
			.map(
				(sec) => `
        <h4>${this.escapeHtml(sec.category)}</h4>
        <div class="checklist">
		${sec.items
			.map((row) => {
				const checkId = `${sec.category}_${row.item.replace(/[^a-zA-Z0-9]/g, "-")}`;
				const state =
					SessionManager.getCheckState(
						SessionManager.currentItemIndex,
						checkId
					) || "";
				const savedItemComment = savedComments[checkId] || "";

				return `
			<label class="check-row" data-check-id="${checkId}" data-state="${state}">
			<input type="checkbox" class="checkbox" data-check-id="${checkId}" ${state === "pass" ? "checked" : ""}>
			<div class="content-column">
			<span class="primary ${state === "pass" ? "completed" : ""}">${this.escapeHtml(row.item)}</span>
			<small class="hint">${this.escapeHtml([row.spec, row.tool].filter(Boolean).join(" - "))}</small>
			</div>
			<button type="button" class="add-comment-btn" data-check-id="${checkId}" data-comment="${this.escapeHtml(savedItemComment)}" aria-label="Add comment…">+</button>
			</label>
			${savedItemComment ? `<div class="comment-wrapper"><textarea class="item-comment" data-check-id="${checkId}" rows="2" placeholder="Add comment…">${this.escapeHtml(savedItemComment)}</textarea></div>` : ""}
		`;
			})
			.join("")}
        </div>
		`
			)
			.join("");

		// (no per-checkbox listeners here; delegated handler handles changes)
		this.applyIndeterminate();
		this.updatePhotoTray(idx);
	}

	// ==================== PHOTO MANAGEMENT ====================
	updatePhotoTray(itemIndex = this.currentItemIndex) {
		const photos = SessionManager.getPhotos(itemIndex);
		this.elements.thumbTray.innerHTML = photos
			.map(
				(p) => `
      <div class="photo-thumb" data-photo-id="${p.id}">
        <img src="${p.base64}" alt="QC Photo">
        <button class="remove-photo" data-remove="${p.id}" aria-label="Remove photo">×</button>
      </div>
    `
			)
			.join("");
	}

	removePhoto(photoId) {
		if (SessionManager.removePhoto(photoId)) {
			this.updatePhotoTray();
			this.updateItemList();
			return true;
		}
		return false;
	}

	disableShutter(disable) {
		if (disable) {
			document.body.classList.add("taking-photo");
		} else {
			document.body.classList.remove("taking-photo");
		}
	}

	// ==================== UI UPDATES ====================
	updateItemList() {
		if (!this.currentOrder) return;
		this.elements.itemList.innerHTML = this.currentOrder.items
			.map((item, i) => {
				const photoCount = SessionManager.getPhotos(i).length;
				const isActive = SessionManager.currentItemIndex === i;
				return `
        <li data-idx="${i}" class="${isActive ? "active" : ""}">
          <span>${item.code} ${photoCount ? `(📷 ${photoCount})` : ""}</span>
          <strong>${item.qty}</strong>
        </li>`;
			})
			.join("");
	}

	onPhotoCaptured() {
		this.updatePhotoTray();
		this.updateItemList();
	}

	showZoomHint() {
		// Show hint for first-time users
		localStorage.removeItem("zoom-hint-shown");
		if (
			!localStorage.getItem("zoom-hint") ||
			localStorage.getItem("zoom-hint") == "true"
		) {
			const hint = document.createElement("div");
			hint.className = "status";
			hint.id = "zoom-hint";
			hint.textContent = "Swipe up/down on the camera area to zoom";
			document.querySelector("#photo-screen").appendChild(hint);

			setTimeout(() => {
				hint.remove();
			}, 20000);

			localStorage.setItem("zoom-hint", "false");
		}
	}

	// ==================== UTILITIES ====================
	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	// ==================== PUBLIC API ====================
	clearCurrentOrder() {
		this.currentOrder = null;
		this.elements.panel.classList.remove("open");
		this.elements.itemList.innerHTML = "";
		this.elements.desc.innerHTML = "";
		this.elements.thumbTray.innerHTML = "";
		this.elements.cust.textContent = "—";
		this.elements.soInfo.textContent = "";

		logger.log("[hud-manager] HUD cleanup complete");
	}
}
