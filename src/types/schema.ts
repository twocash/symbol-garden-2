import { z } from "zod";

// Semantic categories for smart sample selection
export const SemanticCategorySchema = z.enum(['object', 'action', 'ui', 'abstract']);
export type SemanticCategory = z.infer<typeof SemanticCategorySchema>;

// Geometric traits for identifying edge cases
export const GeometricTraitSchema = z.enum([
  'containment',    // elements inside other elements (battery, folder)
  'intersection',   // crossing/overlapping strokes (scissors, link)
  'nested',         // recursive structure (folder in folder)
  'fine-detail',    // small precise elements (eye pupil, checkbox)
  'symmetry',       // bilateral or radial symmetry
  'open-path',      // unclosed strokes (check, arrow)
  'compound',       // multiple disconnected shapes
]);
export type GeometricTrait = z.infer<typeof GeometricTraitSchema>;

// AI-extracted metadata for smart sample selection
export const AiMetadataSchema = z.object({
  // Semantic Category (mutually exclusive)
  semanticCategory: SemanticCategorySchema,
  // Geometric Complexity (1-5 scale)
  complexity: z.number().min(1).max(5),
  // Geometric Characteristics (can have multiple)
  geometricTraits: z.array(GeometricTraitSchema),
  // Confidence that this classification is correct (0-1)
  confidence: z.number().min(0).max(1).default(0.8),
});
export type AiMetadata = z.infer<typeof AiMetadataSchema>;

export const IconSchema = z.object({
  id: z.string(),
  name: z.string(),
  library: z.string(),
  style: z.string().optional(),
  renderStyle: z.enum(["stroke", "fill"]).default("stroke").optional(),
  fillRule: z.string().optional(),
  clipRule: z.string().optional(),
  path: z.string(), // SVG path data
  viewBox: z.string().default("0 0 24 24"),
  tags: z.array(z.string()),
  categories: z.array(z.string()).optional(),
  synonyms: z.array(z.string()).optional(),
  aiDescription: z.string().optional(),
  // NEW: AI-extracted metadata for smart sample selection
  aiMetadata: AiMetadataSchema.optional(),
});

export type Icon = z.infer<typeof IconSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  primaryLibrary: z.string(),
  fallbackLibraries: z.array(z.string()),
  icons: z.record(z.string(), z.string()), // concept -> iconId mapping
  customIcons: z.array(IconSchema).default([]), // User-generated icons specific to this project
  favorites: z.array(z.string()),
  brandColor: z.string().default("#000000").optional(),
  secondaryColors: z.array(z.string()).optional(), // Additional brand colors for quick access
  exportSettings: z.object({
    format: z.enum(["svg", "png", "jsx"]).default("svg"),
    repoLink: z.string().optional(),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(), // Soft-delete support
});

export type Project = z.infer<typeof ProjectSchema>;

export const LibrarySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  license: z.string().optional(),
  // NEW: The "Geometric Autopsy" text block
  styleManifest: z.string().optional().describe("AI-generated technical analysis of the library's design system"),
});

export type Library = z.infer<typeof LibrarySchema>;
