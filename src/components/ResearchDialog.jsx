import React, { useLayoutEffect, useRef } from 'react';

export default function ResearchDialog({ title, onClose, children, wide = false }) {
    const dialog = useRef(null), close = useRef(onClose);
    close.current = onClose;
    useLayoutEffect(() => {
        const previous = document.activeElement, element = dialog.current;
        const overflow = document.body.style.overflow;
        element.showModal(); document.body.style.overflow = 'hidden';
        return () => { element.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus({ preventScroll: true }); };
    }, []);
    const trapFocus = (event) => {
        if (event.key !== 'Tab') return;
        const items = [...dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, a[href], [tabindex="0"]')].filter((element) => element.getClientRects().length);
        if (!items.length) { event.preventDefault(); dialog.current.focus(); return; }
        const next = event.shiftKey ? items.at(-1) : items[0];
        if (document.activeElement === (event.shiftKey ? items[0] : items.at(-1)) || !dialog.current.contains(document.activeElement)) { event.preventDefault(); next.focus(); }
    };
    return <dialog ref={dialog} tabIndex={-1} dir="rtl" aria-label={title} className={`research-dialog ${wide ? 'research-dialog-wide' : ''}`} onKeyDown={trapFocus} onCancel={(event) => { event.preventDefault(); close.current(); }}>
        <header><h2>{title}</h2><button autoFocus type="button" onClick={onClose} aria-label="סגור חלונית">סגור ×</button></header>
        <div className="research-dialog-content">{children}</div>
    </dialog>;
}
