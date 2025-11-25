
const http = require('http');
const fs = require('fs');
const path = require('path');

const boundary = '--------------------------' + Date.now().toString(16);

const postDataStart = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="prompt"',
    '',
    'Test Icon',
    `--${boundary}`,
    'Content-Disposition: form-data; name="libraryHint"',
    '',
    'Phosphor Icons',
    `--${boundary}`,
    'Content-Disposition: form-data; name="styleReferences"; filename="test.svg"',
    'Content-Type: image/svg+xml',
    '',
    '<svg><rect width="100" height="100" /></svg>',
    ''
].join('\r\n');

const postDataEnd = `\r\n--${boundary}--`;

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/generate',
    method: 'POST',
    headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': Buffer.byteLength(postDataStart) + Buffer.byteLength(postDataEnd)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk.substring(0, 100)}...`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(postDataStart);
req.write(postDataEnd);
req.end();
