import { NextRequest, NextResponse } from 'next/server';
import { generateIconVariants } from '@/lib/ai-icon-service';
import { analyzeSvgStyle } from '@/lib/style-analysis';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const prompt = formData.get('prompt') as string;
        const files = formData.getAll('styleReferences') as File[];

        if (!prompt) {
            return NextResponse.json(
                { error: 'No prompt provided' },
                { status: 400 }
            );
        }

        if (!files || files.length === 0) {
            return NextResponse.json(
                { error: 'No style references provided' },
                { status: 400 }
            );
        }

        // Convert files to buffers
        const styleReferences = await Promise.all(
            files.map(async (file) => {
                const arrayBuffer = await file.arrayBuffer();
                return Buffer.from(arrayBuffer);
            })
        );

        // Compute style summary from the uploaded SVGs
        let styleSummary;
        try {
            const svgStrings = styleReferences.map(buf => buf.toString('utf-8'));
            styleSummary = await analyzeSvgStyle(svgStrings);
            console.log(`[API] Computed style summary from ${svgStrings.length} references. Confidence: ${styleSummary.confidenceScore}`);
        } catch (e) {
            console.warn('[API] Failed to compute style summary from references:', e);
            // Continue without style summary (will use fallback prompt)
        }

        // Extract library hint, guidanceScale, and useMetaPrompt from form data
        const libraryHint = formData.get('libraryHint') as string | undefined;
        const guidanceScaleStr = formData.get('guidanceScale') as string | undefined;
        const guidanceScale = guidanceScaleStr ? parseInt(guidanceScaleStr, 10) : 50;
        const useMetaPromptStr = formData.get('useMetaPrompt') as string | undefined;
        const useMetaPrompt = useMetaPromptStr === 'true';

        console.log('Starting icon generation with prompt:', prompt);
        console.log('[API] GuidanceScale:', guidanceScale);
        console.log('[API] UseMetaPrompt:', useMetaPrompt);
        const { images: generatedBuffers, strategy } = await generateIconVariants(prompt, styleReferences, styleSummary, 50, libraryHint, guidanceScale, useMetaPrompt);

        // Return images as base64 strings
        const images = generatedBuffers.map(buffer =>
            `data:image/png;base64,${buffer.toString('base64')}`
        );

        return NextResponse.json({ images, strategy });

    } catch (error) {
        console.error('Generation API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error message:', errorMessage);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

        return NextResponse.json(
            {
                error: 'Failed to generate icons',
                details: errorMessage,
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}
