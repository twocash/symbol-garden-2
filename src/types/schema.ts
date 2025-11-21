import { z } from "zod";

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
});

export type Icon = z.infer<typeof IconSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  primaryLibrary: z.string(),
  fallbackLibraries: z.array(z.string()),
  icons: z.record(z.string(), z.string()), // concept -> iconId mapping
  favorites: z.array(z.string()),
  brandColor: z.string().default("#000000").optional(),
  exportSettings: z.object({
    format: z.enum(["svg", "png", "jsx"]).default("svg"),
    repoLink: z.string().optional(),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const LibrarySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  license: z.string().optional(),
});

export type Library = z.infer<typeof LibrarySchema>;
