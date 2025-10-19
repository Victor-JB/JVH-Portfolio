// Memory monitoring utility
import { logger } from "../log-handling/logger.js";

class MemoryMonitor {
	constructor() {
		this.measurements = [];
		this.maxMeasurements = 10;
	}

	start(intervalMs = 5000) {
		if (!performance.memory) {
			logger.warn("Memory monitoring not available in this browser");
			return;
		}

		this.stop(); // Clear any existing interval

		this.interval = setInterval(() => {
			const memory = performance.memory;
			const measurement = {
				timestamp: Date.now(),
				usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1048576), // MB
				totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1048576),
				jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1048576),
			};

			this.measurements.push(measurement);

			// Keep only recent measurements
			if (this.measurements.length > this.maxMeasurements) {
				this.measurements.shift();
			}

			// Log if memory usage is high
			if (measurement.usedJSHeapSize > 50) {
				logger.warn(`High memory usage: ${measurement.usedJSHeapSize}MB`);
			}

			// Check for potential leak (continuous growth)
			if (this.measurements.length >= 10) {
				const recentGrowth = this.calculateGrowthRate(10);
				if (recentGrowth > 0.5) {
					// Growing > 0.5MB per measurement
					logger.error(
						`Potential memory leak detected: ${recentGrowth}MB/interval growth rate`
					);
				}
			}
		}, intervalMs);
	}

	stop() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	calculateGrowthRate(sampleSize) {
		if (this.measurements.length < sampleSize) return 0;

		const recent = this.measurements.slice(-sampleSize);
		const firstMem = recent[0].usedJSHeapSize;
		const lastMem = recent[recent.length - 1].usedJSHeapSize;

		return (lastMem - firstMem) / sampleSize;
	}

	getStats() {
		if (this.measurements.length === 0) return null;

		const current = this.measurements[this.measurements.length - 1];
		const memValues = this.measurements.map((m) => m.usedJSHeapSize);

		return {
			current: current.usedJSHeapSize,
			details: {
				min: Math.min(...memValues),
				max: Math.max(...memValues),
				average: memValues.reduce((a, b) => a + b, 0) / memValues.length,
				trend: this.calculateGrowthRate(Math.min(5, this.measurements.length)),
			},
		};
	}
}

// Usage in your app:
export const memoryMonitor = new MemoryMonitor();
