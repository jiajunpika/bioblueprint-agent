// Source type - what kind of image is this
export type SourceType =
  | "app_screenshot"
  | "camera_photo"
  | "edited_photo"
  | "document_scan"
  | "screen_recording"
  | "downloaded_image"
  | "unknown";

// Content domain - what area of life does this relate to
export type ContentDomain =
  | "social_media"
  | "messaging"
  | "finance"
  | "shopping"
  | "travel"
  | "health"
  | "work"
  | "entertainment"
  | "daily_life"
  | "unknown";

// Interaction mode - what is the user doing
export type InteractionMode =
  | "content_browsing"
  | "content_posting"
  | "private_chat"
  | "group_chat"
  | "transaction"
  | "notification"
  | "profile_viewing"
  | "search_results"
  | "settings"
  | "unknown";

// Content format - how is content displayed
export type ContentFormat =
  | "single_image"
  | "grid_overview"
  | "feed_list"
  | "chat_thread"
  | "detail_page"
  | "full_screen"
  | "unknown";

// Subject relation - whose content is this
export type SubjectRelation =
  | "own_account"
  | "other_person"
  | "public_content"
  | "received_message"
  | "unknown";

// Detected context for a single image
export interface ImageContext {
  imageIndex: number;
  sourceType: {
    value: SourceType;
    confidence: number;
  };
  contentDomain: {
    value: ContentDomain;
    confidence: number;
    reasoning?: string;
  };
  interactionMode: {
    value: InteractionMode;
    confidence: number;
  };
  contentFormat: {
    value: ContentFormat;
    confidence: number;
  };
  subjectRelation: {
    value: SubjectRelation;
    confidence: number;
    reasoning?: string;
  };
  detectedApp?: {
    name: string;
    confidence: number;
    reasoning: string;
  };
  visibleText: {
    uiLanguage?: string;
    usernames: string[];
    timestamps: string[];
    keyLabels: string[];
    otherText: string[];
  };
  privacySensitivity: {
    level: "low" | "medium" | "high";
    flags: string[];
  };
}

// Context detection result for all images
export interface ContextDetectionResult {
  images: ImageContext[];
  summary: {
    dominantSourceType: SourceType;
    dominantDomain: ContentDomain;
    dominantFormat: ContentFormat;
    detectedUsernames: string[];
    detectedApps: string[];
    overallPrivacyLevel: "low" | "medium" | "high";
  };
}

// Known information provided by user
export interface KnownInfo {
  gender?: "male" | "female" | "other";
  username?: string;
  name?: string;
  ageRange?: string;
  nationality?: string;
  location?: string;
  occupation?: string;
  [key: string]: string | undefined;
}

// Meta file structure
export interface MetaFile {
  known?: KnownInfo;
  context?: ContextDetectionResult;
  notes?: string;
}

// Final output field with source tracking
export interface TrackedField<T> {
  value: T;
  source: "user_input" | "inferred" | "detected";
  confidence?: number;
  evidence?: string[];
}
