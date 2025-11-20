import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Icon } from "@/types/schema";

export async function POST(req: Request) {
    try {
        const { icons, apiKey } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: "API Key is required" }, { status: 400 });
        }

        if (!icons || !Array.isArray(icons) || icons.length === 0) {
            return NextResponse.json({ error: "No icons provided" }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            You are an icon metadata expert. I will provide a list of icons with their names and existing tags.
            For each icon, generate:
            1. A list of 3-5 relevant synonyms or related keywords (tags).
            2. A brief (1 sentence) business-context description of how this icon could be used in a UI (e.g., "Used for analytics dashboards to represent growth").

            Return the result as a JSON array where each object has:
            - id: The icon ID provided.
            - tags: Array of new tags (do not repeat existing ones if possible, but prioritize relevance).
            - description: The business context description.

            Input Icons:
            ${JSON.stringify(icons.map((i: Icon) => ({ id: i.id, name: i.name, tags: i.tags })))}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const enrichedData = JSON.parse(cleanText);
            return NextResponse.json({ data: enrichedData });
        } catch (e) {
            console.error("Failed to parse LLM response:", text);
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

    } catch (error) {
        console.error("Enrichment API Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
