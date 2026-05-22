import { useState, useEffect, useRef, useCallback } from 'react'
import { tokenizeVerse, getWords, wordsMatch, normalize } from '../../lib/verseParser'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { nextReviewDate } from '../../lib/spacedRepetition'
import MasteryModal from './MasteryModal'

const CLEAN_RUNS_FOR_MASTERY = 3

export default function TypingPractice({ userVerse, onComplete }) {
  // userVerse shape: { id, verse_id, clean_run_count, status, review_interval_days,
  //                    verses: { text, book:{ name }, chapter, verse, version } }
  const { profile } = useAuth()
  const verseText  = userVerse.verses.text
  const reference  = `${userVerse.verses.books.name} ${userVerse.verses.chapter}:${userVerse.verses.verse}`

  const tokens      = tokenizeVerse(verseText)
  const words       = getWords(tokens)

  const [typedSoFar, setTypedSoFar]     = useState([]) // confirmed correct words
  const [currentInput, setCurrentInput] = useState('')
  const [isWrong, setIsWrong]           = useState(false)
  const [errorCount, setErrorCount]     = useState(0)
  const [hintsUsed, setHintsUsed]       = useState(0)
  const [hintActive, setHintActive]     = useState(false) // hint for current word
  const [done, setDone]                 = useState(false)
  const [showMastery, setShowMastery]   = useState(false)
  const [saving, setSaving]             = useState(false)

  const inputRef = useRef(null)
  const currentWordIndex = typedSoFar.length
  const currentWord      = words[currentWordIndex] ?? ''
  const isFinished       = currentWordIndex >= words.length

  // Focus input on mount and after each word
  useEffect(() => {
    if (!done) inputRef.current?.focus()
  }, [currentWordIndex, done])

  // Build the display: tokens before current word are "done", current word shows progress
  const renderedTokens = buildRenderedTokens(tokens, words, typedSoFar, currentInput, isWrong, hintActive, currentWord)

  function handleInput(e) {
    const val = e.target.value
    // Backspace on empty input: do nothing (can't go back past confirmed words)
    if (val === '') {
      setCurrentInput('')
      setIsWrong(false)
      setHintActive(false)
      return
    }

    // If user typed a space (or Enter), treat as word submission
    if (val.endsWith(' ') || val.endsWith('\n')) {
      const attempt = val.trim()
      submitWord(attempt)
      return
    }

    setCurrentInput(val)

    // Real-time wrong-word detection: only flag if typed length >= word length
    if (val.length >= currentWord.length) {
      if (!wordsMatch(val, currentWord)) {
        setIsWrong(true)
        setErrorCount(c => c + 1)
      } else {
        setIsWrong(false)
      }
    } else {
      setIsWrong(false)
    }
  }

  function handleKeyDown(e) {
    // Prevent deletion of confirmed words (the input is always just the current word)
    if (e.key === 'Enter') {
      e.preventDefault()
      const attempt = currentInput.trim()
      if (attempt) submitWord(attempt)
    }
    // Block backspace when input is empty to prevent going back
    if (e.key === 'Backspace' && currentInput === '') {
      e.preventDefault()
    }
  }

  function submitWord(attempt) {
    if (!attempt) return
    if (!wordsMatch(attempt, currentWord)) {
      // Wrong — require correction
      setIsWrong(true)
      setErrorCount(c => c + 1)
      return
    }
    // Correct
    const newTyped = [...typedSoFar, currentWord]
    setTypedSoFar(newTyped)
    setCurrentInput('')
    setIsWrong(false)
    setHintActive(false)

    if (newTyped.length >= words.length) {
      finishAttempt(errorCount, hintsUsed)
    }
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
      // Record attempt
      await supabase.from('attempts').insert({
        user_id:     profile.id,
        verse_id:    userVerse.verse_id,
        is_clean:    isClean,
        hints_used:  hints,
        error_count: errors,
      })

      // Update clean run count
      const newCleanCount = isClean ? (userVerse.clean_run_count + 1) : 0

      // Update user_verses
      const updates = { clean_run_count: newCleanCount }
      if (!isClean) {
        // Reset review interval on a bad run
        updates.review_interval_days = 3
      }

      await supabase
        .from('user_verses')
        .update(updates)
        .eq('id', userVerse.id)

      // Update daily streak
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
    if (last === today) {
      // Already practiced today, no change
    } else if (last === yesterday()) {
      newStreak += 1
    } else {
      newStreak = 1
    }

    await supabase.from('profiles').update({
      streak_count:       newStreak,
      last_practice_date: today,
    }).eq('id', profile.id)
  }

  function yesterday() {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  async function handleMasteryConfirm(confirm) {
    // confirm = true: user agrees to mark mastered
    const isClean     = errorCount === 0 && hintsUsed === 0
    const newCleanCount = isClean ? (userVerse.clean_run_count + 1) : 0
    const suggestMastery = newCleanCount >= CLEAN_RUNS_FOR_MASTERY

    if (suggestMastery && confirm) {
      await supabase.from('user_verses').update({
        status:      'mastered',
        mastered_at: new Date().toISOString(),
      }).eq('id', userVerse.id)
    } else if (suggestMastery && !confirm) {
      // User disagrees — reset clean count so they keep practicing
      await supabase.from('user_verses').update({
        clean_run_count: 0,
      }).eq('id', userVerse.id)
    } else {
      // Not mastery territory — schedule next review via spaced repetition
      const { date, intervalDays } = nextReviewDate(userVerse.review_interval_days, isClean)
      await supabase.from('user_verses').update({
        next_review_date:     date,
        review_interval_days: intervalDays,
      }).eq('id', userVerse.id)
    }

    setShowMastery(false)
    onComplete?.()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Reference */}
      <div className="text-center py-3 px-4 border-b border-slate-100">
        <p className="text-sm font-semibold text-brand-700">{reference}</p>
        <p className="text-xs text-slate-400">{userVerse.verses.version}</p>
      </div>

      {/* Verse display */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="font-serif text-lg leading-9 text-slate-700 select-none">
          {renderedTokens}
        </div>
      </div>

      {/* Input area */}
      {!done && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-2">
          {/* Current word prompt */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Word {currentWordIndex + 1} of {words.length}</span>
            <button
              onClick={handleHint}
              disabled={hintActive}
              className="text-brand-600 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {hintActive ? `Hint: "${currentWord[0]}…"` : '💡 Hint'}
            </button>
          </div>

          <div className="relative">
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
              <p className="text-xs text-red-500 mt-1 px-1">
                Not quite — check your spelling and try again.
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex justify-between text-xs text-slate-400 px-1">
            <span>Errors: <strong className={errorCount > 0 ? 'text-red-500' : 'text-slate-500'}>{errorCount}</strong></span>
            <span>Hints: <strong className={hintsUsed > 0 ? 'text-amber-500' : 'text-slate-500'}>{hintsUsed}</strong></span>
          </div>
        </div>
      )}

      {done && saving && (
        <div className="px-4 pb-6 pt-2 text-center text-sm text-slate-400">Saving…</div>
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

function buildRenderedTokens(tokens, words, typedSoFar, currentInput, isWrong, hintActive, currentWord) {
  let wordIdx = 0
  return tokens.map((token, i) => {
    if (token.type === 'punct') {
      return <span key={i} className="text-slate-400">{token.value}</span>
    }

    const idx = wordIdx++
    if (idx < typedSoFar.length) {
      // Confirmed correct
      return <span key={i} className="text-slate-800">{token.value} </span>
    }
    if (idx === typedSoFar.length) {
      // Current word being typed
      if (!currentInput) {
        return (
          <span key={i} className="inline-block bg-brand-100 rounded px-0.5 text-brand-800 cursor-text">
            {hintActive ? `${token.value[0]}…` : '▌'}
            {' '}
          </span>
        )
      }
      return (
        <span
          key={i}
          className={`inline-block rounded px-0.5 ${isWrong ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-800'}`}
        >
          {currentInput}
          {' '}
        </span>
      )
    }
    // Future words — show as placeholder dots
    return (
      <span key={i} className="text-slate-300">
        {'_'.repeat(token.value.length)}{' '}
      </span>
    )
  })
}
