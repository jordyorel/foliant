import sharp from "sharp";

export type ImageCompressionLevel = "best_size" | "standard" | "best_quality";

export type ImageCompressionResult = {
  path: string;
  extension: ".jpg" | ".png" | ".webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

type ImageFormat = "jpeg" | "png" | "webp" | "heif" | "avif" | "tiff" | "gif" | "svg";

function qualityFor(level: ImageCompressionLevel) {
  if (level === "best_size") return 62;
  if (level === "best_quality") return 86;
  return 74;
}

function outputFormat(inputFormat?: ImageFormat): {
  extension: ImageCompressionResult["extension"];
  mimeType: ImageCompressionResult["mimeType"];
} {
  if (inputFormat === "png") {
    return {extension: ".png", mimeType: "image/png"};
  }

  if (inputFormat === "webp") {
    return {extension: ".webp", mimeType: "image/webp"};
  }

  return {extension: ".jpg", mimeType: "image/jpeg"};
}

export async function compressImage(
  inputPath: string,
  outputPath: string,
  level: ImageCompressionLevel = "standard"
): Promise<ImageCompressionResult> {
  const metadata = await sharp(inputPath).metadata();
  const quality = qualityFor(level);
  const output = outputFormat(metadata.format as ImageFormat | undefined);
  const targetPath = outputPath.replace(/\.[a-z0-9]+$/i, output.extension);
  const image = sharp(inputPath, {animated: false}).rotate();

  if (output.extension === ".png") {
    await image
      .png({
        compressionLevel: 9,
        effort: level === "best_size" ? 10 : 7,
        quality,
        palette: level === "best_size"
      })
      .toFile(targetPath);
  } else if (output.extension === ".webp") {
    await image.webp({quality, effort: 6}).toFile(targetPath);
  } else {
    await image.jpeg({quality, mozjpeg: true}).toFile(targetPath);
  }

  return {
    path: targetPath,
    extension: output.extension,
    mimeType: output.mimeType
  };
}
