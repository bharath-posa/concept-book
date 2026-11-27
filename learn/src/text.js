// Tiny formatter for lesson text: **bold**, *italics*, blank-line paragraphs and "- " bullet lists.
// Everything is escaped first, so lesson text can never inject HTML.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
}

export function rich(text) {
  return String(text ?? '').trim().split(/\n\s*\n/).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length && lines.every(l => l.startsWith('- '))) {
      return '<ul>' + lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>'
    }
    return `<p>${inline(lines.join(' '))}</p>`
  }).join('')
}

export { inline }
