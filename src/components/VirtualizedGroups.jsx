import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// A single document scroll keeps group navigation usable on phones. Only nearby
// rows (and the focused row) are mounted; exports use the complete source data.
export default function VirtualizedGroups({ groups, renderWord, clusterRefs }) {
    const root = useRef(null);
    const [viewport, setViewport] = useState({ top: 0, height: 900, width: 300 });
    const [focusedRow, setFocusedRow] = useState(null);
    const columns = Math.max(1, Math.floor((viewport.width + 8) / 144));
    const rows = useMemo(() => {
        let top = 0;
        return groups.flatMap(({ dr, words }) => {
            const result = [{ key: `heading-${dr}`, dr, count: words.length, top, height: 56 }];
            top += 56;
            for (let i = 0; i < words.length; i += columns) {
                result.push({ key: `${dr}-${i}`, words: words.slice(i, i + columns), top, height: 116 });
                top += 116;
            }
            return result;
        });
    }, [groups, columns]);
    useLayoutEffect(() => {
        let frame;
        const update = () => {
            if (!root.current) return;
            const rect = root.current.getBoundingClientRect();
            setViewport({ top: -rect.top, height: innerHeight, width: rect.width });
        };
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
        const observer = new ResizeObserver(schedule);
        observer.observe(root.current);
        addEventListener('scroll', schedule, { passive: true });
        addEventListener('resize', schedule);
        update();
        return () => { observer.disconnect(); cancelAnimationFrame(frame); removeEventListener('scroll', schedule); removeEventListener('resize', schedule); };
    }, []);
    useEffect(() => setFocusedRow(null), [groups]);
    const firstWordRow = rows.find((row) => row.words)?.key;
    const visible = rows.filter((row) => row.top + row.height >= viewport.top - 320 && row.top <= viewport.top + viewport.height + 320 || row.key === focusedRow || row.key === firstWordRow);
    const height = rows.length ? rows.at(-1).top + rows.at(-1).height : 0;
    const moveFocus = (event, row) => {
        if (event.key !== 'Tab') return;
        const buttons = [...root.current.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        const atEdge = event.shiftKey ? index === 0 : index === buttons.length - 1;
        if (!atEdge) return;
        const current = rows.indexOf(row);
        const next = (event.shiftKey ? rows.slice(0, current).reverse() : rows.slice(current + 1)).find((entry) => entry.words);
        if (!next) return;
        event.preventDefault();
        setFocusedRow(next.key);
        window.scrollTo({ top: scrollY + root.current.getBoundingClientRect().top + next.top - 80, behavior: 'instant' });
        requestAnimationFrame(() => {
            const items = root.current.querySelector(`[data-row="${next.key}"]`)?.querySelectorAll('button');
            (event.shiftKey ? items?.[items.length - 1] : items?.[0])?.focus();
        });
    };
    return <div ref={root} className="workspace-virtual-groups" style={{ position: 'relative', height }}>
        {visible.map((row) => <div key={row.key} data-row={row.key} onFocus={() => setFocusedRow(row.key)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedRow(null); }} onKeyDown={(event) => moveFocus(event, row)} style={{ position: 'absolute', top: row.top, width: '100%', height: row.height }}>
            {row.words ? <div className="workspace-word-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 }}>{row.words.map(renderWord)}</div>
                : <h3 ref={(element) => { clusterRefs.current[row.dr] = element; }} className="workspace-group-heading">ש״ד {row.dr} · {row.count} צורות מילים</h3>}
        </div>)}
    </div>;
}
