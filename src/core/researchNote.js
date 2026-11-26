import { t } from '../i18n/locale.js';
import { getWordValues, isValueVisible } from './analysisCore.js';
import { boundaryText, locatorText, researchUnitLabel } from './researchModel.js';
import { candidateCount, describeHit, queryDescription, resultCounts, shuffleSummary } from './researchOperators.js';

const inline = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').replaceAll('|', '\\|');
const center = (positions) => positions.length === 2 ? t`בין ${positions[0]} ל־${positions[1]}` : positions[0] || t('אין');
export function researchNoteRows(unit, { word, value, filters }) {
    return unit.tokens.flatMap((token) => {
        const layers = Number.isFinite(value) ? getWordValues(token).filter((entry) => entry.value === value && isValueVisible(entry.layer, entry.isPrime, filters)).map((entry) => entry.layer) : [];
        if (word ? token.word !== word : Number.isFinite(value) && !layers.length) return [];
        return [{ ...token, matchingLayers: layers }];
    });
}

export function buildResearchNote({ unit, label, filters, selectedDR = null, searchTerm = '', word = null, value = null, passage, selectedPosition = null, corpusSearch = null, operatorEvidence = null }) {
    if (!unit) return '';
    const rows = researchNoteRows(unit, { word, value, filters });
    const source = unit.source;
    const lines = [
        t`# הערת מחקר — ${inline(label ?? researchUnitLabel(unit))}`,
        '',
        ...(source ? [t`- מראי מקום: ${locatorText(source.locators.start)} – ${locatorText(source.locators.end)} (לציון מקום, אינם גבולות ניתוח).`] : []),
        t`- היקף הממצאים: ${source ? t('יחידת MAM אחת') : t('שורה אחת של טקסט אישי')}.`,
        t`- מצב חישוב: ${unit.mode === 'aleph-zero' ? t('א=0 (aleph-zero)') : t('א=1 (aleph-one)')}.`,
        '',
        ...(operatorEvidence ? [
            t('## תוצאת החיפוש שנבחרה'), '',
            queryDescription(operatorEvidence.result.query),
            resultCounts(operatorEvidence.result),
            candidateCount(operatorEvidence.result),
            ...(operatorEvidence.result.expected != null ? [shuffleSummary(operatorEvidence.result.expected)] : []),
            describeHit(operatorEvidence.hit), '',
        ] : []),
        t('## פרטי הבדיקה'), '',
        t`- מזהה: ${unit.id}.`,
        t`- מסנני תצוגה: ${['U', 'T', 'H'].map((layer) => `${layer}=${filters[layer] ? t('פעיל') : t('כבוי')}`).join(', ')}; ראשוניים בלבד=${filters.Prime ? t('כן') : t('לא')}; שורש דיגיטלי=${selectedDR ?? t('ללא סינון')}; חיפוש=${inline(searchTerm) || t('ללא')}.`,
        t`- מילה נבחרת: ${inline(word) || t('ללא')}; ערך נבחר: ${Number.isFinite(value) ? value : t('ללא')}.`,
    ];
    if (source) lines.push(
        t`- מקור: MAM-parsed, ${inline(t(source.bookName))}, פרשיה ${source.ordinal}; קובץ ${inline(source.sourceFile)}.`,
        t('- מדיניות הטקסט: כתיב בלבד (ketiv); קרי מושמט. יחידות הניתוח נקבעות לפי גבולות המסורה בקובצי MAM.'),
        t`- גבול לפני: ${boundaryText(source.boundaryBefore, true)}.`,
        t`- גבול אחרי: ${boundaryText(source.boundaryAfter)}.`,
        `- Corpus ID: ${source.corpus.corpusId}; schema ${source.corpus.schemaVersion}; converter ${source.corpus.converterVersion}.`,
        `- Corpus SHA-256: ${source.corpus.contentHash}`,
        `- Section calculation SHA-256: ${source.calculationHash}`,
        `- Section source SHA-256: ${source.sourceHash}`,
        `- MAM source revision: ${source.corpus.sourceRevision}`,
    );
    else lines.push(t`- מקור: קלט אישי, שורה ${unit.lineNumber}. אין שיוך ל־MAM ואין גרסת מקרא או hash מקרא מיוחסים לשורה זו.`);
    lines.push('', t('## הטקסט המדויק שנותח ביחידה'), '', '```text', unit.text, '```', '', t('## ספירות ומיקומים'), '',
        t`- ביחידה: ${unit.wordCount} מופעי מילים; ${unit.distinctWordCount} צורות מילים שונות; ${unit.letterCount} אותיות חישוב.`,
        t`- סכומי היחידה: U=${unit.totals.units}, T=${unit.totals.tens}, H=${unit.totals.hundreds}.`,
        t`- מרכז המילים: ${center(unit.wordCenter)}; מרכז האותיות: ${center(unit.letterCenter)}.`,
    );
    if (passage) lines.push(t`- בקטע הניתוח הראשי: ${passage.wordCount} מופעי מילים; ${passage.distinctWordCount} צורות מילים שונות.${word ? t` למילה ${inline(word)}: ${passage.selectedWordCount} מופעים.` : ''}`);
    if (selectedPosition) {
        const token = unit.tokens[selectedPosition - 1];
        if (token) lines.push(t`- המופע הנבחר ביחידה: מילה ${token.position} (${token.word}), אותיות ${token.letterStart}–${token.letterEnd}.`);
    }
    if (corpusSearch) lines.push('', t('## חיפוש בכל המקרא — קטע נבחר מתוך התוצאות'), '',
        t`- חיפוש מדויק של ${inline(corpusSearch.word)} בכל המקרא: ${corpusSearch.totalOccurrences} מופעים.`,
        t`- מוצגת כאן יחידה אחת בלבד, ${unit.id}, והמופע הנבחר במיקום ${corpusSearch.position}. זו אינה רשימת כל המופעים במקרא.`,
        t`- מפתח החיפוש תואם ל־Corpus SHA-256: ${corpusSearch.contentHash}.`,
    );
    lines.push('', t`## ${word ? t`כל מופעי ${inline(word)}` : Number.isFinite(value) ? t`כל המופעים בעלי הערך ${value} בשכבות המוצגות` : t('כל מופעי המילים')} ביחידה`, '',
        t`הרשימה מלאה עבור היחידה שנבחרה: ${rows.length} מופעים, ${new Set(rows.map((token) => token.word)).size} צורות מילים שונות.`, '',
        t('| מילה | מיקום מילה | אות תחילה | אות סוף | U | T | H | שכבות התואמות לערך הנבחר |'),
        '|---|---:|---:|---:|---:|---:|---:|---|',
        ...rows.map((token) => `| ${token.word} | ${token.position} | ${token.letterStart} | ${token.letterEnd} | ${token.units} | ${token.tens} | ${token.hundreds} | ${token.matchingLayers.join('/') || '—'} |`),
        '', t('## הגדרות הספירה'), '',
        t('- מופעים הם הופעות בטקסט; צורות מילים שונות הן כתיבים מנורמלים נבדלים. אותיות סופיות אינן מאוחדות עם הכתיב הרגיל; אין ניתוח שורשים או איחוד מורפולוגי.'),
        t('- מספור מילים ואותיות מתחיל ב־1 בתוך יחידת MAM, או בתוך השורה בקלט אישי. נספרות רק אותיות החישוב הקנוניות; ניקוד, טעמים, רווחים ומקף אינם אותיות. מקף מפריד בין מילים לפי הטוקנייזר הקיים.'),
        t('- ביחידה באורך זוגי המרכז נמצא בין שני האיברים המרכזיים. ספירת מילה נבחרת אינה מושפעת ממסנני התצוגה. במיון לפי ערך נספר כל מופע פעם אחת, גם אם כמה שכבות תואמות.'),
        t('- מסנני שורש דיגיטלי וחיפוש מתארים את תצוגת העבודה; טבלת המופעים לעיל מלאה ביחידה עבור המילה או הערך שנבחרו. אין בה מסקנה פרשנית או מבחן מובהקות.'),
    );
    if (source) lines.push('', t('## ייחוס מקור'), '', t`מקרא על פי המסורה (MAM), ויקיטקסט; MAM-parsed. רישיון ${source.corpus.license?.corpus || 'CC-BY-SA-4.0'}.`,
        source.corpus.license?.sourcePageHebrew || 'https://he.wikisource.org/wiki/מקרא_על_פי_המסורה',
        source.corpus.license?.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/');
    return `${lines.join('\n')}\n`;
}
