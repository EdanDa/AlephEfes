import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DIST_PATH = path.join(REPO_ROOT, 'dist');
const CORPUS_PATH = path.join(DIST_PATH, 'corpus');
const INDEX_PATH = path.join(DIST_PATH, 'index.html');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(fs.existsSync(INDEX_PATH), 'dist/index.html is missing; run npm run build first');
assert(fs.existsSync(path.join(CORPUS_PATH, 'manifest.json')), 'dist/corpus/manifest.json is missing');
assert(fs.existsSync(path.join(CORPUS_PATH, 'aleph-efes-tanakh-corpus.json')), 'dist full-corpus JSON is missing');

const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
assert(!/corpus\//u.test(indexHtml), 'Initial HTML contains a corpus preload or request');

const entryMatches = [...indexHtml.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/gu)];
assert(entryMatches.length === 1, `Expected one entry script, found ${entryMatches.length}`);
const entryPath = path.join(DIST_PATH, entryMatches[0][1].replace(/^\//u, ''));
const entrySource = fs.readFileSync(entryPath, 'utf8');
assert(!entrySource.includes('sourceText'), 'Initial JavaScript bundle contains corpus records');
assert(!entrySource.includes('mam-parsed-plus-ketiv-sections'), 'Initial JavaScript bundle contains corpus provenance payload');

const assetsPath = path.join(DIST_PATH, 'assets');
const navigatorChunks = fs.readdirSync(assetsPath).filter((name) => /^TanakhNavigator-.*\.js$/u.test(name));
assert(navigatorChunks.length === 1, `Expected one lazy TanakhNavigator chunk, found ${navigatorChunks.length}`);
assert(!indexHtml.includes(navigatorChunks[0]), 'Tanakh navigator was preloaded in initial HTML');

const bookFiles = fs.readdirSync(path.join(CORPUS_PATH, 'books')).filter((name) => name.endsWith('.json'));
assert(bookFiles.length === 24, `Expected 24 external book files, found ${bookFiles.length}`);

const fullCorpus = JSON.parse(fs.readFileSync(path.join(CORPUS_PATH, 'aleph-efes-tanakh-corpus.json'), 'utf8'));
assert(fullCorpus.books.length === 24, `Expected 24 books in the full-corpus download, found ${fullCorpus.books.length}`);
assert(fullCorpus.provenance?.license?.corpus === 'CC-BY-SA-4.0', 'Full-corpus download is missing its corpus license');

process.stdout.write(`Verified external corpus: 24 book files, one full-corpus download, and one lazy navigator chunk are outside the initial bundle.\n`);
