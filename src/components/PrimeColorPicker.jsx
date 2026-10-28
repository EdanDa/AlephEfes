import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { COLOR_PALETTE, PRIME_COLOR_HEX } from '../core/analysisCore.js';

export default forwardRef(function PrimeColorPicker({ color, onChange, anchor }, ref) {
    const panel = useRef(null), timer = useRef(null), pinned = useRef(false);
    const [open, setOpen] = useState(false), [top, setTop] = useState(100);
    const colors = ['yellow', ...Object.keys(COLOR_PALETTE).filter((key) => key !== 'yellow')];
    const cancelClose = () => clearTimeout(timer.current);
    const close = (restoreFocus = false) => {
        cancelClose(); pinned.current = false; setOpen(false);
        if (restoreFocus) anchor.current?.querySelector('button')?.focus({ preventScroll: true });
    };
    const position = () => {
        if (!anchor.current) return;
        const rect = anchor.current.getBoundingClientRect();
        const compact = innerWidth <= 640 || innerWidth <= 1023 && matchMedia('(pointer: coarse)').matches;
        setTop(Math.max(66, Math.min(innerHeight - 66, compact ? rect.bottom + 74 : rect.top + rect.height / 2)));
    };
    const show = (focus = false) => {
        cancelClose();
        if (focus) { pinned.current = true; anchor.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
        position(); setOpen(true);
        if (focus) requestAnimationFrame(() => panel.current?.querySelector('button')?.focus({ preventScroll: true }));
    };
    const leave = () => { if (!pinned.current) timer.current = setTimeout(() => close(), 500); };
    useImperativeHandle(ref, () => ({ show, leave }));
    useEffect(() => () => clearTimeout(timer.current), []);
    useEffect(() => {
        if (!open) return;
        const outside = (event) => { if (!anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) close(); };
        const escape = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(panel.current?.contains(document.activeElement)); } };
        const scroll = () => {
            const rect = anchor.current?.getBoundingClientRect();
            if (!rect || rect.bottom < 0 || rect.top > innerHeight) close(); else position();
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        window.addEventListener('resize', position);
        window.addEventListener('scroll', scroll, { passive: true });
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', position); window.removeEventListener('scroll', scroll); };
    }, [open]);
    const keyboard = (event) => {
        const buttons = [...panel.current.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
        if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next].focus();
        } else if (event.key === 'Tab' && (event.shiftKey ? index === 0 : index === buttons.length - 1)) { event.preventDefault(); close(true); }
    };
    return open ? createPortal(<div id="prime-color-flower" ref={panel} role="group" aria-label="צבעי הראשוניים" className="app-color-picker" style={{ top }} onMouseEnter={cancelClose} onMouseLeave={leave} onFocusCapture={() => { cancelClose(); pinned.current = true; }} onKeyDown={keyboard}>
            <div className="app-color-petals">{colors.map((key, index) => {
                const angle = 2 * Math.PI / (colors.length - 1) * (index - 1) - Math.PI / 2;
                return <button key={key} type="button" aria-label={`צבע ${COLOR_PALETTE[key].name}`} aria-pressed={color === key} className="app-color-petal" style={{ background: key === 'yellow' ? '#facc15' : PRIME_COLOR_HEX[key], width: index ? 28 : 32, height: index ? 28 : 32, top: `calc(50% + ${index ? 36 * Math.sin(angle) : 0}px)`, left: `calc(50% + ${index ? 36 * Math.cos(angle) : 0}px)` }} onClick={() => { onChange(key); close(true); }} />;
            })}</div>
        </div>, document.body) : null;
});
