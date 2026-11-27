// Home: what to do next, reviews due, this week's practice, and the concept map.
import { esc } from './text.js'
import { today, addDays } from './store.js'

export function renderHome(app, { graph, store, lessons, starter, go }) {
  const { data } = graph
  const conceptIds = data.nodes.filter(n => n.kind === 'concept').map(n => n.id)
  const lessonIds = ['_start', ...conceptIds]
  const doneCount = lessonIds.filter(id => store.isLearned(id)).length
  const nextId = graph.next()
  const due = store.due(lessonIds)
  const session = store.state.session
  const lessonOf = id => (id === '_start' ? starter : lessons[id])

  const week = weekDots(store.state.days)
  app.innerHTML = `
    <header class="home-head">
      <div><h1>${esc(data.title)}</h1><p class="muted small" style="margin:0">${esc(data.tagline)}</p></div>
      <div class="count" aria-label="${doneCount} of ${lessonIds.length} lessons learned">${doneCount}/${lessonIds.length}</div>
    </header>
    ${session && lessonOf(session.id) ? `
      <section class="card resume row">
        <div class="grow"><div class="kicker">Pick up where you left off</div>
          <strong>${esc(lessonOf(session.id).title)}</strong>
          <div class="muted small">Card ${Math.min(session.pos + 1, session.queue.length)} of ${session.queue.length}</div></div>
        <button class="btn btn-primary" data-go="#/lesson/${esc(session.id)}">Continue</button>
      </section>` : ''}
    ${nextId && !(session && session.id === nextId) ? `
      <section class="card next-card">
        <div class="kicker" style="color:#fff">Next up</div>
        <div class="row"><div class="grow"><h2 style="margin:0">${esc(lessonOf(nextId).title)}</h2>
          <div class="muted small">${lessonOf(nextId).minutes || 3} min · ${nextId === '_start' ? 'start here' : 'unlocks ' + graph.children.get(nextId).length + ' more'}</div></div>
          <button class="btn" data-go="#/lesson/${esc(nextId)}">Start</button></div>
      </section>` : ''}
    ${!nextId && doneCount === lessonIds.length ? `<section class="card"><h2>🎉 You've learned all of ${esc(data.title)}</h2><p class="muted" style="margin:0">Keep your reviews going so it sticks.</p></section>` : ''}
    ${due.length ? `
      <section class="card row">
        <div class="grow"><div class="kicker">Reviews</div><strong>${due.length} due</strong>
          <div class="muted small">About ${Math.max(1, Math.round(due.length * 0.5))} min · keeps it in your memory</div></div>
        <button class="btn btn-primary" data-go="#/review">Review</button>
      </section>` : ''}
    <section class="card" aria-label="Days practised this week">
      <div class="row"><div class="grow"><div class="kicker">This week</div>
        <div class="week">${week.map(d => `<span class="${d.on ? 'on' : ''} ${d.today ? 'today' : ''}"><i></i>${d.label}</span>`).join('')}</div></div>
        <div class="muted small" style="text-align:right">${week.filter(d => d.on).length} of 7 days</div></div>
    </section>

    <h2 class="map-title">Your map</h2>
    <p class="muted small">Each concept unlocks when everything it's built from is learned. Tap one to see more.</p>
    <div class="map" id="map"></div>

    <h2 class="map-title">Where it leads</h2>
    <div class="goals">${data.applications.map(a => {
      const p = graph.appProgress(a)
      return `<div class="card goal ${p.have === p.of ? 'done' : ''}"><div class="trophy" aria-hidden="true">🏆</div>
        <div class="grow"><strong>${esc(a.label)}</strong><div class="muted small">${esc(capital(a.defines))}</div>
        <div class="meter" role="img" aria-label="${p.have} of ${p.of} needed concepts learned"><b style="width:${(100 * p.have) / p.of}%"></b></div></div></div>`
    }).join('')}</div>
    <p class="muted small" style="margin-top:24px">Progress is saved on this device only.
      <button class="btn btn-ghost small" id="reset" style="min-height:0;padding:4px 6px">Start over</button></p>
    <p class="muted small">Built on <a href="https://github.com/digital-duck/concept-book">ConceptBook</a> (Apache-2.0).</p>`

  renderMap(app.querySelector('#map'), graph, nextId, id => openSheet(id, { graph, store, lessons, go }))
  app.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)))
  app.querySelector('#reset').addEventListener('click', () => {
    if (confirm('Start over? This clears your progress on this device.')) { store.reset(); go('#/') }
  })
}

function renderMap(el, graph, nextId, onPick) {
  const { data } = graph
  const tiers = [...new Set(data.nodes.map(n => n.tier))].sort((a, b) => a - b)
  const pos = new Map()
  // Order each row by the average position of its parents, so lines cross less.
  const rows = tiers.map(t => data.nodes.filter(n => n.tier === t))
  rows.forEach(row => {
    row.sort((a, b) => avg(a) - avg(b))
    row.forEach((n, i) => pos.set(n.id, (i + 0.5) / row.length))
  })
  function avg(n) { const ps = n.parents.map(p => pos.get(p)).filter(v => v !== undefined); return ps.length ? ps.reduce((s, v) => s + v, 0) / ps.length : 0.5 }

  el.innerHTML = `<svg class="edges" aria-hidden="true"></svg>` + rows.map(row => `<div class="tier">${row.map(n => {
    const st = graph.status(n.id)
    const isNext = nextId === n.id || (nextId === '_start' && n.kind === 'primitive')
    const icon = st === 'learned' ? '✓' : st === 'ready' ? '★' : '🔒'
    return `<button class="node ${st} ${isNext ? 'next' : ''}" data-id="${esc(n.id)}" aria-label="${esc(n.label)}: ${st}">
      <span class="dot" aria-hidden="true">${icon}</span><span class="name">${esc(n.label)}</span></button>`
  }).join('')}</div>`).join('')
  el.querySelectorAll('.node').forEach(b => b.addEventListener('click', () => onPick(b.dataset.id)))

  let ro
  const draw = () => {
    if (!el.isConnected) { ro?.disconnect(); return }
    const svg = el.querySelector('svg.edges'); const box = el.getBoundingClientRect()
    const center = id => {
      const d = el.querySelector(`.node[data-id="${CSS.escape(id)}"] .dot`).getBoundingClientRect()
      return { x: d.left - box.left + d.width / 2, y: d.top - box.top + d.height / 2 }
    }
    svg.innerHTML = data.nodes.flatMap(n => n.parents.map(p => {
      const a = center(p), b = center(n.id)
      const lit = graph.status(p) === 'learned' && graph.status(n.id) !== 'locked'
      const my = (a.y + b.y) / 2   // gentle S-curve: leaves downward, arrives from above
      return `<path class="${lit ? 'lit' : ''}" d="M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}"/>`
    })).join('')
  }
  draw()
  ro = new ResizeObserver(draw); ro.observe(el)
}

function openSheet(id, { graph, store, lessons, go }) {
  const n = graph.nodes.get(id)
  const st = graph.status(id)
  const lessonId = graph.lessonFor(id)
  const lesson = lessonId === '_start' ? null : lessons[lessonId]
  const label = x => graph.nodes.get(x)?.label || x
  const unlocks = graph.children.get(id)
  const apps = graph.data.applications.filter(a => a.needs.includes(id))
  const missing = n.parents.filter(p => !store.isLearned(p))
  const back = document.createElement('div')
  back.className = 'sheet-back'
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="row"><h2 id="sheet-title" class="grow">${esc(n.label)}</h2><button class="icon-btn" data-close aria-label="Close">×</button></div>
    <p>${esc(capital(n.summary || n.defines))}</p>
    ${n.parents.length ? `<div class="kicker">Built from</div><div class="chips">${n.parents.map(p => `<span class="chip ${store.isLearned(p) ? 'ok' : ''}">${store.isLearned(p) ? '✓ ' : ''}${esc(label(p))}</span>`).join('')}</div>` : ''}
    ${unlocks.length || apps.length ? `<div class="kicker">Unlocks</div><div class="chips">${unlocks.map(c => `<span class="chip">${esc(label(c))}</span>`).join('')}${apps.map(a => `<span class="chip">🏆 ${esc(a.label)}</span>`).join('')}</div>` : ''}
    ${st === 'locked'
      ? `<p class="muted">Learn ${missing.map(m => `<strong>${esc(label(m))}</strong>`).join(' and ')} first.</p>`
      : `<button class="btn btn-primary btn-block" data-start>${st === 'learned' ? 'Go through it again' : 'Start'} · ${(lesson || {}).minutes || 3} min</button>`}
  </div>`
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey) }
  const onKey = e => { if (e.key === 'Escape') close() }
  back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close() })
  back.querySelector('[data-start]')?.addEventListener('click', () => { close(); go('#/lesson/' + lessonId) })
  document.addEventListener('keydown', onKey)
  document.body.append(back)
  back.querySelector('[data-close]').focus()
}

function weekDots(days) {
  const t = today(); const now = new Date()
  const monday = addDays(t, -((now.getDay() + 6) % 7))
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
    const d = addDays(monday, i)
    return { label, on: days.includes(d), today: d === t }
  })
}

const capital = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
