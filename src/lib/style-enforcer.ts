/**
 * Style Enforcer - Deterministic SVG mutation for guaranteed style compliance
 *
 * Part of the Sprout Engine (F1)
 *
 * Philosophy: Don't hope the generated SVG matches the library style - FORCE it.
 * This module turns passive style analysis into active enforcement.
 *
 * A "sprout" passes if a designer cannot distinguish it from native library icons.
 * We achieve this by mathematically guaranteeing style attribute compliance.
 */

import { StyleSpec, parseStyleDNA } from './svg-prompt-builder';

/**
 * Result of style compliance check
 */
export interface ComplianceResult {
  /** Did the SVG pass all error-level rules? */
  passed: boolean;
  /** Compliance score 0-100 */
  score: number;
  /** List of rule violations */
  violations: StyleViolation[];
  /** The corrected SVG (always provided, may be unchanged) */
  autoFixed: string;
  /** What was modified during auto-fix */
  changes: StyleChange[];
}

/**
 * A rule violation found during compliance check
 */
export interface StyleViolation {
  /** Which rule was violated */
  rule: StyleRule;
  /** Expected value */
  expected: string;
  /** Actual value found */
  actual: string;
  /** Error = must fix, Warning = should fix */
  severity: 'error' | 'warning';
  /** Can this be auto-fixed? */
  autoFixable: boolean;
  /** Which element/path (if applicable) */
  location?: string;
}

/**
 * A change made during auto-fix
 */
export interface StyleChange {
  /** Which attribute was changed */
  attribute: string;
  /** Value before fix */
  before: string;
  /** Value after fix */
  after: string;
  /** Why this change was made */
  reason: string;
}

/**
 * Rules that can be enforced
 */
export type StyleRule =
  | 'stroke-width'
  | 'stroke-linecap'
  | 'stroke-linejoin'
  | 'fill'
  | 'viewBox'
  | 'optical-weight'
  | 'path-complexity'
  | 'element-fill';

/**
 * Enforcement rules configuration
 */
export interface EnforcementRules {
  strokeWidth: number | null;
  strokeLinecap: 'butt' | 'round' | 'square' | null;
  strokeLinejoin: 'miter' | 'round' | 'bevel' | null;
  viewBox: string | null;
  /** Should all elements have fill="none"? (for stroke-based icons) */
  requireFillNone: boolean;
  /** Maximum path density (0-1) before warning */
  maxOpticalWeight: number | null;
  /** Maximum commands per path before warning */
  maxPathComplexity: number | null;
}

/**
 * Extract stroke-width from SVG (checks root element and common patterns)
 */
function extractStrokeWidth(svg: string): number | null {
  // Check root SVG element
  const rootMatch = svg.match(/<svg[^>]*stroke-width\s*=\s*["']([^"']+)["']/);
  if (rootMatch) {
    return parseFloat(rootMatch[1]);
  }

  // Check for stroke-width in a <g> wrapper
  const gMatch = svg.match(/<g[^>]*stroke-width\s*=\s*["']([^"']+)["']/);
  if (gMatch) {
    return parseFloat(gMatch[1]);
  }

  // Check first path/element with stroke-width
  const elementMatch = svg.match(/stroke-width\s*=\s*["']([^"']+)["']/);
  if (elementMatch) {
    return parseFloat(elementMatch[1]);
  }

  return null;
}

/**
 * Extract stroke-linecap from SVG
 */
function extractLinecap(svg: string): string | null {
  const match = svg.match(/stroke-linecap\s*=\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Extract stroke-linejoin from SVG
 */
function extractLinejoin(svg: string): string | null {
  const match = svg.match(/stroke-linejoin\s*=\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Extract viewBox from SVG
 */
function extractViewBox(svg: string): string | null {
  const match = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Count path commands to estimate complexity
 */
function countPathCommands(svg: string): number {
  const pathMatches = svg.matchAll(/d\s*=\s*["']([^"']+)["']/g);
  let totalCommands = 0;

  for (const match of pathMatches) {
    const d = match[1];
    // Count command letters (M, L, C, etc.)
    const commands = d.match(/[MLHVCSQTAZmlhvcsqtaz]/g);
    totalCommands += commands?.length || 0;
  }

  return totalCommands;
}

/**
 * Estimate optical weight (path density) - rough approximation
 * Higher value = more dense/heavy looking icon
 */
function estimateOpticalWeight(svg: string): number {
  const pathMatches = svg.matchAll(/d\s*=\s*["']([^"']+)["']/g);
  let totalLength = 0;

  for (const match of pathMatches) {
    // Use path string length as rough proxy for visual weight
    totalLength += match[1].length;
  }

  // Normalize to 0-1 range (typical icons have 100-500 chars of path data)
  return Math.min(1, totalLength / 1000);
}

/**
 * Find elements that have fill set to something other than "none"
 */
function findFilledElements(svg: string): string[] {
  const filled: string[] = [];
  const shapeElements = ['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline'];

  for (const element of shapeElements) {
    const regex = new RegExp(`<${element}[^>]*>`, 'g');
    const matches = svg.matchAll(regex);

    for (const match of matches) {
      const elementStr = match[0];
      // Check if has fill that's NOT "none"
      const fillMatch = elementStr.match(/fill\s*=\s*["']([^"']+)["']/);
      if (fillMatch && fillMatch[1] !== 'none') {
        filled.push(`${element} (fill="${fillMatch[1]}")`);
      } else if (!fillMatch) {
        // No fill attribute - might inherit a fill
        // Only flag if SVG root doesn't have fill="none"
        if (!/<svg[^>]*fill\s*=\s*["']none["']/.test(svg)) {
          filled.push(`${element} (no fill attribute)`);
        }
      }
    }
  }

  return filled;
}

/**
 * Replace or add an attribute on the root <svg> element
 */
function setRootAttribute(svg: string, attr: string, value: string | number): string {
  const attrPattern = new RegExp(`(<svg[^>]*?)\\s*${attr}\\s*=\\s*["'][^"']*["']`, 'i');

  if (attrPattern.test(svg)) {
    // Replace existing attribute
    return svg.replace(attrPattern, `$1 ${attr}="${value}"`);
  } else {
    // Add new attribute after <svg
    return svg.replace(/<svg/, `<svg ${attr}="${value}"`);
  }
}

/**
 * Ensure all shape elements have fill="none"
 */
function ensureAllFillNone(svg: string): { svg: string; changedCount: number } {
  const shapeElements = ['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'line'];
  let result = svg;
  let changedCount = 0;

  for (const element of shapeElements) {
    const regex = new RegExp(`<${element}([^>]*?)(/?)>`, 'g');

    result = result.replace(regex, (match, attrs, selfClose) => {
      // Check if already has fill="none"
      if (/fill\s*=\s*["']none["']/.test(attrs)) {
        return match;
      }

      changedCount++;

      // Check if has any fill attribute
      if (/fill\s*=/.test(attrs)) {
        // Replace existing fill with none
        const newAttrs = attrs.replace(/fill\s*=\s*["'][^"']*["']/, 'fill="none"');
        return `<${element}${newAttrs}${selfClose}>`;
      }

      // Add fill="none"
      return `<${element}${attrs} fill="none"${selfClose}>`;
    });
  }

  return { svg: result, changedCount };
}

/**
 * Enforce style rules on an SVG, returning corrected version and compliance report
 */
export function enforceStyle(
  svg: string,
  rules: EnforcementRules
): ComplianceResult {
  const violations: StyleViolation[] = [];
  const changes: StyleChange[] = [];
  let fixedSvg = svg;

  // 1. Stroke Width Enforcement
  if (rules.strokeWidth !== null) {
    const actualWidth = extractStrokeWidth(svg);
    if (actualWidth !== rules.strokeWidth) {
      violations.push({
        rule: 'stroke-width',
        expected: String(rules.strokeWidth),
        actual: actualWidth !== null ? String(actualWidth) : 'not set',
        severity: 'error',
        autoFixable: true,
      });

      // Fix: set/replace stroke-width on root
      const before = actualWidth !== null ? String(actualWidth) : 'not set';
      fixedSvg = setRootAttribute(fixedSvg, 'stroke-width', rules.strokeWidth);

      changes.push({
        attribute: 'stroke-width',
        before,
        after: String(rules.strokeWidth),
        reason: 'Library standard enforcement',
      });
    }
  }

  // 2. Stroke Linecap Enforcement
  if (rules.strokeLinecap !== null) {
    const actualCap = extractLinecap(svg);
    if (actualCap !== rules.strokeLinecap) {
      violations.push({
        rule: 'stroke-linecap',
        expected: rules.strokeLinecap,
        actual: actualCap || 'not set',
        severity: 'error',
        autoFixable: true,
      });

      const before = actualCap || 'not set';
      fixedSvg = setRootAttribute(fixedSvg, 'stroke-linecap', rules.strokeLinecap);

      changes.push({
        attribute: 'stroke-linecap',
        before,
        after: rules.strokeLinecap,
        reason: 'Library standard enforcement',
      });
    }
  }

  // 3. Stroke Linejoin Enforcement
  if (rules.strokeLinejoin !== null) {
    const actualJoin = extractLinejoin(svg);
    if (actualJoin !== rules.strokeLinejoin) {
      violations.push({
        rule: 'stroke-linejoin',
        expected: rules.strokeLinejoin,
        actual: actualJoin || 'not set',
        severity: 'error',
        autoFixable: true,
      });

      const before = actualJoin || 'not set';
      fixedSvg = setRootAttribute(fixedSvg, 'stroke-linejoin', rules.strokeLinejoin);

      changes.push({
        attribute: 'stroke-linejoin',
        before,
        after: rules.strokeLinejoin,
        reason: 'Library standard enforcement',
      });
    }
  }

  // 4. ViewBox Enforcement
  if (rules.viewBox !== null) {
    const actualViewBox = extractViewBox(svg);
    if (actualViewBox !== rules.viewBox) {
      violations.push({
        rule: 'viewBox',
        expected: rules.viewBox,
        actual: actualViewBox || 'not set',
        severity: 'error',
        autoFixable: true,
      });

      const before = actualViewBox || 'not set';
      fixedSvg = setRootAttribute(fixedSvg, 'viewBox', rules.viewBox);

      changes.push({
        attribute: 'viewBox',
        before,
        after: rules.viewBox,
        reason: 'Library standard enforcement',
      });
    }
  }

  // 5. Fill="none" Enforcement (for stroke-based icons)
  if (rules.requireFillNone) {
    const filledElements = findFilledElements(svg);
    if (filledElements.length > 0) {
      violations.push({
        rule: 'element-fill',
        expected: 'fill="none" on all elements',
        actual: `${filledElements.length} elements with fill`,
        severity: 'error',
        autoFixable: true,
        location: filledElements.slice(0, 3).join(', '),
      });

      const result = ensureAllFillNone(fixedSvg);
      fixedSvg = result.svg;

      // Also ensure root has fill="none"
      if (!/<svg[^>]*fill\s*=\s*["']none["']/.test(fixedSvg)) {
        fixedSvg = setRootAttribute(fixedSvg, 'fill', 'none');
      }

      changes.push({
        attribute: 'fill',
        before: `${filledElements.length} non-none fills`,
        after: 'all fill="none"',
        reason: 'Stroke-only icon enforcement',
      });
    }
  }

  // 6. Optical Weight Check (warning only - cannot auto-fix)
  if (rules.maxOpticalWeight !== null) {
    const weight = estimateOpticalWeight(svg);
    if (weight > rules.maxOpticalWeight) {
      violations.push({
        rule: 'optical-weight',
        expected: `<${rules.maxOpticalWeight.toFixed(2)}`,
        actual: weight.toFixed(2),
        severity: 'warning',
        autoFixable: false,
      });
    }
  }

  // 7. Path Complexity Check (warning only - cannot auto-fix)
  if (rules.maxPathComplexity !== null) {
    const complexity = countPathCommands(svg);
    if (complexity > rules.maxPathComplexity) {
      violations.push({
        rule: 'path-complexity',
        expected: `<${rules.maxPathComplexity} commands`,
        actual: `${complexity} commands`,
        severity: 'warning',
        autoFixable: false,
      });
    }
  }

  // Calculate score
  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;
  const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));

  return {
    passed: errorCount === 0,
    score,
    violations,
    autoFixed: fixedSvg,
    changes,
  };
}

/**
 * Extract enforcement rules from Style DNA / StyleSpec
 */
export function rulesFromStyleDNA(styleSpec: StyleSpec): EnforcementRules {
  return {
    strokeWidth: styleSpec.strokeWidth || null,
    strokeLinecap: styleSpec.strokeLinecap || null,
    strokeLinejoin: styleSpec.strokeLinejoin || null,
    viewBox: styleSpec.viewBoxSize ? `0 0 ${styleSpec.viewBoxSize} ${styleSpec.viewBoxSize}` : null,
    requireFillNone: true, // Stroke-based icons should have fill="none"
    maxOpticalWeight: 0.5, // Default threshold for "too dense"
    maxPathComplexity: 50, // Default threshold for "too complex"
  };
}

/**
 * Create enforcement rules from a style manifest string
 */
export function rulesFromManifest(manifest: string): EnforcementRules {
  const styleSpec = parseStyleDNA(manifest);
  return rulesFromStyleDNA(styleSpec);
}

/**
 * Quick compliance check - just returns pass/fail without fixing
 */
export function checkCompliance(svg: string, rules: EnforcementRules): boolean {
  const result = enforceStyle(svg, rules);
  return result.passed;
}

/**
 * Format compliance result for logging
 */
export function formatComplianceResult(result: ComplianceResult): string {
  const lines: string[] = [];

  const status = result.passed ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
  lines.push(`${status} (Score: ${result.score}/100)`);

  if (result.violations.length > 0) {
    lines.push('');
    lines.push('Violations:');
    for (const v of result.violations) {
      const icon = v.severity === 'error' ? '🔴' : '🟡';
      const fix = v.autoFixable ? ' [auto-fixed]' : '';
      lines.push(`  ${icon} ${v.rule}: expected ${v.expected}, got ${v.actual}${fix}`);
    }
  }

  if (result.changes.length > 0) {
    lines.push('');
    lines.push('Changes applied:');
    for (const c of result.changes) {
      lines.push(`  • ${c.attribute}: "${c.before}" → "${c.after}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Default rules for Feather-style libraries
 */
export const FEATHER_RULES: EnforcementRules = {
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  requireFillNone: true,
  maxOpticalWeight: 0.4,
  maxPathComplexity: 40,
};

/**
 * Default rules for Tabler-style libraries
 */
export const TABLER_RULES: EnforcementRules = {
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  requireFillNone: true,
  maxOpticalWeight: 0.5,
  maxPathComplexity: 60,
};

/**
 * Default rules for Lucide-style libraries
 */
export const LUCIDE_RULES: EnforcementRules = {
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  requireFillNone: true,
  maxOpticalWeight: 0.4,
  maxPathComplexity: 45,
};
