import readline from "readline";
import { KnownInfo } from "../types/meta";

// Fields that can be interactively prompted
export interface PromptableField {
  key: keyof KnownInfo;
  label: string;
  required: boolean;
  examples?: string[];
}

// Define promptable fields with labels
export const PROMPTABLE_FIELDS: PromptableField[] = [
  { key: "gender", label: "Gender (Male/Female/Other)", required: true, examples: ["Male", "Female"] },
  { key: "username", label: "Username/Handle", required: false, examples: ["@the_jiajun", "jiajun"] },
  { key: "name", label: "Name", required: false, examples: ["Jiajun", "小明"] },
  { key: "ageRange", label: "Age Range", required: false, examples: ["25-35", "28-35"] },
  { key: "location", label: "Location", required: false, examples: ["Shanghai, China", "Palo Alto, CA"] },
  { key: "occupation", label: "Occupation", required: false, examples: ["Software Engineer", "Office Worker"] },
];

// Create readline interface
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Prompt for a single field
async function promptField(
  rl: readline.Interface,
  field: PromptableField
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const exampleText = field.examples ? ` (e.g., ${field.examples.join(", ")})` : "";
    const requiredText = field.required ? " [required]" : " [optional, press Enter to skip]";

    rl.question(`${field.label}${exampleText}${requiredText}: `, (answer) => {
      const trimmed = answer.trim();
      if (trimmed === "") {
        resolve(undefined);
      } else {
        resolve(trimmed);
      }
    });
  });
}

// Detect missing fields from analysis result
export function detectMissingFields(
  known: KnownInfo | undefined,
  analysisResult: any
): PromptableField[] {
  const missing: PromptableField[] = [];

  for (const field of PROMPTABLE_FIELDS) {
    // Check if field is already in known info
    if (known && known[field.key]) {
      continue;
    }

    // Check if field was inferred with high confidence
    const inferred = getInferredValue(analysisResult, field.key);
    if (inferred && inferred.confidence >= 0.8) {
      continue;
    }

    // Field is missing or low confidence
    missing.push(field);
  }

  return missing;
}

// Get inferred value from analysis result
function getInferredValue(
  analysisResult: any,
  fieldKey: keyof KnownInfo
): { value: any; confidence: number } | undefined {
  if (!analysisResult?.profile?.identity_card) return undefined;

  const identityCard = analysisResult.profile.identity_card;

  switch (fieldKey) {
    case "gender":
      return identityCard.gender ? { value: identityCard.gender, confidence: 0.9 } : undefined;
    case "ageRange":
      return identityCard.age ? { value: identityCard.age, confidence: 0.7 } : undefined;
    case "location":
      return identityCard.location ? { value: identityCard.location, confidence: 0.8 } : undefined;
    case "occupation":
      return identityCard.occupation ? { value: identityCard.occupation, confidence: 0.7 } : undefined;
    default:
      return undefined;
  }
}

// Interactive prompt for missing fields
export async function promptForMissingFields(
  known: KnownInfo | undefined,
  analysisResult: any,
  onlyRequired: boolean = false
): Promise<KnownInfo> {
  const rl = createReadlineInterface();
  const result: KnownInfo = { ...known };

  try {
    const missingFields = detectMissingFields(known, analysisResult);
    const fieldsToPrompt = onlyRequired
      ? missingFields.filter(f => f.required)
      : missingFields;

    if (fieldsToPrompt.length === 0) {
      console.log("\n✓ All required fields are available.");
      return result;
    }

    console.log("\n--- Interactive Input ---");
    console.log("Please provide the following information:\n");

    for (const field of fieldsToPrompt) {
      const value = await promptField(rl, field);
      if (value) {
        (result as any)[field.key] = value;
      }
    }

    console.log("\n--- Input Complete ---\n");

  } finally {
    rl.close();
  }

  return result;
}

// Non-interactive: apply known info to analysis result
export function applyKnownToResult(
  known: KnownInfo,
  analysisResult: any
): any {
  if (!analysisResult) return analysisResult;

  const result = JSON.parse(JSON.stringify(analysisResult));

  // Ensure profile.identity_card exists
  if (!result.profile) result.profile = {};
  if (!result.profile.identity_card) result.profile.identity_card = {};

  const identityCard = result.profile.identity_card;

  // Apply known fields
  if (known.gender) identityCard.gender = known.gender;
  if (known.ageRange) identityCard.age = known.ageRange;
  if (known.location) identityCard.location = known.location;
  if (known.occupation) identityCard.occupation = known.occupation;
  if (known.name) identityCard.name = known.name;

  return result;
}

// Check if running in interactive mode (TTY)
export function isInteractiveMode(): boolean {
  return process.stdin.isTTY === true;
}
