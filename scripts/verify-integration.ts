
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: '.env.local' });

async function main() {
    console.log('Starting integration verification...');

    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
        console.error('GOOGLE_CLOUD_PROJECT_ID not set');
        process.exit(1);
    }

    // Dynamic imports to ensure env vars are loaded first
    const { generateIconVariants } = await import('../src/lib/ai-icon-service');

    // 1. Create dummy SVGs (Complex Filled Shape with Negative Space)
    const svgs = [
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="black" stroke="none"/></svg>', // Donut (Circle with hole)
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h2v5zm4 0h-2V7h2v5z" fill="black" stroke="none"/></svg>', // Square with internal gaps
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" fill="black" stroke="none"/></svg>' // Rounded Square
    ];

    const buffers = svgs.map(s => Buffer.from(s));

    // 2. Generate icons (Analysis happens inside generateIconVariants now)
    console.log('Generating icons with Style-Aware Pipeline...');
    try {
        // Pass a library hint to test the new parameter
        const results = await generateIconVariants("A simple hexagon", buffers, undefined, 50, "Phosphor Icons");
        console.log(`Success! Generated ${results.length} icons.`);

        // Check if results are buffers
        if (results.length > 0 && Buffer.isBuffer(results[0])) {
            console.log('Result 0 size:', results[0].length);
        }

    } catch (error) {
        console.error('Verification failed!');
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        } else {
            console.error('Unknown error:', error);
        }
    }
}

main();
