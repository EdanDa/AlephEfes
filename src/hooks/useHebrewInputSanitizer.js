import { useCallback } from 'react';

const HEBREW_CHAR_RE = /^[א-ת]$/;
const hasHebrewChar = (ch) => {
  if (!ch || ch.length !== 1) return false;
  const code = ch.charCodeAt(0);
  return code >= 0x05D0 && code <= 0x05EA;
};

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
    const outputChars = [];

    for (const ch of normalized) {
      if (ch === ' ' || ch === '\n' || hasHebrewChar(ch)) {
        outputChars.push(ch);
      } else {
        const lower = ch.toLowerCase();
        if (EN_TO_HE_LETTER_MAP[lower]) {
          outputChars.push(EN_TO_HE_LETTER_MAP[lower]);
        } else if (!hasHebrewLetters && EN_TO_HE_PUNCT_LETTER_MAP[ch]) {
          outputChars.push(EN_TO_HE_PUNCT_LETTER_MAP[ch]);
        } else if (!hasHebrewLetters && EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP[ch]) {
          outputChars.push(EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP[ch]);
        } else {
          outputChars.push(' ');
        }
      }
    }

    return outputChars.join('')
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
    .filter((ch) => ch === ' ' || ch === '\n' || HEBREW_CHAR_RE.test(ch))
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
