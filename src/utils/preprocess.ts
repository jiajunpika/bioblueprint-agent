import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExifParser = require("exif-parser");

export interface PreprocessOptions {
  maxWidth: number;
  maxSize: number;
  quality: number;
  outputFormat: "jpeg" | "png";
}

export interface ExifData {
  captureTime?: string; // ISO date string
  gps?: {
    latitude: number;
    longitude: number;
  };
  camera?: string;
  orientation?: number;
}

export interface ProcessedImage {
  filename: string;
  base64: string;
  sizeKB: number;
  originalSizeKB: number;
  exif?: ExifData;
}

const defaultOptions: PreprocessOptions = {
  maxWidth: 1024,
  maxSize: 200 * 1024, // 200KB
  quality: 80,
  outputFormat: "jpeg",
};

export class PreprocessError extends Error {
  constructor(
    message: string,
    public filename: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = "PreprocessError";
  }
}

async function extractExif(filePath: string): Promise<ExifData | undefined> {
  try {
    const buffer = await fs.readFile(filePath);
    const parser = ExifParser.create(buffer);
    const result = parser.parse();

    const exif: ExifData = {};

    // Extract capture time
    if (result.tags?.DateTimeOriginal) {
      const timestamp = result.tags.DateTimeOriginal * 1000;
      exif.captureTime = new Date(timestamp).toISOString();
    } else if (result.tags?.CreateDate) {
      const timestamp = result.tags.CreateDate * 1000;
      exif.captureTime = new Date(timestamp).toISOString();
    }

    // Extract GPS coordinates
    if (result.tags?.GPSLatitude && result.tags?.GPSLongitude) {
      exif.gps = {
        latitude: result.tags.GPSLatitude,
        longitude: result.tags.GPSLongitude,
      };
    }

    // Extract camera info
    if (result.tags?.Make || result.tags?.Model) {
      exif.camera = [result.tags.Make, result.tags.Model]
        .filter(Boolean)
        .join(" ");
    }

    // Extract orientation
    if (result.tags?.Orientation) {
      exif.orientation = result.tags.Orientation;
    }

    // Return undefined if no useful EXIF data
    if (Object.keys(exif).length === 0) {
      return undefined;
    }

    return exif;
  } catch {
    // EXIF extraction failed, return undefined
    return undefined;
  }
}

async function processImage(
  filePath: string,
  options: PreprocessOptions
): Promise<Buffer> {
  // Ensure both dimensions are within maxWidth limit
  // (Claude API requires max 2000px per dimension for multi-image requests)
  return sharp(filePath)
    .resize(options.maxWidth, options.maxWidth, {
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({ quality: options.quality })
    .toBuffer();
}

export async function preprocessSingleImage(
  filePath: string,
  options: Partial<PreprocessOptions> = {}
): Promise<ProcessedImage> {
  const opts = { ...defaultOptions, ...options };
  const filename = path.basename(filePath);
  const stat = await fs.stat(filePath);
  const originalSizeKB = stat.size / 1024;

  // Extract EXIF before compression
  const exif = await extractExif(filePath);

  let buffer = await processImage(filePath, opts);

  // Reduce quality if still too large
  let quality = opts.quality;
  while (buffer.length > opts.maxSize && quality > 30) {
    quality -= 10;
    buffer = await processImage(filePath, { ...opts, quality });
  }

  return {
    filename,
    base64: buffer.toString("base64"),
    sizeKB: buffer.length / 1024,
    originalSizeKB,
    exif,
  };
}

export async function preprocessImages(
  inputDir: string,
  options: Partial<PreprocessOptions> = {}
): Promise<ProcessedImage[]> {
  const opts = { ...defaultOptions, ...options };
  const files = await fs.readdir(inputDir);
  const results: ProcessedImage[] = [];

  const imageExtensions = [".jpg", ".jpeg", ".png", ".heic", ".webp"];

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) continue;

    const ext = path.extname(file).toLowerCase();
    if (!imageExtensions.includes(ext)) continue;

    try {
      const result = await preprocessSingleImage(filePath, opts);
      results.push(result);

      // Log with EXIF info
      let exifInfo = "";
      if (result.exif?.captureTime) {
        exifInfo += ` [${result.exif.captureTime.split("T")[0]}]`;
      }
      if (result.exif?.gps) {
        exifInfo += ` [GPS: ${result.exif.gps.latitude.toFixed(4)}, ${result.exif.gps.longitude.toFixed(4)}]`;
      }

      console.log(
        `✓ ${file}: ${result.originalSizeKB.toFixed(0)}KB → ${result.sizeKB.toFixed(0)}KB${exifInfo}`
      );
    } catch (error: any) {
      if (error.message?.includes("heif")) {
        console.error(`✗ ${file}: HEIC format not supported, install libheif`);
      } else {
        console.error(`✗ ${file}: ${error.message}`);
      }
    }
  }

  return results;
}

export function getBase64Array(images: ProcessedImage[]): string[] {
  return images.map((img) => img.base64);
}

export function getExifSummary(images: ProcessedImage[]): string {
  const withGps = images.filter((img) => img.exif?.gps);
  const withTime = images.filter((img) => img.exif?.captureTime);

  let summary = `EXIF Summary:\n`;
  summary += `- Images with GPS: ${withGps.length}/${images.length}\n`;
  summary += `- Images with capture time: ${withTime.length}/${images.length}\n`;

  if (withGps.length > 0) {
    summary += `\nGPS Locations:\n`;
    for (const img of withGps) {
      summary += `  - ${img.filename}: ${img.exif!.gps!.latitude.toFixed(4)}, ${img.exif!.gps!.longitude.toFixed(4)}\n`;
    }
  }

  if (withTime.length > 0) {
    // Sort by capture time
    const sorted = [...withTime].sort((a, b) => {
      return (
        new Date(a.exif!.captureTime!).getTime() -
        new Date(b.exif!.captureTime!).getTime()
      );
    });

    const earliest = sorted[0].exif!.captureTime!.split("T")[0];
    const latest = sorted[sorted.length - 1].exif!.captureTime!.split("T")[0];
    summary += `\nTime Range: ${earliest} to ${latest}\n`;
  }

  return summary;
}

// CLI entry point
async function main() {
  const inputDir = process.argv[2] || "/Users/jiajun/Downloads/jiajun";

  console.log(`\nPreprocessing images from: ${inputDir}\n`);
  console.log("Options: maxWidth=1024, maxSize=200KB, quality=80\n");

  const startTime = Date.now();
  const images = await preprocessImages(inputDir);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const totalOriginal = images.reduce((sum, img) => sum + img.originalSizeKB, 0);
  const totalCompressed = images.reduce((sum, img) => sum + img.sizeKB, 0);
  const totalBase64 = images.reduce((sum, img) => sum + img.base64.length, 0);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Preprocessed: ${images.length} images`);
  console.log(`Original total: ${(totalOriginal / 1024).toFixed(1)} MB`);
  console.log(`Compressed total: ${(totalCompressed / 1024).toFixed(1)} MB`);
  console.log(`Base64 total: ${(totalBase64 / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Time: ${elapsed}s`);
  console.log(`${"=".repeat(50)}`);

  // Print EXIF summary
  console.log(`\n${getExifSummary(images)}`);
}

if (require.main === module) {
  main().catch(console.error);
}
