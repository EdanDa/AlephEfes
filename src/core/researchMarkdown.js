// The note generator emits this small Markdown subset. Parse into data and let
// React render text nodes; raw HTML is never interpreted.
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replaceAll('\\|', '|'));
export function parseResearchMarkdown(markdown) {
    const lines = markdown.split('\n'), blocks = [];
    for (let i = 0; i < lines.length;) {
        const line = lines[i];
        if (!line.trim()) { i += 1; continue; }
        if (line.startsWith('```')) {
            const body = []; i += 1;
            while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
            i += 1; blocks.push({ type: 'passage', text: body.join('\n') }); continue;
        }
        const heading = /^(#{1,2})\s+(.+)$/.exec(line);
        if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); i += 1; continue; }
        if (line.startsWith('|') && /^\|[\s:|\-]+\|$/.test(lines[i + 1] || '')) {
            const headers = cells(line), alignment = cells(lines[i + 1]); i += 2;
            const rows = [];
            while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
            blocks.push({ type: 'table', headers, alignment, rows }); continue;
        }
        if (line.startsWith('- ')) {
            const items = [];
            while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2));
            blocks.push({ type: 'list', items }); continue;
        }
        blocks.push({ type: 'paragraph', text: line }); i += 1;
    }
    return blocks;
}
