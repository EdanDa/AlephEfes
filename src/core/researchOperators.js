import { t } from '../i18n/locale.js';
import { domains } from './operatorFormula.js';

export function scopeLabel(query) {
    if (query.scope === 'corpus') return t('כל המקרא');
    if (query.scope === 'passage') return t('הטקסט לניתוח');
    return t(query.bookName);
}

export function queryDescription(query) {
    return [query.formula, t(domains[query.domain]), scopeLabel(query), query.mode === 'aleph-zero' ? 'א=0' : 'א=1', query.word].filter(Boolean).join(' · ');
}

export function describeHit(hit) {
    const values = hit.values.map(([key, value]) => `${key}=${Number.isNaN(value) ? '—' : value}`);
    if (hit.domain === 'unit') return [t('יחידה שלמה'), ...values].join(' · ');
    const location = hit.endPosition ? t`מילים ${hit.position} ו־${hit.endPosition}` : t`מילה ${hit.position}`;
    return [`״${hit.word}״`, location, ...values].join(' · ');
}

export function resultCounts(result) {
    return t`${result.cases} התאמות ב־${result.groups.length} מתוך ${result.units} יחידות שנבדקו (${result.words} מילים).`;
}

export function candidateCount(result) {
    if (result.query.domain === 'unit') return t`יחידות מועמדות לפני בדיקת הנוסחה: ${result.eligible}.`;
    return result.query.domain !== 'word'
        ? t`זוגות מועמדים לפני בדיקת הנוסחה: ${result.eligible}.`
        : t`מופעי מילים מועמדים לפני בדיקת הנוסחה: ${result.eligible}.`;
}

export function shuffleSummary(expected) {
    return t`תוחלת ההתאמות בערבוב אקראי של המילים בתוך כל יחידה: ${expected.toFixed(2)}. הערבוב שומר על המילים ועל מספר החזרות של כל כתיב.`;
}
