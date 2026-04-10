import { useCallback } from 'react';

export function useHebrewInputSanitizer({
  HEB_MARKS_RE,
  INPUT_HEBREW_JOINERS_RE,
  INPUT_PUNCT_TO_SPACE_RE,
  INPUT_MULTI_SPACE_RE,
  EN_TO_HE_LETTER_MAP,
  EN_TO_HE_PUNCT_LETTER_MAP,
  EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP,
}) {
  const sanitizeHebrewInput = useCallback((value = '') => {
    const normalized = (value.normalize ? value.normalize('NFKD') : value)
      .replace(HEB_MARKS_RE, '')
      .replace(/\r\n?/g, '\n')
      .replace(INPUT_HEBREW_JOINERS_RE, '$1')
      .replace(INPUT_PUNCT_TO_SPACE_RE, ' ');
    const hasHebrewLetters = /[א-תךםןףץ]/.test(normalized);
    let output = '';

    for (const ch of normalized) {
      if (ch === ' ' || ch === '\n' || /^[א-ת]$/.test(ch)) {
        output += ch;
      } else {
        const lower = ch.toLowerCase();
        if (EN_TO_HE_LETTER_MAP[lower]) {
          output += EN_TO_HE_LETTER_MAP[lower];
        } else if (!hasHebrewLetters && EN_TO_HE_PUNCT_LETTER_MAP[ch]) {
          output += EN_TO_HE_PUNCT_LETTER_MAP[ch];
        } else if (!hasHebrewLetters && EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP[ch]) {
          output += EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP[ch];
        } else {
          output += ' ';
        }
      }
    }

    return output
      .replace(INPUT_MULTI_SPACE_RE, ' ')
      .replace(/\n[ ]+/g, '\n');
  }, [
    EN_TO_HE_LETTER_MAP,
    EN_TO_HE_PUNCT_LETTER_MAP,
    EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP,
    HEB_MARKS_RE,
    INPUT_HEBREW_JOINERS_RE,
    INPUT_PUNCT_TO_SPACE_RE,
    INPUT_MULTI_SPACE_RE,
  ]);

  const sanitizePastedHebrewInput = useCallback((value = '') => (value.normalize ? value.normalize('NFKD') : value)
    .replace(HEB_MARKS_RE, '')
    .replace(/\r\n?/g, '\n')
    .replace(INPUT_HEBREW_JOINERS_RE, '$1')
    .replace(INPUT_PUNCT_TO_SPACE_RE, ' ')
    .split('')
    .filter((ch) => ch === ' ' || ch === '\n' || /^[א-ת]$/.test(ch))
    .join('')
    .replace(INPUT_MULTI_SPACE_RE, ' ')
    .replace(/\n[ ]+/g, '\n')
    .replace(/(^|[ \n])[א-ת](?=($|[ \n]))/g, '$1')
    .replace(INPUT_MULTI_SPACE_RE, ' ')
    .replace(/\n[ ]+/g, '\n'), [
    HEB_MARKS_RE,
    INPUT_HEBREW_JOINERS_RE,
    INPUT_PUNCT_TO_SPACE_RE,
    INPUT_MULTI_SPACE_RE,
  ]);

  return { sanitizeHebrewInput, sanitizePastedHebrewInput };
}
