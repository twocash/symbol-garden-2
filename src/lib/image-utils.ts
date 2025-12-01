/**
 * Image Utilities for Tracer Spike (Sprint 09-A)
 *
 * Provides client-side utilities for SVG-to-PNG conversion
 * and SVG reconstruction from Icon data.
 *
 * These utilities enable the "Structure Reference" feature where
 * a visual reference icon is converted to PNG for multimodal AI input.
 */

import { Icon } from '@/types/schema';

/**
 * Converts an SVG string to a PNG Blob for Vision model consumption.
 * Uses offscreen canvas for rasterization.
 *
 * @param svgString - Complete SVG markup
 * @param size - Output dimension (square), default 512px
 * @returns PNG Blob suitable for multimodal API
 */
export async function svgToPng(svgString: string, size: number = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Create an Image element to load the SVG
    const img = new Image();

    // Create a blob URL for the SVG
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Create canvas with specified size
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to get canvas 2D context'));
        return;
      }

      // Fill with white background (icons need contrast for vision model)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Calculate scaling to fit icon at 80% of canvas (10% padding on each side)
      const padding = size * 0.1;
      const drawSize = size * 0.8;

      // Draw the SVG image centered with padding
      ctx.drawImage(img, padding, padding, drawSize, drawSize);

      // Convert to PNG blob
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob from canvas'));
        }
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into image element'));
    };

    // Set crossOrigin to handle any CORS issues
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/**
 * Reconstructs a complete SVG string from Icon data.
 * Handles both svgContent (full) and path-only storage.
 *
 * @param icon - Icon object from database
 * @returns Complete SVG markup string
 */
export function reconstructSvg(icon: Icon): string {
  const viewBox = icon.viewBox || '0 0 24 24';
  const renderStyle = icon.renderStyle || 'stroke';

  // Base SVG attributes
  const svgAttrs = [
    'xmlns="http://www.w3.org/2000/svg"',
    `viewBox="${viewBox}"`,
    'width="24"',
    'height="24"',
  ];

  // Add style-specific attributes
  // Use black (#000000) instead of currentColor for PNG rendering
  if (renderStyle === 'stroke') {
    svgAttrs.push(
      'fill="none"',
      'stroke="#000000"',
      'stroke-width="2"',
      'stroke-linecap="round"',
      'stroke-linejoin="round"'
    );
  } else {
    svgAttrs.push(
      'fill="#000000"',
      'stroke="none"'
    );
  }

  // Determine the inner content
  let innerContent: string;

  if (icon.svgContent) {
    // Use full SVG content if available (preserves transforms, groups, etc.)
    innerContent = icon.svgContent;
  } else if (icon.path) {
    // Fall back to path-only reconstruction
    const pathAttrs: string[] = [`d="${icon.path}"`];

    // Add fill-rule if specified
    if (icon.fillRule) {
      pathAttrs.push(`fill-rule="${icon.fillRule}"`);
    }

    // Add clip-rule if specified
    if (icon.clipRule) {
      pathAttrs.push(`clip-rule="${icon.clipRule}"`);
    }

    innerContent = `<path ${pathAttrs.join(' ')} />`;
  } else {
    // No content available, return empty SVG
    innerContent = '';
  }

  return `<svg ${svgAttrs.join(' ')}>${innerContent}</svg>`;
}

/**
 * Converts an SVG string to a base64 data URL.
 * Useful for inline embedding or preview purposes.
 *
 * @param svgString - Complete SVG markup
 * @returns Data URL string (data:image/svg+xml;base64,...)
 */
export function svgToDataUrl(svgString: string): string {
  const encoded = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * Converts a PNG Blob to a base64 string for API transmission.
 *
 * @param blob - PNG Blob from svgToPng()
 * @returns Base64 encoded string (without data URL prefix)
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 content
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
