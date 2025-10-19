import { logger } from "../../log-handling/logger.js";

/* ------------------------ ensure highest quality cam ---------------------- */
// Apply additional quality enhancements
export async function enhanceCameraQuality(stream) {
	if (!stream) return;

	const videoTrack = stream.getVideoTracks()[0];
	if (!videoTrack) return;

	const capabilities = videoTrack.getCapabilities();
	const constraints = {};

	// Set optimal focus if supported
	if ("focusMode" in capabilities) {
		if (capabilities.focusMode.includes("continuous")) {
			constraints.focusMode = "continuous";
		} else if (capabilities.focusMode.includes("single-shot")) {
			constraints.focusMode = "single-shot";
		}
	}

	// Set optimal exposure if supported
	if ("exposureMode" in capabilities) {
		if (capabilities.exposureMode.includes("continuous")) {
			constraints.exposureMode = "continuous";
		}
	}

	// Set optimal white balance if supported
	if ("whiteBalanceMode" in capabilities) {
		if (capabilities.whiteBalanceMode.includes("continuous")) {
			constraints.whiteBalanceMode = "continuous";
		}
	}

	// Apply the constraints if we have any
	if (Object.keys(constraints).length > 0) {
		try {
			await videoTrack.applyConstraints({ advanced: [constraints] });
		} catch (error) {
			logger.warn("Some quality enhancements failed:", error);
		}
	}
}

// ------------------- attempt to get better performance -------------------- //
export function optimizeVideoPerformance(video) {
	// Enable hardware acceleration hints
	video.style.transform = "translateZ(0)"; // Force GPU layer
	video.style.willChange = "transform"; // Hint for GPU optimization

	// Optimize video attributes
	video.setAttribute("playsinline", "");
	video.setAttribute("webkit-playsinline", "");
	video.muted = true; // Prevents audio processing overhead
}

/* ----------------------------- shutter sound  ----------------------------- */
// Camera sound effect
export function playCameraSound() {
	try {
		// Create a short camera shutter sound
		const audioContext = new (window.AudioContext ||
			window.webkitAudioContext)();
		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
		oscillator.frequency.exponentialRampToValueAtTime(
			400,
			audioContext.currentTime + 0.1
		);

		gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
		gainNode.gain.exponentialRampToValueAtTime(
			0.01,
			audioContext.currentTime + 0.1
		);

		oscillator.start(audioContext.currentTime);
		oscillator.stop(audioContext.currentTime + 0.1);
	} catch (e) {
		// Fallback to data URL audio if Web Audio API fails
		try {
			new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAAB").play();
		} catch (fallbackError) {
			// Silent failure - audio not critical
			logger.log("Audio playback not available");
		}
	}
}

/* ------------------ HUD util for getting available cams ------------------- */
export async function listCameras() {
	let devices = [];
	let allDevices = await navigator.mediaDevices.enumerateDevices();
	for (let i = 0; i < allDevices.length; i++) {
		let device = allDevices[i];
		if (device.kind == "videoinput") {
			devices.push(JSON.stringify(device));
		}
	}
	return devices;
}
