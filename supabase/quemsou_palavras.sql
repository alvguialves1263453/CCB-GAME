-- Tabela para o jogo "Quem Sou Eu?" (mímica local, pass-and-play)
-- COMO RODAR: dashboard do Supabase → SQL Editor → New query → cola tudo → Run.
-- Pode rodar de novo sem duplicar (limpa antes de inserir).
CREATE TABLE IF NOT EXISTS quemsou_palavras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL,
  categoria text NOT NULL DEFAULT 'Diversão',
  dificuldade text NOT NULL DEFAULT 'facil',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

DELETE FROM quemsou_palavras;

-- Só os famosos (todo mundo conhece, mímica rende)
INSERT INTO quemsou_palavras (texto, categoria, dificuldade) VALUES
  ('Jesus', 'Personagens', 'facil'),
  ('Moisés', 'Personagens', 'facil'),
  ('Davi', 'Personagens', 'facil'),
  ('Golias', 'Personagens', 'facil'),
  ('Noé', 'Personagens', 'facil'),
  ('Adão', 'Personagens', 'facil'),
  ('Eva', 'Personagens', 'facil'),
  ('Maria', 'Personagens', 'facil'),
  ('Pedro', 'Personagens', 'facil'),
  ('Paulo', 'Personagens', 'medio'),
  ('João Batista', 'Personagens', 'medio'),
  ('Sansão', 'Personagens', 'medio'),
  ('Ester', 'Personagens', 'medio'),
  ('Daniel', 'Personagens', 'medio'),
  ('José do Egito', 'Personagens', 'medio'),
  ('Abraão', 'Personagens', 'medio'),
  ('Faraó', 'Personagens', 'facil'),
  ('Judas', 'Personagens', 'medio'),
  ('Lázaro', 'Personagens', 'medio'),
  ('Zaqueu', 'Personagens', 'medio');

-- Verbos e ações (os melhores pra mímica)
INSERT INTO quemsou_palavras (texto, categoria, dificuldade) VALUES
  ('Oração', 'Ações', 'facil'),
  ('Batismo', 'Ações', 'facil'),
  ('Louvor', 'Ações', 'facil'),
  ('Dança', 'Ações', 'facil'),
  ('Corrida', 'Ações', 'facil'),
  ('Natação', 'Ações', 'facil'),
  ('Pular corda', 'Ações', 'facil'),
  ('Dormir', 'Ações', 'facil'),
  ('Chorar', 'Ações', 'facil'),
  ('Rir', 'Ações', 'facil'),
  ('Cantar', 'Ações', 'facil'),
  ('Dirigir', 'Ações', 'facil'),
  ('Cozinhar', 'Ações', 'facil'),
  ('Pescar', 'Ações', 'facil'),
  ('Jogar futebol', 'Ações', 'facil'),
  ('Escovar os dentes', 'Ações', 'facil'),
  ('Tirar selfie', 'Ações', 'facil'),
  ('Falar no celular', 'Ações', 'facil'),
  ('Abraçar', 'Ações', 'facil'),
  ('Cair', 'Ações', 'facil'),
  ('Levantar peso', 'Ações', 'medio'),
  ('Surfar', 'Ações', 'medio'),
  ('Andar de bicicleta', 'Ações', 'facil'),
  ('Boxe', 'Ações', 'medio'),
  ('Mágica', 'Ações', 'medio');

-- Instrumentos (dá pra "tocar" na mímica)
INSERT INTO quemsou_palavras (texto, categoria, dificuldade) VALUES
  ('Violão', 'Instrumentos', 'facil'),
  ('Bateria', 'Instrumentos', 'facil'),
  ('Piano', 'Instrumentos', 'facil'),
  ('Flauta', 'Instrumentos', 'facil'),
  ('Trombeta', 'Instrumentos', 'facil'),
  ('Saxofone', 'Instrumentos', 'medio'),
  ('Violino', 'Instrumentos', 'facil'),
  ('Guitarra', 'Instrumentos', 'facil'),
  ('Pandeiro', 'Instrumentos', 'facil'),
  ('Órgão', 'Instrumentos', 'facil'),
  ('Tuba', 'Instrumentos', 'medio'),
  ('Harpa', 'Instrumentos', 'medio'),
  ('Sanfona', 'Instrumentos', 'medio'),
  ('Tambor', 'Instrumentos', 'facil');

-- Objetos
INSERT INTO quemsou_palavras (texto, categoria, dificuldade) VALUES
  ('Cruz', 'Objetos', 'facil'),
  ('Arca de Noé', 'Objetos', 'facil'),
  ('Celular', 'Objetos', 'facil'),
  ('Óculos', 'Objetos', 'facil'),
  ('Guarda-chuva', 'Objetos', 'facil'),
  ('Tesoura', 'Objetos', 'facil'),
  ('Martelo', 'Objetos', 'facil'),
  ('Bola', 'Objetos', 'facil'),
  ('Bicicleta', 'Objetos', 'facil'),
  ('Avião', 'Objetos', 'facil'),
  ('Barco', 'Objetos', 'facil'),
  ('Chapéu', 'Objetos', 'facil'),
  ('Relógio', 'Objetos', 'facil'),
  ('Chave', 'Objetos', 'facil'),
  ('Espelho', 'Objetos', 'facil'),
  ('Televisão', 'Objetos', 'facil'),
  ('Microfone', 'Objetos', 'facil'),
  ('Presente', 'Objetos', 'facil'),
  ('Bolo de aniversário', 'Objetos', 'facil'),
  ('Câmera', 'Objetos', 'medio');

-- Animais
INSERT INTO quemsou_palavras (texto, categoria, dificuldade) VALUES
  ('Leão', 'Animais', 'facil'),
  ('Macaco', 'Animais', 'facil'),
  ('Elefante', 'Animais', 'facil'),
  ('Cachorro', 'Animais', 'facil'),
  ('Gato', 'Animais', 'facil'),
  ('Galinha', 'Animais', 'facil'),
  ('Cobra', 'Animais', 'facil'),
  ('Sapo', 'Animais', 'facil'),
  ('Pinguim', 'Animais', 'facil'),
  ('Cavalo', 'Animais', 'facil'),
  ('Borboleta', 'Animais', 'medio'),
  ('Aranha', 'Animais', 'facil'),
  ('Tubarão', 'Animais', 'facil'),
  ('Dinossauro', 'Animais', 'facil');

-- Aleatórios pra render risada
INSERT INTO quemsou_palavras (texto, categoria, dificuldade) VALUES
  ('Palhaço', 'Diversão', 'facil'),
  ('Pirata', 'Diversão', 'facil'),
  ('Robô', 'Diversão', 'facil'),
  ('Anjo', 'Diversão', 'facil'),
  ('Bebê', 'Diversão', 'facil'),
  ('Dentista', 'Diversão', 'medio'),
  ('Professor', 'Diversão', 'facil'),
  ('Super-herói', 'Diversão', 'facil'),
  ('Casamento', 'Diversão', 'medio'),
  ('Aniversário', 'Diversão', 'facil'),
  ('Churrasco', 'Diversão', 'facil'),
  ('Praia', 'Diversão', 'facil'),
  ('Cinema', 'Diversão', 'facil'),
  ('Vovó', 'Diversão', 'facil'),
  ('Mágico', 'Diversão', 'medio'),
  ('Circo', 'Diversão', 'facil');

-- Desabilitar RLS para acesso livre, seguindo o padrão das outras tabelas
ALTER TABLE quemsou_palavras DISABLE ROW LEVEL SECURITY;
