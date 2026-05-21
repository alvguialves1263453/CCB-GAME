-- Word Bomb Game Tables
-- Each table has its own RLS policy configured correctly

-- Table: wb_rooms
CREATE TABLE IF NOT EXISTS wb_rooms (
  id text PRIMARY KEY,
  host_id text NOT NULL,
  phase text DEFAULT 'lobby' CHECK (phase IN ('lobby','playing','finished')),
  lives integer DEFAULT 2 CHECK (lives IN (1,2,3)),
  turn_duration double precision DEFAULT 15,
  current_turn_index integer DEFAULT 0,
  current_letter text,
  current_word text,
  turn_started_at bigint,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Table: wb_players
CREATE TABLE IF NOT EXISTS wb_players (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES wb_rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  avatar text,
  is_host boolean DEFAULT false,
  lives integer DEFAULT 2,
  is_alive boolean DEFAULT true,
  score integer DEFAULT 0,
  turn_order integer DEFAULT 0,
  joined_at bigint,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Table: wb_used_words
CREATE TABLE IF NOT EXISTS wb_used_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES wb_rooms(id) ON DELETE CASCADE,
  word text NOT NULL,
  player_id text NOT NULL,
  round integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wb_players_room ON wb_players(room_id);
CREATE INDEX IF NOT EXISTS idx_wb_used_words_room ON wb_used_words(room_id);

-- Enable Realtime for these tables
alter publication supabase_realtime add table wb_rooms;
alter publication supabase_realtime add table wb_players;
alter publication supabase_realtime add table wb_used_words;

-- RLS Policies
-- Since the app uses the anon key, we enable RLS and create policies
-- that allow full access for authenticated and anonymous users alike.
-- In production, you'd want more restrictive policies.

ALTER TABLE wb_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_used_words ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read rooms (needed for discovery)
CREATE POLICY "Allow public read on wb_rooms"
  ON wb_rooms FOR SELECT
  USING (true);

-- Allow anyone to insert rooms
CREATE POLICY "Allow public insert on wb_rooms"
  ON wb_rooms FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update rooms (host drives game state)
CREATE POLICY "Allow public update on wb_rooms"
  ON wb_rooms FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow anyone to delete rooms (host cleanup)
CREATE POLICY "Allow public delete on wb_rooms"
  ON wb_rooms FOR DELETE
  USING (true);

-- Allow anyone to read players in a room
CREATE POLICY "Allow public read on wb_players"
  ON wb_players FOR SELECT
  USING (true);

-- Allow anyone to insert players (joining)
CREATE POLICY "Allow public insert on wb_players"
  ON wb_players FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update players (score, lives, ready state)
CREATE POLICY "Allow public update on wb_players"
  ON wb_players FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow anyone to delete players (leaving)
CREATE POLICY "Allow public delete on wb_players"
  ON wb_players FOR DELETE
  USING (true);

-- Allow anyone to read used words
CREATE POLICY "Allow public read on wb_used_words"
  ON wb_used_words FOR SELECT
  USING (true);

-- Allow anyone to insert used words
CREATE POLICY "Allow public insert on wb_used_words"
  ON wb_used_words FOR INSERT
  WITH CHECK (true);

-- Allow anyone to delete used words
CREATE POLICY "Allow public delete on wb_used_words"
  ON wb_used_words FOR DELETE
  USING (true);
