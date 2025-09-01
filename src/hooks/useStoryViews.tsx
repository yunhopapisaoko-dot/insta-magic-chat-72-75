import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useStoryViews = (userId: string | null) => {
  const markStoryAsViewed = useCallback(async (storyId: string) => {
    if (!userId) return;

    console.log('🔍 Marking story as viewed:', storyId, 'by user:', userId);

    try {
      const { error } = await supabase
        .from('story_views')
        .upsert({ 
          story_id: storyId, 
          user_id: userId 
        }, { 
          onConflict: 'story_id,user_id' 
        });

      if (error) {
        console.error('❌ Error marking story as viewed:', error);
      } else {
        console.log('✅ Story marked as viewed successfully');
      }
    } catch (error) {
      console.error('❌ Error marking story as viewed:', error);
    }
  }, [userId]);

  const getViewedStories = useCallback(async (): Promise<Set<string>> => {
    if (!userId) return new Set();

    try {
      const { data, error } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', userId);

      if (error) throw error;
      
      return new Set(data?.map(view => view.story_id) || []);
    } catch (error) {
      console.error('Error fetching viewed stories:', error);
      return new Set();
    }
  }, [userId]);

  return {
    markStoryAsViewed,
    getViewedStories
  };
};