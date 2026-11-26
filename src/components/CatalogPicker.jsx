import { useId, useLayoutEffect, useRef, useState } from 'react';
import { t } from '../i18n/locale.js';

export default function CatalogPicker({ label, placeholder, options, value, onChoose }) {
    const id = useId();
    const input = useRef(null);
    const list = useRef(null);
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [active, setActive] = useState(0);
    useLayoutEffect(() => {
        if (!open) return;
        const menu = list.current;
        function placeMenu() {
            const field = input.current.getBoundingClientRect();
            const panel = menu.closest('.app-corpus-panel')?.getBoundingClientRect();
            const below = Math.min(window.innerHeight, panel?.bottom ?? Infinity) - field.bottom - 12;
            const above = menu.parentElement.getBoundingClientRect().top - Math.max(0, panel?.top ?? 0) - 12;
            const upwards = below < 260 && above > below;
            menu.dataset.above = String(upwards);
            menu.style.setProperty('--menu-space', Math.max(48, upwards ? above : below) + 'px');
        }
        placeMenu();
        window.addEventListener('resize', placeMenu);
        window.addEventListener('scroll', placeMenu, true);
        return () => {
            window.removeEventListener('resize', placeMenu);
            window.removeEventListener('scroll', placeMenu, true);
        };
    }, [open]);
    const terms = filter.trim().toLowerCase().split(/\s+/);
    const selected = options.find(option => option.id === value);
    const visible = options.filter(option => {
        const text = [option.label, option.detail, option.group, option.keywords].filter(Boolean).join(' ').toLowerCase();
        return terms.every(term => text.includes(term));
    });
    function show() {
        setFilter('');
        setActive(Math.max(0, options.findIndex(option => option.id === value)));
        setOpen(true);
    }
    function choose(option) {
        if (!option) return;
        setOpen(false);
        onChoose(option.id);
    }
    function reveal(node) {
        if (!node || !list.current) return;
        const menu = list.current.getBoundingClientRect();
        const row = node.getBoundingClientRect();
        if (row.top < menu.top) list.current.scrollTop += row.top - menu.top;
        else if (row.bottom > menu.bottom) list.current.scrollTop += row.bottom - menu.bottom;
    }
    function keyDown(event) {
        const key = event.key;
        if (key === 'Escape' && open) {
            event.preventDefault(); event.stopPropagation(); setOpen(false); return;
        }
        if (key === 'Enter') {
            event.preventDefault();
            if (open) choose(visible[active]); else show();
            return;
        }
        if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
        event.preventDefault();
        if (!open) { show(); return; }
        setActive(Math.max(0, Math.min(visible.length - 1, active + (key === 'ArrowDown' ? 1 : -1))));
    }
    return <div className="catalog-picker" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
        <label htmlFor={id}>{label}</label>
        <div className="catalog-control">
            <input id={id} ref={input} role="combobox" type="text" autoComplete="off" spellCheck={false}
                aria-autocomplete="list" aria-expanded={open} aria-controls={id + '-list'}
                aria-activedescendant={open && visible[active] ? id + '-row-' + active : undefined}
                placeholder={open ? t('סינון הרשימה…') : placeholder}
                value={open ? filter : selected?.label || ''} onFocus={show} onClick={() => { if (!open) show(); }}
                onChange={event => { setFilter(event.target.value); setActive(0); setOpen(true); }}
                onKeyDown={keyDown} />
            <button type="button" tabIndex={-1} aria-label={t(open ? 'סגירת הרשימה' : 'פתיחת הרשימה')} aria-expanded={open} aria-controls={id + '-list'}
                onMouseDown={event => event.preventDefault()} onClick={() => {
                    if (open) setOpen(false);
                    else { input.current.focus(); show(); }
                }}><span aria-hidden="true" /></button>
        </div>
        <div id={id + '-list'} className="catalog-menu" ref={list} role="listbox" aria-label={label} hidden={!open}>
            {open && visible.map((option, index) => <div key={option.id}>
                {option.group && option.group !== visible[index - 1]?.group && <div className="catalog-group" role="presentation">{option.group}</div>}
                <div id={id + '-row-' + index} role="option" aria-selected={option.id === value} aria-label={option.label}
                    ref={index === active ? reveal : undefined} data-active={index === active}
                    onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
                    <span>{option.label}</span>{option.detail && <small dir={option.detailDir}>{option.detail}</small>}
                </div>
            </div>)}
            {open && !visible.length && <p role="status">{t('אין התאמות ברשימה')}</p>}
        </div>
    </div>;
}
