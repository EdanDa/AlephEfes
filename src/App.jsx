import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, useTransition, useLayoutEffect } from 'react'; 

// --- Constants ---
const BASE_LETTER_VALUES = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
    'כ': 11, 'ל': 12, 'מ': 13, 'נ': 14, 'ס': 15, 'ע': 16, 'פ': 17, 'צ': 18, 'ק': 19,
    'ר': 20, 'ש': 21, 'ת': 22,
};
const HEB_FINALS = { 'ך':'כ', 'ם':'מ', 'ן':'נ', 'ף':'פ', 'ץ':'צ' };
const CLEAN_RE = /[.,:"'!?()\[\]{}־–—\u05F3\u05F4\u0591-\u05C7]/gu;
const HYPHEN_RE = /[־–—\-]/g;


// --- Caching for expensive functions ---
const primeCache = new Map();

// --- Utility Functions ---
const isPrime = (num) => {
    if (primeCache.has(num)) return primeCache.get(num);
    if (num <= 1) { primeCache.set(num, false); return false; }
    if (num <= 3) { primeCache.set(num, true); return true; }
    if (num % 2 === 0 || num % 3 === 0) { primeCache.set(num, false); return false; }
    for (let i = 5; i * i <= num; i += 6) {
      if (num % i === 0 || num % (i + 2) === 0) {
        primeCache.set(num, false);
        return false;
      }
    }
    primeCache.set(num, true);
    return true;
};

const getDigitalRoot = (n) => (n === 0 ? 0 : ((n % 9) || 9));


// --- Pre-computation Functions (Optimization) ---

// Pre-computes the three layer values for each letter based on the mode.
function buildLetterTable(mode) {
  const table = new Map();
  const letters = Object.keys(BASE_LETTER_VALUES);

  for (const ch of letters) {
    const v = mode === 'aleph-zero' ? BASE_LETTER_VALUES[ch] - 1 : BASE_LETTER_VALUES[ch];
    let tens, hundreds;

    if (mode === 'aleph-zero') {
      const tens_k = v >= 10 ? (v - 10) : 0;
      const hundreds_m = v === 20 ? 10 : v === 21 ? 20 : 0;
      tens = v + 9 * tens_k;
      hundreds = tens + 9 * hundreds_m;
    } else { // aleph-one
      const tens_k = v >= 11 ? (v - 10) : 0;
      const hundreds_m = v === 21 ? 10 : v === 22 ? 30 : 0;
      tens = v + 9 * tens_k;
      hundreds = tens + 9 * hundreds_m;
    }
    table.set(ch, { u: v, t: tens, h: hundreds });
  }

  // Map final letters to their base letter values
  for (const [f, baseCh] of Object.entries(HEB_FINALS)) {
    const r = table.get(baseCh);
    if (r) table.set(f, { ...r });
  }
  return table;
}

// Factory function to create a memoized word computer.
function makeWordComputer(letterTable) {
  const cache = new Map();

  return (rawWord) => {
    if (cache.has(rawWord)) return cache.get(rawWord);

    const clean = rawWord.replace(CLEAN_RE, '').trim();
    if (!clean || !isNaN(clean)) {
      cache.set(rawWord, null);
      return null;
    }

    let u = 0, t = 0, h = 0;
    const letterDetails = [];
    let maxLayer = 'U';

    for (const ch of clean) {
      const rec = letterTable.get(ch);
      if (!rec) continue;
      u += rec.u;
      t += rec.t;
      h += rec.h;
      letterDetails.push({ char: ch, value: rec.u });
      
      const baseLetter = HEB_FINALS[ch] || ch;
      const baseValue = BASE_LETTER_VALUES[baseLetter];
      if (baseValue >= 21) maxLayer = 'H';
      else if (baseValue >= 12 && maxLayer !== 'H') maxLayer = 'T';
    }

    const dr = getDigitalRoot(u);
    const res = {
      word: clean, letterDetails,
      units: u, tens: t, hundreds: h, dr,
      isPrimeU: isPrime(u), 
      isPrimeT: maxLayer !== 'U' && isPrime(t), 
      isPrimeH: maxLayer === 'H' && isPrime(h),
      maxLayer
    };
    cache.set(rawWord, res);
    return res;
  };
}

// Pure function to compute all results from text.
function computeResults(text, letterTable) {
  const lines = text.split('\n').filter(l => l.trim().length);
  const computeWord = makeWordComputer(letterTable);

  const drDistribution = Array(10).fill(0);
  const allWordsMap = new Map();
  const primeSummary = [];
  const calculatedLines = [];
  const valueToWordsMap = new Map();
  
  let grandU = 0, grandT = 0, grandH = 0;
  let totalWordCount = 0;

  for (let li = 0; li < lines.length; li++) {
    const lineWithSpacesForHyphens = lines[li].replace(HYPHEN_RE, ' ');
    const words = lineWithSpacesForHyphens.split(/\s+/).filter(Boolean);
    let lineU = 0, lineT = 0, lineH = 0;
    const calcWords = [];
    let lineMaxLayer = 'U';

    for (const raw of words) {
      const wd = computeWord(raw);
      if (!wd) continue;
      totalWordCount++;
      calcWords.push(wd);

      lineU += wd.units;
      lineT += wd.tens;
      lineH += wd.hundreds;

      if (wd.maxLayer === 'H') lineMaxLayer = 'H';
      else if (wd.maxLayer === 'T' && lineMaxLayer !== 'H') lineMaxLayer = 'T';

      if (!allWordsMap.has(wd.word)) {
        allWordsMap.set(wd.word, wd);
      }
      drDistribution[wd.dr]++;
        
      [wd.units, wd.tens, wd.hundreds].forEach(v => {
        if (!valueToWordsMap.has(v)) valueToWordsMap.set(v, new Set());
        valueToWordsMap.get(v).add(wd.word);
      });
    }

    grandU += lineU;
    grandT += lineT;
    grandH += lineH;

    const isPrimeLineU = isPrime(lineU);
    const isPrimeLineT = lineMaxLayer !== 'U' && isPrime(lineT);
    const isPrimeLineH = lineMaxLayer === 'H' && isPrime(lineH);

    const linePrimes = {};
    if (isPrimeLineU) {
        if (!linePrimes[lineU]) linePrimes[lineU] = [];
        linePrimes[lineU].push('יחידות');
    }
    if (isPrimeLineT) {
        if (!linePrimes[lineT]) linePrimes[lineT] = [];
        linePrimes[lineT].push('עשרות');
    }
    if (isPrimeLineH) {
        if (!linePrimes[lineH]) linePrimes[lineH] = [];
        linePrimes[lineH].push('מאות');
    }
    for (const [value, layers] of Object.entries(linePrimes)) {
        primeSummary.push({ line: li + 1, value: parseInt(value), layers });
    }

    calculatedLines.push({
      lineText: lines[li],
      words: calcWords,
      totals: { units: lineU, tens: lineT, hundreds: lineH },
      totalsDR: getDigitalRoot(lineU),
      isPrimeTotals: { U: isPrimeLineU, T: isPrimeLineT, H: isPrimeLineH },
      lineMaxLayer
    });
  }

  const connectionValues = new Set();
  for (const [value, words] of valueToWordsMap.entries()) {
      if (words.size > 1) {
          connectionValues.add(value);
      }
  }

  const drClusters = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, []]));
  for (const wd of allWordsMap.values()) {
    if (wd.dr > 0) drClusters[wd.dr].push(wd);
  }
  for (const k in drClusters) {
      drClusters[k].sort((a, b) => {
        if (a.units !== b.units) return a.units - b.units;
        if (a.tens !== b.tens) return a.tens - b.tens;
        return a.hundreds - b.hundreds;
      });
  }

  const grandTotals = {
    units: grandU, tens: grandT, hundreds: grandH,
    dr: getDigitalRoot(grandU),
    isPrime: { U: isPrime(grandU), T: isPrime(grandT), H: isPrime(grandH) }
  };

  return {
    lines: calculatedLines, grandTotals, primeSummary, drClusters,
    allWords: Array.from(allWordsMap.values()),
    drDistribution, totalWordCount,
    connectionValues,
  };
}


// --- SVG Icons (Lucide Replacements) ---
const ICONS = {
    sun: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
    moon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
    hash: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>,
    info: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
    copy: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
    check: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
    grid: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>,
    network: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>,
    'chevron-down': <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
};
const Icon = React.memo(({ name, className }) => <div className={className}>{ICONS[name]}</div>);

// Main component for the Advanced Aleph-Code Calculator
const App = () => {
    // State for user input, results, and UI settings
    const [text, setText] = useState('יהוה\nאלהים\nתורה\nאור\nאדם\nדם\nדוד\nזב\nנח\nאיל');
    const [results, setResults] = useState(null);
    const [selectedDR, setSelectedDR] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
    const [isValueTableOpen, setIsValueTableOpen] = useState(false);
    const [isAutoCalculateOn, setIsAutoCalculateOn] = useState(true);
    const [mode, setMode] = useState('aleph-zero'); // 'aleph-zero' or 'aleph-one'
    const [copiedId, setCopiedId] = useState(null);
    const [view, setView] = useState('lines'); // 'lines' or 'clusters'
    const [hoveredWord, setHoveredWord] = useState(null);
    const [isPrimesCollapsed, setIsPrimesCollapsed] = useState(true);
    const clusterRefs = useRef({});
    const valueTableRef = useRef(null);
    
    const letterTable = useMemo(() => buildLetterTable(mode), [mode]);
    const deferredText = useDeferredValue(text);
    const [isPending, startTransition] = useTransition();

    // --- NEW: Fixed Layer Colors and Match Logic ---
    const LAYER_COLORS = {
      U: { light: 'hsl(210, 80%, 95%)', dark: 'hsl(210, 30%, 25%)', dot: 'hsl(210, 85%, 55%)' }, // blue
      T: { light: 'hsl(140, 70%, 94%)', dark: 'hsl(140, 30%, 22%)', dot: 'hsl(140, 65%, 45%)' }, // green
      H: { light: 'hsl(280, 75%, 95%)', dark: 'hsl(280, 25%, 28%)', dot: 'hsl(280, 70%, 60%)' }, // violet
    };
    const LAYER_PRIORITY = ['H','T','U'];

    const layersMatching = (hovered, current) => {
      if (!hovered || !current) return [];
      const matches = [];
      if (hovered.units    === current.units)    matches.push('U');
      if (hovered.tens     === current.tens)     matches.push('T');
      if (hovered.hundreds === current.hundreds) matches.push('H');
      // cross-layer equality
      if (hovered.units === current.tens)     matches.push('T');
      if (hovered.units === current.hundreds) matches.push('H');
      if (hovered.tens  === current.units)    matches.push('U');
      if (hovered.tens  === current.hundreds) matches.push('H');
      if (hovered.hundreds === current.units) matches.push('U');
      if (hovered.hundreds === current.tens)  matches.push('T');
      return Array.from(new Set(matches));
    }

    const strongestLayer = (matchLayers) => {
      return LAYER_PRIORITY.find(L => matchLayers.includes(L)) || null;
    }

    // Effect to scroll to the selected DR cluster
    useLayoutEffect(() => {
        if (view !== 'clusters' || !selectedDR) return;
        const el = clusterRefs.current[selectedDR];
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [selectedDR, view]);

    // Effect to handle clicks outside the value table
    useEffect(() => {
        function handleClickOutside(event) {
            if (valueTableRef.current && !valueTableRef.current.contains(event.target)) {
                setIsValueTableOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [valueTableRef]);

    // Load text from localStorage on initial render
    useEffect(() => {
        const savedText = localStorage.getItem('alephCodeText');
        if (savedText) {
            setText(savedText);
        }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setIsDarkMode(true);
        }
    }, []);
    
    const handleCalculate = useCallback(() => {
        const res = computeResults(text, letterTable);
        setResults(res);
    }, [text, letterTable]);

    // Auto-calculate on text change with a dynamic debounce and React 18 transition
    useEffect(() => {
        if (!isAutoCalculateOn) return;
        
        const run = () => {
            if (deferredText) {
                startTransition(() => {
                    setResults(computeResults(deferredText, letterTable));
                });
            } else {
                setResults(null);
            }
        };

        const delay = Math.min(1000, Math.max(200, deferredText.length * 0.5));
        const handler = setTimeout(run, delay);

        return () => clearTimeout(handler);
    }, [deferredText, isAutoCalculateOn, letterTable]);


    // Save text to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('alephCodeText', text);
    }, [text]);

    // Apply dark mode class to body
    useEffect(() => {
        document.body.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    const stats = useMemo(() => {
        if (!results) return null;
        return {
            totalLines: results.lines.length,
            totalWords: results.totalWordCount,
            uniqueWords: results.allWords.length,
            primeLineTotals: results.primeSummary.length,
            totalConnections: results.connectionValues ? results.connectionValues.size : 0,
            drDistribution: results.drDistribution,
        };
    }, [results]);

    const copySummaryToClipboard = () => {
        if (!results) return;
        
        const primeMarker = (isPrime) => isPrime ? " ♢" : "";

        let summary = `סיכום כללי - קוד-אלף\n===================\n`;
        summary += `סה\"כ יחידות: ${results.grandTotals.units}${primeMarker(results.grandTotals.isPrime.U)}\n`;
        summary += `סה\"כ עשרות: ${results.grandTotals.tens}${primeMarker(results.grandTotals.isPrime.T)}\n`;
        summary += `סה\"כ מאות: ${results.grandTotals.hundreds}${primeMarker(results.grandTotals.isPrime.H)}\n`;
        summary += `ש"ד כללי: ${results.grandTotals.dr}\n\n`;

        if (view === 'clusters') {
            summary += `סיכום מצבורי שורשים דיגיטליים\n---------------------------\n`;
            Object.entries(results.drClusters).forEach(([dr, words]) => {
                if (words.length > 0) {
                    summary += `\nש"ד ${dr} (${words.length} מילים)\n`;
                    words.forEach(wordData => {
                        const values = [];
                        values.push(`יחידות: ${wordData.units}${primeMarker(wordData.isPrimeU)}`);
                        if (wordData.maxLayer !== 'U' && wordData.tens !== wordData.units) {
                            values.push(`עשרות: ${wordData.tens}${primeMarker(wordData.isPrimeT)}`);
                        }
                        if (wordData.maxLayer === 'H' && wordData.hundreds !== wordData.tens) {
                            values.push(`מאות: ${wordData.hundreds}${primeMarker(wordData.isPrimeH)}`);
                        }
                        summary += `- ${wordData.word} (${values.join(', ')})\n`;
                    });
                }
            });
        } else { // 'lines' view
            summary += `סיכום שורות\n---------------------------\n`;
            results.lines.forEach((line, index) => {
                summary += `שורה ${index + 1}: "${line.lineText}"\n`;
                summary += `  - סה\"כ: יחידות=${line.totals.units}${primeMarker(line.isPrimeTotals.U)}, עשרות=${line.totals.tens}${primeMarker(line.isPrimeTotals.T)}, מאות=${line.totals.hundreds}${primeMarker(line.isPrimeTotals.H)}, ש"ד=${line.totalsDR}\n`;
            });
        }
        
        if (results.primeSummary.length > 0) {
            summary += `\n\nסיכום ראשוניים מסכומי שורות\n---------------------------\n`;
            results.primeSummary.forEach(p => {
                summary += `שורה ${p.line}: ${p.value} (שכבת ${p.layers.join(', ')})\n`;
            });
        }
        
        const textArea = document.createElement("textarea");
        textArea.value = summary;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            setCopiedId('summary');
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
        document.body.removeChild(textArea);
    };
    
    const exportToCSV = () => {
        if (!results || !stats) return;
        const rows = [];
        rows.push(["סיכום סטטיסטי"]);
        rows.push(["סה\"כ שורות", stats.totalLines]);
        rows.push(["סה\"כ מילים", stats.totalWords]);
        rows.push(["מילים ייחודיות", stats.uniqueWords]);
        rows.push(["שורות עם סכום ראשוני", stats.primeLineTotals]);
        rows.push(["קבוצות קשרים", stats.totalConnections || 0], []);

        rows.push([
            "ניתוח מפורט - שורה",
            "מילה",
            "חישוב",
            "Σ-יחידות",
            "ראשוני (יחידות)",
            "Σ-עשרות",
            "ראשוני (עשרות)",
            "Σ-מאות",
            "ראשוני (מאות)",
            "ש\"ד"
        ]);
        results.lines.forEach((line, i)=>{
            line.words.forEach(w=>{
            rows.push([
                i+1,
                w.word,
                w.letterDetails.map(l=>l.value).join('+'),
                w.units, w.isPrimeU?'כן':'לא',
                w.tens, w.isPrimeT?'כן':'לא',
                w.hundreds, w.isPrimeH?'כן':'לא',
                w.dr
            ]);
            });
        });

        rows.push([]);
        Object.entries(results.drClusters).forEach(([dr, words])=>{
            if (!words.length) return;
            rows.push([`ש"ד ${dr}`]);
            rows.push(["מילה","Σ-יחידות","Σ-עשרות","Σ-מאות"]);
            words.forEach(w=>{
            rows.push([w.word, w.units, w.tens, w.hundreds]);
            });
            rows.push([]);
        });

        const csv = "\uFEFF" + rows.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: 'aleph_code_analysis.csv' });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    // --- Render Functions ---
    const ValueCell = ({ value, isPrimeFlag, previousValue, isApplicable = true }) => {
        const className = `px-4 py-3 text-center tabular-nums ${isPrimeFlag ? 'text-emerald-500' : 'text-gray-700 dark:text-gray-300'}`;
        if (!isApplicable) {
            return <td className={className}>-</td>;
        }
        if (value === previousValue) {
            return <td className={className}>〃</td>;
        }
        return (
            <td className={className}>
                {value} {isPrimeFlag && <span className="mr-1 text-emerald-500" title="ראשוני">♢</span>}
            </td>
        );
    };
    
    const TotalNumberDisplay = ({ value, isPrimeFlag }) => ( <p className={`text-3xl font-bold ${isPrimeFlag ? 'text-emerald-400' : 'text-white'}`}> {value} {isPrimeFlag && <span className="mr-2 text-xl">♢</span>} </p> );
    
    const ValueDisplay = ({ value, isPrime }) => (
        <span className={isPrime ? 'text-yellow-400 dark:text-yellow-300' : ''}>
            {value}{isPrime && '♢'}
        </span>
    );

    const getWordValues = ({ hundreds, tens, units, isPrimeH, isPrimeT, isPrimeU }) => {
        const out = [];
        if (hundreds !== tens) out.push({ value: hundreds, isPrime: isPrimeH, layer: 'H' });
        if (tens !== units)   out.push({ value: tens,     isPrime: isPrimeT, layer: 'T' });
        out.push({ value: units, isPrime: isPrimeU, layer: 'U' });
        return out;
    };

    const WordValuesDisplay = ({ wordData, isDarkMode, matches, connectionValues, hoveredWord }) => {
        const values = getWordValues(wordData);
        const baseBorder = isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(31,41,55,0.60)';
        
        return (
            <div
                className={`grid grid-flow-col auto-cols-max gap-x-2 text-xs font-mono tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
            >
                {values.map((v, i) => {
                    const L = v.layer;
                    const isHit = hoveredWord && connectionValues.has(v.value) && matches.includes(L);
                    
                    let dotColor = null;
                    if (isHit) {
                        const sourceLayers = [];
                        if (hoveredWord.units === v.value) sourceLayers.push('U');
                        if (hoveredWord.tens === v.value) sourceLayers.push('T');
                        if (hoveredWord.hundreds === v.value) sourceLayers.push('H');
                        const topSourceLayer = strongestLayer(sourceLayers);
                        if (topSourceLayer) {
                            dotColor = LAYER_COLORS[topSourceLayer].dot;
                        }
                    }

                    return (
                        <div key={i} className="flex flex-col items-center">
                            <span className={v.isPrime ? 'text-yellow-400 dark:text-yellow-300' : ''}>
                                {v.value}{v.isPrime && '♢'}
                            </span>
                            <span
                                className="w-3 h-3 mt-0.5 border-2 transition-all duration-200"
                                style={{
                                    borderRadius: L==='U' ? '9999px' : '4px',
                                    transform:   L==='H' ? 'rotate(45deg)' : 'none',
                                    borderColor: dotColor || baseBorder,
                                    background:  dotColor || 'transparent'
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        );
    };


    const handleDrillDown = (dr) => {
        setView('clusters');
        setSelectedDR(dr === selectedDR ? null : dr);
    };

    const colorClasses = {
      blue:   { boxLight: 'bg-blue-50 border-blue-200', text: 'text-blue-800', boxDark: 'bg-gray-700/50 border-blue-800' },
      indigo: { boxLight: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800', boxDark: 'bg-gray-700/50 border-indigo-800' },
      purple: { boxLight: 'bg-purple-50 border-purple-200', text: 'text-purple-800', boxDark: 'bg-gray-700/50 border-purple-800' },
      emerald:{ boxLight: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', boxDark: 'bg-gray-700/50 border-emerald-800' },
      pink:   { boxLight: 'bg-pink-50 border-pink-200', text: 'text-pink-800', boxDark: 'bg-gray-700/50 border-pink-800' },
    };


    return (
        <div 
            dir="rtl" 
            className={`min-h-screen font-sans p-4 sm:p-6 lg:p-8 transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-gray-200' : 'bg-gradient-to-br from-gray-50 to-blue-50 text-gray-800'}`}
        >
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <button onClick={() => setIsValueTableOpen(!isValueTableOpen)} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                <Icon name="hash" className="w-5 h-5 text-purple-600"/>
                            </button>
                            <div className="absolute top-full right-1/2 translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                Show Letter Values
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1"><span className="text-yellow-500">♢</span>: Prime</span>
                            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full border border-blue-500"></div>: Units</span>
                            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 border border-green-500"></div>: Tens</span>
                            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 border border-purple-500 transform rotate-45"></div>: Hundreds</span>
                        </div>
                    </div>

                    <div className="text-center">
                        <h1 className="text-5xl font-bold bg-gradient-to-l from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                            {mode === 'aleph-zero' ? 'מחשבון אלף-אפס' : 'מחשבון אלף-אחד'}
                        </h1>
                        <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>כלי לניתוח נומרולוגי של טקסט עברי</p>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            {isDarkMode ? <Icon name="sun" className="w-5 h-5 text-yellow-400"/> : <Icon name="moon" className="w-5 h-5 text-blue-600"/>}
                        </button>
                        <button onClick={() => setIsAboutModalOpen(true)} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            <Icon name="info" className="w-5 h-5 text-blue-600"/>
                        </button>
                    </div>
                </header>

                {isValueTableOpen && (
                    <div ref={valueTableRef} className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h2 className="text-2xl font-bold mb-4 text-center">טבלת ערכי אותיות ({mode === 'aleph-zero' ? 'אלף-אפס' : 'אלף-אחד'})</h2>
                        <div className="flex justify-center gap-8">
                            { [0, 11].map(offset => (
                                <table key={offset} className="text-center w-full max-w-xs"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                                    <tr>
                                        {['אות', 'יחידות', 'עשרות', 'מאות'].map(header => <th key={header} className="p-2 font-semibold">{header}</th>)}
                                    </tr>
                                </thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    {Object.keys(BASE_LETTER_VALUES).slice(offset, offset + 11).map(letter => {
                                        const rec = letterTable.get(letter);
                                        const finalForm = Object.keys(HEB_FINALS).find(key => HEB_FINALS[key] === letter);
                                        if (!rec) return null;
                                        return (
                                        <tr key={letter} className={isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                                            <td className="p-2 font-bold text-xl flex items-center justify-center gap-2">
                                                <span>{letter}</span>
                                                {finalForm && <span className="text-gray-500 dark:text-gray-400">{finalForm}</span>}
                                            </td>
                                            <td className="p-2 font-mono">{rec.u}</td>
                                            <td className="p-2 font-mono">{rec.t}</td>
                                            <td className="p-2 font-mono">{rec.h}</td>
                                        </tr>
                                        );
                                    })}
                                </tbody></table>
                            ))}
                        </div>
                    </div>
                )}
                
                {isAboutModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsAboutModalOpen(false)}>
                        <div className={`p-8 rounded-xl max-w-2xl mx-auto relative ${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'}`} onClick={e => e.stopPropagation()}>
                            <h2 className="text-3xl font-bold mb-4 text-center bg-gradient-to-l from-blue-600 to-purple-600 bg-clip-text text-transparent">אודות פרויקט "קוד-אלף"</h2>
                            <p className="mb-4 text-right">כלי זה הוא פרי מחקר עצמאי של <strong>עידן-דוד עיון</strong>, פילוסוף וחוקר אוטודידקט. המחקר החל מהתובנה הפשוטה שהאות הראשונה במילה הראשונה בתורה, ב', עשויה לייצג את הערך 1, מה שמוביל למסקנה המהפכנית ש-א'=0.</p>
                            <p className="mb-4 text-right">השערת המחקר היא ש"קוד-אלף" אינו גימטריה מיסטית, אלא מערכת מתמטית-ספרותית עתיקה ומכוונת ששימשה את עורכי המקרא. המערכת מתפקדת כ"שפת-על" המקודדת בתוך הטקסט שכבות של משמעות תיאולוגית, קוסמולוגית והיסטורית, וחושפת את יוצרי המקרא כ"ארכיטקטים של תודעה".</p>
                            <button onClick={() => setIsAboutModalOpen(false)} className="absolute top-4 left-4 text-2xl">&times;</button>
                        </div>
                    </div>
                )}

                <div className={`p-6 rounded-xl border mb-8 transition-all ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <label htmlFor="text-input" className="block text-lg font-semibold">הזן טקסט לניתוח:</label>
                        <div className="flex items-center p-1 rounded-full bg-gray-200 dark:bg-gray-700">
                            <button onClick={() => setMode('aleph-zero')} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${mode === 'aleph-zero' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>אלף-אפס</button>
                            <button onClick={() => setMode('aleph-one')} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${mode === 'aleph-one' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>אלף-אחד</button>
                        </div>
                    </div>
                    <textarea dir="rtl" id="text-input" className={`w-full p-4 border rounded-lg focus:ring-2 focus:border-blue-500 transition duration-150 text-lg leading-7 text-right ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300'}`} rows="5" value={text} onChange={(e) => setText(e.target.value)} placeholder="בראשית ברא אלהים..."></textarea>
                    <div className="mt-4 flex justify-center items-center gap-4">
                        <div className="flex items-center">
                            <input type="checkbox" id="auto-calc" checked={isAutoCalculateOn} onChange={() => setIsAutoCalculateOn(!isAutoCalculateOn)} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                            <label htmlFor="auto-calc" className="mr-2 text-sm font-medium">חשב אוטומטית</label>
                        </div>
                        {!isAutoCalculateOn && (
                            <button onClick={handleCalculate} className="px-8 py-3 bg-gradient-to-l from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105 active:scale-95">חשב ונתח</button>
                        )}
                    </div>
                </div>

                {stats && (
                    <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h2 className="text-2xl font-bold mb-6 text-center">ניתוח סטטיסטי</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center mb-6">
                                 {[{label: 'סה"כ שורות', value: stats.totalLines, color: 'blue'}, {label: 'סה"כ מילים', value: stats.totalWords, color: 'indigo'}, {label: 'מילים ייחודיות', value: stats.uniqueWords, color: 'purple'}, {label: 'שורות ראשוניות', value: stats.primeLineTotals, color: 'emerald'}, {label: 'קבוצות קשרים', value: stats.totalConnections, color: 'pink'}].map(item => {
                                    const cls = colorClasses[item.color];
                                    return (
                                    <div key={item.label} className={`p-4 rounded-lg border ${isDarkMode ? cls.boxDark : cls.boxLight}`}>
                                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : cls.text} font-semibold`}>{item.label}</p>
                                        <p className={`text-3xl font-bold ${isDarkMode ? 'text-gray-100' : cls.text}`}>{item.value}</p>
                                    </div>
                                    );
                                })}
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold mb-3 text-center">התפלגות שורשים דיגיטליים (ש"ד)</h3>
                            <div className={`flex justify-around items-end p-4 rounded-lg h-40 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                {stats.drDistribution.slice(1).map((count, index) => {
                                    const dr = index + 1;
                                    const maxCount = Math.max(...stats.drDistribution.slice(1));
                                    const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                                    return (
                                        <div key={dr} className="flex flex-col items-center w-1/12 cursor-pointer group" onClick={() => handleDrillDown(dr)}>
                                            <div className="text-sm font-bold">{count}</div>
                                            <div className={`w-full rounded-t-md group-hover:bg-purple-400 transition-all duration-300 ${selectedDR === dr ? 'bg-purple-500' : 'bg-purple-200 dark:bg-purple-700'}`} style={{ height: `${height}%` }}></div>
                                            <div className={`font-bold text-sm mt-1 ${selectedDR === dr ? 'text-purple-700 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400'}`}>ש"ד {dr}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-center my-4">
                    <div className="flex items-center p-1 rounded-full bg-gray-200 dark:bg-gray-700">
                        <button onClick={() => setView('lines')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'lines' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}><Icon name="grid" className="w-4 h-4" />חישוב שורות</button>
                        <button onClick={() => setView('clusters')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'clusters' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}><Icon name="network" className="w-4 h-4" />סיכום מילים</button>
                    </div>
                </div>

                {view === 'lines' && results && results.lines.map((lineResult, lineIndex) => ( <div key={lineIndex} className={`p-4 sm:p-6 rounded-xl border mb-8 transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'}`}> <h2 className="text-2xl font-bold mb-1 text-center">תוצאות עבור שורה {lineIndex + 1}</h2> <p className={`text-center mb-6 italic text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>"{lineResult.lineText}"</p> <div className="overflow-x-auto"> <table className="min-w-full border-separate" style={{borderSpacing: "0 0.5rem"}}><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-blue-100'}><tr><th className="px-4 py-3 text-right font-semibold uppercase tracking-wider rounded-r-lg">מילה</th><th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">חישוב</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-יחידות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-עשרות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-מאות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider rounded-l-lg">ש"ד</th></tr></thead><tbody>{lineResult.words.map((res, index) => ( <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-blue-50'}`}><td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right">{res.word}</td><td className="px-4 py-3 text-sm text-right font-mono">{res.letterDetails.map(l => l.value).join('+')}</td><ValueCell value={res.units} isPrimeFlag={res.isPrimeU} /><ValueCell value={res.tens} isPrimeFlag={res.isPrimeT} previousValue={res.units} isApplicable={res.maxLayer !== 'U'} /><ValueCell value={res.hundreds} isPrimeFlag={res.isPrimeH} previousValue={res.tens} isApplicable={res.maxLayer === 'H'} /><td className="px-4 py-3 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td></tr>))}</tbody><tfoot className={`font-bold ${isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-200 to-blue-200'}`}><tr><td colSpan="2" className="px-4 py-4 text-right text-lg rounded-r-lg">סה"כ שורה:</td><ValueCell value={lineResult.totals.units} isPrimeFlag={lineResult.isPrimeTotals.U} /><ValueCell value={lineResult.totals.tens} isPrimeFlag={lineResult.isPrimeTotals.T} previousValue={lineResult.totals.units} isApplicable={lineResult.lineMaxLayer !== 'U'} /><ValueCell value={lineResult.totals.hundreds} isPrimeFlag={lineResult.isPrimeTotals.H} previousValue={lineResult.totals.tens} isApplicable={lineResult.lineMaxLayer === 'H'} /><td className="px-4 py-4 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{lineResult.totalsDR}</td></tr></tfoot></table> </div> </div> ))}
                
                {view === 'clusters' && results && results.drClusters && (
                    <div className={`p-4 sm:p-6 rounded-xl border mt-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h2 className="text-2xl font-bold mb-4 text-center">סיכום מילים לפי מצבורי שורשים דיגיטליים</h2>
                        <div className="mb-4">
                            <input dir="rtl" type="text" placeholder="חפש מילה..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full p-2 border rounded-md text-right ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
                        </div>
                        <div className="space-y-6">
                            {Object.entries(results.drClusters).map(([dr, words]) => {
                                const searchTerms = searchTerm.split(' ').filter(t => t);
                                const filteredWords = searchTerms.length > 0 
                                    ? words.filter(w => searchTerms.some(term => w.word.includes(term)))
                                    : words;

                                if (filteredWords.length === 0 || (selectedDR !== null && selectedDR !== parseInt(dr))) {
                                    return null;
                                }

                                return (
                                    <div 
                                        key={dr} 
                                        ref={el => (clusterRefs.current[dr] = el)}
                                        className={`p-4 rounded-lg border transition-shadow ${isDarkMode ? 'bg-gray-800/50 border-purple-800' : 'bg-gray-900/30 border-purple-200'}`}
                                    >
                                        <h3 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-3 text-center">ש"ד {dr} ({filteredWords.length} מילים)</h3>
                                        <div 
                                            className="flex flex-wrap justify-start gap-2"
                                        >
                                            {filteredWords.map((wordData, index) => {
                                                const matches = hoveredWord ? layersMatching(hoveredWord, wordData) : [];
                                                const topLayer = matches.length ? strongestLayer(matches) : null;
                                                const isSelf = hoveredWord && hoveredWord.word === wordData.word;
                                                
                                                const tint = topLayer && !isSelf
                                                  ? (isDarkMode ? LAYER_COLORS[topLayer].dark : LAYER_COLORS[topLayer].light)
                                                  : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)');
                                                
                                                const cardStyle = {
                                                  background: tint,
                                                  opacity: hoveredWord && !matches.length && !isSelf ? 0.35 : 1,
                                                  border: isSelf
                                                    ? `2px solid ${LAYER_COLORS['H'].dot}`
                                                    : '2px solid transparent',
                                                };

                                                return (
                                                    <div 
                                                        key={wordData.word + '-' + index} 
                                                        className="p-2 rounded-lg text-center transition-all duration-200"
                                                        style={cardStyle}
                                                        onMouseEnter={() => setHoveredWord(wordData)}
                                                        onMouseLeave={() => setHoveredWord(null)}
                                                    >
                                                        <div className={`font-bold text-xl ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{wordData.word}</div>
                                                        <WordValuesDisplay wordData={wordData} isDarkMode={isDarkMode} matches={matches} connectionValues={results.connectionValues} hoveredWord={hoveredWord} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {results && (
                    <>
                        {results.grandTotals && ( <div className="bg-gradient-to-l from-blue-900 to-purple-900 text-white p-6 rounded-xl shadow-lg mt-10 relative"> <h2 className="text-3xl font-bold mb-4 text-center">סיכום כללי</h2> <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center"> <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"> <p className="text-sm text-blue-300 uppercase font-semibold">Σ-יחידות (סה"כ)</p> <TotalNumberDisplay value={results.grandTotals.units} isPrimeFlag={results.grandTotals.isPrime.U} /> </div> <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"> <p className="text-sm text-blue-300 uppercase font-semibold">Σ-עשרות (סה"כ)</p> <TotalNumberDisplay value={results.grandTotals.tens} isPrimeFlag={results.grandTotals.isPrime.T} /> </div> <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"> <p className="text-sm text-blue-300 uppercase font-semibold">Σ-מאות (סה"כ)</p> <TotalNumberDisplay value={results.grandTotals.hundreds} isPrimeFlag={results.grandTotals.isPrime.H} /> </div> <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"> <p className="text-sm text-purple-300 uppercase font-semibold">ש"ד (סה"כ)</p> <p className="text-3xl font-bold">{results.grandTotals.dr}</p> </div> </div> <div className="absolute top-4 right-4 flex gap-2"> <button onClick={copySummaryToClipboard} className="bg-white/20 text-white px-3 py-1 rounded-md text-sm hover:bg-white/30 transition-colors flex items-center gap-1">{copiedId === 'summary' ? <Icon name="check" className="w-4 h-4" /> : <Icon name="copy" className="w-4 h-4" />}העתק סיכום</button> <button onClick={exportToCSV} className="bg-white/20 text-white px-3 py-1 rounded-md text-sm hover:bg-white/30 transition-colors">ייצא ל-CSV</button> </div> </div> )}
                        {results.primeSummary.length > 0 && (
                            <div className={`p-4 sm:p-6 rounded-xl border mt-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                                <button 
                                    onClick={() => setIsPrimesCollapsed(!isPrimesCollapsed)} 
                                    className="w-full flex justify-between items-center text-left text-2xl font-bold text-gray-800 dark:text-gray-200"
                                >
                                    <span>סיכום ראשוניים מסכומי השורות</span>
                                    <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isPrimesCollapsed ? '' : 'rotate-180'}`} />
                                </button>
                                
                                {!isPrimesCollapsed && (
                                    <div className="mt-4">
                                        <p className={`text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            בסך הכל נמצאו <span className="font-bold text-emerald-600">{results.primeSummary.length}</span> ערכים ראשוניים בסכומי השורות.
                                        </p>
                                        <div className="overflow-x-auto max-w-lg mx-auto">
                                            <table className="min-w-full">
                                                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-emerald-100'}>
                                                    <tr>
                                                        <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">שורה</th>
                                                        <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">ערך ראשוני</th>
                                                        <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">שכבה</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                    {results.primeSummary.map((primeInfo, index) => (
                                                        <tr key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-emerald-50'}`}><td className="px-4 py-3 text-center">{primeInfo.line}</td><td className="px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">{primeInfo.value}</td><td className="px-4 py-3 text-center">{primeInfo.layers.join(', ')}</td></tr>))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    );
};

export default App; 
