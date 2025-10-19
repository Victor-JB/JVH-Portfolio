import {
	STREAM_CONFIG,
	STREAM_QUALITIES,
	PREVIEW_THUMB_QUALITY,
	PREVIEW_THUMB_WIDTH,
} from "../../config.js";
import {
	enhanceCameraQuality,
	optimizeVideoPerformance,
} from "./camera-utils.js";
import { initializeZoom } from "./zoom-init.js";
import { logger } from "../../log-handling/logger.js";

class CameraManager {
	constructor() {
		this.video = document.getElementById("cam");
		optimizeVideoPerformance(this.video);

		this.freezeCanvas = document.getElementById("freezeCanvas");
		this.thumbCanvas = document.getElementById("thumbCanvas");

		// Cache canvas contexts to avoid recreation
		this.thumbCtx = this.thumbCanvas.getContext("2d", {
			alpha: false,
			desynchronized: true,
		});

		this.videoStream = null;
		this.captureTrack = null;
		this.captureIC = null;
		this.fallback = false;
		this.capabilities = {
			width: null,
			height: null,
		};
		this.zoom = null;
	}

	// ====================================================================== //
	// CameraManager: Public API
	// ====================================================================== //

	async initialize() {
		try {
			const { maxW, maxH } = await this._initVidStream();
			const res = await this._applyQuality("medium");
			await this._applyStream(this.videoStream);

			// important that this come first so captureTrack can be attached to it
			try {
				this.zoom = initializeZoom(this.videoStream);
			} catch (e) {
				logger.error(`[CAM_INIT] Zoom initialization failed: ${e}`);
			}
			await this._getCaptureTrack(maxW, maxH);
		} catch (err) {
			logger.error("[CAM_INIT] Initialization failed:", err);
		}
	}

	async captureHighestQPhoto() {
		let bmp = null;
		let thumbBlob = null;

		try {
			this.captureTrack.enabled = true;

			if (this.zoom) {
				await this.captureTrack.applyConstraints({
					advanced: [{ zoom: this.zoom.getCurrentZoom() }],
				});
			}

			const fullBlob = await this.captureIC.takePhoto();
			bmp = await createImageBitmap(fullBlob);

			// Reuse canvas context instead of creating new one
			const tc = this.thumbCanvas;
			const ctx = this.thumbCtx;

			const s = Math.min(1, PREVIEW_THUMB_WIDTH / bmp.width);
			tc.width = Math.round(bmp.width * s);
			tc.height = Math.round(bmp.height * s);

			// Clear canvas before drawing
			ctx.clearRect(0, 0, tc.width, tc.height);
			ctx.drawImage(bmp, 0, 0, tc.width, tc.height);

			// Create thumbnail blob
			thumbBlob = await new Promise((res) =>
				tc.toBlob(res, "image/jpeg", PREVIEW_THUMB_QUALITY)
			);

			// Convert to data URL
			const thumbUrl = await new Promise((res, rej) => {
				const fr = new FileReader();
				fr.onload = () => res(fr.result);
				fr.onerror = rej;
				fr.readAsDataURL(thumbBlob);
			});

			const result = {
				fullSizeBlob: fullBlob,
				thumbnailDataUrl: thumbUrl,
				dims: {
					fWidth: bmp.width,
					fHeight: bmp.height,
					tWidth: tc.width,
					tHeight: tc.height,
				},
			};

			return result;
		} finally {
			// CRITICAL: Always clean up resources
			if (bmp) {
				bmp.close(); // Release GPU memory
			}

			// Clear references to help GC
			thumbBlob = null;

			// Disable capture track when done
			this.captureTrack.enabled = false;

			// Optional: Force garbage collection hint (non-standard)
			if (window.gc) {
				window.gc();
			}
		}
	}

	// Getters
	getStreamInfo() {
		if (!this.videoStream) return null;
		const track = this.videoStream.getVideoTracks()[0];
		const settings = track.getSettings();
		return {
			currCam: { width: settings.width, height: settings.height },
			maxCam: {
				width: this.capabilities.width,
				height: this.capabilities.height,
			},
		};
	}

	// ====================================================================== //
	// CameraManager: Stream management (private)
	// ====================================================================== //

	// Private methods
	async _initVidStream() {
		let stream = null;
		try {
			stream = await navigator.mediaDevices.getUserMedia(STREAM_CONFIG);
			enhanceCameraQuality(stream);
		} catch (err) {
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: true,
					audio: false,
				});
				enhanceCameraQuality(stream);
				this.fallback = true;
			} catch (fallbackErr) {
				logger.error(
					`[CAM] Could not establish any video stream:`,
					fallbackErr
				);
				throw fallbackErr;
			}
		}
		if (stream) {
			this.videoStream = stream;
			const track = stream.getVideoTracks()[0];
			const cap = track.getCapabilities();
			this.capabilities.width = cap.width.max;
			this.capabilities.height = cap.height.max;
			logger.log(
				`Supported camera dim range: ${cap.width.max}x${cap.height.max}`
			);
			return { maxW: cap.width.max, maxH: cap.height.max };
		}
	}

	async _getCaptureTrack(maxW, maxH) {
		const uiTrack = this.videoStream.getVideoTracks()[0];
		const photoTrack = uiTrack.clone();
		try {
			await photoTrack.applyConstraints({
				width: { ideal: maxW },
				height: { ideal: maxH },
				aspectRatio: { ideal: 4 / 3 },
			});
			try {
				await photoTrack.applyConstraints({
					advanced: [
						{
							focusMode: "continuous",
							exposureMode: "continuous",
							whiteBalanceMode: "continuous",
						},
					],
				});
			} catch {}
			this.captureTrack = photoTrack;
			this.captureTrack.enabled = false; // park the clone until needed
			this.captureIC = new ImageCapture(photoTrack);
		} catch {
			logger.error("Capture track could not be initialized");
		}
	}

	async _applyStream(stream) {
		const v = this.video;
		v.srcObject = stream;
		await v.play();
	}

	async _applyQuality(tier, stream = this.videoStream) {
		if (this.fallback) return;
		const track = stream.getVideoTracks()[0];

		const [w, h] = STREAM_QUALITIES[tier];
		const capW = this.capabilities.width;
		const capH = this.capabilities.height;
		const reqW = Math.min(w, capW);
		const reqH = Math.min(h, capH);

		try {
			await track.applyConstraints({
				width: { ideal: reqW },
				height: { ideal: reqH },
				aspectRatio: { ideal: 4 / 3 },
			});
			try {
				await track.applyConstraints({
					advanced: [
						{
							focusMode: "continuous",
							exposureMode: "continuous",
							whiteBalanceMode: "continuous",
							pointsOfInterest: [{ x: 0.5, y: 0.5 }],
						},
					],
				});
			} catch {}
		} catch (err) {
			logger.warn(`Failed to apply constraints ${w}x${h}: ${err}`);
			return;
		}
		return;
	}

	// ====================================================================== //
	// CameraManager: Cleanup (private)
	// ====================================================================== //
	dispose() {
		if (this.videoStream) {
			this.videoStream.getTracks().forEach((track) => track.stop());
			this.videoStream = null;
		}
		this.captureTrack?.stop();
		this.captureTrack = null;
		this.captureIC = null;
		this.video.srcObject = null;
	}
}

// Export singleton instance
export const cameraManager = new CameraManager();
