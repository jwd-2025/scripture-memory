import { useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Imports verses from a published Google Sheet.
 *
 * Expected sheet columns (row 1 = headers):
 *   A: book_name   (must match exactly, e.g. "John", "1 Corinthians")
 *   B: chapter     (number)
 *   C: verse       (number)
 *   D: version     ("KJV" or "NKJV")
 *   E: text        (full verse text)
 */
export default function SheetImport() {
  const [sheetUrl, setSheetUrl] = useState('')
  const [preview,  setPreview]  = useState([])
  const [books,    setBooks]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [importing, setImporting] = useState(false)
  const [results,  setResults]  = useState(null)
  const [error,    setError]    = useState('')

  async function fetchPreview(e) {
    e.preventDefault()
    setError(''); setPreview([]); setResults(null)
    setLoading(true)

    try {
      const csvUrl = sheetUrlToCsvUrl(sheetUrl)
      const resp   = await fetch(csvUrl)
      if (!resp.ok) throw new Error('Could not fetch sheet. Make sure it is published to the web as CSV.')
      const text = await resp.text()
      const rows = parseCsv(text)
      if (rows.length < 2) throw new Error('Sheet appears empty or has no data rows.')
      const parsed = rows.slice(1).map(parseRow).filter(Boolean)
      if (parsed.length === 0) throw new Error('No valid verse rows found. Check column format.')
      setPreview(parsed.slice(0, 10))

      // Fetch books for matching
      const { data: booksData } = await supabase.from('books').select('id, name')
      if (booksData) setBooks(booksData)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function runImport() {
    setImporting(true); setError('')
    try {
      const csvUrl = sheetUrlToCsvUrl(sheetUrl)
      const resp   = await fetch(csvUrl)
      const text   = await resp.text()
      const rows   = parseCsv(text)
      const parsed = rows.slice(1).map(parseRow).filter(Boolean)

      const { data: booksData } = await supabase.from('books').select('id, name')
      const bookMap = Object.fromEntries(booksData.map(b => [b.name.toLowerCase(), b.id]))

      let imported = 0, skipped = 0, errors = 0
      const BATCH = 50

      for (let i = 0; i < parsed.length; i += BATCH) {
        const batch = parsed.slice(i, i + BATCH).map(r => {
          const bookId = bookMap[r.book_name.toLowerCase()]
          if (!bookId) { skipped++; return null }
          return {
            book_id: bookId,
            chapter: r.chapter,
            verse:   r.verse,
            version: r.version,
            text:    r.text,
          }
        }).filter(Boolean)

        const { data, error } = await supabase
          .from('verses')
          .upsert(batch, { onConflict: 'book_id,chapter,verse,version' })

        if (error) errors += batch.length
        else imported += batch.length
      }

      setResults({ imported, skipped, errors })
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 space-y-1">
        <p className="font-semibold">Google Sheets format</p>
        <p className="text-xs">Your sheet must have these columns in order: <strong>book_name · chapter · verse · version · text</strong></p>
        <p className="text-xs">The sheet must be published: <em>File → Share → Publish to web → CSV</em></p>
      </div>

      <form onSubmit={fetchPreview} className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Published sheet URL</label>
          <input
            required
            value={sheetUrl}
            onChange={e => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/pub?output=csv"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full bg-slate-700 text-white rounded-lg py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Fetching preview…' : 'Preview first 10 rows'}
        </button>
      </form>

      {preview.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Preview</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['Book','Ch','Vs','Ver','Text'].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    <td className="px-2 py-1.5 text-slate-600">{r.book_name}</td>
                    <td className="px-2 py-1.5 text-slate-600">{r.chapter}</td>
                    <td className="px-2 py-1.5 text-slate-600">{r.verse}</td>
                    <td className="px-2 py-1.5 text-slate-600">{r.version}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[160px] truncate">{r.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {results ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
              <p className="font-semibold">Import complete!</p>
              <p>✅ Imported: {results.imported} · ⏭ Skipped: {results.skipped} · ❌ Errors: {results.errors}</p>
            </div>
          ) : (
            <button
              onClick={runImport}
              disabled={importing}
              className="w-full bg-brand-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {importing ? 'Importing…' : '⬆️ Import all rows into database'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sheetUrlToCsvUrl(url) {
  // Accept either the "publish" CSV URL directly, or convert a regular sheet URL
  if (url.includes('output=csv')) return url
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) throw new Error('Could not parse the sheet URL.')
  return `https://docs.google.com/spreadsheets/d/${match[1]}/pub?output=csv`
}

function parseCsv(text) {
  return text.split('\n').map(line => {
    const cols = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim())
    return cols
  })
}

function parseRow(cols) {
  if (cols.length < 5) return null
  const [book_name, chapter, verse, version, ...textParts] = cols
  const text = textParts.join(',').trim()
  if (!book_name || !chapter || !verse || !version || !text) return null
  if (!['KJV','NKJV'].includes(version.toUpperCase())) return null
  return {
    book_name: book_name.trim(),
    chapter:   parseInt(chapter),
    verse:     parseInt(verse),
    version:   version.toUpperCase(),
    text:      text.replace(/^"|"$/g, ''),
  }
}
