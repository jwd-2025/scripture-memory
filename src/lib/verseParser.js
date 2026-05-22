/**
 * Splits a verse into tokens. Each token is either a "word" or "punctuation".
 *
 * Examples:
 *   "For God so loved" → [word:'For', word:'God', word:'so', word:'loved']
 *   "fear not," → [word:'fear', word:'not', punct:',']
 *   "Lord—and" → [word:'Lord', punct:'—', word:'and']
 *
 * The user types words only. Punctuation tokens are auto-inserted.
 */
export function tokenizeVerse(text) {
  // Normalize smart quotes / em-dashes for consistent matching
  const normalized = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()

  const tokens = []
  // Split on word boundaries while keeping delimiters
  const parts = normalized.split(/(\s+)/)

  for (const part of parts) {
    if (!part || /^\s+$/.test(part)) continue

    // A "chunk" may have leading/trailing punctuation: ,."';:!?—-
    const match = part.match(/^([^a-zA-Z0-9''-]*)([a-zA-Z0-9''-]+)([^a-zA-Z0-9''-]*)$/)
    if (match) {
      const [, leading, word, trailing] = match
      if (leading) tokens.push({ type: 'punct', value: leading })
      if (word)    tokens.push({ type: 'word',  value: word })
      if (trailing) tokens.push({ type: 'punct', value: trailing })
    } else {
      // Entire chunk is punctuation
      tokens.push({ type: 'punct', value: part })
    }
  }
  return tokens
}

/**
 * Given tokens, return the list of words (in order) that the user must type.
 */
export function getWords(tokens) {
  return tokens.filter(t => t.type === 'word').map(t => t.value)
}

/**
 * Normalize a typed word for comparison (lowercase, strip possessive apostrophes for leniency).
 */
export function normalize(word) {
  return word.toLowerCase().replace(/['']/g, "'")
}

/**
 * Compare typed word to expected word (case-insensitive).
 */
export function wordsMatch(typed, expected) {
  return normalize(typed) === normalize(expected)
}
