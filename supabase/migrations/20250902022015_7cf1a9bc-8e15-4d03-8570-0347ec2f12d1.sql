-- Remove duplicate notifications by keeping only the oldest one for each combination of user_id, actor_id, entity_id, and type
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, actor_id, entity_id, type 
      ORDER BY created_at ASC
    ) as row_num
  FROM notifications
  WHERE type IN ('like', 'comment_like')
)
DELETE FROM notifications 
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE row_num > 1
);