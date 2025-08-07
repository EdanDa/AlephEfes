import React, { useState, useMemo, useEffect } from 'react';

// --- Constants ---
const BASE_LETTER_VALUES = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
    'כ': 11, 'ל': 12, 'מ': 13, 'נ': 14, 'ס': 15, 'ע': 16, 'פ': 17, 'צ': 18, 'ק': 19,
    'ר': 20, 'ש': 21, 'ת': 22,
};

// --- Caching for expensive functions ---
const primeCache = new Map();

// --- SVG Icons (Lucide Replacements) ---
const Icon = ({ name, className }) => {
    const icons = {
        sun: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
        moon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
        hash: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>,
        info: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
        copy: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
        check: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
        grid: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>,
        network: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>,
    };
    return <div className={className}>{icons[name]}</div>;
};

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

    // Load text from localStorage on initial render
    useEffect(() => {
        const savedText = localStorage.getItem('alephCodeText');
        if (savedText) {
            setText(savedText);
        }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setIsDarkMode(true);
        }
        // Run initial calculation after a short delay to ensure state is set
        setTimeout(handleCalculate, 100);
    }, []);
    
    // Auto-calculate on text change with a dynamic debounce
    useEffect(() => {
        if (!isAutoCalculateOn) return;
        
        // Smart debounce: quicker for small texts, slower for large texts
        const delay = Math.min(1000, Math.max(200, text.length * 0.5));

        const handler = setTimeout(() => {
            if (text) {
                handleCalculate();
            } else {
                setResults(null);
            }
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [text, isAutoCalculateOn, mode]);


    // Save text to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('alephCodeText', text);
    }, [text]);

    // Apply dark mode class to body
    useEffect(() => {
        document.body.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    // --- Core Aleph-Code & Number Theory Logic ---
    const letterValues = useMemo(() => {
        if (mode === 'aleph-zero') {
            const zeroBased = {};
            for (const key in BASE_LETTER_VALUES) {
                zeroBased[key] = BASE_LETTER_VALUES[key] - 1;
            }
            return { ...zeroBased, 'ך': 10, 'ם': 12, 'ן': 13, 'ף': 16, 'ץ': 17 };
        }
        // aleph-one
        return { ...BASE_LETTER_VALUES, 'ך': 11, 'ם': 13, 'ן': 14, 'ף': 17, 'ץ': 18 };
    }, [mode]);

    const isPrime = (num) => {
        if (primeCache.has(num)) {
            return primeCache.get(num);
        }
        if (num <= 1) {
            primeCache.set(num, false);
            return false;
        }
        if (num <= 3) {
            primeCache.set(num, true);
            return true;
        }
        if (num % 2 === 0 || num % 3 === 0) {
            primeCache.set(num, false);
            return false;
        }
        for (let i = 5; i * i <= num; i = i + 6) {
            if (num % i === 0 || num % (i + 2) === 0) {
                primeCache.set(num, false);
                return false;
            }
        }
        primeCache.set(num, true);
        return true;
    };

    const getDigitalRoot = (num) => {
        if (num === 0) return 0;
        const root = num % 9;
        return root === 0 ? 9 : root;
    };

    // Main calculation handler
    const handleCalculate = () => {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        let grandTotals = { units: 0, tens: 0, hundreds: 0 };
        const primeSummary = [];
        const allWords = new Map();
        let totalWordCount = 0;

        const calculatedLines = lines.map((line, lineIndex) => {
            const words = line.split(/\s+/).filter(word => word.length > 0);
            let lineTotals = { units: 0, tens: 0, hundreds: 0 };

            const calculatedWords = words.map(word => {
                const cleanWord = word.replace(/[.,:"']/g, '');
                if (cleanWord.length === 0 || !isNaN(cleanWord)) return null;
                totalWordCount++;

                let units = 0;
                const letterDetails = [];

                for (const char of cleanWord) {
                    const value = letterValues[char];
                    if (value !== undefined) {
                        units += value;
                        letterDetails.push({ char, value });
                    }
                }

                let tens = 0;
                let hundreds = 0;

                if (mode === 'aleph-zero') {
                    let tens_k_sum = 0;
                    let hundreds_m_sum = 0;
                    letterDetails.forEach(({ value }) => {
                        if (value >= 10) tens_k_sum += (value - 10);
                        if (value === 20) hundreds_m_sum += 10;
                        else if (value === 21) hundreds_m_sum += 20;
                    });
                    tens = units + 9 * tens_k_sum;
                    hundreds = tens + 9 * hundreds_m_sum;
                } else { // aleph-one
                    let tens_k_sum = 0;
                    let hundreds_m_sum = 0;
                    letterDetails.forEach(({ value }) => {
                        if (value >= 11) tens_k_sum += (value - 10); // כ is 11
                        if (value === 21) hundreds_m_sum += 10; // ש is 21
                        else if (value === 22) hundreds_m_sum += 30; // ת is 22
                    });
                    tens = units + 9 * tens_k_sum;
                    hundreds = tens + 9 * hundreds_m_sum;
                }

                const dr = getDigitalRoot(units);
                
                lineTotals.units += units;
                lineTotals.tens += tens;
                lineTotals.hundreds += hundreds;

                if (!allWords.has(cleanWord)) {
                    allWords.set(cleanWord, { 
                        word: cleanWord, 
                        units, 
                        tens, 
                        hundreds, 
                        dr,
                        isPrimeU: isPrime(units),
                        isPrimeT: isPrime(tens),
                        isPrimeH: isPrime(hundreds)
                    });
                }

                return { word, letterDetails, units, tens, hundreds, dr, isPrimeU: isPrime(units), isPrimeT: isPrime(tens), isPrimeH: isPrime(hundreds) };
            }).filter(Boolean);
            
            grandTotals.units += lineTotals.units;
            grandTotals.tens += lineTotals.tens;
            grandTotals.hundreds += lineTotals.hundreds;
            
            const isPrimeTotalU = isPrime(lineTotals.units);
            const isPrimeTotalT = isPrime(lineTotals.tens);
            const isPrimeTotalH = isPrime(lineTotals.hundreds);

            if (isPrimeTotalU) primeSummary.push({ line: lineIndex + 1, value: lineTotals.units, layer: 'יחידות' });
            if (isPrimeTotalT) primeSummary.push({ line: lineIndex + 1, value: lineTotals.tens, layer: 'עשרות' });
            if (isPrimeTotalH) primeSummary.push({ line: lineIndex + 1, value: lineTotals.hundreds, layer: 'מאות' });

            return { lineText: line, words: calculatedWords, totals: lineTotals, totalsDR: getDigitalRoot(lineTotals.units), isPrimeTotals: { U: isPrimeTotalU, T: isPrimeTotalT, H: isPrimeTotalH } };
        });
        
        const finalGrandTotals = { ...grandTotals, dr: getDigitalRoot(grandTotals.units), isPrime: { U: isPrime(grandTotals.units), T: isPrime(grandTotals.tens), H: isPrime(grandTotals.hundreds) } };

        // --- Connection & Clustering Logic ---
        const valueToWordsMap = new Map();
        allWords.forEach(wordData => {
            [wordData.units, wordData.tens, wordData.hundreds].forEach(value => {
                if (!valueToWordsMap.has(value)) {
                    valueToWordsMap.set(value, new Set());
                }
                valueToWordsMap.get(value).add(wordData.word);
            });
        });

        const connectionColors = new Map();
        let colorIndex = 0;
        const generateColor = (index) => {
             const hue = (index * 137.508) % 360;
             return `hsl(${hue}, 60%, ${isDarkMode ? '35%' : '85%'})`;
        };
        
        const sortedValues = Array.from(valueToWordsMap.keys()).filter(value => valueToWordsMap.get(value).size > 1).sort((a, b) => b - a);
        sortedValues.forEach(value => {
            connectionColors.set(value, generateColor(colorIndex++));
        });

        const drClusters = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, []]));
        allWords.forEach(wordData => {
            const connections = {};
            [
                { layer: 'units', value: wordData.units },
                { layer: 'tens', value: wordData.tens },
                { layer: 'hundreds', value: wordData.hundreds }
            ].forEach(({ value }) => {
                if (connectionColors.has(value)) {
                    connections[value] = connectionColors.get(value);
                }
            });
            
            const enrichedWordData = { ...wordData, connections };

            if (enrichedWordData.dr > 0) {
                drClusters[enrichedWordData.dr].push(enrichedWordData);
            }
        });
        
        for (const dr in drClusters) {
            drClusters[dr].sort((a, b) => a.units - b.units);
        }

        const totalConnections = connectionColors.size;
        const calculatedResults = { lines: calculatedLines, grandTotals: finalGrandTotals, primeSummary, drClusters, allWords: Array.from(allWords.values()), totalWordCount, totalConnections };
        setResults(calculatedResults);
    };

    const stats = useMemo(() => {
        if (!results) return null;
        const drDistribution = Array(10).fill(0);
        results.allWords.forEach(word => {
            drDistribution[word.dr]++;
        });
        return {
            totalLines: results.lines.length,
            totalWords: results.totalWordCount,
            uniqueWords: results.allWords.length,
            primeLineTotals: results.primeSummary.length,
            totalConnections: results.totalConnections,
            drDistribution,
        };
    }, [results]);

    const copySummaryToClipboard = (e) => {
        if (!results) return;
        let summary = `סיכום כללי - קוד-אלף\n===================\n`;
        summary += `סה"כ יחידות: ${results.grandTotals.units}\n`;
        summary += `סה"כ עשרות: ${results.grandTotals.tens}\n`;
        summary += `סה"כ מאות: ${results.grandTotals.hundreds}\n`;
        summary += `ש"ד כללי: ${results.grandTotals.dr}\n\n`;
        
        summary += `סיכום שורות\n---------------------------\n`;
        results.lines.forEach((line, index) => {
            summary += `שורה ${index + 1}: יחידות=${line.totals.units}, עשרות=${line.totals.tens}, מאות=${line.totals.hundreds}, ש"ד=${line.totalsDR}\n`;
        });
        summary += `\n`;

        if (results.primeSummary.length > 0) {
            summary += `סיכום ראשוניים מסכומי שורות\n---------------------------\n`;
            results.primeSummary.forEach(p => {
                summary += `שורה ${p.line}: ${p.value} (שכבת ${p.layer})\n`;
            });
        }
        
        const textArea = document.createElement("textarea");
        textArea.value = summary;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopiedId('summary');
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) { console.error('Failed to copy text: ', err); }
        document.body.removeChild(textArea);
    };
    
    const exportToCSV = () => {
        if (!results) return;
        let csvContent = "\uFEFF"; // BOM for Hebrew in Excel
        
        csvContent += "סיכום סטטיסטי\n";
        csvContent += `סה"כ שורות,${stats.totalLines}\n`;
        csvContent += `סה"כ מילים,${stats.totalWords}\n`;
        csvContent += `מילים ייחודיות,${stats.uniqueWords}\n`;
        csvContent += `שורות עם סכום ראשוני,${stats.primeLineTotals}\n`;
        csvContent += `קבוצות קשרים,${stats.totalConnections}\n\n`;

        csvContent += "ניתוח מפורט - שורה,מילה,חישוב,Σ-יחידות,ראשוני (יחידות),Σ-עשרות,ראשוני (עשרות),Σ-מאות,ראשוני (מאות),ש\"ד\n";
        results.lines.forEach((line, lineIndex) => {
            line.words.forEach(word => {
                const row = [
                    lineIndex + 1,
                    `"${word.word}"`,
                    `"${word.letterDetails.map(l => l.value).join('+')}"`,
                    word.units, word.isPrimeU ? 'כן' : 'לא',
                    word.tens, word.isPrimeT ? 'כן' : 'לא',
                    word.hundreds, word.isPrimeH ? 'כן' : 'לא',
                    word.dr
                ].join(',');
                csvContent += row + "\n";
            });
        });
        csvContent += "\n";

        csvContent += "סיכום מצבורי שורשים דיגיטליים\n";
        Object.entries(results.drClusters).forEach(([dr, words]) => {
            if (words.length > 0) {
                csvContent += `ש\"ד ${dr}\n`;
                csvContent += "מילה,Σ-יחידות,Σ-עשרות,Σ-מאות,קשרים\n";
                words.forEach(wordData => {
                    csvContent += `${wordData.word},${wordData.units},${wordData.tens},${wordData.hundreds},"${Object.keys(wordData.connections).join(', ')}"\n`;
                });
            }
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "aleph_code_analysis.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Render Functions ---
    const PrimeCell = ({ value, isPrimeFlag }) => ( <td className={`px-4 py-3 text-center tabular-nums ${isPrimeFlag ? 'text-emerald-500' : 'text-gray-700 dark:text-gray-300'}`}> {value} {isPrimeFlag && <span className="mr-1 text-emerald-500" title="ראשוני">♢</span>} </td> );
    const TotalNumberDisplay = ({ value, isPrimeFlag }) => ( <p className={`text-3xl font-bold ${isPrimeFlag ? 'text-emerald-400' : 'text-white'}`}> {value} {isPrimeFlag && <span className="mr-2 text-xl">♢</span>} </p> );
    
    const WordValuesDisplay = ({ hundreds, tens, units }) => {
        const values = [];
        if (hundreds !== tens) {
            values.push(hundreds);
            if (tens !== units) {
                values.push(tens);
            }
        } else { // hundreds === tens
            if (tens !== units) {
                values.push(tens);
            }
        }
        values.push(units);

        return (
            <div className={`font-mono text-xs tracking-wider flex justify-center gap-2 pt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {values.map((val, index) => (
                    <span key={index}>{val}</span>
                ))}
            </div>
        );
    };


    return (
        <div 
            dir="rtl" 
            className={`min-h-screen font-sans p-4 sm:p-6 lg:p-8 transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-gray-200' : 'bg-gradient-to-br from-gray-50 to-blue-50 text-gray-800'}`}
        >
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 text-center relative">
                    <div className="absolute top-0 right-0 flex gap-2">
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            {isDarkMode ? <Icon name="sun" className="w-5 h-5 text-yellow-400"/> : <Icon name="moon" className="w-5 h-5 text-blue-600"/>}
                        </button>
                        <button onClick={() => setIsValueTableOpen(!isValueTableOpen)} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            <Icon name="hash" className="w-5 h-5 text-purple-600"/>
                        </button>
                        <button onClick={() => setIsAboutModalOpen(true)} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            <Icon name="info" className="w-5 h-5 text-blue-600"/>
                        </button>
                    </div>
                    <h1 className="text-5xl font-bold bg-gradient-to-l from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 text-center">
                        {mode === 'aleph-zero' ? 'מחשבון אלף-אפס' : 'מחשבון אלף-אחד'}
                    </h1>
                    <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>כלי לניתוח נומרולוגי של טקסט עברי</p>
                </header>

                {isValueTableOpen && (
                    <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h2 className="text-2xl font-bold mb-4 text-center">טבלת ערכי אותיות ({mode === 'aleph-zero' ? 'אלף-אפס' : 'אלף-אחד'})</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-center"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                                    <tr>
                                        {['אות', 'יחידות', 'עשרות', 'מאות'].map(header => <th key={header} className="p-2 font-semibold">{header}</th>)}
                                    </tr>
                                </thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    {Object.entries(letterValues).filter(([key]) => !['ך', 'ם', 'ן', 'ף', 'ץ'].includes(key)).map(([letter, value]) => {
                                        let tens, hundreds;
                                        if (mode === 'aleph-zero') {
                                            tens = value + 9 * (value >= 10 ? value - 10 : 0);
                                            hundreds = tens + 9 * (value === 20 ? 10 : value === 21 ? 20 : 0);
                                        } else {
                                            tens = value + 9 * (value >= 11 ? value - 10 : 0);
                                            hundreds = tens + 9 * (value === 21 ? 10 : value === 22 ? 30 : 0);
                                        }
                                        return (
                                            <tr key={letter} className={isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                                                <td className="p-2 font-bold text-xl">{letter}</td>
                                                <td className="p-2 font-mono">{value}</td>
                                                <td className="p-2 font-mono">{tens}</td>
                                                <td className="p-2 font-mono">{hundreds}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody></table>
                        </div>
                    </div>
                )}
                
                {isAboutModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsAboutModalOpen(false)}>
                        <div className={`p-8 rounded-xl max-w-2xl mx-auto relative ${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'}`} onClick={e => e.stopPropagation()}>
                            <h2 className="text-3xl font-bold mb-4 text-center bg-gradient-to-l from-blue-600 to-purple-600 bg-clip-text text-transparent">אודות פרויקט "קוד-אלף"</h2>
                            <p className="mb-4 text-right">כלי זה הוא פרי מחקר עצמאי של **עידן-דוד עיון**, פילוסוף וחוקר אוטודידקט. המחקר החל מהתובנה הפשוטה שהאות הראשונה במילה הראשונה בתורה, ב', עשויה לייצג את הערך 1, מה שמוביל למסקנה המהפכנית ש-א'=0.</p>
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
                            {[{label: 'סה"כ שורות', value: stats.totalLines, color: 'blue'}, {label: 'סה"כ מילים', value: stats.totalWords, color: 'indigo'}, {label: 'מילים ייחודיות', value: stats.uniqueWords, color: 'purple'}, {label: 'שורות ראשוניות', value: stats.primeLineTotals, color: 'emerald'}, {label: 'קבוצות קשרים', value: stats.totalConnections, color: 'pink'}].map(item => (
                                <div key={item.label} className={`p-4 rounded-lg border ${isDarkMode ? `bg-gray-700/50 border-${item.color}-800` : `bg-${item.color}-50 border-${item.color}-200`}`}>
                                    <p className={`text-sm text-${item.color}-600 dark:text-${item.color}-400 font-semibold`}>{item.label}</p>
                                    <p className={`text-3xl font-bold text-${item.color}-800 dark:text-${item.color}-200`}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold mb-3 text-center">התפלגות שורשים דיגיטליים (ש"ד)</h3>
                            <div className={`flex justify-around items-end p-4 rounded-lg h-40 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                {stats.drDistribution.slice(1).map((count, index) => {
                                    const dr = index + 1;
                                    const maxCount = Math.max(...stats.drDistribution.slice(1));
                                    const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                                    return (
                                        <div key={dr} className="flex flex-col items-center w-1/12 cursor-pointer group" onClick={() => setSelectedDR(selectedDR === dr ? null : dr)}>
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

                {view === 'lines' && results && results.lines.map((lineResult, lineIndex) => ( <div key={lineIndex} className={`p-4 sm:p-6 rounded-xl border mb-8 transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'}`}> <h2 className="text-2xl font-bold mb-1 text-center">תוצאות עבור שורה {lineIndex + 1}</h2> <p className={`text-center mb-6 italic text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>"{lineResult.lineText}"</p> <div className="overflow-x-auto"> <table className="min-w-full border-separate" style={{borderSpacing: "0 0.5rem"}}><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-blue-100'}><tr><th className="px-4 py-3 text-right font-semibold uppercase tracking-wider rounded-r-lg">מילה</th><th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">חישוב</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-יחידות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-עשרות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-מאות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider rounded-l-lg">ש"ד</th></tr></thead><tbody>{lineResult.words.map((res, index) => ( <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-blue-50'}`}><td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right">{res.word}</td><td className="px-4 py-3 text-sm text-right font-mono">{res.letterDetails.map(l => l.value).join('+')}</td><PrimeCell value={res.units} isPrimeFlag={res.isPrimeU} /><PrimeCell value={res.tens} isPrimeFlag={res.isPrimeT} /><PrimeCell value={res.hundreds} isPrimeFlag={res.isPrimeH} /><td className="px-4 py-3 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td></tr>))}</tbody><tfoot className={`font-bold ${isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-200 to-blue-200'}`}><tr><td colSpan="2" className="px-4 py-4 text-right text-lg rounded-r-lg">סה"כ שורה:</td><PrimeCell value={lineResult.totals.units} isPrimeFlag={lineResult.isPrimeTotals.U} /><PrimeCell value={lineResult.totals.tens} isPrimeFlag={lineResult.isPrimeTotals.T} /><PrimeCell value={lineResult.totals.hundreds} isPrimeFlag={lineResult.isPrimeTotals.H} /><td className="px-4 py-4 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{lineResult.totalsDR}</td></tr></tfoot></table> </div> </div> ))}
                
                {view === 'clusters' && results && results.drClusters && (
                    <div className={`p-4 sm:p-6 rounded-xl border mt-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h2 className="text-2xl font-bold mb-4 text-center">סיכום מילים לפי מצבורי שורשים דיגיטליים</h2>
                        <div className="mb-4">
                            <input dir="rtl" type="text" placeholder="חפש מילה..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full p-2 border rounded-md text-right ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
                        </div>
                        <div className="space-y-6">
                            {Object.entries(results.drClusters).map(([dr, words]) => {
                                const filteredWords = words.filter(w => w.word.includes(searchTerm));
                                if (filteredWords.length === 0 || (selectedDR !== null && selectedDR !== parseInt(dr))) {
                                    return null;
                                }

                                return (
                                    <div key={dr} className={`p-4 rounded-lg border transition-shadow ${isDarkMode ? 'bg-gray-800/50 border-purple-800' : 'bg-gray-900/30 border-purple-200'}`}>
                                        <h3 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-3 text-center">ש"ד {dr} ({filteredWords.length} מילים)</h3>
                                        <div
                                            className="flex flex-wrap justify-start gap-2"
                                        >
                                            {filteredWords.map((wordData, index) => {
                                                let backgroundColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
                                                let opacity = 1.0;
                                                
                                                if (hoveredWord) {
                                                    const hoveredConnections = Object.keys(hoveredWord.connections);
                                                    const currentConnections = Object.keys(wordData.connections);
                                                    
                                                    const sharedConnections = hoveredConnections.filter(value => currentConnections.includes(value));

                                                    if (sharedConnections.length > 0) {
                                                        const highestSharedValue = Math.max(...sharedConnections.map(Number));
                                                        backgroundColor = hoveredWord.connections[highestSharedValue];
                                                    } else if (wordData.word !== hoveredWord.word) {
                                                        opacity = 0.4;
                                                    }
                                                }

                                                const cardStyle = { backgroundColor, opacity };

                                                return (
                                                    <div 
                                                        key={index} 
                                                        className="p-2 rounded-lg text-center transition-all duration-200"
                                                        style={cardStyle}
                                                        onMouseEnter={() => setHoveredWord(wordData)}
                                                        onMouseLeave={() => setHoveredWord(null)}
                                                    >
                                                        <div className={`font-bold text-2xl ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{wordData.word}</div>
                                                        <WordValuesDisplay hundreds={wordData.hundreds} tens={wordData.tens} units={wordData.units} />
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
                        {results.primeSummary.length > 0 && ( <div className={`p-4 sm:p-6 rounded-xl border mt-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}> <h2 className="text-2xl font-bold mb-2 text-center">סיכום ראשוניים מסכומי השורות</h2> <p className={`text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}> בסך הכל נמצאו <span className="font-bold text-emerald-600">{results.primeSummary.length}</span> ערכים ראשוניים בסכומי השורות. </p> <div className="overflow-x-auto max-w-lg mx-auto"> <table className="min-w-full"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-emerald-100'}><tr><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">שורה</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">ערך ראשוני</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">שכבה</th></tr></thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>{results.primeSummary.map((primeInfo, index) => ( <tr key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-emerald-50'}`}><td className="px-4 py-3 text-center">{primeInfo.line}</td><td className="px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">{primeInfo.value}</td><td className="px-4 py-3 text-center">{primeInfo.layer}</td></tr>))}</tbody></table> </div> </div> )}
                    </>
                )}

            </div>
        </div>
    );
};

export default App;

