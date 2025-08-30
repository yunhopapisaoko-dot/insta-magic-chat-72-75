-- Add foreign key relationship between stories and profiles
ALTER TABLE public.stories 
ADD CONSTRAINT stories_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;