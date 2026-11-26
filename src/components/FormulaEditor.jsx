import { useRef, useState } from 'react';
import { domains, pairMeasures, unitMeasures, wordMeasures } from '../core/operatorFormula.js';
import { operatorCatalog } from '../core/operatorCatalog.js';
import CatalogPicker from './CatalogPicker.jsx';
import { t } from '../i18n/locale.js';

const libraryKey = 'alephEfes:researchOperators:v1';

function readLibrary() {
    const items = JSON.parse(localStorage.getItem(libraryKey) || '[]');
    return Array.isArray(items) ? items.filter(item => item && typeof item.name === 'string' &&
        typeof item.formula === 'string' && Object.hasOwn(domains, item.domain)) : [];
}

export default function FormulaEditor({ query, update, validate }) {
    const input = useRef(null);
    const [name, setName] = useState('');
    const [library, setLibrary] = useState(() => { try { return readLibrary(); } catch { return []; } });
    const [message, setMessage] = useState('');
    const wholeUnit = query.domain === 'unit';
    const paired = !wholeUnit && query.domain !== 'word';
    const currentRule = operatorCatalog.find(rule => rule.domain === query.domain && rule.formula === query.formula);
    function insert(symbol) {
        const { selectionStart: start, selectionEnd: end } = input.current;
        const left = query.formula.slice(0, start), right = query.formula.slice(end);
        const addition = (left && !/[\s(]$/.test(left) ? ' ' : '') + symbol + ' ';
        update({ formula: left + addition + right });
        requestAnimationFrame(() => {
            input.current?.focus();
            input.current?.setSelectionRange(start + addition.length, start + addition.length);
        });
    }
    function save() {
        const label = name.trim();
        if (!label || !validate()) return;
        try {
            const items = readLibrary();
            if (items.some(item => item.name === label)) { setMessage(t('שם זה כבר שמור. בחרו שם אחר.')); return; }
            const next = [...items, { name: label, formula: query.formula, domain: query.domain }];
            localStorage.setItem(libraryKey, JSON.stringify(next));
            setLibrary(next); setMessage(t('האופרטור נשמר בדפדפן זה.'));
        } catch { setMessage(t('השמירה בדפדפן נכשלה.')); }
    }
    const options = (list, prefix = '') => Object.entries(list).map(([key, label]) =>
        <option key={prefix + key} value={prefix + key}>{t(label)} · {prefix + key}</option>);
    return <div className="formula-editor">
        <CatalogPicker label={t('בחירת כלל')} placeholder={t('הגדרה חופשית')} value={currentRule?.id || ''}
            options={[{ id: '', label: t('הגדרה חופשית') }, ...Object.keys(domains).flatMap(domain =>
                operatorCatalog.filter(rule => rule.domain === domain).map(rule => ({
                    id: rule.id, label: t(rule.label), detail: rule.formula, detailDir: 'ltr', group: t(domains[domain]),
                })))]} onChoose={id => {
            const rule = operatorCatalog.find(item => item.id === id);
            update({ domain: rule?.domain || 'word', formula: rule?.formula || '' });
            setName(''); setMessage('');
        }} />
        <label>{t('מה בודקים')}<select value={query.domain} onChange={e => update({ domain: e.target.value })}>
            {Object.entries(domains).map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}
        </select></label>
        <label>{t('נוסחת האופרטור')}<textarea ref={input} value={query.formula} maxLength={512} dir="ltr" rows={2} spellCheck={false}
            aria-describedby="formula-help" onChange={e => update({ formula: e.target.value })} /></label>
        <p id="formula-help">{t('אפשר להקליד או להוסיף מדד, לשלב מספרים ופעולות חשבון ולהשוות בין ביטויים. סוגריים קובעים את סדר הפעולות.')}</p>
        {wholeUnit && <p>{t('בבדיקת יחידה שלמה, הפונקציה count סופרת כמה מילים מקיימות את התנאי שבסוגריים.')}</p>}
        <div className="formula-tools"><select aria-label={t('הוספת מדד לנוסחה')} value="" onChange={e => insert(e.target.value)}>
            <option value="">{t('הוספת מדד לנוסחה')}</option>
            <optgroup label={t('המילה הנבדקת')}>{options(wordMeasures)}</optgroup>
            <optgroup label={t('היחידה')}>{options(unitMeasures)}</optgroup>
            {paired && <optgroup label={t('המילה השנייה בזוג')}>{options(wordMeasures, 'b.')}{options(pairMeasures)}</optgroup>}
        </select>
        <select aria-label={t('הוספת פעולה לנוסחה')} value="" onChange={e => insert(e.target.value)}>
            <option value="">{t('הוספת פעולה לנוסחה')}</option>
            {wholeUnit && <option dir="ltr" value="count(">count(</option>}
            {['+', '-', '*', '/', '%', '=', '!=', '<', '<=', '>', '>=', '(', ')', 'and', 'or'].map(op => <option dir="ltr" key={op} value={op}>{op}</option>)}
        </select></div>
        <details className="formula-library"><summary>{t('האופרטורים שלי')}</summary>
            {library.length > 0 && <label>{t('טעינת הגדרה שמורה')}<select value="" onChange={e => {
                const item = library.find(row => row.name === e.target.value);
                if (item) { update({ formula: item.formula, domain: item.domain }); setName(''); setMessage(''); }
            }}><option value="">{t('בחרו הגדרה')}</option>{library.map(row => <option key={row.name}>{row.name}</option>)}</select></label>}
            <label>{t('שם לשמירה')}<input value={name} maxLength={80} onChange={e => { setName(e.target.value); setMessage(''); }} /></label>
            <button type="button" disabled={!name.trim() || !query.formula.trim()} onClick={save}>{t('שמור הגדרה')}</button>
            {message && <p role="status">{message}</p>}
        </details>
    </div>;
}
