import { boundaryTypeNames } from '../core/researchModel.js';
import useLanguage from '../i18n/LanguageContext.jsx';
import { t } from '../i18n/locale.js';

export default function TanakhBoundary({ boundary }) {
    const language = useLanguage();
    return <span className="tanakh-match-boundary" lang={language} dir="auto">
        {t(boundaryTypeNames[boundary.normalizedType])} · <bdi lang="he">{boundary.upstreamMarker}</bdi>
    </span>;
}
