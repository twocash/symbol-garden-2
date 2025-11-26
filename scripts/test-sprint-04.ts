import { generateIconVariants } from '../src/lib/ai-icon-service';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function runTest() {
    console.log("🧪 Starting Sprint 04 Verification Test...");

    // 1. Create a mock seed icon (24px black square)
    const seedBuffer = await sharp({
        create: {
            width: 1024,
            height: 1024,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    })
        .composite([{
            input: Buffer.from(`<svg width="1024" height="1024"><rect x="100" y="100" width="824" height="824" stroke="black" stroke-width="40" fill="none"/></svg>`),
            blend: 'over'
        }])
        .png()
        .toBuffer();

    console.log("✅ Created mock seed icon.");

    try {
        // 2. Run Generation Pipeline
        console.log("🚀 Calling generateIconVariants (Expect 2 parallel batches + Jury)...");
        const result = await generateIconVariants(
            "simple square box",
            [seedBuffer],
            undefined, // styleSummary
            50, // strictness
            "Lineicons",
            50, // guidance
            true // useMetaPrompt
        );

        console.log(`✅ Generation Complete!`);
        console.log(`📊 Survivors: ${result.images.length}`);
        console.log(`🎯 Strategy: ${result.strategy}`);
        console.log(`📏 Grid: ${result.targetGrid}`);

        // 3. Save Survivors
        const outDir = path.join(__dirname, '../out-test-sprint-04');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

        for (let i = 0; i < result.images.length; i++) {
            const filename = path.join(outDir, `survivor-${i}.png`);
            fs.writeFileSync(filename, result.images[i]);
            console.log(`💾 Saved: ${filename}`);
        }

        if (result.images.length >= 2) {
            console.log("✅ PASS: At least 2 survivors returned (Failsafe working).");
        } else {
            console.error("❌ FAIL: Fewer than 2 survivors returned.");
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ Test Failed:", error);
        process.exit(1);
    }
}

runTest();
