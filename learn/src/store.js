// Progress lives on this device only (localStorage). Every read and write is guarded: private browsing or
// blocked storage just means progress isn't kept, never a broken page.
const INTERVALS = [1, 3, 7, 16, 35, 90]   // days until the next review, by box

export function today(d = new Date()) {
  const z = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  return today(new Date(y, m - 1, d + n))
}

export function createStore(key) {
  const fresh = () => ({ learned: {}, days: [], session: null })
  let state = fresh()
  try { state = { ...fresh(), ...JSON.parse(localStorage.getItem(key) || '{}') } } catch { /* start fresh */ }
  const save = () => { try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* not kept */ } }

  return {
    get state() { return state },
    isLearned: id => Boolean(state.learned[id]),
    // Newly learned → first review tomorrow (box 0).
    learn(ids) {
      const t = today()
      for (const id of ids) {
        if (!state.learned[id]) state.learned[id] = { at: t, box: 0, due: addDays(t, 1) }
      }
      this.practised(); save()
    },
    // Spaced repetition: right → next box (longer gap); wrong → back to the start (tomorrow).
    reviewed(id, correct) {
      const item = state.learned[id]
      if (!item) return
      const t = today()
      item.box = correct ? Math.min(item.box + 1, INTERVALS.length - 1) : 0
      item.due = addDays(t, INTERVALS[item.box])
      item.last = t
      this.practised(); save()
    },
    due(ids) {
      const t = today()
      return ids.filter(id => state.learned[id] && state.learned[id].due <= t)
        .sort((a, b) => state.learned[a].due.localeCompare(state.learned[b].due))
    },
    practised() {
      const t = today()
      if (!state.days.includes(t)) state.days = [...state.days.slice(-60), t]
    },
    // The lesson in progress, so the learner can stop any time and resume on the same card.
    saveSession(s) { state.session = s; save() },
    clearSession() { state.session = null; save() },
    reset() { state = fresh(); save() },
  }
}
