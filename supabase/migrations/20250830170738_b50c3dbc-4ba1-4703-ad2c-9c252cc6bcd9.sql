-- Disable RLS temporarily to avoid conflicts and recreate policies
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create simple policies that work with custom auth system
CREATE POLICY "Allow all conversation operations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all participant operations" ON conversation_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all message operations" ON messages FOR ALL USING (true) WITH CHECK (true);