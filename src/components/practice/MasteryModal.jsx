export default function MasteryModal({ errorCount, hintsUsed, cleanRunCount, cleanRunsNeeded, reference, onConfirm }) {
  const isClean         = errorCount === 0 && hintsUsed === 0
  const suggestMastery  = cleanRunCount >= cleanRunsNeeded
  const runsRemaining   = Math.max(0, cleanRunsNeeded - cleanRunCount)

  let emoji, headline, body

  if (suggestMastery) {
    emoji    = '🏆'
    headline = 'Mastery Achieved!'
    body     = `You've completed ${cleanRunsNeeded} clean runs of ${reference} with zero errors and zero hints. Would you like to mark this verse as mastered and move it out of your daily queue?`
  } else if (isClean) {
    emoji    = '✅'
    headline = 'Clean run!'
    body     = `No errors, no hints. ${runsRemaining} more clean run${runsRemaining !== 1 ? 's' : ''} until mastery is suggested.`
  } else {
    emoji    = errorCount > 3 ? '💪' : '👍'
    headline = 'Good effort!'
    const parts = []
    if (errorCount > 0) parts.push(`${errorCount} error${errorCount !== 1 ? 's' : ''}`)
    if (hintsUsed > 0)  parts.push(`${hintsUsed} hint${hintsUsed !== 1 ? 's' : ''}`)
    body = `You had ${parts.join(' and ')}. Keep practicing — you'll get there!`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <div className="text-5xl mb-2">{emoji}</div>
          <h2 className="text-xl font-bold text-slate-800">{headline}</h2>
          <p className="text-sm text-slate-500 mt-2">{body}</p>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Clean runs</span>
            <span>{Math.min(cleanRunCount, cleanRunsNeeded)} / {cleanRunsNeeded}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (cleanRunCount / cleanRunsNeeded) * 100)}%` }}
            />
          </div>
        </div>

        {/* Action buttons */}
        {suggestMastery ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onConfirm(false)}
              className="py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Keep practicing
            </button>
            <button
              onClick={() => onConfirm(true)}
              className="py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Mark mastered ✓
            </button>
          </div>
        ) : (
          <button
            onClick={() => onConfirm(false)}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            {isClean ? 'Next verse →' : 'Try again'}
          </button>
        )}
      </div>
    </div>
  )
}
