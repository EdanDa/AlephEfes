import { memo } from 'react';
import { COLOR_PALETTE, getLetterDetails, isValueVisible } from '../core/analysisCore.js';
import { shouldUseDitto } from '../utils/valueDisplay.js';
import useLanguage from '../i18n/LanguageContext.jsx';
import { t } from '../i18n/locale.js';
import { InspectWord } from './ResearchWorkspace.jsx';

const layers = [
    { id: 'U', label: 'יחידות', value: 'units', prime: 'isPrimeU' },
    { id: 'T', label: 'עשרות', value: 'tens', prime: 'isPrimeT' },
    { id: 'H', label: 'מאות', value: 'hundreds', prime: 'isPrimeH' },
];

const ValueCell = memo(function ValueCell({ word, layer, previous, filters, primeColor }) {
    useLanguage();
    const value = word[layer.value];
    const prime = word[layer.prime];
    const visible = isValueVisible(layer.id, prime, filters);
    const repeat = previous && shouldUseDitto(value, word[previous.value], isValueVisible(previous.id, word[previous.prime], filters));
    const color = COLOR_PALETTE[primeColor];
    return (
        <td role="cell" className={`detail-metric selectable ${prime ? color.light + ' ' + color.dark : ''}`}>
            <span className="detail-metric-label" aria-hidden="true">{t(layer.label)}</span>
            {visible && <>
                {repeat && <span className="detail-ditto">〃</span>}
                <bdi className="detail-number" dir="ltr">{value}{prime && <span className="detail-prime" title={t('ראשוני')}>♢</span>}</bdi>
            </>}
        </td>
    );
});

export default function WordDetailTable({ words, letterTable, filters, primeColor, lineIndex, positions, numberingStart }) {
    useLanguage();
    const visibleLayers = layers.filter(layer => filters[layer.id]);
    return (
        <div className="detail-table-container overflow-x-auto">
            <table role="table" className={`research-detail-table ${positions ? '' : 'app-word-table'}`} style={{ '--metric-span': 12 / (visibleLayers.length + 1) }}>
                <thead role="rowgroup"><tr role="row">
                    <th role="columnheader" scope="col" className="app-word-column">{t('מילה')}</th>
                    <th role="columnheader" scope="col" className="app-sum-column">{t('חישוב')}</th>
                    {visibleLayers.map(layer => <th role="columnheader" scope="col" key={layer.id}>{t(layer.label)}</th>)}
                    <th role="columnheader" scope="col" aria-label={t('שורש דיגיטלי')}>{t('ש"ד')}</th>
                </tr></thead>
                <tbody role="rowgroup">{words.map((word, index) => {
                    const position = positions?.[index];
                    const number = numberingStart == null ? null : position - 1 + numberingStart;
                    return (
                        <tr role="row" key={index}>
                            <td role="cell" className="detail-word-cell">
                                <span className="research-detail-word">
                                    {number != null && <span className="research-detail-position" dir="ltr" aria-label={t`מיקום מילה בשורה: ${number}`}>{number}</span>}
                                    <InspectWord word={word.word} lineIndex={lineIndex} wordPosition={position}>
                                        <bdi dir="rtl" lang="he">{word.word}</bdi>
                                    </InspectWord>
                                </span>
                            </td>
                            <td role="cell" dir="ltr" className="app-letter-sum selectable">{getLetterDetails(word.word, letterTable).map(letter => letter.value).join(' + ')}</td>
                            {layers.map((layer, i) => filters[layer.id] && <ValueCell key={layer.id} word={word} layer={layer} previous={layers[i - 1]} filters={filters} primeColor={primeColor} />)}
                            <td role="cell" className="detail-metric detail-root">
                                <span className="detail-metric-label" aria-hidden="true" title={t('שורש דיגיטלי')}>{t('ש"ד')}</span>
                                <bdi dir="ltr">{word.dr}</bdi>
                            </td>
                        </tr>
                    );
                })}</tbody>
            </table>
        </div>
    );
}
