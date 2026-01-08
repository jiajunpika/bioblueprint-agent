import "dotenv/config";
import { preprocessImages, getExifSummary } from "../src/utils/preprocess";
import { analyzeWithTwoPhases } from "../src/pipeline";
import fs from "fs/promises";
import path from "path";

function generateOutputFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  return `bioblueprint_${timestamp}.json`;
}

async function main() {
  const inputDir = process.argv[2] || path.join(__dirname, "../datasets/jiajun_album_samples");

  // Default output to results directory with timestamp naming
  const resultsDir = path.join(__dirname, "../results");
  const defaultOutputFile = path.join(resultsDir, generateOutputFilename());
  const outputFile = process.argv[3] || defaultOutputFile;

  // Ensure results directory exists
  await fs.mkdir(resultsDir, { recursive: true });

  console.log("=".repeat(60));
  console.log("BioBlueprint Agent - Full Test Run");
  console.log("=".repeat(60));

  // Step 1: Preprocess images
  console.log("\n[Step 1] Preprocessing images...\n");
  const startPreprocess = Date.now();

  // Use higher resolution for grid/collage images (story overview)
  const isGridDataset = inputDir.includes("grid") || inputDir.includes("story");
  const preprocessConfig = isGridDataset
    ? { maxWidth: 1536, maxSize: 300 * 1024, quality: 85 }  // Higher res for grids
    : { maxWidth: 800, maxSize: 150 * 1024, quality: 70 };   // Normal for single photos

  console.log(`Using ${isGridDataset ? "HIGH" : "NORMAL"} resolution mode`);

  const processedImages = await preprocessImages(inputDir, preprocessConfig);
  const preprocessTime = ((Date.now() - startPreprocess) / 1000).toFixed(1);
  console.log(
    `\nPreprocessing complete: ${processedImages.length} images in ${preprocessTime}s`
  );

  // Print EXIF summary
  console.log(`\n${getExifSummary(processedImages)}`);

  // Calculate total size
  const totalBase64Size = processedImages.reduce(
    (sum, img) => sum + img.base64.length,
    0
  );
  console.log(`Total base64 size: ${(totalBase64Size / 1024 / 1024).toFixed(1)} MB`);

  // Step 2: Run analysis pipeline
  console.log("\n[Step 2] Running analysis pipeline...\n");
  const startAnalysis = Date.now();

  try {
    // Pass ProcessedImage[] directly (includes EXIF data)
    const blueprint = await analyzeWithTwoPhases(processedImages);
    const analysisTime = ((Date.now() - startAnalysis) / 1000).toFixed(1);

    console.log(`\nAnalysis complete in ${analysisTime}s`);

    // Use character_name for filename if available
    const characterName = blueprint.character_name || "unknown";
    const finalOutputFile = process.argv[3]
      ? outputFile
      : path.join(resultsDir, `${characterName}.json`);

    // Save result
    await fs.writeFile(finalOutputFile, JSON.stringify(blueprint, null, 2));
    console.log(`\nResult saved to: ${finalOutputFile}`);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("Result Summary:");
    console.log("=".repeat(60));
    console.log(JSON.stringify(blueprint, null, 2));
  } catch (error: any) {
    console.error("\nAnalysis failed:", error.message);
    if (error.response) {
      console.error("API Response:", error.response);
    }
    process.exit(1);
  }

  const totalTime = ((Date.now() - startPreprocess) / 1000).toFixed(1);
  console.log("\n" + "=".repeat(60));
  console.log(`Total time: ${totalTime}s`);
  console.log("=".repeat(60));
}

main().catch(console.error);
