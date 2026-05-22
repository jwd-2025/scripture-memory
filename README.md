# Hide It In Your Heart 📖

A mobile-first scripture memorization app. Multi-user, invite-only, with KJV and NKJV support.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Auth + Database | [Supabase](https://supabase.com) (free tier) |
| Hosting | [Netlify](https://netlify.com) |

---

## Setup (one-time, ~15 minutes)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon public key** (Settings → API)
3. Open the **SQL Editor** and paste + run the entire contents of `supabase/schema.sql`

### 2. Clone and configure locally

```bash
git clone https://github.com/YOUR_USERNAME/scripture-memory.git
cd scripture-memory
npm install
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Run locally:
```bash
npm run dev
```

### 3. Create your admin account

Because registration is invite-only, you'll bootstrap your own account manually:

1. In the Supabase dashboard, go to **Authentication → Users → Add user**
2. Enter your email and a password
3. In the **SQL Editor**, run:
   ```sql
   UPDATE public.profiles
   SET is_admin = TRUE
   WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
   ```
4. Sign in at `http://localhost:5173/login`

### 4. Deploy to Netlify

1. Push your repo to GitHub
2. In Netlify: **Add new site → Import from Git** → select your repo
3. Build settings are auto-detected from `netlify.toml`
4. Go to **Site settings → Environment variables** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

---

## Adding Verses

### Option A: Manual entry (Admin panel → Verses tab)
Good for adding individual verses one at a time.

### Option B: Google Sheets import (Admin panel → Import tab)

Create a Google Sheet with these columns in order (no header row — or with a header row, the import skips row 1):

| A: book_name | B: chapter | C: verse | D: version | E: text |
|---|---|---|---|---|
| John | 3 | 16 | KJV | For God so loved the world… |
| Romans | 8 | 28 | NKJV | And we know that all things work together… |

Book names must match exactly (e.g. `1 Corinthians`, `Song of Solomon`).

Then: **File → Share → Publish to web → Entire Document → CSV → Publish**

Copy the published URL and paste it into the Import tab.

> **Note on NKJV:** The NKJV is under copyright. You must own a licensed copy to use the text. This app does not include any NKJV text — you supply it yourself via the import or manual entry. KJV is in the public domain.

---

## Workflow

### For users
1. Receive an invite link from admin
2. Register at `/register?token=YOUR_TOKEN`
3. Verses are assigned by admin, or added personally from the dashboard
4. Practice by tapping any verse card → type out the verse word-by-word
5. 3 clean runs (zero errors, zero hints) → mastery suggested
6. Mastered verses enter spaced-repetition review (3 → 7 → 18 → 45 → 90 days)

### For admin
- **Invites tab**: Generate and share invite links (7-day expiry)
- **Verses tab**: Add/edit/delete KJV and NKJV verses
- **Sets tab**: Create curated verse lists and assign them to users
- **Import tab**: Bulk-import from a Google Sheet

---

## Mastery Logic

- **Clean run** = attempt with 0 errors AND 0 hints used
- **Mastery suggestion** = 3 consecutive clean runs
- If user confirms mastery → verse leaves active queue, enters spaced review
- If user disagrees → clean count resets, verse stays active
- Hints factor in: any hint used = run is not clean

---

## File Structure

```
src/
  components/
    admin/         # Admin panel tabs
    practice/      # TypingPractice + MasteryModal
    Layout.jsx     # App shell + nav
    ProtectedRoute.jsx
  contexts/
    AuthContext.jsx
  lib/
    supabase.js
    verseParser.js      # Tokenizer for auto-punctuation
    spacedRepetition.js # SM-2-inspired interval logic
  pages/
    Login.jsx
    Register.jsx    # Invite-only
    Dashboard.jsx
    Practice.jsx
    Admin.jsx
    Settings.jsx
supabase/
  schema.sql        # Run this in Supabase SQL editor
```
