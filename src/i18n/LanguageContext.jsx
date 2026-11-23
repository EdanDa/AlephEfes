import { createContext, useContext, useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage, translateLabel } from './locale.js';

const LanguageContext = createContext('he');

export function LanguageProvider({ children }) {
    const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
    return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

export default function useLanguage() {
    return useContext(LanguageContext);
}

// Reserve the larger translation's footprint even when a label wraps.
export function BilingualLabel({ message, values = [] }) {
    const language = useLanguage();
    return <span className="bilingual-label" data-alternate={translateLabel(message, language === 'en' ? 'he' : 'en', ...values)}>
        <span>{translateLabel(message, language, ...values)}</span>
    </span>;
}
