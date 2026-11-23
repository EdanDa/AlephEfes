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

// Size wrapping headings for both languages, including at enlarged font sizes.
export function BilingualLabel({ message }) {
    const language = useLanguage();
    return <span className="bilingual-label" data-alternate={translateLabel(message, language === 'en' ? 'he' : 'en')}>
        <span>{translateLabel(message, language)}</span>
    </span>;
}
