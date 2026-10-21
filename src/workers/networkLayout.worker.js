import { buildQuadTree, applyBarnesHutRepulsion } from '../core/networkLayout.js';

let job = null;
let timer = null;
function schedule() {
    clearTimeout(timer);
    if (job && !job.paused && job.alpha > 0) timer = setTimeout(tick, 33);
}
function tick() {
    const { nodes, links, width, height, alpha, generation } = job;
    const tree = buildQuadTree(nodes);
    for (const node of nodes) applyBarnesHutRepulsion(node, tree, nodes.length > 500 ? 1000 : 2000, alpha, 0.64);
    for (const [aIndex, bIndex] of links) {
        const a = nodes[aIndex], b = nodes[bIndex];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1;
        const force = (distance - 90) * 0.06 * alpha / distance;
        a.vx += dx * force; a.vy += dy * force;
        b.vx -= dx * force; b.vy -= dy * force;
    }
    const positions = new Float32Array(nodes.length * 2);
    nodes.forEach((node, index) => {
        if (node.fixed) { node.vx = 0; node.vy = 0; }
        else {
            node.vx = Math.max(-10, Math.min(10, node.vx + (width / 2 - node.x) * 0.004 * alpha)) * 0.9;
            node.vy = Math.max(-10, Math.min(10, node.vy + (height / 2 - node.y) * 0.004 * alpha)) * 0.9;
            node.x += node.vx; node.y += node.vy;
        }
        positions[index * 2] = node.x; positions[index * 2 + 1] = node.y;
    });
    job.alpha = Math.max(0, alpha - 0.0125);
    postMessage({ generation, positions, settled: job.alpha === 0 }, [positions.buffer]);
    schedule();
}
self.onmessage = ({ data }) => {
    try {
        if (data.type === 'init') { job = { ...data, alpha: 1, paused: false }; schedule(); }
        if (!job || data.generation !== job.generation) return;
        if (data.type === 'pause') { job.paused = data.paused; if (!data.paused && data.restart) job.alpha = Math.max(job.alpha, 0.3); schedule(); }
        if (data.type === 'drag') {
            const node = job.nodes[data.index];
            if (node) { Object.assign(node, { x: data.x, y: data.y, fixed: data.fixed }); job.alpha = Math.max(job.alpha, 0.3); schedule(); }
        }
    } catch (error) { clearTimeout(timer); postMessage({ generation: job?.generation, error: String(error) }); }
};
