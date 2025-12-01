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

// Component categories for Sprout Engine (F3)
export const ComponentCategorySchema = z.enum([
  'body',        // Main shape (user torso, document rectangle)
  'head',        // Top element (user head, arrow point)
  'modifier',    // Badge, indicator, status symbol
  'container',   // Enclosing shape (circle, shield, square)
  'indicator',   // Check, x, plus, minus, arrow
  'detail',      // Internal lines, decorative elements
  'connector',   // Lines joining other elements
]);
export type ComponentCategory = z.infer<typeof ComponentCategorySchema>;

// Sprint 07: Geometric topology for Kitbash "Blueprint" matching
// Describes the visual SHAPE of a component, independent of its semantic meaning
// Example: A battery body, mic body, and rocket fuselage are all "capsule" shapes
export const GeometricTypeSchema = z.enum([
  'circle',      // Perfect circle or ring
  'square',      // Equal sides, sharp or rounded corners
  'rect',        // Non-square rectangle
  'capsule',     // Pill shape (rounded rectangle with semicircle ends)
  'triangle',    // Three-sided polygon
  'line',        // Straight stroke
  'curve',       // Simple arc or squiggle
  'L-shape',     // 90-degree bend
  'U-shape',     // Open container/cup shape
  'cross',       // Plus or X shape
  'complex',     // Irregular or detailed shape (fallback)
]);
export type GeometricType = z.infer<typeof GeometricTypeSchema>;

// Bounding box for component positioning
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  centerX: z.number(),
  centerY: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

// A discrete visual component within an icon (Sprout Engine F3)
// Sprint 07: Added geometricType for Blueprint Protocol matching
export const IconComponentSchema = z.object({
  name: z.string(),
  category: ComponentCategorySchema,
  geometricType: GeometricTypeSchema.default('complex'), // Sprint 07: Shape classification
  pathData: z.string(),
  elementType: z.enum(['path', 'circle', 'rect', 'line', 'polyline', 'ellipse']),
  boundingBox: BoundingBoxSchema,
  semanticTags: z.array(z.string()),
  sourceIcon: z.string(),
  weight: z.number().min(0).max(1),
});
export type IconComponent = z.infer<typeof IconComponentSchema>;

// Sprint 07: Index result for component lookups
export interface IconComponentIndex {
  iconId: string;
  iconName: string;
  components: IconComponent[];
  componentSignature: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

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
  path: z.string(), // SVG path data (for simple icons)
  // Sprint 07: Full SVG inner content for complex/kitbashed icons with transforms
  // When present, this takes precedence over 'path' for rendering
  svgContent: z.string().optional(),
  viewBox: z.string().default("0 0 24 24"),
  tags: z.array(z.string()),
  categories: z.array(z.string()).optional(),
  synonyms: z.array(z.string()).optional(),
  aiDescription: z.string().optional(),
  // NEW: AI-extracted metadata for smart sample selection
  aiMetadata: AiMetadataSchema.optional(),
  // Sprout Engine F3: Semantic component breakdown
  components: z.array(IconComponentSchema).optional(),
  componentSignature: z.string().optional(), // Quick signature for matching (e.g., "user-body+user-head")
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
