// fsm.js
// Centralized app states + pure reducer. No DOM, no fetch here.

export const S = Object.freeze({
	INIT: "INIT",
	RESUME_PROMPT: "RESUME_PROMPT",
	WAITING_SCAN: "WAITING_SCAN",
	LOADING: "LOADING",
	READY: "READY",
	UPLOADING: "UPLOADING",
	ERROR: "ERROR",
});

/** Initial state */
export const initialState = { name: S.INIT, ctx: {} };

/**
 * Pure reducer: (state, event) -> nextState
 * Events to dispatch from the driver:
 * - {type:'RESUME_ACCEPTED', orderNo, so}
 * - {type:'RESUME_DECLINED'}
 * - {type:'SCAN_OK', orderNo, so}
 * - {type:'SCAN_BAD'}
 * - {type:'DONE_CLICKED'}
 * - {type:'UPLOAD_OK'}
 * - {type:'UPLOAD_FAIL', msg}
 * - {type:'ACK'}            // user acknowledged error / continue
 */
export function reducer(state, event) {
	switch (state.name) {
		case S.INIT:
			return { name: S.RESUME_PROMPT, ctx: {} };

		case S.RESUME_PROMPT: {
			if (event.type === "RESUME_ACCEPTED") {
				return {
					name: S.LOADING,
					ctx: { orderNo: event.orderNo, so: event.so, resuming: true },
				};
			}
			if (event.type === "NO_RESUME") {
				return { name: S.WAITING_SCAN, ctx: {} };
			}
			return state;
		}

		case S.WAITING_SCAN: {
			if (event.type === "SCAN_OK") {
				return {
					name: S.LOADING,
					ctx: { orderNo: event.orderNo, so: event.so },
				};
			}
			if (event.type === "SCAN_FAIL") {
				return {
					name: S.ERROR,
					ctx: {
						msg: event.message,
						warn: true,
						go: S.WAITING_SCAN,
						source: "WAITING_SCAN",
					},
				};
			}
			return state;
		}

		case S.LOADING: {
			if (event.type === "NO_APPEND") {
				return { name: S.WAITING_SCAN, ctx: {} };
			}
			return {
				name: S.READY,
				ctx: { orderNo: state.ctx.orderNo, so: state.ctx.so },
			};
		}

		case S.READY: {
			if (event.type === "DONE_CLICKED") {
				return { name: S.UPLOADING, ctx: { orderNo: state.ctx.orderNo } };
			}
			return state;
		}

		case S.UPLOADING: {
			if (event.type === "UPLOAD_OK") return { name: S.WAITING_SCAN, ctx: {} };
			if (event.type === "UPLOAD_FAIL")
				return {
					name: S.ERROR,
					ctx: {
						msg: event.msg,
						go: S.READY,
						source: "UPLOADING",
						close_modal: true,
					},
				};
			return state;
		}

		case S.ERROR: {
			if (event.type === "ACK") {
				return { name: state.ctx.go || S.WAITING_SCAN, ctx: {} };
			}
			return state;
		}

		default:
			return state;
	}
}
