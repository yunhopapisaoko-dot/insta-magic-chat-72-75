-- Create post_tags table for tagging users in posts
CREATE TABLE public.post_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tagged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create story_tags table for tagging users in stories
CREATE TABLE public.story_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tagged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Enable RLS
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for post_tags
CREATE POLICY "Anyone can view post tags" 
ON public.post_tags 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create post tags when they own the post" 
ON public.post_tags 
FOR INSERT 
WITH CHECK (
  tagged_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.posts 
    WHERE id = post_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own post tags" 
ON public.post_tags 
FOR DELETE 
USING (tagged_by = auth.uid());

-- RLS policies for story_tags
CREATE POLICY "Anyone can view story tags" 
ON public.story_tags 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create story tags when they own the story" 
ON public.story_tags 
FOR INSERT 
WITH CHECK (
  tagged_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.stories 
    WHERE id = story_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own story tags" 
ON public.story_tags 
FOR DELETE 
USING (tagged_by = auth.uid());