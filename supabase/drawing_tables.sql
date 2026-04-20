-- Tabelas para o modo Desenho Musical Multiplayer

-- Tabela de prompts (frases para desenhar)
CREATE TABLE IF NOT EXISTS drawing_prompts (
  id SERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  difficulty TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de salas de desenho (extends rooms com tipo de jogo)
CREATE TABLE IF NOT EXISTS drawing_rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  phase TEXT DEFAULT 'lobby' CHECK (phase IN ('lobby', 'drawing', 'voting', 'reveal', 'ranking')),
  current_round INTEGER DEFAULT 0,
  round_count INTEGER DEFAULT 3,
  current_prompt TEXT,
  current_drawing_index INTEGER DEFAULT 0,
  deadline_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de desenhos enviados
CREATE TABLE IF NOT EXISTS drawing_submissions (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES drawing_rooms(id),
  player_id TEXT NOT NULL,
  player_nickname TEXT,
  round INTEGER NOT NULL,
  drawing_data TEXT NOT NULL, -- JSON com dados do canvas
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de votos
CREATE TABLE IF NOT EXISTS drawing_votes (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES drawing_submissions(id),
  voter_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, voter_id)
);

-- Inserir alguns prompts iniciais
INSERT INTO drawing_prompts (prompt, category, difficulty) VALUES
  ('Uma igreja com sino', 'religion', 'easy'),
  ('Um hymnal aberto', 'music', 'easy'),
  ('Um piano', 'instrument', 'medium'),
  ('Um coral cantando', 'religion', 'medium'),
  ('Um ministro com terno', 'people', 'easy'),
  ('Uma cruz', 'religion', 'easy'),
  ('Um órgão', 'instrument', 'hard'),
  ('Notas musicais voando', 'music', 'easy'),
  ('Uma Bíblia aberta', 'religion', 'easy'),
  ('Um maestro regendo', 'music', 'hard'),
  ('Familia orando', 'religion', 'medium'),
  ('Uma harpa', 'instrument', 'hard'),
  ('Um tambor', 'instrument', 'easy'),
  ('Uma flauta', 'instrument', 'medium'),
  ('Um saxofone', 'instrument', 'hard');

-- Habilitar realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE drawing_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE drawing_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE drawing_votes;
