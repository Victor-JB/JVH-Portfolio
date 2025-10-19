import { logger } from "../../log-handling/logger.js";

// Simplified swipe-controlled zoom handlers - only swipe up/down functionality

export function setupSwipeZoomControls(stream, zoomCapabilities) {
	const video = document.getElementById("cam");
	const screen = document.getElementById("zoom-touchzone");
	const zoomIndicator = document.getElementById("zoom-indicator");
	const zoomDisplay = document.getElementById("zoom-display");
	const zoomThumb = document.getElementById("zoom-thumb");
	const touchFeedback = document.getElementById("touch-feedback");

	let isZooming = false;
	let zoomStartY = 0;
	let zoomStartValue = 1;
	let indicatorTimeout = null;
	let currentZoom = zoomCapabilities.current || 1;
	let isCleanedUp = false; // Track if this controller has been cleaned up

	if (!zoomCapabilities.supported) {
		logger.log("Zoom not supported on this camera");
		return { cleanup: () => {} };
	}

	// Initialize display
	updateZoomDisplay(currentZoom);
	updateZoomThumb(currentZoom);

	// Set zoom level with safety checks
	async function setZoom(zoomLevel) {
		if (isCleanedUp) {
			logger.warn("Zoom controller has been cleaned up, ignoring setZoom");
			return currentZoom;
		}

		try {
			const videoTrack = stream.getVideoTracks()[0];
			if (!videoTrack) {
				logger.warn("Video track not available for zoom");
				return currentZoom;
			}

			// Check if track is still valid
			if (videoTrack.readyState !== "live") {
				logger.warn("Video track is not live, cannot apply zoom");
				return currentZoom;
			}

			// Apply zoom with error handling
			await videoTrack.applyConstraints({
				advanced: [{ zoom: zoomLevel }],
			});
			currentZoom = zoomLevel;
			return currentZoom;
		} catch (error) {
			if (error.name === "OperationError") {
				logger.warn("Track is in invalid state, zoom operation cancelled");
				// End any ongoing zoom operation
				endZoom();
			} else {
				logger.error("Failed to set zoom:", error);
			}
			return currentZoom;
		}
	}

	// Touch event handlers for swipe zoom
	const startZoom = (clientY) => {
		if (isCleanedUp) return;

		isZooming = true;
		zoomStartY = clientY;
		zoomStartValue = currentZoom;

		showZoomIndicator();
		showTouchFeedback(clientY);

		// Haptic feedback if available
		if (navigator.vibrate) {
			navigator.vibrate(10);
		}
	};

	const updateZoom = async (clientY) => {
		if (!isZooming || isCleanedUp) return;

		// Calculate zoom based on vertical movement
		// Swipe up = zoom in, swipe down = zoom out
		const deltaY = zoomStartY - clientY; // Inverted for natural feel
		const sensitivity = 0.002; // Reduced for smoother control
		const zoomRange = zoomCapabilities.max - zoomCapabilities.min;
		const zoomDelta = deltaY * sensitivity * zoomRange;

		let newZoom = zoomStartValue + zoomDelta;

		// Clamp to valid range
		newZoom = Math.max(
			zoomCapabilities.min,
			Math.min(zoomCapabilities.max, newZoom)
		);

		// Round to step increments for smoother operation
		if (zoomCapabilities.step) {
			newZoom =
				Math.round(newZoom / zoomCapabilities.step) * zoomCapabilities.step;
		}

		// Apply zoom with threshold to reduce jitter
		if (Math.abs(newZoom - currentZoom) > 0.01) {
			const actualZoom = await setZoom(newZoom);
			updateZoomDisplay(actualZoom);
			updateZoomThumb(actualZoom);
		}
	};

	const endZoom = () => {
		if (!isZooming) return;

		isZooming = false;
		hideTouchFeedback();
		hideZoomIndicator();

		// Log final zoom level
		logger.log(`Zoom set to: ${currentZoom.toFixed(2)}x`);

		// Light haptic feedback
		if (navigator.vibrate) {
			navigator.vibrate(5);
		}
	};

	// Event listeners
	const touchStartHandler = (e) => {
		// Only handle single finger touches
		if (e.touches.length === 1) {
			e.preventDefault();
			e.stopPropagation();
			startZoom(e.touches[0].clientY);
		}
	};

	const touchMoveHandler = (e) => {
		// Only handle single finger touches during zoom
		if (e.touches.length === 1 && isZooming) {
			e.preventDefault();
			e.stopPropagation();
			updateZoom(e.touches[0].clientY);
		}
	};

	const touchEndHandler = (e) => {
		// End zoom when no more touches
		if (e.touches.length === 0) {
			endZoom();
		}
	};

	const touchCancelHandler = (e) => {
		logger.log("Touch cancelled");
		endZoom();
	};

	// Add event listeners
	screen.addEventListener("touchstart", touchStartHandler, { passive: false });
	screen.addEventListener("touchmove", touchMoveHandler, { passive: false });
	screen.addEventListener("touchend", touchEndHandler);
	screen.addEventListener("touchcancel", touchCancelHandler);

	// UI Helper Functions
	function showZoomIndicator() {
		if (zoomIndicator && !isCleanedUp) {
			zoomIndicator.classList.add("visible");
			clearTimeout(indicatorTimeout);
		}
	}

	function hideZoomIndicator() {
		if (zoomIndicator && !isCleanedUp) {
			indicatorTimeout = setTimeout(() => {
				if (!isCleanedUp) {
					zoomIndicator.classList.remove("visible");
				}
			}, 1500);
		}
	}

	function showTouchFeedback(clientY) {
		if (!touchFeedback || isCleanedUp) return;

		const rect = video.getBoundingClientRect();
		const y = clientY - rect.top;
		const x = rect.width / 2; // Center horizontally

		touchFeedback.style.left = x + "px";
		touchFeedback.style.top = y + "px";
		touchFeedback.classList.add("active");
	}

	function hideTouchFeedback() {
		if (touchFeedback && !isCleanedUp) {
			touchFeedback.classList.remove("active");
		}
	}

	function updateZoomDisplay(zoom) {
		if (zoomDisplay && !isCleanedUp) {
			zoomDisplay.textContent = `${zoom.toFixed(1)}×`;
		}
	}

	function updateZoomThumb(zoom) {
		if (!zoomCapabilities || !zoomThumb || isCleanedUp) return;

		// Calculate position as percentage from bottom (1x) to top (max)
		const progress =
			(zoom - zoomCapabilities.min) /
			(zoomCapabilities.max - zoomCapabilities.min);
		const position = 100 - progress * 100; // Invert for bottom-to-top
		zoomThumb.style.top = `${position}%`;
	}

	// Cleanup function to remove event listeners and reset state
	function cleanup() {
		logger.log("Cleaning up zoom controller");
		isCleanedUp = true;
		isZooming = false;

		// Remove event listeners
		screen.removeEventListener("touchstart", touchStartHandler);
		screen.removeEventListener("touchmove", touchMoveHandler);
		screen.removeEventListener("touchend", touchEndHandler);
		screen.removeEventListener("touchcancel", touchCancelHandler);

		// Clear any pending timeouts
		clearTimeout(indicatorTimeout);

		// Hide UI elements
		if (zoomIndicator) {
			zoomIndicator.classList.remove("visible");
		}
		if (touchFeedback) {
			touchFeedback.classList.remove("active");
		}
	}

	// Return controller object with cleanup method
	return {
		cleanup,
		getCurrentZoom: () => currentZoom,
		setZoom: (level) => setZoom(level),
	};
}
