-- ============================================================
-- Scripture Memory App — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Profiles (extends auth.users) ────────────────────────────
CREATE TABLE public.profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username         TEXT        NOT NULL,
  bible_version    TEXT        NOT NULL DEFAULT 'NKJV' CHECK (bible_version IN ('NKJV','KJV')),
  is_admin         BOOLEAN     NOT NULL DEFAULT FALSE,
  streak_count     INTEGER     NOT NULL DEFAULT 0,
  last_practice_date DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- ── Invites ───────────────────────────────────────────────────
CREATE TABLE public.invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL,
  token        TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by   UUID        REFERENCES public.profiles(id),
  used         BOOLEAN     NOT NULL DEFAULT FALSE,
  used_by      UUID        REFERENCES auth.users(id),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invites"
  ON public.invites FOR ALL
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));
-- Allow unauthenticated lookup of a token during registration
CREATE POLICY "Anyone can read invite by token"
  ON public.invites FOR SELECT USING (TRUE);

-- ── Books of the Bible ────────────────────────────────────────
CREATE TABLE public.books (
  id        SERIAL PRIMARY KEY,
  name      TEXT   NOT NULL UNIQUE,
  testament TEXT   NOT NULL CHECK (testament IN ('OT','NT')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── Verses ────────────────────────────────────────────────────
CREATE TABLE public.verses (
  id          SERIAL PRIMARY KEY,
  book_id     INTEGER     NOT NULL REFERENCES public.books(id),
  chapter     INTEGER     NOT NULL,
  verse       INTEGER     NOT NULL,
  version     TEXT        NOT NULL CHECK (version IN ('NKJV','KJV')),
  text        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, chapter, verse, version)
);
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read verses"
  ON public.verses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage verses"
  ON public.verses FOR ALL
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- ── Verse Sets ────────────────────────────────────────────────
CREATE TABLE public.verse_sets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  created_by  UUID        REFERENCES public.profiles(id),
  is_public   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.verse_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read public sets"
  ON public.verse_sets FOR SELECT TO authenticated USING (is_public = TRUE OR created_by = auth.uid());
CREATE POLICY "Admins can manage all sets"
  ON public.verse_sets FOR ALL
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- ── Verse Set Items ───────────────────────────────────────────
CREATE TABLE public.verse_set_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      UUID    NOT NULL REFERENCES public.verse_sets(id) ON DELETE CASCADE,
  verse_id    INTEGER NOT NULL REFERENCES public.verses(id),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (set_id, verse_id)
);
ALTER TABLE public.verse_set_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read set items"
  ON public.verse_set_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage set items"
  ON public.verse_set_items FOR ALL
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- ── User Verse Queue ──────────────────────────────────────────
-- status: 'active' | 'mastered' | 'review_due'
CREATE TABLE public.user_verses (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  verse_id             INTEGER     NOT NULL REFERENCES public.verses(id),
  status               TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','mastered','review_due')),
  clean_run_count      INTEGER     NOT NULL DEFAULT 0,
  next_review_date     DATE,
  review_interval_days INTEGER     NOT NULL DEFAULT 3,
  added_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mastered_at          TIMESTAMPTZ,
  UNIQUE (user_id, verse_id)
);
ALTER TABLE public.user_verses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own verse queue"
  ON public.user_verses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all user verses"
  ON public.user_verses FOR SELECT
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- ── Practice Attempts ─────────────────────────────────────────
CREATE TABLE public.attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  verse_id      INTEGER     NOT NULL REFERENCES public.verses(id),
  is_clean      BOOLEAN     NOT NULL,   -- TRUE = zero errors AND zero hints
  hints_used    INTEGER     NOT NULL DEFAULT 0,
  error_count   INTEGER     NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own attempts"
  ON public.attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts"
  ON public.attempts FOR SELECT
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- ── Trigger: auto-create profile on signup ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, bible_version)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'bible_version', 'NKJV')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Seed: Books of the Bible ──────────────────────────────────
INSERT INTO public.books (name, testament, sort_order) VALUES
  ('Genesis','OT',1),('Exodus','OT',2),('Leviticus','OT',3),('Numbers','OT',4),
  ('Deuteronomy','OT',5),('Joshua','OT',6),('Judges','OT',7),('Ruth','OT',8),
  ('1 Samuel','OT',9),('2 Samuel','OT',10),('1 Kings','OT',11),('2 Kings','OT',12),
  ('1 Chronicles','OT',13),('2 Chronicles','OT',14),('Ezra','OT',15),('Nehemiah','OT',16),
  ('Esther','OT',17),('Job','OT',18),('Psalms','OT',19),('Proverbs','OT',20),
  ('Ecclesiastes','OT',21),('Song of Solomon','OT',22),('Isaiah','OT',23),('Jeremiah','OT',24),
  ('Lamentations','OT',25),('Ezekiel','OT',26),('Daniel','OT',27),('Hosea','OT',28),
  ('Joel','OT',29),('Amos','OT',30),('Obadiah','OT',31),('Jonah','OT',32),
  ('Micah','OT',33),('Nahum','OT',34),('Habakkuk','OT',35),('Zephaniah','OT',36),
  ('Haggai','OT',37),('Zechariah','OT',38),('Malachi','OT',39),
  ('Matthew','NT',40),('Mark','NT',41),('Luke','NT',42),('John','NT',43),
  ('Acts','NT',44),('Romans','NT',45),('1 Corinthians','NT',46),('2 Corinthians','NT',47),
  ('Galatians','NT',48),('Ephesians','NT',49),('Philippians','NT',50),('Colossians','NT',51),
  ('1 Thessalonians','NT',52),('2 Thessalonians','NT',53),('1 Timothy','NT',54),('2 Timothy','NT',55),
  ('Titus','NT',56),('Philemon','NT',57),('Hebrews','NT',58),('James','NT',59),
  ('1 Peter','NT',60),('2 Peter','NT',61),('1 John','NT',62),('2 John','NT',63),
  ('3 John','NT',64),('Jude','NT',65),('Revelation','NT',66)
ON CONFLICT (name) DO NOTHING;
