import { getWordValues, isValueVisible } from './analysisCore.js';
import { boundaryText, locatorText } from './researchModel.js';

const inline = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').replaceAll('|', '\\|');
const center = (positions) => positions.length === 2 ? `בין ${positions[0]} ל־${positions[1]}` : positions[0] || 'אין';
export function researchNoteRows(unit, { word, value, filters }) {
    return unit.tokens.flatMap((token) => {
        const layers = Number.isFinite(value) ? getWordValues(token).filter((entry) => entry.value === value && isValueVisible(entry.layer, entry.isPrime, filters)).map((entry) => entry.layer) : [];
        if (word ? token.word !== word : Number.isFinite(value) && !layers.length) return [];
        return [{ ...token, matchingLayers: layers }];
    });
}

export function buildResearchNote({ unit, filters, selectedDR = null, searchTerm = '', word = null, value = null, passage, selectedPosition = null, corpusSearch = null }) {
    if (!unit) return '';
    const rows = researchNoteRows(unit, { word, value, filters });
    const source = unit.source;
    const lines = [
        `# הערת מחקר — ${inline(unit.label)}`,
        '',
        `- היקף הממצאים: ${source ? 'יחידת MAM אחת' : 'שורה אחת של טקסט אישי'}.`,
        `- מזהה: ${unit.id}.`,
        `- מצב חישוב: ${unit.mode === 'aleph-zero' ? 'א=0 (aleph-zero)' : 'א=1 (aleph-one)'}.`,
        `- מסנני תצוגה: ${['U', 'T', 'H'].map((layer) => `${layer}=${filters[layer] ? 'פעיל' : 'כבוי'}`).join(', ')}; ראשוניים בלבד=${filters.Prime ? 'כן' : 'לא'}; שורש דיגיטלי=${selectedDR ?? 'ללא סינון'}; חיפוש=${inline(searchTerm) || 'ללא'}.`,
        `- מילה נבחרת: ${inline(word) || 'ללא'}; ערך נבחר: ${Number.isFinite(value) ? value : 'ללא'}.`,
    ];
    if (source) lines.push(
        `- מקור: MAM-parsed, ${inline(source.bookName)}, פרשיה ${source.ordinal}; קובץ ${inline(source.sourceFile)}.`,
        '- מדיניות הטקסט: כתיב בלבד (ketiv); קרי מושמט. יחידות הניתוח נקבעות לפי גבולות המסורה בקובצי MAM.',
        `- מראי מקום: ${locatorText(source.locators.start)} – ${locatorText(source.locators.end)} (לציון מקום, אינם גבולות ניתוח).`,
        `- גבול לפני: ${boundaryText(source.boundaryBefore, true)}.`,
        `- גבול אחרי: ${boundaryText(source.boundaryAfter)}.`,
        `- Corpus ID: ${source.corpus.corpusId}; schema ${source.corpus.schemaVersion}; converter ${source.corpus.converterVersion}.`,
        `- Corpus SHA-256: ${source.corpus.contentHash}`,
        `- Section calculation SHA-256: ${source.calculationHash}`,
        `- Section source SHA-256: ${source.sourceHash}`,
        `- MAM source revision: ${source.corpus.sourceRevision}`,
    );
    else lines.push(`- מקור: קלט אישי, שורה ${unit.lineNumber}. אין שיוך ל־MAM ואין גרסת מקרא או hash מקרא מיוחסים לשורה זו.`);
    lines.push('', '## הטקסט המדויק שנותח ביחידה', '', '```text', unit.text, '```', '', '## ספירות ומיקומים', '',
        `- ביחידה: ${unit.wordCount} מופעי מילים; ${unit.distinctWordCount} צורות מילים שונות; ${unit.letterCount} אותיות חישוב.`,
        `- סכומי היחידה: U=${unit.totals.units}, T=${unit.totals.tens}, H=${unit.totals.hundreds}.`,
        `- מרכז המילים: ${center(unit.wordCenter)}; מרכז האותיות: ${center(unit.letterCenter)}.`,
    );
    if (passage) lines.push(`- בקטע הניתוח הראשי: ${passage.wordCount} מופעי מילים; ${passage.distinctWordCount} צורות מילים שונות.${word ? ` למילה ${inline(word)}: ${passage.selectedWordCount} מופעים.` : ''}`);
    if (selectedPosition) {
        const token = unit.tokens[selectedPosition - 1];
        if (token) lines.push(`- המופע הנבחר ביחידה: מילה ${token.position} (${token.word}), אותיות ${token.letterStart}–${token.letterEnd}.`);
    }
    if (corpusSearch) lines.push('', '## חיפוש בכל המקרא — קטע נבחר מתוך התוצאות', '',
        `- חיפוש מדויק של ${inline(corpusSearch.word)} בכל המקרא: ${corpusSearch.totalOccurrences} מופעים.`,
        `- מוצגת כאן יחידה אחת בלבד, ${unit.id}, והמופע הנבחר במיקום ${corpusSearch.position}. זו אינה רשימת כל המופעים במקרא.`,
        `- מפתח החיפוש תואם ל־Corpus SHA-256: ${corpusSearch.contentHash}.`,
    );
    lines.push('', `## ${word ? `כל מופעי ${inline(word)}` : Number.isFinite(value) ? `כל המופעים בעלי הערך ${value} בשכבות המוצגות` : 'כל מופעי המילים'} ביחידה`, '',
        `הרשימה מלאה עבור היחידה שנבחרה: ${rows.length} מופעים, ${new Set(rows.map((token) => token.word)).size} צורות מילים שונות.`, '',
        '| מילה | מיקום מילה | אות תחילה | אות סוף | U | T | H | שכבות התואמות לערך הנבחר |',
        '|---|---:|---:|---:|---:|---:|---:|---|',
        ...rows.map((token) => `| ${token.word} | ${token.position} | ${token.letterStart} | ${token.letterEnd} | ${token.units} | ${token.tens} | ${token.hundreds} | ${token.matchingLayers.join('/') || '—'} |`),
        '', '## הגדרות הספירה', '',
        '- מופעים הם הופעות בטקסט; צורות מילים שונות הן כתיבים מנורמלים נבדלים. אותיות סופיות אינן מאוחדות עם הכתיב הרגיל; אין ניתוח שורשים או איחוד מורפולוגי.',
        '- מספור מילים ואותיות מתחיל ב־1 בתוך יחידת MAM, או בתוך השורה בקלט אישי. נספרות רק אותיות החישוב הקנוניות; ניקוד, טעמים, רווחים ומקף אינם אותיות. מקף מפריד בין מילים לפי הטוקנייזר הקיים.',
        '- ביחידה באורך זוגי המרכז נמצא בין שני האיברים המרכזיים. ספירת מילה נבחרת אינה מושפעת ממסנני התצוגה. במיון לפי ערך נספר כל מופע פעם אחת, גם אם כמה שכבות תואמות.',
        '- מסנני שורש דיגיטלי וחיפוש מתארים את תצוגת העבודה; טבלת המופעים לעיל מלאה ביחידה עבור המילה או הערך שנבחרו. אין בה מסקנה פרשנית או מבחן מובהקות.',
    );
    if (source) lines.push('', '## ייחוס מקור', '', `מקרא על פי המסורה (MAM), ויקיטקסט; MAM-parsed. רישיון ${source.corpus.license?.corpus || 'CC-BY-SA-4.0'}.`,
        source.corpus.license?.sourcePageHebrew || 'https://he.wikisource.org/wiki/מקרא_על_פי_המסורה',
        source.corpus.license?.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/');
    return `${lines.join('\n')}\n`;
}
