import { getWordValues, isValueVisible, isWordVisible } from './analysisCore.js';
const BARNES_HUT_MAX_DEPTH = 12;
const BARNES_HUT_MIN_SIZE = 1e-3;

const createQuadNode = (x, y, size, depth) => ({
    x,
    y,
    size,
    depth,
    node: null,
    bucket: null,
    children: null,
    mass: 0,
    centerX: 0,
    centerY: 0,
});

const addMassToQuad = (quad, point) => {
    const nextMass = quad.mass + 1;
    quad.centerX = (quad.centerX * quad.mass + point.x) / nextMass;
    quad.centerY = (quad.centerY * quad.mass + point.y) / nextMass;
    quad.mass = nextMass;
};

const getQuadChildIndex = (quad, point) => {
    const midX = quad.x + quad.size / 2;
    const midY = quad.y + quad.size / 2;
    const isRight = point.x >= midX ? 1 : 0;
    const isBottom = point.y >= midY ? 1 : 0;
    return isRight + isBottom * 2;
};

const ensureQuadChildren = (quad) => {
    if (quad.children) return;
    const half = quad.size / 2;
    quad.children = [
        createQuadNode(quad.x, quad.y, half, quad.depth + 1),
        createQuadNode(quad.x + half, quad.y, half, quad.depth + 1),
        createQuadNode(quad.x, quad.y + half, half, quad.depth + 1),
        createQuadNode(quad.x + half, quad.y + half, half, quad.depth + 1),
    ];
};

const insertPointToQuad = (quad, point) => {
    addMassToQuad(quad, point);

    if (quad.children) {
        const idx = getQuadChildIndex(quad, point);
        insertPointToQuad(quad.children[idx], point);
        return;
    }

    if (!quad.node && !quad.bucket) {
        quad.node = point;
        return;
    }

    if (quad.depth >= BARNES_HUT_MAX_DEPTH || quad.size <= BARNES_HUT_MIN_SIZE) {
        if (!quad.bucket) {
            quad.bucket = [];
            if (quad.node) {
                quad.bucket.push(quad.node);
                quad.node = null;
            }
        }
        quad.bucket.push(point);
        return;
    }

    const existing = quad.node;
    quad.node = null;
    ensureQuadChildren(quad);
    if (existing) {
        const existingIdx = getQuadChildIndex(quad, existing);
        insertPointToQuad(quad.children[existingIdx], existing);
    }
    const idx = getQuadChildIndex(quad, point);
    insertPointToQuad(quad.children[idx], point);
};

const buildQuadTree = (points) => {
    if (!points.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
    }

    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const padding = span * 0.05 + 1;
    const root = createQuadNode(minX - padding, minY - padding, span + padding * 2, 0);

    for (const point of points) insertPointToQuad(root, point);
    return root;
};

const applyBarnesHutRepulsion = (point, quad, repulsion, alpha, thetaSq) => {
    if (!quad || quad.mass === 0) return;

    if (!quad.children) {
        if (quad.bucket) {
            for (const other of quad.bucket) {
                if (other !== point) {
                    const dx = point.x - other.x;
                    const dy = point.y - other.y;
                    const distSq = dx * dx + dy * dy + 1e-6;
                    const invDist = 1 / Math.sqrt(distSq);
                    const force = (repulsion * alpha) / distSq;
                    point.vx += dx * invDist * force;
                    point.vy += dy * invDist * force;
                }
            }
            return;
        }

        if (!quad.node || quad.node === point) return;
        const dx = point.x - quad.node.x;
        const dy = point.y - quad.node.y;
        const distSq = dx * dx + dy * dy + 1e-6;
        const invDist = 1 / Math.sqrt(distSq);
        const force = (repulsion * alpha) / distSq;
        point.vx += dx * invDist * force;
        point.vy += dy * invDist * force;
        return;
    }

    const dx = point.x - quad.centerX;
    const dy = point.y - quad.centerY;
    const distSq = dx * dx + dy * dy + 1e-6;
    const sizeSq = quad.size * quad.size;

    if (sizeSq / distSq < thetaSq) {
        const invDist = 1 / Math.sqrt(distSq);
        const force = (repulsion * quad.mass * alpha) / distSq;
        point.vx += dx * invDist * force;
        point.vy += dy * invDist * force;
        return;
    }

    for (const child of quad.children) {
        applyBarnesHutRepulsion(point, child, repulsion, alpha, thetaSq);
    }
};

export const buildWordConnectionIndex = (coreResults, filters, selectedDR) => {
    if (!coreResults) return { nodes: [], links: [] };

    const nodes = [];
    const links = [];
    const wordNodesMap = new Map();
    const valueNodesMap = new Map();

    const allWords = Array.isArray(coreResults.allWords) ? coreResults.allWords : [];

    allWords.forEach(wordData => {
        if (!isWordVisible(wordData, filters)) return;
        if (selectedDR !== null && wordData.dr !== selectedDR) return;

        if (!wordNodesMap.has(wordData.word)) {
            const node = { id: wordData.word, type: 'word', data: wordData, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0 };
            wordNodesMap.set(wordData.word, node);
            nodes.push(node);
        }

        const values = getWordValues(wordData);
        values.forEach(v => {
            if (!isValueVisible(v.layer, v.isPrime, filters)) return;

            const valKey = `val-${v.value}`;
            if (!valueNodesMap.has(valKey)) {
                const node = { id: valKey, type: 'value', value: v.value, isPrime: v.isPrime, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0 };
                valueNodesMap.set(valKey, node);
                nodes.push(node);
            }

            links.push({ source: wordData.word, target: valKey, layer: v.layer });
        });
    });

    return { nodes, links };
};


export { buildQuadTree, applyBarnesHutRepulsion };
