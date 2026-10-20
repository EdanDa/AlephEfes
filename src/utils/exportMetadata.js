const csvCell = (value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function withCSVMetadata(csv, { mode, filters, corpusSelection }) {
    if (!csv) return '';
    // Preserve record boundaries, including embedded newlines and escaped quotes.
    const records = [];
    let quoted = false;
    let start = 0;
    for (let i = 0; i < csv.length; i += 1) {
        if (csv[i] === '"') {
            if (quoted && csv[i + 1] === '"') i += 1;
            else quoted = !quoted;
        } else if (csv[i] === '\n' && !quoted) {
            records.push(csv.slice(start, i).replace(/\r$/, ''));
            start = i + 1;
        }
    }
    if (start < csv.length) records.push(csv.slice(start));
    const columns = ['analysis_mode', 'filter_units', 'filter_tens', 'filter_hundreds', 'filter_prime', 'source_book', 'source_start_section', 'source_end_section'];
    const values = [mode, filters.U, filters.T, filters.H, filters.Prime, corpusSelection?.bookSlug, corpusSelection?.startSectionOrdinal, corpusSelection?.endSectionOrdinal].map(csvCell).join(',');
    return records.map((record, index) => record ? `${index === 0 ? columns.join(',') : values},${record}` : '').join('\n');
}
