import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Icon } from "@/types/schema";
import fs from 'fs';
import path from 'path';

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
            You are an icon metadata expert. I will provide a list of icons with their names and existing tags.
            For each icon, generate:
            1. A list of 3-5 relevant synonyms or related keywords (tags).
            2. A brief (1 sentence) business-context description of how this icon could be used in a UI (e.g., 'Used for analytics dashboards to represent growth').
            
            IMPORTANT: 
            - Do not use double quotes (") within the description string. Use single quotes (') instead.
            - Return ONLY valid JSON.
            - Do not include markdown formatting (no \`\`\`json ... \`\`\`).
            - Do not include any other text.

            Return the result as a JSON array where each object has:
            - id: The icon ID provided.
            - tags: Array of new tags (do not repeat existing ones if possible, but prioritize relevance).
            - description: The business context description.

            Input Icons:
            ${JSON.stringify(icons.map((i: Icon) => ({ id: i.id, name: i.name, tags: i.tags })))}
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
            return NextResponse.json({ data: enrichedData });
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
