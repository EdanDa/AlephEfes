import React, { useState, useMemo, useEffect } from 'react';

// Main component for the Advanced Aleph-Code Calculator
const App = () => {
    // State for user input, results, and UI settings
    const [text, setText] = useState('יהוה אלהים\nאברהם משה\nאדם דם\nאמת מת\nישראל מלכות');
    const [results, setResults] = useState(null);
    const [showSymbolLegend, setShowSymbolLegend] = useState(true);
    const [selectedDR, setSelectedDR] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Load text from localStorage on initial render
    useEffect(() => {
        const savedText = localStorage.getItem('alephCodeText');
        if (savedText) {
            setText(savedText);
        }
        // Check for user's system preference for dark mode
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setIsDarkMode(true);
        }
    }, []);

    // Save text to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('alephCodeText', text);
    }, [text]);

    // Apply dark mode class to body
    useEffect(() => {
        document.body.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    // --- Core Aleph-Code & Number Theory Logic ---
    const letterValues = useMemo(() => ({
        'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'ה': 4, 'ו': 5, 'ז': 6, 'ח': 7, 'ט': 8, 'י': 9,
        'כ': 10, 'ל': 11, 'מ': 12, 'נ': 13, 'ס': 14, 'ע': 15, 'פ': 16, 'צ': 17, 'ק': 18,
        'ר': 19, 'ש': 20, 'ת': 21,
        'ך': 10, 'ם': 12, 'ן': 13, 'ף': 16, 'ץ': 17
    }), []);

    const isPrime = (num) => {
        if (num <= 1) return false;
        if (num <= 3) return true;
        if (num % 2 === 0 || num % 3 === 0) return false;
        for (let i = 5; i * i <= num; i = i + 6) {
            if (num % i === 0 || num % (i + 2) === 0) return false;
        }
        return true;
    };

    const getDigitalRoot = (num) => {
        if (num === 0) return 0;
        const root = num % 9;
        return root === 0 ? 9 : root;
    };

    const generateColor = (index) => {
        const hue = (index * 137.508) % 360;
        return `hsl(${hue}, 70%, 50%)`;
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

                let units = 0, tens_k_sum = 0, hundreds_m_sum = 0;
                const letterDetails = [];

                for (const char of cleanWord) {
                    const value = letterValues[char];
                    if (value !== undefined) {
                        units += value;
                        letterDetails.push({ char, value });
                        if (value >= 10) tens_k_sum += (value - 10);
                        if (value === 20) hundreds_m_sum += 10;
                        else if (value === 21) hundreds_m_sum += 20;
                    }
                }

                const tens = units + 9 * tens_k_sum;
                const hundreds = tens + 9 * hundreds_m_sum;
                const dr = getDigitalRoot(units);
                
                lineTotals.units += units;
                lineTotals.tens += tens;
                lineTotals.hundreds += hundreds;

                if (!allWords.has(cleanWord)) {
                    allWords.set(cleanWord, { word: cleanWord, units, tens, hundreds, dr });
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

        const drClusters = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, []]));
        const valueMaps = { units: new Map(), tens: new Map(), hundreds: new Map() };
        
        allWords.forEach(wordData => {
            ['units', 'tens', 'hundreds'].forEach(layer => {
                const value = wordData[layer];
                if (!valueMaps[layer].has(value)) valueMaps[layer].set(value, []);
                valueMaps[layer].get(value).push(wordData.word);
            });
        });

        const activeSymbols = [];
        const wordToSymbols = new Map();
        let symbolIndex = 0;
        const symbolShapes = ['●', '■', '▲', '◆', '★', '✚', '▼', '⬟'];

        ['units', 'tens', 'hundreds'].forEach(layer => {
            valueMaps[layer].forEach((words, value) => {
                if (words.length > 1) {
                    const symbol = {
                        shape: symbolShapes[symbolIndex % symbolShapes.length],
                        color: generateColor(symbolIndex),
                        layer: layer === 'units' ? 'יחידות' : layer === 'tens' ? 'עשרות' : 'מאות',
                        value,
                        words: words.length
                    };
                    activeSymbols.push(symbol);
                    words.forEach(word => {
                        if (!wordToSymbols.has(word)) wordToSymbols.set(word, []);
                        wordToSymbols.get(word).push(symbol);
                    });
                    symbolIndex++;
                }
            });
        });

        allWords.forEach(wordData => {
            if (wordData.dr > 0) {
                drClusters[wordData.dr].push({
                    ...wordData,
                    symbols: wordToSymbols.get(wordData.word) || []
                });
            }
        });
        
        for (const dr in drClusters) {
            drClusters[dr].sort((a, b) => a.word.localeCompare(b.word, 'he'));
        }

        const calculatedResults = { lines: calculatedLines, grandTotals: finalGrandTotals, primeSummary, drClusters, activeSymbols, allWords: Array.from(allWords.values()), totalWordCount };
        setResults(calculatedResults);
        setSelectedDR(null);
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
            totalConnections: results.activeSymbols.length,
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
            const button = e.currentTarget;
            const originalText = button.innerHTML;
            button.innerHTML = 'הועתק!';
            button.disabled = true;
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
        } catch (err) { console.error('Failed to copy text: ', err); }
        document.body.removeChild(textArea);
    };
    
    const exportToCSV = () => {
        if (!results) return;
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM for Hebrew in Excel
        csvContent += "שורה,מילה,פירוט אותיות,Σ-יחידות,ראשוני (יחידות),Σ-עשרות,ראשוני (עשרות),Σ-מאות,ראשוני (מאות),ש\"ד\n";

        results.lines.forEach((line, lineIndex) => {
            line.words.forEach(word => {
                const row = [
                    lineIndex + 1,
                    `"${word.word}"`,
                    `"${word.letterDetails.map(l => `${l.char}${l.value}`).join('+')}"`,
                    word.units, word.isPrimeU ? 'כן' : 'לא',
                    word.tens, word.isPrimeT ? 'כן' : 'לא',
                    word.hundreds, word.isPrimeH ? 'כן' : 'לא',
                    word.dr
                ].join(',');
                csvContent += row + "\n";
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "aleph_code_analysis.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Render Functions ---
    const PrimeCell = ({ value, isPrimeFlag }) => ( <td className={`px-4 py-3 text-center tabular-nums ${isPrimeFlag ? 'text-emerald-500' : 'text-gray-700 dark:text-gray-300'}`}> {value} {isPrimeFlag && <span className="mr-1 text-emerald-500" title="ראשוני">♢</span>} </td> );
    const TotalNumberDisplay = ({ value, isPrimeFlag }) => ( <p className={`text-3xl font-bold ${isPrimeFlag ? 'text-emerald-400' : 'text-white'}`}> {value} {isPrimeFlag && <span className="mr-2 text-xl">♢</span>} </p> );

    return (
        <div className={`min-h-screen font-sans p-4 sm:p-6 lg:p-8 transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-gray-200' : 'bg-gradient-to-br from-gray-50 to-blue-50 text-gray-800'}`}>
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 text-center relative">
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="absolute top-0 right-0 bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-2xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        aria-label="toggle dark mode"
                    >
                        {isDarkMode ? '☀️' : '🌙'}
                    </button>
                    <h1 className="text-5xl font-bold bg-gradient-to-l from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">מחשבון קוד-אלף</h1>
                    <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>כלי לניתוח נומרולוגי של טקסט עברי על פי שיטת א=0 ונעילת Δ9</p>
                </header>

                <div className={`p-6 rounded-xl border mb-8 transition-all ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'}`}>
                    <label htmlFor="text-input" className="block text-lg font-semibold mb-3">הזן טקסט לניתוח:</label>
                    <textarea id="text-input" className={`w-full p-4 border rounded-lg focus:ring-2 focus:border-blue-500 transition duration-150 text-lg leading-7 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300'}`} rows="5" value={text} onChange={(e) => setText(e.target.value)} placeholder="בראשית ברא אלהים..."></textarea>
                    <div className="mt-4 flex justify-center">
                        <button onClick={handleCalculate} className="px-8 py-3 bg-gradient-to-l from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105 active:scale-95">חשב ונתח</button>
                    </div>
                </div>

                {stats && (
                    <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h2 className="text-2xl font-bold mb-6 text-center">ניתוח סטטיסטי</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center mb-6">
                            {[{label: 'סה"כ שורות', value: stats.totalLines, color: 'blue'}, {label: 'סה"כ מילים', value: stats.totalWords, color: 'indigo'}, {label: 'מילים ייחודיות', value: stats.uniqueWords, color: 'purple'}, {label: 'שורות ראשוניות', value: stats.primeLineTotals, color: 'emerald'}, {label: 'קשרים מתמטיים', value: stats.totalConnections, color: 'pink'}].map(item => (
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
                
                {results && results.lines.map((lineResult, lineIndex) => ( <div key={lineIndex} className={`p-4 sm:p-6 rounded-xl border mb-8 transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'}`}> <h2 className="text-2xl font-bold mb-1 text-center">תוצאות עבור שורה {lineIndex + 1}</h2> <p className={`text-center mb-6 italic text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}"{lineResult.lineText}"</p> <div className="overflow-x-auto"> <table className="min-w-full border-separate" style={{borderSpacing: "0 0.5rem"}}><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-blue-100'}><tr><th className="px-4 py-3 text-right font-semibold uppercase tracking-wider rounded-r-lg">מילה</th><th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">פירוט אותיות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-יחידות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-עשרות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-מאות</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider rounded-l-lg">ש"ד</th></tr></thead><tbody>{lineResult.words.map((res, index) => ( <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-blue-50'}`}><td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right">{res.word}</td><td className="px-4 py-3 text-sm text-right">{res.letterDetails.map(l => `${l.char}${l.value}`).join('+')}</td><PrimeCell value={res.units} isPrimeFlag={res.isPrimeU} /><PrimeCell value={res.tens} isPrimeFlag={res.isPrimeT} /><PrimeCell value={res.hundreds} isPrimeFlag={res.isPrimeH} /><td className="px-4 py-3 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td></tr>))}</tbody><tfoot className={`font-bold ${isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-200 to-blue-200'}`}><tr><td colSpan="2" className="px-4 py-4 text-right text-lg rounded-r-lg">סה"כ שורה:</td><PrimeCell value={lineResult.totals.units} isPrimeFlag={lineResult.isPrimeTotals.U} /><PrimeCell value={lineResult.totals.tens} isPrimeFlag={lineResult.isPrimeTotals.T} /><PrimeCell value={lineResult.totals.hundreds} isPrimeFlag={lineResult.isPrimeTotals.H} /><td className="px-4 py-4 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{lineResult.totalsDR}</td></tr></tfoot></table> </div> </div> ))}
                {results && results.grandTotals && ( <div className="bg-gradient-to-l from-blue-900 to-purple-900 text-white p-6 rounded-xl shadow-lg mt-10 relative"> <h2 className="text-3xl font-bold mb-4 text-center">סיכום כללי</h2> <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center"> <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"> <p className="text-sm text-blue-300 uppercase font-semibold">Σ-יחידות (סה"כ)</p> <TotalNumberDisplay value={results.grandTotals.units} isPrimeFlag={results.grandTotals.isPrime.U} /> </div> <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"> <p className="text-sm text-blue-300 uppercase font-semibold">Σ-עשרות (סה"כ)</p> <TotalNumberDisplay value={results.grandTotals.tens} isPrimeFlag={results.grandTotals.isPrime.T} /> </div> <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"> <p className="text-sm text-blue-300 uppercase font-semibold">Σ-מאות (סה"כ)</p> <TotalNumberDisplay value={results.grandTotals.hundreds} isPrimeFlag={results.grandTotals.isPrime.H} /> </div> <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"> <p className="text-sm text-purple-300 uppercase font-semibold">ש"ד (סה"כ)</p> <p className="text-3xl font-bold">{results.grandTotals.dr}</p> </div> </div> <div className="absolute top-4 right-4 flex gap-2"> <button onClick={copySummaryToClipboard} className="bg-white/20 text-white px-3 py-1 rounded-md text-sm hover:bg-white/30 transition-colors">העתק סיכום</button> <button onClick={exportToCSV} className="bg-white/20 text-white px-3 py-1 rounded-md text-sm hover:bg-white/30 transition-colors">ייצא ל-CSV</button> </div> </div> )}
                {results && results.primeSummary.length > 0 && ( <div className={`p-4 sm:p-6 rounded-xl border mt-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}> <h2 className="text-2xl font-bold mb-2 text-center">סיכום ראשוניים מסכומי השורות</h2> <p className={`text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}> בסך הכל נמצאו <span className="font-bold text-emerald-600">{results.primeSummary.length}</span> ערכים ראשוניים בסכומי השורות. </p> <div className="overflow-x-auto max-w-lg mx-auto"> <table className="min-w-full"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-emerald-100'}><tr><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">שורה</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">ערך ראשוני</th><th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">שכבה</th></tr></thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>{results.primeSummary.map((primeInfo, index) => ( <tr key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-emerald-50'}`}><td className="px-4 py-3 text-center">{primeInfo.line}</td><td className="px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">{primeInfo.value}</td><td className="px-4 py-3 text-center">{primeInfo.layer}</td></tr>))}</tbody></table> </div> </div> )}
                
                {results && results.drClusters && (
                    <div className={`p-4 sm:p-6 rounded-xl border mt-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h2 className="text-2xl font-bold mb-4 text-center">סיכום מילים לפי מצבורי שורשים דיגיטליים</h2>
                        {results.activeSymbols.length > 0 && (
                            <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-l from-gray-50 to-blue-50'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-semibold text-center flex-1">מקרא סמלים לקשרים מתמטיים</h3>
                                    <button onClick={() => setShowSymbolLegend(!showSymbolLegend)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-xl">{showSymbolLegend ? '🔼' : '🔽'}</button>
                                </div>
                                {showSymbolLegend && (
                                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                                        {results.activeSymbols.map((symbol, index) => (
                                            <span key={index} className={`flex items-center px-2 py-1 rounded-md shadow-sm ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                                                <span style={{ color: symbol.color, fontSize: '1.2em' }} className="mx-1">{symbol.shape}</span>
                                                <span className="font-mono">= Σ-{symbol.layer} = {symbol.value} ({symbol.words} מילים)</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="mb-4">
                            <input type="text" placeholder="חפש מילה..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full p-2 border rounded-md ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(results.drClusters).map(([dr, words]) => {
                                const filteredWords = words.filter(w => w.word.includes(searchTerm));
                                return (filteredWords.length > 0 && (selectedDR === null || selectedDR === parseInt(dr))) && (
                                    <div key={dr} className={`p-4 rounded-lg border hover:shadow-md transition-shadow ${isDarkMode ? 'bg-gray-800/50 border-purple-800' : 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200'}`}>
                                        <h3 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-3 text-center">ש"ד {dr} ({filteredWords.length} מילים)</h3>
                                        <div className="space-y-1">
                                            {filteredWords.map((wordData, index) => (
                                                <div key={index} className={`flex items-center justify-between p-2 rounded shadow-sm ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                                                    <span className="font-medium">{wordData.word} ({wordData.units})</span>
                                                    <div className="flex">
                                                        {wordData.symbols.map((symbol, sIndex) => (
                                                            <span key={sIndex} style={{ color: symbol.color }} className="font-mono mr-1 text-lg" title={`Σ-${symbol.layer} = ${symbol.value}`}>{symbol.shape}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
