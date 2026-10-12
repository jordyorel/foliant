export function pdfPixelRatio(width: number, height: number, deviceRatio: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  const density = Number.isFinite(deviceRatio) ? Math.max(1, Math.min(deviceRatio, 2)) : 1;
  return Math.min(density, Math.sqrt(8_000_000 / (width * height)), 4096 / Math.max(width, height));
}
