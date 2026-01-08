// Scan result types
export interface ImageTag {
  tag: string;
  confidence: number;
  category: TagCategory;
}

export type TagCategory =
  | "hobby"
  | "food"
  | "travel"
  | "social"
  | "backstory"
  | "location"
  | "aesthetic"
  | "pet"
  | "family"
  | "work";

export interface ImageScan {
  imageIndex: number;
  tags: ImageTag[];
  textDetected: string[];
  peopleCount: number;
  hasLocation: boolean;
  locationTag?: string;
  priority: "high" | "medium" | "low";
}

export interface CrossReference {
  topic: string;
  images: number[];
  confidence: number;
}

export interface ScanSummary {
  totalImages: number;
  categoryDistribution: Record<TagCategory, number>;
  highPriorityImages: number[];
  crossReferences: CrossReference[];
}

export interface ScanResult {
  scanResults: ImageScan[];
  summary: ScanSummary;
}

// BioBlueprint types (simplified)
export interface ConfidenceValue<T> {
  value: T;
  confidence: number;
  evidence: string[];
}

export interface BioBlueprint {
  profile?: {
    identityCard?: {
      gender?: ConfidenceValue<string>;
      age?: ConfidenceValue<string>;
      location?: ConfidenceValue<string>;
      occupation?: ConfidenceValue<string>;
    };
  };
  blueprint?: {
    corePersonality?: Record<string, any>;
    careerEngine?: Record<string, any>;
    expressionEngine?: Record<string, any>;
    aestheticEngine?: Record<string, any>;
    simulation?: {
      hobbies?: ConfidenceValue<string>[];
      pets?: ConfidenceValue<any>[];
      household?: Record<string, any>;
      locations?: Record<string, any>;
      foodPreferences?: Record<string, any>;
    };
    backstory?: {
      education?: ConfidenceValue<any>[];
      family?: ConfidenceValue<string>;
      lifeEvents?: ConfidenceValue<any>[];
    };
    goal?: Record<string, any>;
  };
}
