import { t } from '../i18n/locale.js';
export function stripTrailingSpacesPerLine(text) {
  if (typeof text !== 'string') return '';
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}


export const COPY_LAYER_LEGEND = "י'-יחידות ע'-עשרות מ'-מאות";
export const COPY_PRIME_LEGEND = "♢-ראשוני";

export function formatTextForClipboard(text) {
  const cleaned = stripTrailingSpacesPerLine(text).replace(/-{4,}/g, '---');
  if (!cleaned) return '';

  const normalized = cleaned.trimStart();
  const headerLine = `${t(COPY_LAYER_LEGEND)} ${t(COPY_PRIME_LEGEND)}`;
  if (normalized.startsWith(headerLine)) return cleaned;

  return `${headerLine}\n---\n\n${cleaned}`;
}
