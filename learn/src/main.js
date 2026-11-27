// ConceptBook Learn — loads a domain's lessons and routes between the map, a lesson and reviews.
import './style.css'
import { createStore } from './store.js'
import { createGraph } from './graph.js'
import { renderHome } from './home.js'
import { playLesson, playReview } from './player.js'

const app = document.getElementById('app')

async function boot() {
  let data
  try {
    const index = await (await fetch('./index.json')).json()
    data = await (await fetch('./' + index[0].file)).json()
  } catch {
    app.innerHTML = '<p class="boot">Couldn\'t load the lessons. Check your connection and reload.</p>'
    return
  }
  const store = createStore(`cb-learn:v1:${data.domain}.${data.level}.${data.language}`)
  const graph = createGraph(data, store)
  const ctx = { graph, store, lessons: data.lessons, starter: data.starter, go }
  document.title = `${data.title} · ConceptBook Learn`

  function go(hash) { if (location.hash === hash) route(); else location.hash = hash }
  function route() {
    const [, page, id] = (location.hash || '#/').split('/')
    if (page === 'lesson' && id) playLesson(app, ctx, decodeURIComponent(id))
    else if (page === 'review') playReview(app, ctx)
    else renderHome(app, ctx)
  }
  window.addEventListener('hashchange', route)
  route()
}

boot()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
