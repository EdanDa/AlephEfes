export function stripTrailingSpacesPerLine(text) {
  if (typeof text !== 'string') return '';
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}


export const COPY_LAYER_LEGEND = "א'-אחדות ע'-עשרות מ'-מאות";
export const COPY_PRIME_LEGEND = "♢-ראשוני";

export function formatTextForClipboard(text) {
  const cleaned = stripTrailingSpacesPerLine(text);
  if (!cleaned) return '';

  const normalized = cleaned.trimStart();
  const headerLine = `${COPY_LAYER_LEGEND} ${COPY_PRIME_LEGEND}`;
  if (normalized.startsWith(headerLine)) return cleaned;

  return `${headerLine}\n---\n\n${cleaned}`;
}
