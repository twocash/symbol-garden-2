import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Icon, SemanticCategory, GeometricTrait } from "@/types/schema";
import { indexIconComponents, IconComponent } from "@/lib/component-indexer";
import fs from 'fs';
import path from 'path';

// Helper to build full SVG from icon data
function buildFullSvg(icon: Icon): string {
    const viewBox = icon.viewBox || "0 0 24 24";
    const renderStyle = icon.renderStyle || "stroke";

    if (renderStyle === "stroke") {
        return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`;
    } else {
        return `<svg viewBox="${viewBox}" fill="currentColor"><path d="${icon.path}" ${icon.fillRule ? `fill-rule="${icon.fillRule}"` : ''} ${icon.clipRule ? `clip-rule="${icon.clipRule}"` : ''}/></svg>`;
    }
}

const LOG_FILE = path.join(process.cwd(), 'enrichment.log');

function log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message} ${data ? JSON.stringify(data) : ''}\n`;

    // Log to console
    if (message.toLowerCase().includes('error')) {
        console.error(message, data || '');
    } else {
        console.log(message, data || '');
    }

    // Log to file
    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (e) {
        console.error("Failed to write to log file", e);
    }
}

export async function POST(req: Request) {
    try {
        const { icons, apiKey } = await req.json();

        if (!apiKey) {
            log("Enrichment API: Missing API Key");
            return NextResponse.json({ error: "API Key is required" }, { status: 400 });
        }

        if (!icons || !Array.isArray(icons) || icons.length === 0) {
            log("Enrichment API: No icons provided");
            return NextResponse.json({ error: "No icons provided" }, { status: 400 });
        }

        log(`Enrichment API: Processing ${icons.length} icons`);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
You are an icon metadata expert analyzing SVG icons for a design system.
I will provide icons with their names, existing tags, AND their SVG code.

For each icon, analyze and extract:

1. SEMANTIC CATEGORY (choose exactly ONE):
   - "object": Real-world things (cup, headphones, rocket, umbrella, camera)
   - "action": Verbs/operations (download, upload, refresh, play, send)
   - "ui": Navigation/interface elements (arrow, chevron, menu, grid, sidebar)
   - "abstract": Symbols/concepts (warning, info, heart, star, check)

2. GEOMETRIC COMPLEXITY (1-5 integer):
   - 1: Single primitive (circle, square, line)
   - 2: Simple composition (house, file, envelope)
   - 3: Medium complexity (camera, shopping-cart, coffee)
   - 4: Complex with details (printer, microphone, calendar)
   - 5: Intricate/many elements (map, dashboard, browser)

3. GEOMETRIC TRAITS (list ALL that apply from this set):
   - "containment": Elements visually inside other elements (battery with bars, folder with document)
   - "intersection": Crossing or overlapping strokes (scissors, chain-link, crossed arrows)
   - "nested": Recursive or layered structure (stacked layers, grouped items)
   - "fine-detail": Small precise elements requiring careful placement (eye with pupil, toggle with dot)
   - "symmetry": Clear bilateral or radial symmetry
   - "open-path": Unclosed strokes that don't form closed shapes (checkmark, curved arrow)
   - "compound": Multiple disconnected shapes (ellipsis dots, signal bars, grid)

4. TAGS: 3-5 relevant synonyms/keywords (avoid repeating existing tags)

5. DESCRIPTION: Brief (1 sentence) business-context description

IMPORTANT:
- Analyze the ACTUAL SVG geometry, not just the name
- Do not use double quotes (") within description strings. Use single quotes (') instead.
- Return ONLY valid JSON array, no markdown formatting.
- geometricTraits should be an array (can be empty if none apply clearly)

Return JSON array:
[{
  "id": "icon-id",
  "tags": ["synonym1", "synonym2", "synonym3"],
  "description": "Business context description here",
  "semanticCategory": "object",
  "complexity": 3,
  "geometricTraits": ["symmetry", "compound"]
}]

Input Icons:
${JSON.stringify(icons.map((i: Icon) => ({
    id: i.id,
    name: i.name,
    tags: i.tags,
    svg: buildFullSvg(i)
})), null, 2)}
        `;

        log("Enrichment API: Sending request to Gemini...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        log("Enrichment API: Raw response from Gemini:", text);

        // Clean up markdown code blocks if present
        let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // Extract JSON array if there's extra text
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            cleanText = cleanText.substring(firstBracket, lastBracket + 1);
        }

        try {
            const enrichedData = JSON.parse(cleanText);
            log(`Enrichment API: Successfully parsed ${enrichedData.length} items`);

            // F3: Also index components for each icon (for Kitbash)
            // Run component indexing in parallel for all icons
            log(`Enrichment API: Indexing components for ${icons.length} icons...`);
            const componentPromises = icons.map((icon: Icon) =>
                indexIconComponents(icon, apiKey).catch(err => {
                    log(`Enrichment API: Component indexing failed for ${icon.name}:`, err);
                    return []; // Return empty array on error
                })
            );

            const componentResults = await Promise.all(componentPromises);

            // Merge component data into enriched results
            const enrichedWithComponents = enrichedData.map((item: any, index: number) => ({
                ...item,
                components: componentResults[index] || [],
                componentSignature: (componentResults[index] || [])
                    .map((c: IconComponent) => c.name.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    .sort()
                    .join('+'),
            }));

            log(`Enrichment API: Component indexing complete`);
            return NextResponse.json({ data: enrichedWithComponents });
        } catch (e) {
            log("Enrichment API: Failed to parse LLM response. Raw text:", text);
            log("Enrichment API: Parse error:", e);
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

    } catch (error) {
        log("Enrichment API Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
