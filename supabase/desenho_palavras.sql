-- Tabela para o jogo "Desenhe a Palavra"
CREATE TABLE IF NOT EXISTS desenho_palavras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  category text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Inserindo palavras iniciais
INSERT INTO desenho_palavras (word, category) VALUES
  ('Bíblia', 'Igreja'),
  ('Fé', 'Bíblia'),
  ('Graça', 'Bíblia'),
  ('Profeta', 'Bíblia'),
  ('Moisés', 'Personagens'),
  ('Davi', 'Personagens'),
  ('Golias', 'Personagens'),
  ('Jesus', 'Personagens'),
  ('Pedro', 'Personagens'),
  ('Paulo', 'Personagens'),
  ('Maria', 'Personagens'),
  ('Arca', 'Bíblia'),
  ('Dilúvio', 'Bíblia'),
  ('Oração', 'Igreja'),
  ('Culto', 'Igreja'),
  ('Hino', 'Igreja'),
  ('Véu', 'Igreja'),
  ('Órgão', 'Igreja'),
  ('Violino', 'Igreja'),
  ('Tuba', 'Igreja'),
  ('Batismo', 'Igreja'),
  ('Anjo', 'Bíblia'),
  ('Cruz', 'Bíblia'),
  ('Céu', 'Bíblia'),
  ('Coroa', 'Bíblia'),
  ('Cordeiro', 'Bíblia'),
  ('Leão', 'Bíblia');

-- Desabilitar RLS para acesso livre, seguindo o padrão das outras tabelas
ALTER TABLE desenho_palavras DISABLE ROW LEVEL SECURITY;
