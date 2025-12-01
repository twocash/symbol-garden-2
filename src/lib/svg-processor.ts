/**
 * SVG Processor - The "Iron Dome" for SVG handling
 *
 * Part of Sprint 06: Stability & Polish
 *
 * Philosophy: All SVGs entering or exiting the system pass through ONE gateway.
 * This prevents ad-hoc fixes in individual components from breaking other flows.
 *
 * Two modes:
 * - 'ingest': Permissive - accept external icons as-is, optimize for size
 * - 'generate': Strict - enforce style DNA, preserve editability
 */

import { optimize, Config as SvgoConfig } from 'svgo';
import {
  enforceStyle,
  EnforcementRules,
  ComplianceResult,
  FEATHER_RULES,
} from './style-enforcer';
import { validateSvg, validateAndRepairPaths } from './svg-validator';

/**
 * Processing Mode:
 * - 'ingest': Importing an icon from external source. Be permissive, optimize for size.
 * - 'generate': Creating a new icon. Be strict, optimize for editability.
 */
export type ProcessingMode = 'ingest' | 'generate';

/**
 * The Style Profile - Runtime configuration for the Iron Dome.
 * Combines EnforcementRules with optimization constraints.
 */
export interface StyleProfile extends EnforcementRules {
  /** If false, keeps separate paths separate (critical for Kitbash) */
  allowPathMerging: boolean;
  /** If false, preserves <circle>, <rect> as primitives for editing */
  allowShapeToPath: boolean;
  /** Decimal places for coordinate precision */
  floatPrecision: number;
}

/**
 * Result of processing an SVG through the Iron Dome
 */
export interface ProcessResult {
  /** The processed SVG */
  svg: string;
  /** Was the SVG modified? */
  modified: boolean;
  /** Compliance result from style enforcement */
  compliance: ComplianceResult | null;
  /** Any warnings encountered */
  warnings: string[];
  /** Processing metrics */
  metrics: {
    originalSize: number;
    processedSize: number;
    processingTimeMs: number;
  };
}

/**
 * Default profile for GENERATED icons (Strict Mode)
 * Used when creating new icons via Sprout/Kitbash
 */
export const GENERATION_PROFILE: StyleProfile = {
  ...FEATHER_RULES,
  allowPathMerging: false,    // CRITICAL: Keep components separate!
  allowShapeToPath: false,    // CRITICAL: Keep primitives editable!
  floatPrecision: 2,
};

/**
 * Default profile for INGESTED icons (Permissive Mode)
 * Used when importing from GitHub, Iconify, or file uploads
 */
export const INGESTION_PROFILE: StyleProfile = {
  // Don't force style attributes on ingested icons
  strokeWidth: null,
  strokeLinecap: null,
  strokeLinejoin: null,
  viewBox: null,
  requireFillNone: false,     // Accept filled icons
  maxOpticalWeight: null,     // No weight warnings
  maxPathComplexity: null,    // No complexity warnings
  // Allow standard web optimizations
  allowPathMerging: true,
  allowShapeToPath: true,
  floatPrecision: 2,
};

/**
 * Create a custom profile from a library manifest
 */
export function createProfileFromRules(
  rules: EnforcementRules,
  mode: ProcessingMode
): StyleProfile {
  return {
    ...rules,
    allowPathMerging: mode === 'ingest',
    allowShapeToPath: mode === 'ingest',
    floatPrecision: 2,
  };
}

/**
 * The SVG Processor - Central gateway for all SVG operations
 */
export class SVGProcessor {
  /**
   * Process an SVG through the Iron Dome
   *
   * @param svg - Raw SVG string
   * @param mode - Processing mode ('ingest' or 'generate')
   * @param profile - Optional custom profile (uses defaults based on mode if not provided)
   * @returns ProcessResult with the processed SVG and metadata
   */
  static process(
    svg: string,
    mode: ProcessingMode = 'generate',
    profile?: StyleProfile
  ): ProcessResult {
    const startTime = performance.now();
    const originalSize = svg.length;
    const warnings: string[] = [];

    // Use provided profile or select default based on mode
    const activeProfile = profile || (mode === 'generate' ? GENERATION_PROFILE : INGESTION_PROFILE);

    let processedSvg = svg;
    let compliance: ComplianceResult | null = null;

    // =========================================================================
    // STAGE 1: SANITIZATION
    // Remove potentially dangerous content (scripts, events)
    // =========================================================================
    processedSvg = this.sanitize(processedSvg);

    // =========================================================================
    // STAGE 2: PATH SYNTAX REPAIR (generate mode only)
    // Fix common LLM path errors like "M6 6 12 12" -> "M6 6 L12 12"
    // Run BEFORE SVGO since malformed paths may cause SVGO to fail
    // =========================================================================
    if (mode === 'generate') {
      const pathRepair = validateAndRepairPaths(processedSvg, true);
      if (pathRepair.fixedSvg) {
        processedSvg = pathRepair.fixedSvg;
        warnings.push(...pathRepair.errors.map(e => `[path-repair] ${e.message}`));
      }
    }

    // =========================================================================
    // STAGE 3: NORMALIZATION
    // Convert style="" attributes to native SVG attributes
    // =========================================================================
    processedSvg = this.normalizeStyleAttributes(processedSvg);

    // =========================================================================
    // STAGE 4: STYLE ENFORCEMENT (generate mode only)
    // Apply style DNA rules BEFORE optimization so SVGO knows the context
    // =========================================================================
    if (mode === 'generate' && this.hasEnforcementRules(activeProfile)) {
      compliance = enforceStyle(processedSvg, activeProfile);
      processedSvg = compliance.autoFixed;

      if (!compliance.passed) {
        warnings.push(`Style enforcement applied ${compliance.changes.length} fix(es)`);
      }
    }

    // =========================================================================
    // STAGE 5: OPTIMIZATION
    // Run SVGO with mode-aware configuration
    // =========================================================================
    const svgoConfig = this.buildSvgoConfig(activeProfile, mode);
    try {
      const result = optimize(processedSvg, svgoConfig);
      if ('data' in result) {
        processedSvg = result.data;
      }
    } catch (error) {
      warnings.push(`SVGO optimization failed: ${error}`);
      // Continue with unoptimized SVG
    }

    // =========================================================================
    // STAGE 6: VALIDATION
    // Final bounds check and cleanup
    // =========================================================================
    const validation = validateSvg(processedSvg, {
      viewBoxSize: activeProfile.viewBox ? parseInt(activeProfile.viewBox.split(' ')[3]) : 24,
      autoFix: true,
    });

    if (validation.fixedSvg) {
      processedSvg = validation.fixedSvg;
    }

    // Collect validation issues as warnings
    if (validation.errors.length > 0) {
      warnings.push(...validation.errors.map(e => `[${e.type}] ${e.message}`));
    }
    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings.map(w => `[${w.type}] ${w.message}`));
    }

    const processingTimeMs = performance.now() - startTime;

    return {
      svg: processedSvg,
      modified: processedSvg !== svg,
      compliance,
      warnings,
      metrics: {
        originalSize,
        processedSize: processedSvg.length,
        processingTimeMs,
      },
    };
  }

  /**
   * Quick process for simple use cases - returns just the SVG string
   */
  static quick(svg: string, mode: ProcessingMode = 'generate'): string {
    return this.process(svg, mode).svg;
  }

  /**
   * Process with a specific library's rules
   */
  static processWithRules(
    svg: string,
    rules: EnforcementRules,
    mode: ProcessingMode = 'generate'
  ): ProcessResult {
    const profile = createProfileFromRules(rules, mode);
    return this.process(svg, mode, profile);
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Sanitize SVG - remove scripts, event handlers, and potentially dangerous content
   */
  private static sanitize(svg: string): string {
    return svg
      // Remove script tags
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      // Remove event handlers (onclick, onload, etc.)
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove javascript: URLs
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '')
      // Remove data: URLs in href (potential XSS vector)
      .replace(/href\s*=\s*["']data:[^"']*["']/gi, '')
      // Remove external entity references
      .replace(/<!ENTITY[^>]*>/gi, '')
      // Remove processing instructions except xml declaration
      .replace(/<\?(?!xml)[^?]*\?>/gi, '');
  }

  /**
   * Normalize inline style="" attributes to native SVG attributes
   * This makes subsequent regex-based processing more reliable
   */
  private static normalizeStyleAttributes(svg: string): string {
    // Match style="..." on any SVG element
    return svg.replace(
      /(<\w+[^>]*)\s+style\s*=\s*["']([^"']+)["']([^>]*>)/gi,
      (match, before, styleContent, after) => {
        // Parse the style content
        const styles = styleContent.split(';').filter(Boolean);
        const attrs: string[] = [];

        for (const style of styles) {
          const [prop, value] = style.split(':').map((s: string) => s.trim());
          if (prop && value) {
            // Convert CSS property to SVG attribute
            const attrName = prop.replace(/-([a-z])/g, (_: string, c: string) => c);
            // Only convert known SVG presentation attributes
            if (this.isSvgPresentationAttribute(prop)) {
              attrs.push(`${prop}="${value}"`);
            }
          }
        }

        // Add converted attributes
        if (attrs.length > 0) {
          return `${before} ${attrs.join(' ')}${after}`;
        }
        return `${before}${after}`;
      }
    );
  }

  /**
   * Check if a CSS property is a valid SVG presentation attribute
   */
  private static isSvgPresentationAttribute(prop: string): boolean {
    const presentationAttrs = new Set([
      'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
      'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'stroke-opacity',
      'fill-opacity', 'opacity', 'visibility', 'display', 'color',
      'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
    ]);
    return presentationAttrs.has(prop);
  }

  /**
   * Check if a profile has any enforcement rules set
   */
  private static hasEnforcementRules(profile: StyleProfile): boolean {
    return (
      profile.strokeWidth !== null ||
      profile.strokeLinecap !== null ||
      profile.strokeLinejoin !== null ||
      profile.viewBox !== null ||
      profile.requireFillNone
    );
  }

  /**
   * Build SVGO configuration based on profile and mode
   */
  private static buildSvgoConfig(profile: StyleProfile, mode: ProcessingMode): SvgoConfig {
    return {
      multipass: true,
      floatPrecision: profile.floatPrecision,
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              // ALWAYS keep the viewBox - critical for icon sizing
              removeViewBox: false,

              // Remove metadata and comments
              removeMetadata: true,
              removeComments: true,

              // MODE-DEPENDENT: Path Merging
              // In 'generate' mode, we DISABLE this to keep components separate
              // In 'ingest' mode, we allow it for size optimization
              mergePaths: profile.allowPathMerging,

              // MODE-DEPENDENT: Shape to Path conversion
              // In 'generate' mode, we DISABLE this to keep <circle>, <rect> editable
              // In 'ingest' mode, we allow it for consistency
              convertShapeToPath: profile.allowShapeToPath,

              // Always clean up IDs (but don't remove them entirely)
              cleanupIds: {
                remove: false,
                minify: true,
              },

              // Remove empty attributes
              removeEmptyAttrs: true,

              // Don't remove hidden elements (they might be intentional)
              removeHiddenElems: false,

              // Collapse groups where possible
              collapseGroups: true,
            },
          },
        } as any, // SVGO types are too strict for preset-default config

        // Precision control for coordinates
        {
          name: 'convertPathData',
          params: {
            floatPrecision: profile.floatPrecision,
            transformPrecision: profile.floatPrecision,
            // Don't aggressively convert to arcs - can lose precision
            makeArcs: undefined,
            noSpaceAfterFlags: true,
          },
        },

        // Clean up numeric values
        {
          name: 'cleanupNumericValues',
          params: {
            floatPrecision: profile.floatPrecision,
          },
        },

        // Sort attributes for consistency (helps with diffs)
        {
          name: 'sortAttrs',
        },

        // Remove useless stroke and fill when they're defaults
        {
          name: 'removeUselessStrokeAndFill',
          params: {
            // Don't remove stroke="none" or fill="none" - they're intentional in icons
            removeNone: false,
          },
        },
      ],
    };
  }
}

/**
 * Convenience function for processing generated SVGs
 */
export function processGeneratedSvg(svg: string, rules?: EnforcementRules): string {
  if (rules) {
    return SVGProcessor.processWithRules(svg, rules, 'generate').svg;
  }
  return SVGProcessor.quick(svg, 'generate');
}

/**
 * Convenience function for processing ingested SVGs
 */
export function processIngestedSvg(svg: string): string {
  return SVGProcessor.quick(svg, 'ingest');
}

/**
 * Format processing result for logging
 */
export function formatProcessResult(result: ProcessResult): string {
  const lines: string[] = [];

  const sizeChange = result.metrics.processedSize - result.metrics.originalSize;
  const sizePercent = ((sizeChange / result.metrics.originalSize) * 100).toFixed(1);
  const sign = sizeChange >= 0 ? '+' : '';

  lines.push(`[SVGProcessor] ${result.modified ? 'Modified' : 'Unchanged'}`);
  lines.push(`  Size: ${result.metrics.originalSize} → ${result.metrics.processedSize} (${sign}${sizePercent}%)`);
  lines.push(`  Time: ${result.metrics.processingTimeMs.toFixed(1)}ms`);

  if (result.compliance) {
    lines.push(`  Compliance: ${result.compliance.passed ? '✅ Pass' : '❌ Fail'} (${result.compliance.score}/100)`);
  }

  if (result.warnings.length > 0) {
    lines.push(`  Warnings:`);
    for (const w of result.warnings) {
      lines.push(`    ⚠️ ${w}`);
    }
  }

  return lines.join('\n');
}

// Re-export from svg-path-utils for backwards compatibility
// The actual implementation is in svg-path-utils.ts which is client-safe
export { extractCombinedPathData } from './svg-path-utils';
