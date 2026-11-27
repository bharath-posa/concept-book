// Runs a lesson or a review session: one card at a time, a progress bar, and a finish screen.
// Mastery: a missed question comes back at the end of the lesson (up to 3 tries in all).
import { esc } from './text.js'
import { renderCard } from './cards.js'
import { seededShuffle } from './graph.js'

const GRADED = new Set(['choice', 'number', 'order', 'build'])
const MAX_TRIES = 3

export function playLesson(app, ctx, lessonId) {
  const { graph, store, lessons, starter, go } = ctx
  const lesson = lessonId === '_start' ? starter : lessons[lessonId]
  if (!lesson) { go('#/'); return }
  const fromSave = store.state.session && store.state.session.id === lessonId ? store.state.session : null
  const s = fromSave || {
    id: lessonId, pos: 0, tries: {}, firstTry: 0, graded: 0,
    queue: lesson.cards.map((_, i) => ({ ref: i })),
  }
  const learnIds = lessonId === '_start' ? [...graph.primitives, '_start'] : [lessonId]

  run(app, ctx, {
    title: lesson.title,
    session: s,
    card: item => lesson.cards[item.ref],
    conceptId: lessonId,
    onAnswer(item, correct) {
      s.tries[item.ref] = (s.tries[item.ref] || 0) + 1
      if (s.tries[item.ref] === 1) { s.graded++; if (correct) s.firstTry++ }
      if (!correct && s.tries[item.ref] < MAX_TRIES) s.queue.push({ ref: item.ref, retry: true })
    },
    save: () => store.saveSession(s),
    finish() {
      const before = new Set(graph.data.nodes.filter(n => graph.status(n.id) === 'ready').map(n => n.id))
      store.learn(learnIds); store.clearSession()
      const unlocked = graph.data.nodes.filter(n => n.kind === 'concept' && graph.status(n.id) === 'ready' && !before.has(n.id))
      finishScreen(app, ctx, {
        icon: '✓',
        title: lessonId === '_start' ? 'The building blocks are on your map' : `${lesson.title} is on your map`,
        stats: [[`${s.firstTry}/${s.graded}`, 'right first time'], [unlocked.length, unlocked.length === 1 ? 'concept unlocked' : 'concepts unlocked']],
        note: unlocked.length ? `Unlocked: ${unlocked.map(n => n.label).join(', ')}` : '',
      })
    },
    quit: () => go('#/'),
  })
}

export function playReview(app, ctx) {
  const { graph, store, lessons, starter, go } = ctx
  const lessonIds = ['_start', ...graph.data.nodes.filter(n => n.kind === 'concept').map(n => n.id)]
  const due = store.due(lessonIds).slice(0, 8)
  if (!due.length) { go('#/'); return }
  const poolOf = id => {
    const l = id === '_start' ? starter : lessons[id]
    const pool = (l.review || []).length ? l.review : l.cards.filter(c => GRADED.has(c.type) && c.type !== 'build')
    return pool
  }
  // One question per due concept, picked differently each time; concepts mixed (interleaving).
  const n = store.state.days.length
  const items = seededShuffle(due, 'review' + n).map(id => {
    const pool = poolOf(id); return { id, q: pool[(n + id.length) % pool.length] }
  })
  const s = { pos: 0, queue: items.map((it, i) => ({ ref: i })), tries: {}, right: 0 }
  const results = {}

  run(app, ctx, {
    title: 'Review',
    session: s,
    card: item => items[item.ref].q,
    conceptId: null,
    onAnswer(item, correct) {
      const it = items[item.ref]
      if (!(it.id in results)) { results[it.id] = correct; store.reviewed(it.id, correct); if (correct) s.right++ }
      if (!correct && !item.retry) s.queue.push({ ref: item.ref, retry: true })   // see it again before you go
    },
    save() {},
    finish() {
      finishScreen(app, ctx, {
        icon: '★',
        title: 'Reviews done',
        stats: [[`${s.right}/${items.length}`, 'remembered'], [items.length, items.length === 1 ? 'concept refreshed' : 'concepts refreshed']],
        note: s.right < items.length ? 'The ones you missed come back tomorrow.' : 'Each one comes back later, a little further apart.',
      })
    },
    quit: () => go('#/'),
  })
}

function run(app, ctx, h) {
  const { graph } = ctx
  const s = h.session
  app.innerHTML = `<div class="player">
    <div class="player-top"><button class="icon-btn" aria-label="Close and save" data-quit>×</button>
      <div class="progress" role="progressbar" aria-label="${esc(h.title)} progress" aria-valuemin="0" aria-valuemax="100"><b></b></div></div>
    <main class="stage" aria-live="polite"></main>
    <div class="player-foot"><button class="btn btn-primary btn-block" data-main></button></div></div>`
  const stage = app.querySelector('.stage')
  const bar = app.querySelector('.progress'); const fill = bar.querySelector('b')
  const btn = app.querySelector('[data-main]')
  let handler = null
  const foot = {
    set(label, fn, { disabled = false } = {}) { btn.hidden = false; btn.textContent = label; btn.disabled = disabled; handler = fn },
    enable(on) { btn.disabled = !on },
    hide() { btn.hidden = true; handler = null },
  }
  btn.addEventListener('click', () => { if (handler && !btn.disabled) handler() })
  app.querySelector('[data-quit]').addEventListener('click', h.quit)

  const show = () => {
    if (s.pos >= s.queue.length) { h.finish(); return }
    const pct = Math.round((100 * s.pos) / s.queue.length)
    fill.style.width = pct + '%'; bar.setAttribute('aria-valuenow', pct)
    const item = s.queue[s.pos]
    const card = h.card(item)
    window.scrollTo(0, 0)
    renderCard(card, { stage, foot, graph, conceptId: h.conceptId, retry: item.retry }, correct => {
      if (GRADED.has(card.type)) h.onAnswer(item, correct)
      s.pos++; h.save(); show()
    })
  }
  h.save(); show()
}

function finishScreen(app, ctx, { icon, title, stats, note }) {
  const { graph, lessons, starter, go } = ctx
  const nextId = graph.next()
  const next = nextId && (nextId === '_start' ? starter : lessons[nextId])
  app.innerHTML = `<div class="done">
    <div class="badge" aria-hidden="true">${icon}</div>
    <h1>${esc(title)}</h1>
    <div class="stats">${stats.map(([v, l]) => `<div><b>${esc(v)}</b>${esc(l)}</div>`).join('')}</div>
    ${note ? `<p class="muted">${esc(note)}</p>` : ''}
    <div class="actions">
      ${next ? `<button class="btn btn-primary btn-block" data-next>One more? ${esc(next.title)} · ${next.minutes || 3} min</button>` : ''}
      <button class="btn btn-block" data-home>Back to the map</button>
    </div></div>`
  app.querySelector('[data-next]')?.addEventListener('click', () => go('#/lesson/' + nextId))
  app.querySelector('[data-home]').addEventListener('click', () => go('#/'))
  app.querySelector('h1').setAttribute('tabindex', '-1'); app.querySelector('h1').focus()
}
