export function qs(params) {
	const s = new URLSearchParams(params);
	return s.toString();
}

// ----------------- compresses image for ai realtime processing ---------------
// compress image helper for ai photos real time
export function compressImage(file, wMax, quality) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const scale = Math.min(1, wMax / img.width);
			const w = Math.round(img.width * scale);
			const h = Math.round(img.height * scale);

			const canvas = Object.assign(document.createElement("canvas"), {
				width: w,
				height: h,
			});
			canvas.getContext("2d").drawImage(img, 0, 0, w, h);
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject("Compression failed")),
				"image/jpeg",
				quality
			);
		};
		img.onerror = () => reject("Invalid image");
		img.src = URL.createObjectURL(file);
	});
}
