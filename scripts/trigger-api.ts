
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function main() {
    console.log('Triggering API at http://localhost:3000/api/generate...');

    const form = new FormData();
    form.append('prompt', 'A simple test icon');

    // Create a dummy SVG file
    const dummySvg = '<svg><rect width="100" height="100" /></svg>';
    const buffer = Buffer.from(dummySvg);

    form.append('styleReferences', buffer, {
        filename: 'test.svg',
        contentType: 'image/svg+xml',
    });

    form.append('libraryHint', 'Phosphor Icons');

    try {
        const response = await fetch('http://localhost:3000/api/generate', {
            method: 'POST',
            body: form
        });

        if (response.ok) {
            console.log('API call successful!');
            const data = await response.json();
            console.log('Response:', JSON.stringify(data).substring(0, 100) + '...');
        } else {
            console.error('API call failed:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response body:', text);
        }
    } catch (error) {
        console.error('Error triggering API:', error);
    }
}

main();
