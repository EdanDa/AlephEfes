import { createContext, useContext, useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from './locale.js';

const LanguageContext = createContext('he');

export function LanguageProvider({ children }) {
    const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
    return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

export default function useLanguage() {
    return useContext(LanguageContext);
}
