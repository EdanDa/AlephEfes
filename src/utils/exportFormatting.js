export function stripTrailingSpacesPerLine(text) {
  if (typeof text !== 'string') return '';
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}
