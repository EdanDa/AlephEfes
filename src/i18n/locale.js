import english from './english.js';

const preference = 'alephEfes:language';

function selectedLanguage() {
    if (typeof window === 'undefined') return 'he';
    const url = new URL(window.location.href);
    // file: documents can always update their fragment, including in WebKit.
    const fragment = url.protocol === 'file:' ? new URLSearchParams(url.hash.slice(1)) : null;
    const requested = fragment?.get('lang') || url.searchParams.get('lang');
    if (requested === 'en' || requested === 'he') return requested;
    try {
        return window.localStorage.getItem(preference) === 'en' ? 'en' : 'he';
    } catch {
        return 'he';
    }
}

export let language = selectedLanguage();
export let direction = language === 'en' ? 'ltr' : 'rtl';
const listeners = new Set();

export const getLanguage = () => language;
export function subscribeLanguage(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// Tagged messages keep interpolated words and numbers out of the dictionary.
/** @param {string | TemplateStringsArray} message @param {...any} values */
export function t(message, ...values) {
    const key = typeof message === 'string' ? message
        : message.reduce((text, part, i) => text + (i ? `{${i - 1}}` : '') + part, '');
    const result = language === 'en' && Object.prototype.hasOwnProperty.call(english, key) ? english[key] : key;
    return values.length ? result.replace(/\{(\d+)\}/g, (_, n) => String(values[n])) : result;
}

export function switchLanguageUrl() {
    const url = new URL(window.location.href);
    const next = language === 'he' ? 'en' : 'he';
    if (url.protocol === 'file:') {
        const fragment = new URLSearchParams(url.hash.slice(1));
        fragment.set('lang', next);
        url.hash = fragment.toString();
    } else {
        url.searchParams.set('lang', next);
    }
    return url.href;
}

function readLocation() {
    const next = selectedLanguage();
    if (next === language) return;
    language = next;
    direction = next === 'en' ? 'ltr' : 'rtl';
    applyDocumentLanguage();
    for (const listener of listeners) listener();
}

export function switchLanguage(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = switchLanguageUrl();
    if (window.location.protocol === 'file:') {
        window.location.replace(url);
    } else {
        window.history.replaceState(window.history.state, '', url);
    }
    readLocation();
}

if (typeof window !== 'undefined') {
    window.addEventListener('popstate', readLocation);
    window.addEventListener('hashchange', readLocation);
}

export function applyDocumentLanguage() {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    try {
        window.localStorage.setItem(preference, language);
    } catch {
        // The URL selects the language when site preferences cannot be stored.
    }
}
