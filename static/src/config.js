const API_BASE = location.origin;

export const WEBAPP_VERSION = "1.0.5";

export const TESTING = true; // controls barcode wait interval

export const OFFLINE_INDEXDB_KEY = "qc:offline:logs";

export const API = {
	yolo: `${API_BASE}/api/vison/yolo`,
	dino: `${API_BASE}/api/vision/dino-sam`,
};

export const GENIUS_URL = `${API_BASE}/api/genius/sales-order/`;
export const LOG_UPLOAD_URL = `${API_BASE}/api/qc-logs`;
export const SHAREPOINT_UPLOAD_URL = `${API_BASE}/api/sharepoint`;

export const BARCODE_REGEX = "^\\d{8}$";

export const STREAM_CONFIG = {
	video: {
		facingMode: { ideal: "environment" },
		width: { ideal: 1920 },
		height: { ideal: 1440 }, // 4:3
		aspectRatio: { ideal: 4 / 3 },
		frameRate: { ideal: 60, min: 30 },
		resizeMode: "crop-and-scale",
	},
	audio: false,
};

export const STREAM_QUALITIES = {
	high: [3264, 2448], // 4:3, matches your observed max
	medium: [2560, 1920], // 4:3, good render perf
	low: [1920, 1440], // 4:3, safe default
};

export const PREVIEW_THUMB_WIDTH = 480;
export const PREVIEW_THUMB_QUALITY = 0.8;

/* which template(s) each FamilyCode pulls in                       */
export const QC_MAP = {
	CUST_J: ["all"], // custom gripper ⇒ full pack
	SP: ["foam"], // spare foam only
	FEES: [], // no QC for fees; pretty sure these get filtered out by backend tho
	STD_J: ["all"],
	STD_K: ["all"],
	PUR: ["electrical", "blower", "pneumatics", "testing"],
	COMP: ["structure"],
	// … add more families here …
};

/* If you add a new template JSON file, add it here once. */
export const ALL_TEMPLATES = [
	"structure",
	"foam",
	"fit_finish",
	"electrical",
	"blower",
	"pneumatics",
	"testing",
	"pre_ship",
];

/*
Deprecated
export const OCR_SCREEN_CONFIG = {
	CROP_RATIO: 0.15, // scan only the top 25 % of the frame
	PREPROCESS: true, // toggle extra pixel processing below
};
*/
