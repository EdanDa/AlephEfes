import { t } from '../i18n/locale.js';
import integrity from './corpusIntegrity.json';

export const corpusUrl = (file) => `${import.meta.env.BASE_URL}corpus/${file}`;
const cache = new Map();
export async function verifyCorpusText(text, expectedHash) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== expectedHash) throw new Error(t('קובץ המקרא אינו תואם לגרסה המאומתת. נסו לטעון שוב או לרענן את האפליקציה.'));
}
function load(file) {
    if (!integrity.files[file]) return Promise.reject(new Error(t('קובץ מקרא לא מוכר')));
    if (!cache.has(file)) cache.set(file, (async () => {
        const response = await fetch(corpusUrl(file), { cache: 'no-cache' });
        if (!response.ok) throw new Error(t('טעינת המקרא נכשלה. בדקו את החיבור ונסו שוב.'));
        const text = await response.text();
        await verifyCorpusText(text, integrity.files[file]);
        return JSON.parse(text);
    })().catch((error) => { cache.delete(file); throw error; }));
    return cache.get(file);
}
export async function loadResearchManifest() {
    const manifest = await load('manifest.json');
    if (manifest.contentHash !== integrity.contentHash) throw new Error(t('גרסאות המקרא אינן תואמות'));
    return manifest;
}
export { load as loadVerifiedCorpusFile, loadResearchManifest as loadCorpusManifest };
