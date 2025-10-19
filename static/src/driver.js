// driver.js — side-effects layer for the FSM (SessionManager + simplified HUD)

import {
	wireGlobalListeners,
	wireLoggingListeners,
} from "./listening-handling/listeners.js";
import { DebugHUD } from "./ui/debug-hud.js";
import { HUDManager } from "./ui/hud-manager.js";
import { logger } from "./log-handling/logger.js";
import { S, reducer, initialState } from "./fsm.js";
import {
	checkSPFolderExists,
	flushOfflineQueue,
} from "./session-handling/session-sync-exports.js";
import { TESTING, BARCODE_REGEX } from "./config.js";
import { initIDB } from "./session-handling/idb-photos.js";
import { standbyModal, flashStatus } from "./ui/ux-elements.js";
import { startCamera } from "./peripherals-handling/camera/camera.js";
import { SessionManager } from "./session-handling/session-manager.js";
import { waitForOrderNo } from "./listening-handling/ordernum-entry.js";
import { fetchSalesOrder } from "./api-handling/api-handler-exports.js";

export function bootApp() {
	const modal = standbyModal();
	const hud = new HUDManager();
	const debugHud = new DebugHUD();

	let state = initialState;

	async function dispatch(evt) {
		const prev = state;
		state = reducer(state, evt);
		if (state.name !== prev.name) await onEnter(state);
	}

	async function onEnter(s) {
		switch (s.name) {
			case S.INIT: {
				await startCamera();
				debugHud.mount();
				wireGlobalListeners({ hud, debugHud }); // prolly needn't exist if
				wireLoggingListeners(); // you just have the logging in the functions...
				hud.mount(dispatch);
				initIDB().catch(() => {});
				flushOfflineQueue();
				logger.log(
					"[INIT] Camera started, global & logging listeners ready, HUD mounted, debugHUD mounted"
				);
				return dispatch({ type: "INIT_DONE" });
			}

			case S.RESUME_PROMPT: {
				const drafts = SessionManager.getDraft();
				if (!drafts.length) {
					logger.log("[RESUME_PROMPT] No drafts found");
					return dispatch({ type: "NO_RESUME" });
				} else {
					logger.log(`[RESUME_PROMPT] Found ${drafts.length} draft(s)`);
				}

				const last = drafts[0];
				const ok = confirm(`Resume previous session ${last.orderNo}?`);
				if (!ok) {
					logger.log(
						`[RESUME_PROMPT] User chose NOT to resume session ${last.orderNo}`
					);
					return dispatch({ type: "NO_RESUME" });
				}
				logger.log(
					`[RESUME_PROMPT] User chose to resume session ${last.orderNo}`
				);

				const snapshot = SessionManager.loadFromStorage(last.orderNo);
				if (!snapshot) {
					logger.error(`[RESUME_PROMPT] Snapshot ${last.orderNo} not found...`);
					return dispatch({ type: "NO_RESUME" });
				}
				logger.log(`[RESUME_PROMPT] Resumed session ${snapshot.orderNo}`);
				return dispatch({
					type: "RESUME_ACCEPTED",
					orderNo: snapshot.orderNo,
					so: snapshot.so,
				});
			}

			case S.WAITING_SCAN: {
				logger.log("[WAITING_SCAN] Waiting for barcode…");
				const { code } = await waitForOrderNo({
					modal,
					scanPollMs: TESTING ? 5000 : 40, // keep your existing pacing
				});
				if (!RegExp(BARCODE_REGEX).test(code)) {
					return dispatch({
						type: "SCAN_FAIL",
						message: `Invalid code '${code}' scanned`,
					});
				}
				modal.loading(`Scanned ${code}, checking Genius...`);
				try {
					const so = await fetchSalesOrder(code);
					logger.logBarcodeScanned(code, so.items.length || 0, so.client);
					return dispatch({ type: "SCAN_OK", orderNo: code, so: so });
				} catch (e) {
					dispatch({ type: "SCAN_FAIL", message: `${e.message}` });
					return;
				}
			}

			case S.LOADING: {
				const { orderNo, so, resuming } = s.ctx;

				if (!resuming) {
					try {
						modal.loading("Checking SharePoint for existing photos…");
						const res = await checkSPFolderExists({
							orderNo: orderNo,
							soClient: so.client,
						});

						if (res) {
							logger.log("[LOADING] Existing photos found in Sharepoint");
							const proceed = await modal.confirm(res.formatted_res);
							if (!proceed) {
								logger.log(
									"[LOADING] Operator chose not to append to existing photos"
								);
								modal.open();
								modal.show("Waiting for scan…");
								return dispatch({ type: "NO_APPEND" });
							} else {
								logger.log(
									`[LOADING] Operator will append; ${res.photo_count} existing photo(s) found.`
								);
							}
						} else {
							logger.log(
								"[LOADING] No existing Sharepoint photos for this order."
							);
						}
					} catch (err) {
						modal.close();
						logger.warn(
							`[LOADING] SharePoint check failed: ${err?.message || err}`
						);
					}
				}

				if (!resuming) SessionManager.init(orderNo, so);
				await hud.initializeOrder(so);

				modal.close();
				flashStatus(`Order # ${orderNo}`);

				return dispatch({ type: "READY" });
			}

			case S.READY: {
				logger.log("[READY] Operator is interacting with the app...");
				return;
			}

			case S.UPLOADING: {
				try {
					hud.disableShutter(true);
					modal.open();
					modal.loading("Uploading current session...", true);

					const res = await SessionManager.uploadSession();
					modal.success(
						`Successfully uploaded ${res.totalPhotos} images & checklist to\n[dir]/${res.cName}/${res.ordNo}.${res.cName}`
					);

					hud.clearCurrentOrder();
					SessionManager.endSession();
					hud.disableShutter(false);
					return dispatch({ type: "UPLOAD_OK" });
				} catch (e) {
					return dispatch({
						type: "UPLOAD_FAIL",
						msg: `Upload failed: ${e?.message}`,
					});
				}
			}

			case S.ERROR: {
				const err_msg = s.ctx.msg;
				modal.error(err_msg, { close_modal: s.ctx?.close_modal });
				if (s.ctx.warn) logger.warn(`[${s.name}] ${err_msg}`);
				else logger.error(`[${s.name}] [${s.ctx.source}] ${err_msg}`);
				dispatch({ type: "ACK" });
				return;
			}
		}
	}

	// boot the machine
	onEnter(state);

	// expose for console debugging
	return {
		dispatch,
		get state() {
			return state;
		},
	};
}
