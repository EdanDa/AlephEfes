import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile('public/corpus/manifest.json', 'utf8'));
const files = ['manifest.json', 'provenance.json', manifest.downloads.wordOccurrencesJson, ...manifest.divisions.flatMap((division) => division.books.map((book) => book.file))];
const hashes = Object.fromEntries(await Promise.all(files.map(async (file) => [file, createHash('sha256').update(await readFile(`public/corpus/${file}`)).digest('hex')])));
const output = `${JSON.stringify({ contentHash: manifest.contentHash, files: hashes }, null, 2)}\n`;
const path = 'src/core/corpusIntegrity.json';
if (process.argv.includes('--check')) {
    if (await readFile(path, 'utf8') !== output) throw new Error('Research integrity hashes need regeneration: node scripts/generate-research-integrity.mjs');
} else await writeFile(path, output);
