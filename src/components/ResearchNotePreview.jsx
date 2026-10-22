import React, { useMemo } from 'react';
import { parseResearchMarkdown } from '../core/researchMarkdown.js';

function NoteText({ text }) {
    // Isolate Latin identifiers and numbers from surrounding RTL punctuation.
    return text.split(/([A-Za-z0-9][A-Za-z0-9=_.:/+()\-]*(?: [A-Za-z0-9][A-Za-z0-9=_.:/+()\-]*)*)/g).map((part, index) => /^[A-Za-z0-9]/.test(part) ? <bdi dir="ltr" key={index}>{part}</bdi> : part);
}
export default function ResearchNotePreview({ content }) {
    const blocks = useMemo(() => parseResearchMarkdown(content), [content]);
    return <article className="research-note-preview" dir="rtl" tabIndex={0} aria-label="תצוגה מקדימה של הערת המחקר">
        {blocks.map((block, index) => {
            if (block.type === 'heading') return block.level === 1 ? <h3 key={index}><NoteText text={block.text} /></h3> : <h4 key={index}><NoteText text={block.text} /></h4>;
            if (block.type === 'passage') return <pre className="research-note-passage" key={index}>{block.text}</pre>;
            if (block.type === 'list') return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><NoteText text={item} /></li>)}</ul>;
            if (block.type === 'table') return <div className="research-note-table-scroll" tabIndex={0} role="region" aria-label="טבלת המופעים ביחידה" key={index}><table><thead><tr>{block.headers.map((header, cell) => <th scope="col" key={cell}>{header}</th>)}</tr></thead><tbody>{block.rows.map((row, number) => <tr key={number}>{row.map((value, cell) => <td key={cell} dir={block.alignment[cell]?.endsWith(':') ? 'ltr' : 'auto'}>{value}</td>)}</tr>)}</tbody></table></div>;
            if (/^https:\/\/\S+$/.test(block.text)) return <p key={index}><a href={block.text} target="_blank" rel="noreferrer">{block.text}</a></p>;
            return <p key={index}><NoteText text={block.text} /></p>;
        })}
    </article>;
}
