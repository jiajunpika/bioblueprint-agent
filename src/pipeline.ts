import Anthropic from "@anthropic-ai/sdk";
import { ScanResult, BioBlueprint } from "./types/bioblueprint";
import { ContextDetectionResult, MetaFile, KnownInfo } from "./types/meta";
import { scannerPrompt } from "./prompts/scanner";
import { analyzerPrompt } from "./prompts/analyzer";
import { synthesizerPrompt } from "./prompts/synthesizer";
import { contextDetectorPrompt } from "./prompts/contextDetector";
import { ProcessedImage, ExifData } from "./utils/preprocess";

const client = new Anthropic();

interface ImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/jpeg";
    data: string;
  };
}

interface TextContent {
  type: "text";
  text: string;
}

type ContentBlock = ImageContent | TextContent;

function formatExifInfo(exif?: ExifData): string {
  if (!exif) return "";

  const parts: string[] = [];

  if (exif.captureTime) {
    parts.push(`Taken: ${exif.captureTime}`);
  }

  if (exif.gps) {
    parts.push(`GPS: ${exif.gps.latitude.toFixed(6)}, ${exif.gps.longitude.toFixed(6)}`);
  }

  if (exif.camera) {
    parts.push(`Camera: ${exif.camera}`);
  }

  return parts.length > 0 ? ` | EXIF: ${parts.join(", ")}` : "";
}

function buildImageContentWithExif(images: ProcessedImage[]): ContentBlock[] {
  const content: ContentBlock[] = [
    {
      type: "text",
      text: `Please scan the following ${images.length} images:`,
    },
  ];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const exifInfo = formatExifInfo(img.exif);

    content.push({
      type: "text",
      text: `\n--- Image ${i} (${img.filename})${exifInfo} ---`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: img.base64,
      },
    });
  }

  return content;
}

function buildExifSummary(images: ProcessedImage[]): string {
  const withGps = images.filter((img) => img.exif?.gps);
  const withTime = images.filter((img) => img.exif?.captureTime);

  if (withGps.length === 0 && withTime.length === 0) {
    return "";
  }

  let summary = "\n\n## EXIF Metadata (Use for inference):\n";

  if (withGps.length > 0) {
    summary += "\nGPS Locations:\n";
    for (const img of withGps) {
      const idx = images.indexOf(img);
      summary += `- Image ${idx}: ${img.exif!.gps!.latitude.toFixed(6)}, ${img.exif!.gps!.longitude.toFixed(6)}\n`;
    }
  }

  if (withTime.length > 0) {
    summary += "\nCapture Times:\n";
    const sorted = [...withTime].sort((a, b) => {
      return (
        new Date(a.exif!.captureTime!).getTime() -
        new Date(b.exif!.captureTime!).getTime()
      );
    });

    for (const img of sorted) {
      const idx = images.indexOf(img);
      summary += `- Image ${idx}: ${img.exif!.captureTime}\n`;
    }

    const earliest = sorted[0].exif!.captureTime!;
    const latest = sorted[sorted.length - 1].exif!.captureTime!;
    summary += `\nTime Range: ${earliest.split("T")[0]} to ${latest.split("T")[0]}\n`;
  }

  return summary;
}

// Phase 0: Context Detection
export async function detectContext(images: ProcessedImage[]): Promise<ContextDetectionResult> {
  console.log(`Detecting context for ${images.length} images...`);

  const content: ContentBlock[] = [
    {
      type: "text",
      text: `Analyze the context of the following ${images.length} images:`,
    },
  ];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const exifInfo = formatExifInfo(img.exif);

    content.push({
      type: "text",
      text: `\n--- Image ${i} (${img.filename})${exifInfo} ---`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: img.base64,
      },
    });
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: contextDetectorPrompt,
    messages: [
      {
        role: "user",
        content: content,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("No text response from context detector");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in context detector response");
  }

  try {
    return JSON.parse(jsonMatch[0]) as ContextDetectionResult;
  } catch (e) {
    const fs = require("fs");
    fs.writeFileSync("/tmp/context_raw_response.txt", textBlock.text);
    console.error("JSON parse error. Raw response saved to /tmp/context_raw_response.txt");
    throw e;
  }
}

export async function scanImages(images: ProcessedImage[]): Promise<ScanResult> {
  console.log(`Scanning ${images.length} images...`);

  const content = buildImageContentWithExif(images);

  // Add EXIF summary at the end
  const exifSummary = buildExifSummary(images);
  if (exifSummary) {
    content.push({
      type: "text",
      text: exifSummary,
    });
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: scannerPrompt,
    messages: [
      {
        role: "user",
        content: content,
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("No text response from scanner");
  }

  // Parse JSON from response
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in scanner response");
  }

  try {
    return JSON.parse(jsonMatch[0]) as ScanResult;
  } catch (e) {
    // Save raw response for debugging
    const fs = require("fs");
    fs.writeFileSync("/tmp/scanner_raw_response.txt", textBlock.text);
    console.error("JSON parse error. Raw response saved to /tmp/scanner_raw_response.txt");
    throw e;
  }
}

export async function deepAnalyze(
  images: ProcessedImage[],
  scanResult: ScanResult,
  focusAreas: string[]
): Promise<BioBlueprint> {
  console.log(`Deep analyzing with focus on: ${focusAreas.join(", ")}`);

  const exifSummary = buildExifSummary(images);

  const analysisPrompt = `
Based on the following scan results, perform deep analysis:

Scan Summary:
- Total images: ${scanResult.summary.totalImages}
- High priority image indices: ${scanResult.summary.highPriorityImages.join(", ")}
- Focus topics: ${focusAreas.join(", ")}

Topic details:
${scanResult.summary.crossReferences
  .map(
    (ref) =>
      `- ${ref.topic}: images [${ref.images.join(", ")}], confidence ${ref.confidence}`
  )
  .join("\n")}
${exifSummary}

Please generate complete BioBlueprint JSON.
`;

  const content: ContentBlock[] = [
    { type: "text", text: analysisPrompt },
    ...buildImageContentWithExif(images).slice(1), // Skip the first text block
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: analyzerPrompt,
    messages: [
      {
        role: "user",
        content: content,
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("No text response from analyzer");
  }

  // Parse JSON from response
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in analyzer response");
  }

  return JSON.parse(jsonMatch[0]) as BioBlueprint;
}

export function filterByConfidence(
  blueprint: BioBlueprint,
  threshold: number = 0.6
): BioBlueprint {
  // Deep filter function to remove low confidence values
  function filterObject(obj: any): any {
    if (obj === null || obj === undefined) return undefined;

    if (Array.isArray(obj)) {
      return obj
        .map((item) => filterObject(item))
        .filter((item) => item !== undefined);
    }

    if (typeof obj === "object") {
      // Check if it's a confidence value object
      if ("confidence" in obj && "value" in obj) {
        if (obj.confidence < threshold) {
          return undefined;
        }
        return obj;
      }

      // Regular object - filter its properties
      const filtered: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const filteredValue = filterObject(value);
        if (
          filteredValue !== undefined &&
          !(Array.isArray(filteredValue) && filteredValue.length === 0) &&
          !(
            typeof filteredValue === "object" &&
            Object.keys(filteredValue).length === 0
          )
        ) {
          filtered[key] = filteredValue;
        }
      }
      return Object.keys(filtered).length > 0 ? filtered : undefined;
    }

    return obj;
  }

  return filterObject(blueprint) || {};
}

export async function synthesize(inferenceResult: BioBlueprint): Promise<any> {
  console.log("Synthesizing inference results into final BioBlueprint format...");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: synthesizerPrompt,
    messages: [
      {
        role: "user",
        content: `Convert the following inference results to final BioBlueprint format:\n\n${JSON.stringify(inferenceResult, null, 2)}`,
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("No text response from synthesizer");
  }

  // Parse JSON from response
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in synthesizer response");
  }

  return JSON.parse(jsonMatch[0]);
}

export interface AnalysisOptions {
  meta?: MetaFile;
  skipContextDetection?: boolean;
}

export interface AnalysisResult {
  blueprint: BioBlueprint;
  context?: ContextDetectionResult;
  meta?: MetaFile;
}

export async function analyzeWithAllPhases(
  images: ProcessedImage[],
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  let contextResult: ContextDetectionResult | undefined;

  // Phase 0: Context Detection
  if (!options.skipContextDetection) {
    console.log("\n========== Phase 0: Context Detection ==========");
    contextResult = await detectContext(images);

    console.log(`\nContext detected:`);
    console.log(`  - Source: ${contextResult.summary.dominantSourceType}`);
    console.log(`  - Domain: ${contextResult.summary.dominantDomain}`);
    console.log(`  - Format: ${contextResult.summary.dominantFormat}`);
    if (contextResult.summary.detectedApps.length > 0) {
      console.log(`  - Apps: ${contextResult.summary.detectedApps.join(", ")}`);
    }
    if (contextResult.summary.detectedUsernames.length > 0) {
      console.log(`  - Usernames: ${contextResult.summary.detectedUsernames.join(", ")}`);
    }
    console.log(`  - Privacy: ${contextResult.summary.overallPrivacyLevel}`);
  }

  // Phase 1: Quick Scan
  console.log("\n========== Phase 1: Quick Scan ==========");
  const scanResult = await scanImages(images);

  console.log(`\nScan complete: ${scanResult.summary.totalImages} images`);
  console.log(
    `Found ${scanResult.summary.crossReferences.length} cross-reference topics`
  );
  console.log(
    `High priority images: ${scanResult.summary.highPriorityImages.length}`
  );

  // Print scan summary
  console.log("\nCategory distribution:");
  for (const [category, count] of Object.entries(
    scanResult.summary.categoryDistribution
  )) {
    if (count > 0) {
      console.log(`  - ${category}: ${count}`);
    }
  }

  console.log("\nCross-references:");
  for (const ref of scanResult.summary.crossReferences) {
    console.log(
      `  - ${ref.topic}: ${ref.images.length} images, confidence ${ref.confidence}`
    );
  }

  // Phase 2: Deep Analysis
  console.log("\n========== Phase 2: Deep Analysis ==========");

  // Extract focus areas from high confidence cross-references
  const focusAreas = scanResult.summary.crossReferences
    .filter((ref) => ref.confidence > 0.7)
    .map((ref) => ref.topic);

  const blueprint = await deepAnalyze(images, scanResult, focusAreas);

  // Post-processing
  console.log("\n========== Post-processing ==========");
  const filtered = filterByConfidence(blueprint, 0.8);

  // Phase 3: Synthesis
  console.log("\n========== Phase 3: Synthesis ==========");

  // Merge known info with inferred if meta provided
  const knownInfo = options.meta?.known || {};
  const synthesisInput = {
    ...filtered,
    _knownInfo: knownInfo,
    _context: contextResult?.summary,
  };

  const finalBlueprint = await synthesize(synthesisInput);

  // Apply known info overrides with source tracking
  if (Object.keys(knownInfo).length > 0) {
    applyKnownInfo(finalBlueprint, knownInfo);
  }

  return {
    blueprint: finalBlueprint,
    context: contextResult,
    meta: options.meta,
  };
}

// Apply known info to blueprint with source tracking
function applyKnownInfo(blueprint: any, known: KnownInfo): void {
  if (!blueprint.profile?.identity_card) return;

  const card = blueprint.profile.identity_card;

  if (known.gender) {
    card.gender = { value: known.gender, source: "user_input" };
  }
  if (known.username) {
    card.username = { value: known.username, source: "user_input" };
  }
  if (known.name) {
    card.name = { value: known.name, source: "user_input" };
  }
  if (known.ageRange) {
    card.age = { value: known.ageRange, source: "user_input" };
  }
  if (known.location) {
    card.location = { value: known.location, source: "user_input" };
  }
  if (known.occupation) {
    card.occupation = { value: known.occupation, source: "user_input" };
  }
}

// Legacy function for backwards compatibility
export async function analyzeWithTwoPhases(
  images: ProcessedImage[]
): Promise<BioBlueprint> {
  const result = await analyzeWithAllPhases(images, { skipContextDetection: true });
  return result.blueprint;
}
