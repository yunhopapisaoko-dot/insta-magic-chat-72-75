-- Fix RLS policies to allow profile operations without Supabase Auth

-- Update profiles policies to allow all operations since we're using custom auth
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create permissive policies for profiles (since we have custom auth system)
CREATE POLICY "Allow all profile operations" 
ON public.profiles 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Update follows policies  
DROP POLICY IF EXISTS "Users can create their own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can delete their own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;

-- Create permissive policies for follows
CREATE POLICY "Allow all follow operations" 
ON public.follows 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Update post_likes policies
DROP POLICY IF EXISTS "Users can create their own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can view all likes" ON public.post_likes;

-- Create permissive policies for post_likes
CREATE POLICY "Allow all like operations" 
ON public.post_likes 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Update posts policies
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can view all posts" ON public.posts;

-- Create permissive policies for posts
CREATE POLICY "Allow all post operations" 
ON public.posts 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create storage policies for avatars bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Create permissive storage policies for avatars
CREATE POLICY "Allow all avatar operations" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'avatars') 
WITH CHECK (bucket_id = 'avatars');

-- Create storage policies for posts bucket  
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT (id) DO NOTHING;

-- Create permissive storage policies for posts
CREATE POLICY "Allow all post file operations" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'posts') 
WITH CHECK (bucket_id = 'posts');