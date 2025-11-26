import { VertexAI } from '@google-cloud/vertexai';

const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = 'us-central1';
const JURY_MODEL = 'gemini-2.0-flash-exp'; // Align with AI Icon Service analysis model

export interface ScoredCandidate {
    buffer: Buffer;
    score: number;
    reasoning: string;
    index: number;
}

export class StyleJuryService {
    private vertexAI: VertexAI;
    private model: any;

    constructor() {
        if (!project) {
            console.warn("StyleJuryService: GOOGLE_CLOUD_PROJECT_ID not set. Jury will be disabled.");
        }
        this.vertexAI = new VertexAI({ project: project || 'demo', location });
        this.model = this.vertexAI.getGenerativeModel({ model: JURY_MODEL });
    }

    /**
     * Evaluates a batch of candidates against seed icons.
     * Returns the top survivors based on style similarity.
     * FAILSAFE: Always returns at least 2 candidates.
     */
    async evaluateCandidates(candidates: Buffer[], seeds: Buffer[]): Promise<ScoredCandidate[]> {
        if (!project || candidates.length === 0) {
            // Pass-through if no project or no candidates
            return candidates.map((buf, i) => ({ buffer: buf, score: 10, reasoning: "Jury Disabled", index: i }));
        }

        console.log(`[StyleJury] ⚖️ Convening the Tribunal for ${candidates.length} candidates...`);

        try {
            // 1. Prepare Inputs
            const seedParts = seeds.map((buf, i) => ({
                inlineData: { mimeType: 'image/png', data: buf.toString('base64') }
            }));

            const candidateParts = candidates.map((buf, i) => ({
                inlineData: { mimeType: 'image/png', data: buf.toString('base64') }
            }));

            // 2. Construct the Prompt
            const prompt = `
                You are a Senior Design Director for a strict icon system.
                
                CONTEXT:
                - The first ${seeds.length} images are the "REFERENCE SEEDS" (The Truth).
                - The next ${candidates.length} images are "CANDIDATES" (Generated).
                
                TASK:
                Evaluate each CANDIDATE against the REFERENCE SEEDS.
                Score each candidate from 0-10 on "Style Match".
                
                🚨 IMMEDIATE DISQUALIFICATION (THE KILL LIST) 🚨
                If a candidate violates ANY of these, score it 0/10 immediately:
                1.  **SHADOWS**: Any drop shadow, gradient, or shading. (Must be flat).
                2.  **COLOR**: Any pixel that is not Black (#000000) or White (#FFFFFF).
                3.  **3D/PERSPECTIVE**: Isometric views or 3D rendering. (Must be flat 2D).
                4.  **FILLED SHAPES**: Solid fills where the seeds are outlined.
                
                CRITERIA (If surviving the Kill List):
                - Stroke Width: Must match exactly.
                - Corner Radius: Must match exactly.
                - Complexity: Must be similar.
                - Vibe: Must feel like it belongs in the same set.
                
                OUTPUT FORMAT:
                Return a JSON array of objects:
                [
                    { "index": 0, "score": 8, "reasoning": "Good match" },
                    { "index": 1, "score": 0, "reasoning": "VIOLATION: Has drop shadow" }
                ]
                The "index" corresponds to the order of the CANDIDATES (0 to ${candidates.length - 1}).
                RETURN ONLY JSON.
            `;

            const parts = [
                { text: "REFERENCE SEEDS:" },
                ...seedParts,
                { text: "CANDIDATES:" },
                ...candidateParts,
                { text: prompt }
            ];

            // 3. Call Gemini
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts }],
                generationConfig: { responseMimeType: "application/json" }
            });

            const responseText = result.response.candidates?.[0].content.parts[0].text || "[]";
            const evaluations = JSON.parse(responseText);

            // 4. Map Scores to Buffers
            const scoredCandidates: ScoredCandidate[] = evaluations.map((evalItem: any) => {
                const idx = evalItem.index;
                if (idx >= 0 && idx < candidates.length) {
                    return {
                        buffer: candidates[idx],
                        score: evalItem.score,
                        reasoning: evalItem.reasoning,
                        index: idx
                    };
                }
                return null;
            }).filter((item: any) => item !== null);

            // 5. Sort by Score (Descending)
            scoredCandidates.sort((a, b) => b.score - a.score);

            console.log("[StyleJury] 📊 Verdicts:", scoredCandidates.map(c => `#${c.index}: ${c.score}/10 (${c.reasoning})`).join("\n"));

            // 6. Apply Failsafe (Return Top 2 regardless of score)
            // If we have valid scores, filter by threshold (e.g. > 6), but ensure at least 2 survive.
            const threshold = 6;
            const survivors = scoredCandidates.filter(c => c.score >= threshold);

            if (survivors.length < 2) {
                console.log("[StyleJury] ⚠️ Hung Jury! Enforcing Failsafe (Returning Top 2).");
                return scoredCandidates.slice(0, 2);
            }

            return survivors;

        } catch (error) {
            console.error("[StyleJury] 💥 Error during deliberation:", error);
            // Failsafe: Return top 2 candidates (or all if < 2) assuming first ones are best guess
            return candidates.slice(0, 2).map((buf, i) => ({ buffer: buf, score: 5, reasoning: "Jury Error", index: i }));
        }
    }
}
