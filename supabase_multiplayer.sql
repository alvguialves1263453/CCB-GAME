-- Rode isso no SQL Editor do seu Supabase para criar as tabelas do Multiplayer

-- 1. Criar a tabela de salas (rooms)
CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  host_id text NOT NULL,
  phase text DEFAULT 'lobby', -- 'lobby', 'preparing', 'answering', 'result', 'ranking'
  current_round integer DEFAULT 0,
  round_count integer DEFAULT 5,
  difficulty text DEFAULT 'facil',
  deadline_at bigint, -- Unix timestamp in ms
  questions jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Criar a tabela de jogadores (players)
CREATE TABLE IF NOT EXISTS players (
  id text PRIMARY KEY,
  room_id text REFERENCES rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  avatar text,
  is_host boolean DEFAULT false,
  is_ready boolean DEFAULT false,
  score integer DEFAULT 0,
  has_answered boolean DEFAULT false,
  round integer DEFAULT 0,
  joined_at bigint,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Habilitar o Realtime (Importante para o postgres_changes funcionar)
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;

-- (Opcional) Desabilitar RLS se você quiser acesso livre no teste, ou criar políticas
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
