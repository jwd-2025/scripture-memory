import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const [activeVerses,   setActiveVerses]   = useState([])
  const [masteredVerses, setMasteredVerses] = useState([])
  const [reviewDue,      setReviewDue]      = useState([])
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    fetchVerses()
  }, [profile?.id])

  async function fetchVerses() {
    if (!profile?.id) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('user_verses')
      .select(`
        *,
        verses (
          id, chapter, verse, version, text,
          books ( name )
        )
      `)
      .eq('user_id', profile.id)
      .order('added_at', { ascending: true })

    if (data) {
      setActiveVerses(data.filter(v => v.status === 'active'))
      setMasteredVerses(data.filter(v => v.status === 'mastered'))
      setReviewDue(data.filter(v =>
        v.status === 'mastered' &&
        v.next_review_date &&
        v.next_review_date <= today
      ))
    }
    setLoading(false)
  }

  function startPractice(verseQueue) {
    // Store the queue in sessionStorage and navigate to practice
    sessionStorage.setItem('practiceQueue', JSON.stringify(verseQueue.map(v => v.id)))
    navigate('/practice')
  }

  const streak = profile?.streak_count ?? 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Greeting + streak */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Hello, {profile?.username ?? 'friend'} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {profile?.bible_version} · Keep hiding it in your heart
          </p>
        </div>
        <StreakBadge streak={streak} />
      </div>

      {/* Review due banner */}
      {reviewDue.length > 0 && (
        <div
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => startPractice(reviewDue)}
        >
          <span className="text-2xl">🔔</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Review time!</p>
            <p className="text-amber-600 text-xs">{reviewDue.length} mastered verse{reviewDue.length !== 1 ? 's' : ''} due for review</p>
          </div>
          <span className="text-amber-400">›</span>
        </div>
      )}

      {/* Active queue */}
      <Section
        title="Your verses"
        count={activeVerses.length}
        action={activeVerses.length > 0 ? { label: 'Practice all', onClick: () => startPractice(activeVerses) } : null}
        empty={activeVerses.length === 0 && 'No active verses yet. Ask your admin to assign some, or add your own below.'}
      >
        {activeVerses.map(uv => (
          <VerseCard
            key={uv.id}
            uv={uv}
            onClick={() => startPractice([uv])}
          />
        ))}
      </Section>

      {/* Random mastered review */}
      {masteredVerses.length > 0 && (
        <Section title="Random review" count={masteredVerses.length}>
          <button
            onClick={() => {
              const shuffled = [...masteredVerses].sort(() => Math.random() - 0.5).slice(0, 5)
              startPractice(shuffled)
            }}
            className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            🎲 Quiz me on {Math.min(5, masteredVerses.length)} random mastered verses
          </button>
        </Section>
      )}

      {/* Mastered list */}
      {masteredVerses.length > 0 && (
        <Section title="Mastered" count={masteredVerses.length} collapsible>
          {masteredVerses.map(uv => (
            <VerseCard
              key={uv.id}
              uv={uv}
              mastered
              onClick={() => startPractice([uv])}
            />
          ))}
        </Section>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StreakBadge({ streak }) {
  if (streak === 0) return null
  return (
    <div className="flex flex-col items-center bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      <span className="text-xl">🔥</span>
      <span className="text-xs font-bold text-amber-700">{streak}</span>
      <span className="text-[10px] text-amber-500">day{streak !== 1 ? 's' : ''}</span>
    </div>
  )
}

function Section({ title, count, action, empty, collapsible, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => collapsible && setOpen(o => !o)}
          className={`flex items-center gap-2 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <h2 className="font-semibold text-slate-700 text-sm">{title}</h2>
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{count}</span>
          {collapsible && <span className="text-slate-400 text-xs">{open ? '▾' : '▸'}</span>}
        </button>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-brand-600 font-medium hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-2">
          {empty ? (
            <p className="text-sm text-slate-400 italic px-1">{empty}</p>
          ) : children}
        </div>
      )}
    </div>
  )
}

function VerseCard({ uv, mastered, onClick }) {
  const [revealed, setRevealed] = useState(false)
  const ref = `${uv.verses.books.name} ${uv.verses.chapter}:${uv.verses.verse}`

  function handleReveal(e) {
    e.stopPropagation()
    setRevealed(r => !r)
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-md hover:border-brand-200 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Reference row */}
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold text-brand-700">{ref}</p>
            <button
              onClick={handleReveal}
              className="text-[10px] text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 transition-colors"
            >
              {revealed ? 'Hide' : 'Peek'}
            </button>
          </div>
          {/* Verse text — only shown when revealed */}
          {revealed && (
            <p className="text-sm text-slate-600 font-serif leading-snug">{uv.verses.text}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {mastered ? (
            <span className="text-lg">🏆</span>
          ) : (
            <CleanRunPips count={uv.clean_run_count} needed={3} />
          )}
          <button
            onClick={onClick}
            className="text-[10px] bg-brand-600 text-white rounded-lg px-2.5 py-1 font-semibold hover:bg-brand-700 transition-colors"
          >
            Practice
          </button>
        </div>
      </div>
    </div>
  )
}

function CleanRunPips({ count, needed }) {
  return (
    <div className="flex gap-1 flex-shrink-0 pt-0.5">
      {Array.from({ length: needed }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < count ? 'bg-brand-500' : 'bg-slate-200'}`}
        />
      ))}
    </div>
  )
}
