import fs from "fs/promises";
import path from "path";
import { MetaFile, ContextDetectionResult, KnownInfo } from "../types/meta";

const META_FILENAME = "meta.json";

// Read meta.json from dataset directory
export async function readMeta(datasetDir: string): Promise<MetaFile> {
  const metaPath = path.join(datasetDir, META_FILENAME);

  try {
    const content = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(content) as MetaFile;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // File doesn't exist, return empty meta
      return {};
    }
    throw error;
  }
}

// Write meta.json to dataset directory
export async function writeMeta(datasetDir: string, meta: MetaFile): Promise<void> {
  const metaPath = path.join(datasetDir, META_FILENAME);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
}

// Update context in meta.json
export async function updateMetaContext(
  datasetDir: string,
  context: ContextDetectionResult
): Promise<MetaFile> {
  const meta = await readMeta(datasetDir);
  meta.context = context;
  await writeMeta(datasetDir, meta);
  return meta;
}

// Update known info in meta.json
export async function updateMetaKnown(
  datasetDir: string,
  known: Partial<KnownInfo>
): Promise<MetaFile> {
  const meta = await readMeta(datasetDir);
  meta.known = { ...meta.known, ...known };
  await writeMeta(datasetDir, meta);
  return meta;
}

// Get known info, with defaults
export function getKnownInfo(meta: MetaFile): KnownInfo {
  return meta.known || {};
}

// Check if meta has context
export function hasContext(meta: MetaFile): boolean {
  return !!meta.context && meta.context.images.length > 0;
}

// Get summary from context
export function getContextSummary(meta: MetaFile): string {
  if (!meta.context) return "No context detected";

  const { summary } = meta.context;
  const parts: string[] = [];

  if (summary.dominantSourceType !== "unknown") {
    parts.push(`Source: ${summary.dominantSourceType}`);
  }
  if (summary.dominantDomain !== "unknown") {
    parts.push(`Domain: ${summary.dominantDomain}`);
  }
  if (summary.dominantFormat !== "unknown") {
    parts.push(`Format: ${summary.dominantFormat}`);
  }
  if (summary.detectedApps.length > 0) {
    parts.push(`Apps: ${summary.detectedApps.join(", ")}`);
  }
  if (summary.detectedUsernames.length > 0) {
    parts.push(`Users: ${summary.detectedUsernames.join(", ")}`);
  }

  return parts.join(" | ");
}

