// Verse references are one-based. Regression tests verify both ends of each
// section range against the checked-in MAM verse spans.
export const songs = [
    { id: 'sea', title: 'שירת הים', aliases: ['אז ישיר', 'שירת משה'], book: 'שמות', bookSlug: 'exodus',
        chapter: 15, firstVerse: 1, lastVerse: 19, ordinal: 42, endOrdinal: 85 },
    { id: 'haazinu', title: 'האזינו', aliases: ['שירת האזינו', 'שירת משה'], book: 'דברים', bookSlug: 'deuteronomy',
        chapter: 32, firstVerse: 1, lastVerse: 43, ordinal: 147, endOrdinal: 214 },
    { id: 'deborah', title: 'שירת דבורה', aliases: ['שירת דבורה וברק'], book: 'שופטים', bookSlug: 'judges',
        chapter: 5, firstVerse: 1, lastVerse: 31, ordinal: 20, endOrdinal: 106 },
];

export function findSongs(query) {
    if (query.length < 2) return [];
    return songs.filter(song => [song.title, ...song.aliases].some(name => name.includes(query)));
}

export function songNumbers(song) {
    return `${song.chapter}:${song.firstVerse}–${song.lastVerse}`;
}
