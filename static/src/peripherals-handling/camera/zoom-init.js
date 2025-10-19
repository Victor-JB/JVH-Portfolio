import { logger } from "../../log-handling/logger.js";
import { setupSwipeZoomControls } from "./zoom-handler.js";

// Store current zoom controller to clean it up when stream changes
let currentZoomController = null;

// Initialize zoom capabilities
export function initializeZoom(stream) {
	// Clean up any existing zoom controller first
	if (currentZoomController) {
		logger.log("Cleaning up previous zoom controller");
		currentZoomController.cleanup();
		currentZoomController = null;
	}

	if (!stream) {
		logger.warn("Cannot initialize zoom - no active stream");
		return false;
	}

	const videoTrack = stream.getVideoTracks()[0];
	if (!videoTrack) {
		logger.warn("No video track available for zoom");
		return false;
	}

	const capabilities = videoTrack.getCapabilities();

	if ("zoom" in capabilities) {
		const zoomCapabilities = capabilities.zoom;

		// Get current zoom level from the track
		const settings = videoTrack.getSettings();
		const currentZoom = settings.zoom || zoomCapabilities.min || 1;

		// Create new zoom controller
		currentZoomController = setupSwipeZoomControls(stream, {
			current: currentZoom,
			min: zoomCapabilities.min || 1,
			max: zoomCapabilities.max || 1,
			step: zoomCapabilities.step || 0.1,
			supported: true,
		});

		logger.log(
			`Zoom initialized: current=${currentZoom}, min=${zoomCapabilities.min}, max=${zoomCapabilities.max}, step=${zoomCapabilities.step}`
		);
		return currentZoomController;
	} else {
		logger.log("Camera does not support zoom");
		localStorage.setItem("zoom-hint", "false");
		return null;
	}
}
