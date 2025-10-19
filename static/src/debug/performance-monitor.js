class FPSMonitor {
	constructor() {
		this.times = [];
		this.frameId = null;
		this.lastFps = 0;
	}

	// The internal animation loop that records frame timestamps
	#loop(timestamp) {
		// Add the current frame's timestamp
		this.times.push(timestamp);

		// Remove any timestamps older than one second
		const now = performance.now();
		while (this.times.length > 0 && this.times[0] <= now - 1000) {
			this.times.shift();
		}

		// Calculate and store the current FPS based on the last second's frames
		this.lastFps = this.times.length;

		// Continue the loop
		if (this.frameId !== null) {
			this.frameId = window.requestAnimationFrame(this.#loop.bind(this));
		}
	}

	// Starts the FPS monitoring
	start() {
		if (this.frameId === null) {
			this.frameId = window.requestAnimationFrame(this.#loop.bind(this));
		}
	}

	// Stops the FPS monitoring
	stop() {
		if (this.frameId !== null) {
			window.cancelAnimationFrame(this.frameId);
			this.frameId = null;
			// Optionally reset for a fresh start later
			this.times = [];
			this.lastFps = 0;
		}
	}

	// Returns the most recently calculated average FPS
	getAverageFPS() {
		return this.lastFps;
	}
}
export const fpsMonitor = new FPSMonitor();
