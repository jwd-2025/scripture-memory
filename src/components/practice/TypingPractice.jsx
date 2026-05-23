import { useState, useEffect, useRef } from 'react'
import { tokenizeVerse, getWords, wordsMatch } from '../../lib/verseParser'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { nextReviewDate } from '../../lib/spacedRepetition'
import MasteryModal from './MasteryModal'

const CLEAN_RUNS_FOR_MASTERY = 3

export default function TypingPractice({ userVerse, onComplete }) {
  const { profile } = useAuth()
  const verseText  = userVerse.verses.text
  const reference  = `${userVerse.verses.books.name} ${userVerse.verses.chapter}:${userVerse.verses.verse}`

  const tokens = tokenizeVerse(verseText)
  const words  = getWords(tokens)

  const [typedSoFar,   setTypedSoFar]   = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [isWrong,      setIsWrong]      = useState(false)
  const [errorCount,   setErrorCount]   = useState(0)
  const [hintsUsed,    setHintsUsed]    = useState(0)
  const [hintActive,   setHintActive]   = useState(false)
  const [done,         setDone]         = useState(false)
  const [showMastery,  setShowMastery]  = useState(false)
  const [saving,       setSaving]       = useState(false)

  const inputRef       = useRef(null)
  const currentWordRef = useRef(null)  // ref on the active word span
  const verseScrollRef = useRef(null)  // ref on the scrollable verse container

  const currentWordIndex = typedSoFar.length
  const currentWord      = words[currentWordIndex] ?? ''

  // Focus input on mount and after each word
  useEffect(() => {
    if (!done) inputRef.current?.focus()
  }, [currentWordIndex, done])

  // Scroll current word into view whenever it advances
  useEffect(() => {
    if (currentWordRef.current && verseScrollRef.current) {
      const container = verseScrollRef.current
      const el        = currentWordRef.current
      const elTop     = el.offsetTop
      const elBottom  = elTop + el.offsetHeight
      const cTop      = container.scrollTop
      const cBottom   = cTop + container.clientHeight

      // Scroll so the current word is comfortably in the middle of the visible area
      if (elTop < cTop + 40 || elBottom > cBottom - 40) {
        container.scrollTo({
          top: elTop - container.clientHeight / 2,
          behavior: 'smooth',
        })
      }
    }
  }, [currentWordIndex])

  function handleInput(e) {
    const val = e.target.value
    if (val === '') {
      setCurrentInput('')
      setIsWrong(false)
      setHintActive(false)
      return
    }
    if (val.endsWith(' ') || val.endsWith('\n')) {
      submitWord(val.trim())
      return
    }
    setCurrentInput(val)
    if (val.length >= currentWord.length) {
      setIsWrong(!wordsMatch(val, currentWord))
      if (!wordsMatch(val, currentWord)) setErrorCount(c => c + 1)
    } else {
      setIsWrong(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (currentInput.trim()) submitWord(currentInput.trim())
    }
    if (e.key === 'Backspace' && currentInput === '') e.preventDefault()
  }

  function submitWord(attempt) {
    if (!attempt) return
    if (!wordsMatch(attempt, currentWord)) {
      setIsWrong(true)
      setErrorCount(c => c + 1)
      return
    }
    const newTyped = [...typedSoFar, currentWord]
    setTypedSoFar(newTyped)
    setCurrentInput('')
    setIsWrong(false)
    setHintActive(false)
    if (newTyped.length >= words.length) finishAttempt(errorCount, hintsUsed)
  }

  function handleHint() {
    if (hintActive) return
    setHintsUsed(h => h + 1)
    setHintActive(true)
  }

  async function finishAttempt(errors, hints) {
    setDone(true)
    const isClean = errors === 0 && hints === 0
    setSaving(true)
    try {
      await supabase.from('attempts').insert({
        user_id: profile.id, verse_id: userVerse.verse_id,
        is_clean: isClean, hints_used: hints, error_count: errors,
      })
      const newCleanCount = isClean ? (userVerse.clean_run_count + 1) : 0
      const updates = { clean_run_count: newCleanCount }
      if (!isClean) updates.review_interval_days = 3
      await supabase.from('user_verses').update(updates).eq('id', userVerse.id)
      await updateStreak()
    } finally {
      setSaving(false)
      setShowMastery(true)
    }
  }

  async function updateStreak() {
    const today = new Date().toISOString().split('T')[0]
    const last  = profile.last_practice_date
    let newStreak = profile.streak_count
    if (last === today) { /* no change */ }
    else if (last === yesterday()) newStreak += 1
    else newStreak = 1
    await supabase.from('profiles').update({
      streak_count: newStreak, last_practice_date: today,
    }).eq('id', profile.id)
  }

  function yesterday() {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  async function handleMasteryConfirm(confirm) {
    const isClean        = errorCount === 0 && hintsUsed === 0
    const newCleanCount  = isClean ? (userVerse.clean_run_count + 1) : 0
    const suggestMastery = newCleanCount >= CLEAN_RUNS_FOR_MASTERY

    if (suggestMastery && confirm) {
      await supabase.from('user_verses').update({
        status: 'mastered', mastered_at: new Date().toISOString(),
      }).eq('id', userVerse.id)
    } else if (suggestMastery && !confirm) {
      await supabase.from('user_verses').update({ clean_run_count: 0 }).eq('id', userVerse.id)
    } else {
      const { date, intervalDays } = nextReviewDate(userVerse.review_interval_days, isClean)
      await supabase.from('user_verses').update({
        next_review_date: date, review_interval_days: intervalDays,
      }).eq('id', userVerse.id)
    }
    setShowMastery(false)
    onComplete?.()
  }

  // Build rendered tokens, attaching ref to the current word
  const renderedTokens = buildRenderedTokens(
    tokens, words, typedSoFar, currentInput, isWrong, hintActive, currentWord, currentWordRef
  )

  return (
    <div className="flex flex-col h-full">
      {/* Reference */}
      <div className="text-center py-3 px-4 border-b border-slate-100 flex-shrink-0">
        <p className="text-sm font-semibold text-brand-700">{reference}</p>
        <p className="text-xs text-slate-400">{userVerse.verses.version}</p>
      </div>

      {/* Verse display — scrollable, shrinks when keyboard appears */}
      <div ref={verseScrollRef} className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        <div className="font-serif text-lg leading-9 text-slate-700 select-none">
          {renderedTokens}
        </div>
        {/* Extra padding so last word isn't right at the edge */}
        <div className="h-8" />
      </div>

      {/* Input area — always pinned above keyboard */}
      {!done && (
        <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-slate-100 bg-white space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Word {currentWordIndex + 1} of {words.length}</span>
            <button
              onClick={handleHint}
              disabled={hintActive}
              className="text-brand-600 font-medium disabled:opacity-40"
            >
              {hintActive ? `Hint: "${currentWord[0]}…"` : '💡 Hint'}
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder={hintActive ? `Starts with "${currentWord[0]}"…` : 'Type the next word…'}
            className={`w-full rounded-xl border-2 px-4 py-3 text-base transition-colors focus:outline-none ${
              isWrong
                ? 'border-red-400 bg-red-50 text-red-700 placeholder-red-300 focus:border-red-500'
                : 'border-slate-200 bg-white focus:border-brand-500'
            }`}
          />
          {isWrong && (
            <p className="text-xs text-red-500 px-1">Not quite — check your spelling and try again.</p>
          )}

          <div className="flex justify-between text-xs text-slate-400 px-1">
            <span>Errors: <strong className={errorCount > 0 ? 'text-red-500' : 'text-slate-500'}>{errorCount}</strong></span>
            <span>Hints: <strong className={hintsUsed > 0 ? 'text-amber-500' : 'text-slate-500'}>{hintsUsed}</strong></span>
          </div>
        </div>
      )}

      {done && saving && (
        <div className="flex-shrink-0 px-4 pb-6 pt-2 text-center text-sm text-slate-400">Saving…</div>
      )}

      {showMastery && (
        <MasteryModal
          errorCount={errorCount}
          hintsUsed={hintsUsed}
          cleanRunCount={userVerse.clean_run_count + (errorCount === 0 && hintsUsed === 0 ? 1 : 0)}
          cleanRunsNeeded={CLEAN_RUNS_FOR_MASTERY}
          reference={reference}
          onConfirm={handleMasteryConfirm}
        />
      )}
    </div>
  )
}

// ── Render helpers ────────────────────────────────────────────────────────────

function buildRenderedTokens(tokens, words, typedSoFar, currentInput, isWrong, hintActive, currentWord, currentWordRef) {
  let wordIdx = 0
  return tokens.map((token, i) => {
    if (token.type === 'punct') {
      return <span key={i} className="text-slate-400">{token.value}</span>
    }

    const idx = wordIdx++

    if (idx < typedSoFar.length) {
      return <span key={i} className="text-slate-800">{token.value} </span>
    }

    if (idx === typedSoFar.length) {
      // Current word — attach scroll ref here
      if (!currentInput) {
        return (
          <span key={i} ref={currentWordRef}
            className="inline-block bg-brand-100 rounded px-0.5 text-brand-800 cursor-text">
            {hintActive ? `${token.value[0]}…` : '▌'}{' '}
          </span>
        )
      }
      return (
        <span key={i} ref={currentWordRef}
          className={`inline-block rounded px-0.5 ${isWrong ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-800'}`}>
          {currentInput}{' '}
        </span>
      )
    }

    return (
      <span key={i} className="text-slate-300">
        {'_'.repeat(token.value.length)}{' '}
      </span>
    )
  })
}
