import { Fragment } from 'react';
import TanakhBoundary from './TanakhBoundary.jsx';
import { t } from '../i18n/locale.js';

export default function SpellingResult({ data, hit, onOpen }) {
    const { tokens, offsets, bookOffsets, sectionIds, boundariesAfter } = data.index;
    const { start, end, section, endSection, position, endPosition } = hit;
    const sectionId = sectionIds[section];
    const split = sectionId.lastIndexOf('-');
    const book = data.books.get(sectionId.slice(0, split));
    const ordinal = Number(sectionId.slice(split + 1));
    const endOrdinal = ordinal + endSection - section;
    const contextStart = Math.max(start - 4, offsets[section], bookOffsets[hit.book]);
    const contextEnd = Math.min(end + 4, offsets[endSection + 1], bookOffsets[hit.book + 1]);
    const label = section === endSection ? t`${t(book.name)} · פרשיה ${ordinal}`
        : t`${t(book.name)} · פרשיות ${ordinal}–${endOrdinal}`;
    const parts = [];
    for (let i = section; i <= endSection; i++) {
        parts.push(<Fragment key={i}>
            {i > section && <> <TanakhBoundary boundary={boundariesAfter[i - 1]} /> </>}
            <mark>{tokens.slice(Math.max(start, offsets[i]), Math.min(end, offsets[i + 1])).join(' ')}</mark>
        </Fragment>);
    }
    return <li><button type="button" onClick={() => onOpen({ bookSlug: book.slug, ordinal, endOrdinal, sectionId, position, endPosition })}>
        <span>{label} · {section === endSection ? t`מילה ${position}` : t`ממילה ${position} עד מילה ${endPosition}`}</span>
        <span className="tanakh-search-excerpt" dir="rtl" lang="he">
            {contextStart > Math.max(offsets[section], bookOffsets[hit.book]) && '… '}
            {tokens.slice(contextStart, start).join(' ')} {parts} {tokens.slice(end, contextEnd).join(' ')}
            {contextEnd < Math.min(offsets[endSection + 1], bookOffsets[hit.book + 1]) && ' …'}
        </span>
    </button></li>;
}
