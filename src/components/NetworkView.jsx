import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { buildWordConnectionIndex } from '../core/networkLayout.js';
import { LAYER_COLORS, PRIME_COLOR_HEX } from '../core/analysisCore.js';
import { InspectWord } from './ResearchWorkspace';

export default memo(function NetworkView({ coreResults, filters, isDarkMode, primeColor, onWordClick, selectedDR }) {
    const canvasRef = useRef(null), hostRef = useRef(null), control = useRef(null);
    const [paused, setPaused] = useState(false);
    const [status, setStatus] = useState('running');
    const [selected, setSelected] = useState(null);
    const [query, setQuery] = useState('');
    const graph = useMemo(() => buildWordConnectionIndex(coreResults, filters, selectedDR), [coreResults, filters, selectedDR]);
    const callback = useRef(onWordClick);
    callback.current = onWordClick;
    useEffect(() => {
        const canvas = canvasRef.current, host = hostRef.current, ctx = canvas.getContext('2d');
        const generation = crypto.randomUUID();
        let alive = true, worker = null, frame = null, fallback = false, userPaused = paused, inView = true, settled = false;
        let size = { width: host.clientWidth, height: host.clientHeight, dpr: Math.min(devicePixelRatio || 1, 2) };
        let transform = { x: 0, y: 0, k: 1 }, drag = null, selectedId = null, hoveredId = null;
        const nodes = graph.nodes.map((node, index) => {
            const angle = index * 2.399963;
            const radius = Math.sqrt((index + 1) / Math.max(1, graph.nodes.length)) * Math.min(size.width, size.height) * 0.44;
            return { ...node, x: size.width / 2 + Math.cos(angle) * radius, y: size.height / 2 + Math.sin(angle) * radius, vx: 0, vy: 0 };
        });
        const nodeIndices = new Map(nodes.map((node, index) => [node.id, index]));
        const links = graph.links.map((link) => ({ ...link, a: nodes[nodeIndices.get(link.source)], b: nodes[nodeIndices.get(link.target)] }));
        setSelected(null); setStatus('running');
        const draw = () => {
            frame = null;
            if (!alive || !inView || document.hidden) return;
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(size.dpr * transform.k, 0, 0, size.dpr * transform.k, size.dpr * transform.x, size.dpr * transform.y);
            const active = selectedId || hoveredId;
            const connected = new Set(active ? [active] : []);
            if (active) for (const link of links) if (link.source === active || link.target === active) { connected.add(link.source); connected.add(link.target); }
            for (const layer of ['U', 'T', 'H']) {
                ctx.strokeStyle = isDarkMode ? LAYER_COLORS[layer].strokeDark : LAYER_COLORS[layer].strokeLight;
                ctx.lineWidth = 1 / transform.k; ctx.globalAlpha = active ? 0.06 : 0.22;
                ctx.beginPath();
                for (const link of links) if (link.layer === layer) { ctx.moveTo(link.a.x, link.a.y); ctx.lineTo(link.b.x, link.b.y); }
                ctx.stroke();
                if (active) {
                    ctx.globalAlpha = 0.9; ctx.lineWidth = 2 / transform.k; ctx.beginPath();
                    for (const link of links) if (link.layer === layer && (link.source === active || link.target === active)) { ctx.moveTo(link.a.x, link.a.y); ctx.lineTo(link.b.x, link.b.y); }
                    ctx.stroke();
                }
            }
            for (const node of nodes) {
                const sx = node.x * transform.k + transform.x, sy = node.y * transform.k + transform.y;
                if (sx < -100 || sy < -40 || sx > size.width + 100 || sy > size.height + 40) continue;
                const highlighted = connected.has(node.id);
                ctx.globalAlpha = active && !highlighted ? 0.16 : 1;
                ctx.fillStyle = node.type === 'word' ? (isDarkMode ? '#a78bfa' : '#7c3aed') : node.isPrime ? PRIME_COLOR_HEX[primeColor] : '#64748b';
                ctx.beginPath(); ctx.arc(node.x, node.y, node.id === active ? 7 : node.type === 'word' ? 4 : 3, 0, Math.PI * 2); ctx.fill();
                if (highlighted || nodes.length < 250 || transform.k >= 2.5) {
                    ctx.font = `${11 / Math.max(1, transform.k / 2)}px sans-serif`;
                    ctx.fillStyle = isDarkMode ? '#f8fafc' : '#0f172a';
                    ctx.fillText(node.type === 'word' ? node.id : String(node.value), node.x + 8, node.y - 5);
                }
            }
            ctx.globalAlpha = 1;
        };
        const requestDraw = () => { if (!frame) frame = requestAnimationFrame(draw); };
        const fail = () => { fallback = true; worker?.terminate(); worker = null; if (alive) setStatus('fallback'); requestDraw(); };
        const send = (message) => { try { worker?.postMessage({ generation, ...message }); } catch { fail(); } };
        const syncPause = () => { send({ type: 'pause', paused: userPaused || document.hidden || !inView }); requestDraw(); };
        const resize = () => { size = { ...size, width: host.clientWidth, height: host.clientHeight }; canvas.width = size.width * size.dpr; canvas.height = size.height * size.dpr; requestDraw(); };
        const ro = new ResizeObserver(resize); ro.observe(host); resize();
        try {
            worker = new Worker(new URL('../workers/networkLayout.worker.js', import.meta.url), { type: 'module' });
            worker.onerror = (event) => { event.preventDefault(); fail(); };
            worker.onmessageerror = fail;
            worker.onmessage = ({ data }) => {
                if (!alive) return;
                if (!data || typeof data !== 'object') { fail(); return; }
                if (data.generation !== generation) return;
                if (data.error || !(data.positions instanceof Float32Array) || data.positions.length !== nodes.length * 2 || !data.positions.every(Number.isFinite)) { fail(); return; }
                nodes.forEach((node, index) => { if (drag?.node !== node) { node.x = data.positions[index * 2]; node.y = data.positions[index * 2 + 1]; } });
                settled = data.settled;
                setStatus(settled ? 'settled' : 'running'); requestDraw();
            };
            send({ type: 'init', nodes: nodes.map(({ x, y, vx, vy }) => ({ x, y, vx, vy })), links: graph.links.map((link) => [nodeIndices.get(link.source), nodeIndices.get(link.target)]), width: size.width, height: size.height });
            syncPause();
        } catch { fail(); }
        const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncPause(); }); io.observe(host);
        document.addEventListener('visibilitychange', syncPause);
        const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left - transform.x) / transform.k, y: (event.clientY - rect.top - transform.y) / transform.k }; };
        const nearest = (p) => { let found = null, best = (24 / transform.k) ** 2; for (const node of nodes) { const distance = (node.x - p.x) ** 2 + (node.y - p.y) ** 2; if (distance < best) { best = distance; found = node; } } return found; };
        const down = (event) => { if (!event.isPrimary || event.button !== 0) return; canvas.setPointerCapture(event.pointerId); drag = { node: nearest(point(event)), x: event.clientX, y: event.clientY, moved: false }; };
        const move = (event) => {
            if (!event.isPrimary) return;
            if (drag) {
                const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
                if (Math.hypot(dx, dy) > 3) drag.moved = true;
                if (drag.moved) {
                    if (drag.node) { Object.assign(drag.node, point(event)); send({ type: 'drag', index: nodeIndices.get(drag.node.id), x: drag.node.x, y: drag.node.y, fixed: true }); }
                    else { transform.x += dx; transform.y += dy; }
                    drag.x = event.clientX; drag.y = event.clientY;
                }
            } else hoveredId = nearest(point(event))?.id || null;
            requestDraw();
        };
        const up = (event) => {
            if (!drag) return;
            if (!drag.moved) { selectedId = selectedId === drag.node?.id ? null : drag.node?.id; setSelected(nodes.find((node) => node.id === selectedId) || null); }
            if (drag.node) send({ type: 'drag', index: nodeIndices.get(drag.node.id), x: drag.node.x, y: drag.node.y, fixed: false });
            drag = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); requestDraw();
        };
        const zoom = (factor) => { const next = Math.max(0.1, Math.min(5, transform.k * factor)); transform = { x: size.width / 2 - (size.width / 2 - transform.x) * next / transform.k, y: size.height / 2 - (size.height / 2 - transform.y) * next / transform.k, k: next }; requestDraw(); };
        const wheel = (event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.1 : 0.9); };
        control.current = (action, value) => {
            if (action === 'pause') { userPaused = value; send({ type: 'pause', paused: userPaused || document.hidden || !inView, restart: !value }); requestDraw(); }
            else if (action === 'reset') { transform = { x: 0, y: 0, k: 1 }; requestDraw(); }
            else if (action === 'select') { selectedId = nodeIndices.has(value) ? value : null; setSelected(nodes.find((node) => node.id === selectedId) || null); requestDraw(); }
            else zoom(action === 'in' ? 1.25 : 0.8);
        };
        canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('wheel', wheel, { passive: false });
        requestDraw();
        return () => { alive = false; worker?.terminate(); cancelAnimationFrame(frame); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', syncPause); control.current = null; canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel); };
    }, [graph, isDarkMode, primeColor]);
    return <section className={`app-results-card app-network-card p-4 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-300'}`}>
        <h2 className="app-results-title text-center font-bold mb-4">רשת</h2>
        <div className="app-canvas-toolbar flex flex-wrap justify-center gap-2 mb-3">
            <button aria-label="הגדל את רשת הקשרים" onClick={() => control.current?.('in')}>+</button><button aria-label="הקטן את רשת הקשרים" onClick={() => control.current?.('out')}>−</button>
            <button onClick={() => control.current?.('reset')}>איפוס תצוגה</button>
            <button disabled={status === 'fallback'} aria-pressed={paused} onClick={() => { setPaused(!paused); control.current?.('pause', !paused); }}>{paused ? 'המשך תנועה' : 'השהה תנועה'}</button>
        </div>
        <p className="text-sm text-center mb-3" role="status">{status === 'fallback' ? 'פריסה סטטית · אפשר לבחור, לגרור ולהגדיל' : paused ? 'התנועה מושהית' : status === 'settled' ? 'הפריסה התייצבה' : 'מסדר את הרשת…'}</p>
        <details className="workspace-help"><summary>איך חוקרים את הרשת?</summary><p>המילים מחוברות לערכיהן בשכבות המוצגות. גררו להזזה והקישו לבחירה. ברשת גדולה תוויות מופיעות בבחירה או בהגדלה.</p></details>
        <form className="workspace-network-search" onSubmit={(event) => { event.preventDefault(); control.current?.('select', query.trim()); }}><label>בחירת מילה ברשת <input value={query} onChange={(event) => setQuery(event.target.value)} /></label><button>בחר</button></form>
        <div ref={hostRef} className="app-network-canvas relative w-full h-[600px] overflow-hidden bg-slate-100 dark:bg-gray-900 rounded-lg border"><canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none' }} aria-label="רשת קשרים; ניתן לבחור מילה גם בשדה החיפוש" /></div>
        {selected && <div className="workspace-network-selection"><strong>{selected.type === 'word' ? selected.id : `ערך ${selected.value}`}</strong>{selected.type === 'word' && <><button onClick={() => callback.current?.(selected.data)}>הצג קשרי מילה</button><InspectWord word={selected.id} /></>}</div>}
    </section>;
});
