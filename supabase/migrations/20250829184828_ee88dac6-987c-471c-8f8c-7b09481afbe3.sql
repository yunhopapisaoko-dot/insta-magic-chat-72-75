-- Create stories table
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  background_color TEXT,
  text_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Enable Row Level Security
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Create policies for stories
CREATE POLICY "Users can view stories from people they follow and their own" 
ON public.stories 
FOR SELECT 
USING (
  expires_at > now() AND (
    user_id = auth.uid() OR 
    user_id IN (
      SELECT following_id 
      FROM follows 
      WHERE follower_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create their own stories" 
ON public.stories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND expires_at > now());

CREATE POLICY "Users can delete their own stories" 
ON public.stories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage bucket for stories media
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true);

-- Create storage policies for stories
CREATE POLICY "Stories media are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'stories');

CREATE POLICY "Users can upload their own stories media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own stories media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create function to cleanup expired stories
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.stories 
  WHERE expires_at < now();
END;
$$;

-- Create index for better performance
CREATE INDEX idx_stories_expires_at ON public.stories (expires_at);
CREATE INDEX idx_stories_user_id ON public.stories (user_id);