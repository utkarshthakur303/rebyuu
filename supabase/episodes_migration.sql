CREATE TABLE IF NOT EXISTS episode_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id TEXT NOT NULL REFERENCES anime_index(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL CHECK (episode_number >= 1),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, anime_id, episode_number)
);

CREATE TABLE IF NOT EXISTS episode_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id TEXT NOT NULL REFERENCES anime_index(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL CHECK (episode_number >= 1),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_episode_ratings_anime_episode ON episode_ratings(anime_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_episode_ratings_user_id ON episode_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_comments_anime_episode ON episode_comments(anime_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_episode_comments_user_id ON episode_comments(user_id);

ALTER TABLE episode_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own episode ratings" ON episode_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own episode ratings" ON episode_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own episode ratings" ON episode_ratings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public read episode ratings" ON episode_ratings FOR SELECT USING (true);

CREATE POLICY "Users can insert own episode comments" ON episode_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own episode comments" ON episode_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own episode comments" ON episode_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public read episode comments" ON episode_comments FOR SELECT USING (true);

CREATE TRIGGER update_episode_ratings_updated_at BEFORE UPDATE ON episode_ratings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_episode_comments_updated_at BEFORE UPDATE ON episode_comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
