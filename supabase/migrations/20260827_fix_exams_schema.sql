-- ============================================================
-- أَثَر — Migration: Fix exams schema & academic profile
-- ============================================================

-- 1. Exams Table
ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS exam_type text DEFAULT 'school' 
    CHECK (exam_type IN ('school','center','final','mock')),
  ADD COLUMN IF NOT EXISTS total_score integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS score numeric;

COMMENT ON COLUMN public.exams.exam_type IS 'نوع الامتحان: school=مدرسة، center=سنتر، final=نهاية العام، mock=تجريبي';
COMMENT ON COLUMN public.exams.total_score IS 'الدرجة الكلية للامتحان';
COMMENT ON COLUMN public.exams.score IS 'الدرجة التي حصل عليها الطالب';

-- 2. Profiles Table (Stage, Track, Phone)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stage text CHECK (stage IN ('first_secondary', 'second_secondary', 'third_secondary')),
  ADD COLUMN IF NOT EXISTS track text CHECK (track IN ('literary', 'scientific_math', 'scientific_science')),
  ADD COLUMN IF NOT EXISTS phone text;

-- 3. Multi Gemini Keys Table (1.8)
CREATE TABLE IF NOT EXISTS public.gemini_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  api_key text NOT NULL,
  label text DEFAULT 'توكن احتياطي',
  priority integer DEFAULT 1,
  is_exhausted boolean DEFAULT false,
  exhausted_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gemini_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own gemini keys" 
  ON public.gemini_api_keys
  FOR ALL 
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
