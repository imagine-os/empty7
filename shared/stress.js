// Graph Gallery — synthetic stress graph for GPU demos. Seeded, preferential attachment (has hubs).

const TYPES = ['studio', 'film', 'person', 'genre', 'award'];
const COLORS = { studio: '#f5b642', film: '#ff5f8f', person: '#5ec8ff', genre: '#8dff9e', award: '#e6c3ff' };

/** mulberry32 seeded PRNG -> () => [0,1) */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * makeStress(n, avgDegree, seed) -> { nodes, links }
 * Preferential attachment: each new node attaches ~avgDegree/2 edges to targets sampled
 * from the endpoint list (probability ∝ degree), producing a heavy-tailed hub structure.
 */
export function makeStress(n = 50000, avgDegree = 3, seed = 1) {
  const rand = rng(seed);
  const m = Math.max(1, Math.round(avgDegree / 2));   // edges added per node
  const nodes = new Array(n);
  const degree = new Uint32Array(n);
  const links = [];
  // Endpoint list: every node id appears once per incident edge, so uniform sampling ∝ degree.
  const ends = new Uint32Array(n * m * 2 + 8);
  let endsLen = 0;

  for (let i = 0; i < n; i++) {
    const type = TYPES[i % 5];
    const ang = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 1000;
    nodes[i] = { id: 's' + i, type, label: type + ' ' + i, color: COLORS[type], size: 2,
                 x: Math.cos(ang) * r, y: Math.sin(ang) * r };
    if (i === 0) continue;
    const k = Math.min(m, i);
    for (let j = 0; j < k; j++) {
      // mostly preferential, occasionally uniform so early nodes don't hog everything
      let t = endsLen > 0 && rand() < 0.85 ? ends[(rand() * endsLen) | 0] : (rand() * i) | 0;
      if (t === i) t = (t + 1) % i;
      links.push({ source: 's' + i, target: 's' + t, relation: 'synthetic' });
      degree[i]++; degree[t]++;
      ends[endsLen++] = i; ends[endsLen++] = t;
    }
  }
  for (let i = 0; i < n; i++) nodes[i].size = 1.5 + Math.sqrt(degree[i]) * 0.8;
  return { nodes, links };
}

export { TYPES as STRESS_TYPES, COLORS as STRESS_COLORS };
