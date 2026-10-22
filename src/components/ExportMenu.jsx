import React, { useEffect, useRef, useState } from 'react';

export default function ExportMenu({ children, disabled = false }) {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const close = (event) => { if (!ref.current?.contains(event.target)) ref.current?.removeAttribute('open'); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, []);
    return <details ref={ref} onToggle={(event) => setOpen(event.currentTarget.open)} className="app-export-toolbar workspace-export-menu" onKeyDown={(event) => {
        if (event.key === 'Escape') { ref.current.removeAttribute('open'); ref.current.querySelector('summary button').focus(); }
    }}>
        <summary><button type="button" disabled={disabled} aria-haspopup="true" aria-expanded={open} onClick={(event) => { event.preventDefault(); ref.current.open = !ref.current.open; }}>העתקה וייצוא ▾</button></summary>
        <div className="workspace-export-options" onClick={(event) => { event.stopPropagation(); if (event.target.closest('button') && !event.target.closest('button').disabled) { ref.current.open = false; ref.current.querySelector('summary button').focus(); } }}>{children}</div>
    </details>;
}
