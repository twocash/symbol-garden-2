import { NextRequest, NextResponse } from 'next/server';
import { generateIconVariants } from '@/lib/ai-icon-service';

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

        console.log('Starting icon generation with prompt:', prompt);
        const generatedBuffers = await generateIconVariants(prompt, styleReferences);

        // Return images as base64 strings
        const images = generatedBuffers.map(buffer =>
            `data:image/png;base64,${buffer.toString('base64')}`
        );

        return NextResponse.json({ images });

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
