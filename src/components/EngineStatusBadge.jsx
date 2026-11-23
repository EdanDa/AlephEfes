import { t } from '../i18n/locale.js';
import useLanguage from '../i18n/LanguageContext.jsx';
import { memo } from 'react';

const EngineStatusBadge = memo(({ engineStats }) => {
  useLanguage();
  if (!engineStats) return null;

  return (
    <span className="text-xs text-gray-400 dark:text-gray-500 noselect">{t("מנוע: ")}{engineStats.workerAvailable ? 'Worker' : 'Main'}{t(" · זמן אחרון: ")}{engineStats.lastDurationMs}ms ·
      fallback: {engineStats.fallbackCount}
    </span>
  );
});

export default EngineStatusBadge;
