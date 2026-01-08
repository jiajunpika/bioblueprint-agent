declare module "exif-parser" {
  interface ExifTags {
    DateTimeOriginal?: number;
    CreateDate?: number;
    GPSLatitude?: number;
    GPSLongitude?: number;
    Make?: string;
    Model?: string;
    Orientation?: number;
    [key: string]: any;
  }

  interface ParseResult {
    tags: ExifTags;
    imageSize?: {
      width: number;
      height: number;
    };
    thumbnailOffset?: number;
    thumbnailLength?: number;
  }

  interface ExifParser {
    parse(): ParseResult;
  }

  function create(buffer: Buffer): ExifParser;

  export = { create };
}
