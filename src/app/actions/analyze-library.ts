"use server";

import { generateLibraryManifest } from "@/lib/style-analysis";
import { Icon } from "@/types/schema";

export async function analyzeLibrary(icons: Icon[], apiKey: string): Promise<string> {
    try {
        return await generateLibraryManifest(icons, apiKey);
    } catch (error) {
        console.error("Failed to analyze library:", error);
        return "";
    }
}
