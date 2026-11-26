// Definitions counted independently by scripts/audit-research-operators.py.
const valueEquals = target => `U = ${target} or T = ${target} or H = ${target}`;
const wordCount = valueEquals('W');
const letterCount = valueEquals('L');

export const operatorCatalog = [
    { id: 'wordCount', label: 'ערך המילה שווה למספר המילים ביחידה', domain: 'word', formula: wordCount },
    { id: 'letterCount', label: 'ערך המילה שווה למספר האותיות ביחידה', domain: 'word', formula: letterCount },
    { id: 'wordPosition', label: 'ערך המילה שווה למיקומה (מ־1)', domain: 'word', formula: valueEquals('pos') },
    { id: 'zeroAddress', label: 'ערך המילה שווה לכתובתה (מ־0)', domain: 'word', formula: valueEquals('pos - 1') },
    { id: 'sectionOrdinal', label: 'ערך המילה שווה למספר הפרשיה בספר', domain: 'word', formula: valueEquals('section') },
    { id: 'letterStart', label: 'ערך המילה שווה למיקום האות הראשונה שלה', domain: 'word', formula: valueEquals('start') },
    { id: 'letterEnd', label: 'ערך המילה שווה למיקום האות האחרונה שלה', domain: 'word', formula: valueEquals('end') },
    { id: 'formOccurrence', label: 'ערך המילה שווה למספרו הסידורי של המופע באותו כתיב', domain: 'word', formula: valueEquals('occ') },
    { id: 'centerMeasuresWords', label: 'ערך המילה האמצעית שווה למספר המילים ביחידה', domain: 'word', formula: `(${wordCount}) and 2 * pos = W + 1` },
    { id: 'repeatDistance', label: 'ערך המילה שווה למרחק בין שני מופעיה', domain: 'repeat', formula: valueEquals('gap') },
    { id: 'mirrorSpelling', label: 'אותו כתיב בשני מקומות סימטריים ביחידה', domain: 'mirror', formula: 'form = b.form' },
    { id: 'sameWordBothDimensions', label: 'אותה מילה מתאימה למספר המילים ולמספר האותיות', domain: 'word', formula: `(${wordCount}) and (${letterCount})` },
    { id: 'bothDimensions', label: 'ביחידה יש התאמה למספר המילים והתאמה למספר האותיות', domain: 'unit', formula: `count(${wordCount}) > 0 and count(${letterCount}) > 0` },
    { id: 'localFrequency', label: 'ערך המילה שווה למספר מופעי הכתיב ביחידה', domain: 'word', formula: valueEquals('freq') },
    { id: 'middleSelfPosition', label: 'ערך המילה האמצעית שווה למיקומה', domain: 'word', formula: `2 * pos = W + 1 and (${valueEquals('pos')})` },
    { id: 'doubleCenter', label: 'המילה האמצעית מכילה את האות האמצעית', domain: 'word', formula: '2 * pos = W + 1 and L % 2 = 1 and 2 * start <= L + 1 and 2 * end >= L + 1' },
    { id: 'centerSeam', label: 'אמצע המילים ואמצע האותיות נופלים באותו רווח', domain: 'word', formula: '2 * pos = W and 2 * end = L' },
    { id: 'repeatLattice', label: 'שלושה מופעים רצופים של אותו כתיב במרווחים שווים', domain: 'word', formula: 'prevGap = nextGap' },
    { id: 'prefixMeasuresWords', label: 'סכום הערכים מתחילת היחידה שווה למספר המילים', domain: 'word', formula: 'prefixU = W or prefixT = W or prefixH = W' },
    { id: 'suffixMeasuresWords', label: 'סכום הערכים עד סוף היחידה שווה למספר המילים', domain: 'word', formula: 'suffixU = W or suffixT = W or suffixH = W' },
    { id: 'frameSpelling', label: 'המילה הראשונה והאחרונה זהות בכתיבן', domain: 'mirror', formula: 'pos = 1 and form = b.form' },
    { id: 'adjacentEquivalent', label: 'כתיבים סמוכים שונים שווים בכל שלוש השכבות', domain: 'adjacent', formula: 'form != b.form and U = b.U and T = b.T and H = b.H' },
];
