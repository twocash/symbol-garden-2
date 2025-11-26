import { NextRequest, NextResponse } from 'next/server';
import { vectorizeImage } from '@/lib/ai-icon-service';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No image file provided' },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const strategy = (formData.get('strategy') as 'FILLED' | 'OUTLINED') || 'FILLED';
        const visualWeightStr = formData.get('visualWeight');
        const visualWeight = visualWeightStr ? parseFloat(visualWeightStr as string) : 10;

        const targetFillRatioStr = formData.get('targetFillRatio');
        const targetFillRatio = targetFillRatioStr ? parseFloat(targetFillRatioStr as string) : 0.85;

        const targetGridStr = formData.get('targetGrid');
        const targetGrid = targetGridStr ? parseFloat(targetGridStr as string) : 24;

        const svg = await vectorizeImage(buffer, strategy, { visualWeight, targetFillRatio, targetGrid });

        return NextResponse.json({ svg });
    } catch (error) {
        console.error('Vectorization error:', error);
        console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return NextResponse.json(
            { error: `Failed to vectorize image: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
