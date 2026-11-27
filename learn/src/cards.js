// One renderer per card type. Each draws into `stage` and drives the footer button through `foot`.
// Graded cards call done(correct); the others call done().
import { esc, rich, inline } from './text.js'
import { seededShuffle } from './graph.js'

const diagram = svg => (svg ? `<div class="diagram" aria-hidden="true">${svg}</div>` : '')

export function renderCard(card, { stage, foot, graph, conceptId, retry }, done) {
  const r = RENDER[card.type]
  if (!r) { done(); return }
  stage.innerHTML = retry ? '<div class="kicker">Let\'s try this one again</div>' : ''
  const box = document.createElement('div')
  stage.append(box)
  r(card, { box, foot, graph, conceptId }, done)
  const h = box.querySelector('h2, .q')
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }) }
}

function feedback(box, kind, title, body) {
  const f = document.createElement('div')
  f.className = `feedback ${kind}`; f.setAttribute('role', 'status')
  f.innerHTML = `<h3>${esc(title)}</h3>${body ? `<div>${rich(body)}</div>` : ''}`
  box.append(f)
  f.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

const PRAISE = ['Nice!', 'Exactly.', 'Spot on.', 'Yes!', 'Correct.']
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)]

const RENDER = {
  hook(card, { box, foot }, done) {
    box.innerHTML = `<div class="kicker">Think about it</div><h2 class="q">${inline(card.text)}</h2>`
    foot.set('Show me', () => {
      feedback(box, 'info', 'Here\'s the idea', card.reveal)
      foot.set('Continue', done)
    })
  },

  idea(card, { box, foot }, done) {
    box.innerHTML = `<div class="kicker">The idea</div><div class="q" style="font-weight:400">${rich(card.text)}</div>${diagram(card.svg)}`
    foot.set('Got it', done)
  },

  steps(card, { box, foot }, done) {
    box.innerHTML = `<div class="kicker">${esc(card.title || 'Worked example')}</div>
      ${card.problem ? `<div class="problem q" style="font-weight:500">${inline(card.problem)}</div>` : ''}
      ${diagram(card.svg)}<ol class="steps-list"></ol>`
    const list = box.querySelector('ol'); let i = 0
    const nextStep = () => {
      const li = document.createElement('li'); li.innerHTML = inline(card.steps[i]); list.append(li); i++
      li.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      foot.set(i < card.steps.length ? 'Next step' : 'Continue', i < card.steps.length ? nextStep : done)
    }
    foot.set('Show the first step', nextStep)
  },

  predict(card, { box, foot }, done) {
    box.innerHTML = `<div class="kicker">Make a guess</div><h2 class="q">${inline(card.q)}</h2>
      <div class="options">${card.options.map((o, i) => `<button class="opt" data-i="${i}">${inline(o)}</button>`).join('')}</div>`
    foot.hide()
    box.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
      box.querySelectorAll('.opt').forEach(x => { x.disabled = true })
      b.classList.add('picked')
      feedback(box, 'info', 'Here\'s what happens', card.reveal)
      foot.set('Continue', done)
    }))
  },

  choice(card, { box, foot }, done) {
    const opts = seededShuffle(card.options.map((o, i) => ({ ...o, i })), card.q)
    box.innerHTML = `<div class="kicker">Your turn</div><h2 class="q">${inline(card.q)}</h2>${diagram(card.svg)}
      <div class="options">${opts.map(o => `<button class="opt" data-i="${o.i}">${inline(o.text)}</button>`).join('')}</div>`
    foot.hide()
    box.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
      const o = card.options[+b.dataset.i]
      box.querySelectorAll('.opt').forEach(x => {
        x.disabled = true
        if (card.options[+x.dataset.i].correct) x.classList.add('right')
      })
      if (o.correct) feedback(box, 'good', praise(), o.why)
      else { b.classList.add('wrong'); feedback(box, 'bad', 'Not quite', o.feedback) }
      foot.set('Continue', () => done(Boolean(o.correct)))
    }))
  },

  number(card, { box, foot }, done) {
    box.innerHTML = `<div class="kicker">Your turn</div><h2 class="q">${inline(card.q)}</h2>${diagram(card.svg)}
      <div class="num-row"><input type="text" inputmode="decimal" autocomplete="off" aria-label="Your answer" placeholder="Your answer">
      ${card.unit ? `<span class="unit">${esc(card.unit)}</span>` : ''}</div>
      ${card.hint ? '<button class="btn btn-ghost hint-btn">Need a hint?</button>' : ''}`
    const input = box.querySelector('input')
    box.querySelector('.hint-btn')?.addEventListener('click', e => { e.target.remove(); feedback(box, 'info', 'Hint', card.hint) })
    const check = () => {
      const v = parseNumber(input.value)
      if (v === null) { input.focus(); return }
      input.disabled = true; box.querySelector('.hint-btn')?.remove()
      const tol = Math.max(Number(card.tolerance) || 0, 1e-9)
      const ok = Math.abs(v - Number(card.answer)) <= tol
      if (ok) feedback(box, 'good', praise(), card.explain)
      else feedback(box, 'bad', `The answer is ${card.answer}${card.unit ? ' ' + card.unit : ''}`, card.explain)
      foot.set('Continue', () => done(ok))
    }
    input.addEventListener('input', () => foot.enable(parseNumber(input.value) !== null))
    input.addEventListener('keydown', e => { if (e.key === 'Enter') check() })
    foot.set('Check', check, { disabled: true })
  },

  order(card, { box, foot }, done) {
    const items = seededShuffle(card.items.map((t, i) => ({ t, i })), card.q)
    const picked = []
    box.innerHTML = `<div class="kicker">Put in order</div><h2 class="q">${inline(card.q)}</h2>
      <p class="muted small">Tap them in order. Tap a placed one to take it back.</p>
      <ol class="order-slots"></ol><div class="options pool"></div>`
    const slots = box.querySelector('.order-slots'); const pool = box.querySelector('.pool')
    const draw = () => {
      slots.innerHTML = card.items.map((_, n) => picked[n] !== undefined
        ? `<li><b>${n + 1}</b><button data-back="${n}">${inline(card.items[picked[n]])}</button></li>`
        : `<li><b>${n + 1}</b></li>`).join('')
      pool.innerHTML = items.filter(x => !picked.includes(x.i)).map(x => `<button class="opt" data-i="${x.i}">${inline(x.t)}</button>`).join('')
      pool.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { picked.push(+b.dataset.i); draw() }))
      slots.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { picked.splice(+b.dataset.back, 1); draw() }))
      foot.enable(picked.length === card.items.length)
    }
    foot.set('Check', () => {
      const ok = picked.every((v, n) => v === n)
      slots.querySelectorAll('[data-back]').forEach(b => { b.disabled = true })
      slots.querySelectorAll('li').forEach((li, n) => li.classList.add(picked[n] === n ? 'right' : 'wrong'))
      slots.querySelectorAll('li').forEach(li => { li.style.borderStyle = 'solid'; li.style.borderColor = li.classList.contains('right') ? 'var(--good)' : 'var(--bad)' })
      if (ok) feedback(box, 'good', praise(), card.explain)
      else feedback(box, 'bad', 'Not quite — here\'s the order', card.items.map((t, n) => `${n + 1}. ${t}`).join('\n\n') + '\n\n' + card.explain)
      foot.set('Continue', () => done(ok))
    }, { disabled: true })
    draw()
  },

  build(card, { box, foot, graph, conceptId }, done) {
    const node = graph.nodes.get(conceptId)
    const { answer, options } = graph.buildChoices(conceptId)
    const chosen = new Set()
    const label = id => graph.nodes.get(id).label
    box.innerHTML = `<div class="kicker">Build it</div><h2 class="q">What is <strong>${esc(node.label)}</strong> built from?</h2>
      <p class="muted small">Pick all the building blocks (${answer.length}).</p>
      <div class="build-chips">${options.map(id => `<button class="opt" data-id="${esc(id)}" aria-pressed="false">${esc(label(id))}</button>`).join('')}</div>`
    box.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id
      chosen.has(id) ? chosen.delete(id) : chosen.add(id)
      b.classList.toggle('picked', chosen.has(id)); b.setAttribute('aria-pressed', chosen.has(id))
      foot.enable(chosen.size > 0)
    }))
    foot.set('Check', () => {
      const ok = chosen.size === answer.length && answer.every(a => chosen.has(a))
      box.querySelectorAll('.opt').forEach(b => {
        b.disabled = true
        const right = answer.includes(b.dataset.id)
        if (right) b.classList.add('right'); else if (chosen.has(b.dataset.id)) b.classList.add('wrong')
      })
      const why = `**${node.label}** = ${answer.map(a => label(a)).join(' + ')}. ${node.summary || capital(node.defines) + '.'}`
      feedback(box, ok ? 'good' : 'bad', ok ? praise() : 'Not quite', why)
      foot.set('Continue', () => done(ok))
    }, { disabled: true })
  },
}

// Accepts 12, 12.5, 12,5, -3, 1/2 and ignores a trailing unit or degree sign.
export function parseNumber(raw) {
  const s = String(raw).trim().replace(/[°a-zA-Z²³\s]+$/u, '').replace(',', '.').replace(/^−/, '-')
  if (/^-?\d+(\.\d+)?\s*\/\s*-?\d+(\.\d+)?$/.test(s)) { const [a, b] = s.split('/').map(Number); return b ? a / b : null }
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null
}

const capital = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
