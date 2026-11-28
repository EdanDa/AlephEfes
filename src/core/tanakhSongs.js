import chapterRanges from './poetryChapterRanges.json' with { type: 'json' };
import { getLanguage, t, translateLabel } from '../i18n/locale.js';

const namedPassages = [
    { id: 'sea', title: 'שירת הים', aliases: ['אז ישיר', 'שירת משה'], book: 'שמות', bookSlug: 'exodus',
        chapter: 15, firstVerse: 1, lastVerse: 19, ordinal: 42, endOrdinal: 85 },
    { id: 'haazinu', title: 'האזינו', aliases: ['שירת האזינו', 'שירת משה'], book: 'דברים', bookSlug: 'deuteronomy',
        chapter: 32, firstVerse: 1, lastVerse: 43, ordinal: 147, endOrdinal: 214 },
    { id: 'deborah', title: 'שירת דבורה', aliases: ['שירת דבורה וברק'], book: 'שופטים', bookSlug: 'judges',
        chapter: 5, firstVerse: 1, lastVerse: 31, ordinal: 20, endOrdinal: 106 },
    { id: 'david', title: 'שירת דוד', book: 'שמואל ב', subBook: 'שמ"ב', bookSlug: 'samuel',
        chapter: 22, firstVerse: 1, lastVerse: 51, ordinal: 323, endOrdinal: 370 },
    { id: 'ark', title: 'הודו ליהוה קראו בשמו', book: 'דברי הימים א', subBook: 'דה"א', bookSlug: 'chronicles',
        chapter: 16, firstVerse: 8, lastVerse: 36, ordinal: 191, endOrdinal: 223 },
    { id: 'times', title: 'כ״ח העתים', aliases: ['שיר העתים', 'שיר העיתים', 'עת ללדת', 'עתים', 'עיתים'], book: 'קהלת', bookSlug: 'ecclesiastes',
        chapter: 3, firstVerse: 2, lastVerse: 8, ordinal: 3, endOrdinal: 30 },
    { id: 'kings-list', kind: 'passage', title: 'רשימת מלכי כנען', aliases: ['מלכי כנען', 'שלושים ואחד מלכים'], book: 'יהושע', bookSlug: 'joshua',
        chapter: 12, firstVerse: 9, lastVerse: 24, ordinal: 42, endOrdinal: 58 },
    { id: 'haman', kind: 'passage', title: 'שמות עשרת בני המן', book: 'אסתר', bookSlug: 'esther',
        chapter: 9, firstVerse: 7, lastVerse: 9, ordinal: 21, endOrdinal: 30 },
    { id: 'valor', title: 'אשת חיל', book: 'משלי', bookSlug: 'proverbs',
        chapter: 31, firstVerse: 10, lastVerse: 31, ordinal: 50, endOrdinal: 50 },
];

// Each tuple gives the first and last chapter, final MAM section and final verse.
// Psalms 114–115 share a single MAM section. Every interval is checked against the token index.
function chapterPassages(bookSlug, book, kind) {
    return chapterRanges[bookSlug].map(([chapter, endChapter, endOrdinal, lastVerse], index, ranges) => ({
        id: `${bookSlug}-chapter-${chapter}`, kind, book, bookSlug, chapter, endChapter, firstVerse: 1, lastVerse,
        ordinal: index ? ranges[index - 1][2] + 1 : 1, endOrdinal,
    }));
}
export const songs = [...namedPassages, ...chapterPassages('psalms', 'תהלים', 'psalm'), ...chapterPassages('lamentations', 'איכה', 'lament')];
export function passageTitle(song, locale = getLanguage()) {
    if (song.kind === 'psalm') return song.chapter === song.endChapter ? translateLabel('מזמור {0}', locale, song.chapter)
        : translateLabel('מזמורים {0}–{1}', locale, song.chapter, song.endChapter);
    if (song.kind === 'lament') return translateLabel('קינה {0}', locale, song.chapter);
    return translateLabel(song.title, locale);
}
export function passageAction(song, analyze) {
    if (song.kind === 'psalm') return analyze ? t('נתח את הבחירה מתהלים') : t('פתח את המזמור השלם');
    if (song.kind === 'lament') return analyze ? t('נתח את הקינה') : t('פתח את הקינה המלאה');
    if (song.kind === 'passage') return analyze ? t('נתח את הקטע') : t('פתח את הקטע המלא');
    return analyze ? t('נתח את השירה') : t('פתח את השירה המלאה');
}
export function findSongs(query) {
    if (query.length < 2) return [];
    return namedPassages.filter(song => [song.title, ...(song.aliases || [])].some(name => name.includes(query)));
}

export function songNumbers(song) {
    const last = song.endChapter && song.endChapter !== song.chapter ? `${song.endChapter}:${song.lastVerse}` : song.lastVerse;
    return `${song.chapter}:${song.firstVerse}–${last}`;
}
