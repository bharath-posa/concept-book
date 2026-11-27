// What the concept graph tells the app: what's learned, what's ready, what to do next, what it unlocks.
export function createGraph(data, store) {
  const nodes = new Map(data.nodes.map(n => [n.id, n]))
  const children = new Map(data.nodes.map(n => [n.id, []]))
  for (const n of data.nodes) for (const p of n.parents) children.get(p)?.push(n.id)
  const primitives = data.nodes.filter(n => n.kind === 'primitive').map(n => n.id)
  const starterDone = () => primitives.every(id => store.isLearned(id))

  // reach = concepts downstream + 1.5 × applications downstream (same rule as graph_lib.productivity_order)
  const reach = new Map()
  const downstream = id => {
    const seen = new Set(); const stack = [...children.get(id)]
    while (stack.length) { const c = stack.pop(); if (!seen.has(c)) { seen.add(c); stack.push(...children.get(c)) } }
    return seen
  }
  for (const n of data.nodes) {
    const down = downstream(n.id)
    const apps = data.applications.filter(a => a.needs.some(x => x === n.id || down.has(x))).length
    reach.set(n.id, down.size + 1.5 * apps)
  }

  function status(id) {
    const n = nodes.get(id)
    if (store.isLearned(id)) return 'learned'
    if (n.kind === 'primitive') return 'ready'          // all taught by the starter lesson
    return n.parents.every(p => store.isLearned(p)) ? 'ready' : 'locked'
  }
  const lessonFor = id => (nodes.get(id)?.kind === 'primitive' ? '_start' : id)

  function next() {
    if (!starterDone()) return '_start'
    const ready = data.nodes.filter(n => n.kind === 'concept' && status(n.id) === 'ready')
    ready.sort((a, b) => reach.get(b.id) - reach.get(a.id) || a.tier - b.tier)
    return ready[0]?.id || null
  }

  // Concepts that become ready once `id` is learned (for "You unlocked…").
  function unlockedBy(id) {
    return children.get(id).filter(c => {
      const n = nodes.get(c)
      return !store.isLearned(c) && n.parents.every(p => p === id || store.isLearned(p))
    })
  }

  // The "build it" question: the concept's real building blocks plus a few plausible decoys.
  function buildChoices(id) {
    const n = nodes.get(id)
    const down = downstream(id)
    const pool = data.nodes.filter(x => x.id !== id && !n.parents.includes(x.id) && !down.has(x.id) && x.tier <= n.tier)
    const decoys = seededShuffle(pool, id).slice(0, Math.max(2, 5 - n.parents.length))
    return { answer: n.parents, options: seededShuffle([...n.parents, ...decoys.map(d => d.id)], id + ':o') }
  }

  const appProgress = a => ({ have: a.needs.filter(x => store.isLearned(x)).length, of: a.needs.length })

  return { data, nodes, children, primitives, status, lessonFor, next, unlockedBy, buildChoices, appProgress, starterDone, reach }
}

// Same order every time for the same seed, so a retried question looks the same.
export function seededShuffle(list, seed) {
  let h = 2166136261
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  const rand = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296 }
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}
