-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can create their own stories" ON public.stories;

-- Create new policy that allows story creation 
CREATE POLICY "Enable story creation for all users" ON public.stories
  FOR INSERT WITH CHECK (true);

-- Ensure stories table has proper RLS enabled
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;