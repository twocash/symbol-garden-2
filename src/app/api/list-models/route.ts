import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
    try {
        const { apiKey } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: "API Key is required" }, { status: 400 });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API request failed: ${error}`);
        }

        const data = await response.json();
        return NextResponse.json({ models: data.models || [] });
    } catch (error) {
        console.error("List Models Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
