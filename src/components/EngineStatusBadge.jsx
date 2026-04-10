import React, { memo } from 'react';

const EngineStatusBadge = memo(({ engineStats }) => {
  if (!engineStats) return null;

  return (
    <span className="text-xs text-gray-400 dark:text-gray-500 noselect">
      מנוע: {engineStats.workerAvailable ? 'Worker' : 'Main'} ·
      זמן אחרון: {engineStats.lastDurationMs}ms ·
      fallback: {engineStats.fallbackCount}
    </span>
  );
});

export default EngineStatusBadge;
