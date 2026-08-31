// Generates deterministic test fixtures without external assets.
// Usage: node tests/fixtures/generate.mjs
import {execFileSync} from "node:child_process";
import {mkdirSync, rmSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";
import {PDFDocument} from "pdf-lib";

const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, {recursive: true});
const out = (name) => join(dir, name);

// Pseudo-random RGB buffer (deterministic LCG) so fixtures are stable across runs.
function noise(width, height) {
  const buffer = Buffer.alloc(width * height * 3);
  let seed = 123456789;
  for (let i = 0; i < buffer.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    buffer[i] = seed % 256;
  }
  return buffer;
}

// 1. light.pdf — small text-based PDF via Ghostscript.
writeFileSync(
  out("light.ps"),
  "%!PS\n/Helvetica findfont 24 scalefont setfont\n72 720 moveto\n(Hello Foliant) show\nshowpage\n"
);
execFileSync("gs", [
  "-q",
  "-dBATCH",
  "-dNOPAUSE",
  "-sDEVICE=pdfwrite",
  "-sOutputFile=" + out("light.pdf"),
  out("light.ps")
]);
rmSync(out("light.ps"), {force: true});

// 2. heavy.pdf — scanned-like image PDF (embed a large noisy JPEG with pdf-lib).
const heavyJpg = await sharp(noise(1800, 2400), {raw: {width: 1800, height: 2400, channels: 3}})
  .jpeg({quality: 95})
  .toBuffer();
const heavyDoc = await PDFDocument.create();
const heavyImage = await heavyDoc.embedJpg(heavyJpg);
// Draw the high-res image scaled onto a letter-size page so Ghostscript can
// downsample it (the image sits at ~210 dpi, above the /screen 72 dpi target).
const heavyPage = heavyDoc.addPage([612, 792]);
heavyPage.drawImage(heavyImage, {x: 0, y: 0, width: 612, height: 792});
writeFileSync(out("heavy.pdf"), await heavyDoc.save());

// 3. tiny.pdf — minimal valid PDF (blank page), already near-optimal.
const tinyDoc = await PDFDocument.create();
tinyDoc.addPage([200, 200]);
writeFileSync(out("tiny.pdf"), await tinyDoc.save());

// 4. image.jpg — compressible JPEG.
await sharp(noise(900, 1100), {raw: {width: 900, height: 1100, channels: 3}})
  .jpeg({quality: 90})
  .toFile(out("image.jpg"));

// 5. image.png — lossless PNG with noise.
await sharp(noise(600, 700), {raw: {width: 600, height: 700, channels: 3}})
  .png()
  .toFile(out("image.png"));

// 6. invalid files — wrong content behind a plausible extension.
writeFileSync(out("invalid.pdf"), Buffer.from("this is definitely not a pdf\n".repeat(200)));
writeFileSync(out("invalid.jpg"), Buffer.from("this is definitely not a jpeg\n".repeat(200)));

console.log("Fixtures generated in", dir);
