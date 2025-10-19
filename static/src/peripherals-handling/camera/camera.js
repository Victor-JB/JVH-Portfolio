// camera.js
import { playCameraSound } from "./camera-utils.js";
import { logger } from "../../log-handling/logger.js";
import { cameraManager } from "./cam-manager.js";
import { SessionManager } from "../../session-handling/session-manager.js";

// ----------------------- initialize video stream -------------------------- //
export async function startCamera() {
	try {
		// Initialize camera with specified quality (default to low for performance)
		await cameraManager.initialize();

		// Get stream info for logging
		const info = cameraManager.getStreamInfo();
		logger.log(
			`[START_CAM] Camera started: ${info.currCam.width}x${info.currCam.height}`
		);
		return true;
	} catch (err) {
		logger.error(`Failed to start camera: ${err}`);
		throw err;
	}
}

/* ----------------------------- take photo --------------------------------- */
export async function capturePhoto() {
	// Validate session state
	if (!SessionManager.state || !SessionManager.currentOrderNo) {
		throw new Error("No active session");
	}

	if (
		SessionManager.currentItemIndex == null ||
		SessionManager.currentItemIndex < 0
	) {
		alert("Please select an item first that you are taking a photo of.");
		throw new Error("Please select an item first");
	}

	playCameraSound();
	try {
		// Capture highest quality photo directly to overlay canvas
		const { fullSizeBlob, thumbnailDataUrl, dims } =
			await cameraManager.captureHighestQPhoto();
		await SessionManager.savePhoto(fullSizeBlob, thumbnailDataUrl);
		logger.log(
			`[CAPTURE] Photo captured: ${dims.fWidth}x${dims.fHeight}, thumbnail: ${dims.tWidth}x${dims.tHeight}`
		);
		return;
	} catch (err) {
		logger.error(`Photo capture failed: ${err}`);
		throw err;
	}
}

/* ------------------------- expose camera info ----------------------------- */
export function getCameraInfo() {
	return cameraManager.getStreamInfo();
}

/* --------------------- stop stream helper func ---------------------------- */
export function stopStream() {
	cameraManager.dispose();
	logger.log("[CAM.js] Camera stream stopped");
}

/* ------ Polyfill for early WebKit that lacks navigator.mediaDevices ------- */
(() => {
	if (!navigator.mediaDevices) {
		navigator.mediaDevices = {};
	}

	if (!navigator.mediaDevices.getUserMedia) {
		const legacy =
			navigator.webkitGetUserMedia ||
			navigator.mozGetUserMedia ||
			navigator.getUserMedia;

		if (legacy) {
			navigator.mediaDevices.getUserMedia = (constraints) =>
				new Promise((resolve, reject) => {
					legacy.call(navigator, constraints, resolve, reject);
				});
		}
	}
})();
