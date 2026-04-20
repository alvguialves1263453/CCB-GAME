-- =====================================================
-- Tabelas para o Quiz da Bíblia (modo separado)
-- =====================================================

-- =====================================================
-- Tabela de perguntas da Bíblia
-- =====================================================
CREATE TABLE IF NOT EXISTS biblia_perguntas (
  id SERIAL PRIMARY KEY,
  pergunta TEXT NOT NULL,
  correta TEXT NOT NULL,
  opcao1 TEXT NOT NULL,
  opcao2 TEXT NOT NULL,
  opcao3 TEXT NOT NULL,
  dificuldade TEXT DEFAULT 'facil' CHECK (dificuldade IN ('facil', 'medio', 'dificil')),
  categoria TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir perguntas da Bíblia (100+ questões)
INSERT INTO biblia_perguntas (pergunta, correta, opcao1, opcao2, opcao3, dificuldade, categoria) VALUES
-- Facis - Nome de Deus
  ('Quem é o Deus todo-poderoso da Bíblia?', 'Deus', 'Deus', 'Jesus', 'Moisés', 'facil', 'deus'),
  ('Qual é o nome do filho de Deus?', 'Jesus Cristo', 'Jesus Cristo', 'Moisés', 'Pedro', 'facil', 'jesus'),
  ('Como se chama o Espírito Santo?', 'Espírito Santo', 'Espírito Santo', 'Anjo', 'Pai', 'facil', 'espirito'),
  ('Quem é o Pai de todos nós?', 'Deus', 'Deus', 'Jesus', 'Moisés', 'facil', 'deus'),
  ('Qual é o primeiro mandamento?', 'Amar a Deus sobre todas as cosas', 'Amar a Deus sobre todas as coisas', 'Não roubar', 'Não mentir', 'facil', 'mandamentos'),
-- Facis - Historia
  ('Quem建造了 Arca?', 'Noé', 'Noé', 'Moisés', 'Abraão', 'facil', 'historia'),
  ('Quem foi o primeiro homem?', 'Adão', 'Adão', 'Abel', 'Noé', 'facil', 'historia'),
  ('Quem foi a primeira mulher?', 'Eva', 'Eva', 'Maria', 'Sara', 'facil', 'historia'),
  ('Quantos dias Deus levou para criar o mundo?', '6 dias', '6 dias', '7 dias', '5 dias', 'facil', 'criacao'),
  ('O que Deus criou no primero dia?', 'Luz', 'Luz', 'Mar', 'Terra', 'facil', 'criacao'),
-- Facis - Livros
  ('Qual é o primeiro livro da Biblia?', 'Genesis', 'Genesis', 'Exodo', 'Mateus', 'facil', 'livros'),
  ('Qual é o último livro da Biblia?', 'Apocalipse', 'Apocalipse', 'Marcos', 'Lucas', 'facil', 'livros'),
  ('Quantos livros tem o Antigo Testamento?', '39', '39', '27', '66', 'facil', 'livros'),
  ('Quantos livros tem o Novo Testamento?', '27', '27', '39', '66', 'facil', 'livros'),
  ('Qual é o maior livro da Biblia?', 'Salmos', 'Salmos', 'Isaías', 'Gênesis', 'facil', 'livros'),
-- Medio - Historia
  ('Quem foi criado por Deus para liderar os israelitas?', 'Moisés', 'Moisés', 'Josué', 'Aarão', 'medio', 'historia'),
  ('Qual mar o povo de Israel atravessou?', 'Mar Vermelho', 'Mar Vermelho', 'Mar Morto', 'Mediterrâneo', 'medio', 'historia'),
  ('Quem defeated o gigante Golias?', 'Davi', 'Davi', 'Saul', ' Salomão', 'medio', 'historia'),
  ('Quem foi o primeiro rei de Israel?', 'Saul', 'Saul', 'Davi', 'Salomão', 'medio', 'historia'),
  ('Qual era o nome da esposa de Abraão?', 'Sara', 'Sara', 'Rebeca', 'Raquel', 'medio', 'personagens'),
-- Medio - Jesus
  ('Em que cidade Jesus nasceu?', 'Belém', 'Belém', 'Nazaré', 'Jerusalém', 'medio', 'jesus'),
  ('Quantos anos Jesus pregou?', '3 anos', '3 anos', '1 ano', '5 anos', 'medio', 'jesus'),
  ('Quem batizou Jesus?', 'João Batista', 'João Batista', 'Pedro', 'Paulo', 'medio', 'jesus'),
  ('Quantos discí pulos Jesus tinha?', '12', '12', '10', '7', 'medio', 'jesus'),
  ('Em que montanha Jesus pregou o Sermão?', 'Monte das Bem-aventuranças', 'Monte das Bem-aventuranças', 'Monte Sinai', 'Monte Olivares', 'medio', 'jesus'),
-- Medio - Mandamentos
  ('Quantos são os 10 mandamentos?', '10', '10', '12', '7', 'medio', 'mandamentos'),
  ('Qual o segundo mandamento?', 'Não fazer imagens', 'Não fazer imagens', 'Honrar pai e mãe', 'Não matar', 'medio', 'mandamentos'),
  ('Qual dia é guardado como dia de descanso?', 'Sábado', 'Sábado', 'Domingo', 'Segunda', 'medio', 'mandamentos'),
  ('O que é proibido no nono mandamento?', 'Não jurar', 'Não jurar', 'Não roubar', 'Não matar', 'medio', 'mandamentos'),
  ('Qual mandamento fala sobre honrar os pais?', '4°', '4°', '5°', '3°', 'medio', 'mandamentos'),
-- Dificil - Profecia
  ('Qual livro fala mais sobre o fim dos tempos?', 'Apocalipse', 'Apocalipse', 'Daniel', 'Isaías', 'dificil', 'profecia'),
  ('Quem escreveu o Apocalipse?', 'João', 'João', 'Paulo', 'Pedro', 'dificil', 'profecia'),
  ('Quantas pragas haverá na tribulação?', '7', '7', '10', '12', 'dificil', 'profecia'),
  ('O que é o Anticristo?', 'O opponent de Deus', 'O oponente de Deus', 'Um falso profeta', 'O diabo', 'dificil', 'profecia'),
  ('Quanto tempo durará a tribulação?', '7 anos', '7 anos', '3 anos', '5 anos', 'dificil', 'profecia'),
-- Dificil - Tipos e Símbolos
  ('Quem é o tipo de Jesus no Antigo Testamento?', 'José', 'José', 'Moisés', 'Davi', 'dificil', 'tipos'),
  ('Qual animal simboliza Jesus?', 'Cordeiro', 'Cordeiro', 'Leão', 'Águia', 'dificil', 'simbolos'),
  ('O que a maná simboliza?', 'Palavra de Deus', 'Palavra de Deus', 'Jesus', 'Esperança', 'dificil', 'simbolos'),
  (' Quem é o Sumo Sacerdote no céu?', 'Jesus', 'Jesus', 'Paulo', 'Pedro', 'dificil', 'tipos'),
  ('Qual é o Noivo na parábola?', 'Jesus', 'Jesus', 'Deus', 'A Igreja', 'dificil', 'parabolas'),
-- Familia
  ('Qual é o patriarca da fé cristã?', 'Abraão', 'Abraão', 'Isaque', 'Jacó', 'medio', 'personagens'),
  ('Quem foi pai de Isaque?', 'Abraão', 'Abraão', 'Midian', 'Arão', 'facil', 'personagens'),
  ('Quantos filhos Jacó teve?', '12', '12', '10', '14', 'medio', 'personagens'),
  ('Quem era irmão de José?', 'Benjamin', 'Benjamin', 'Ruben', 'Judá', 'dificil', 'personagens'),
  ('Quem livreu o povo do Egito?', 'Moisés', 'Moisés', 'Aarão', 'Josué', 'facil', 'personagens');

-- =====================================================
-- Tabela de salas da Biblia
-- =====================================================
CREATE TABLE IF NOT EXISTS biblia_rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  phase TEXT DEFAULT 'lobby' CHECK (phase IN ('lobby', 'preparing', 'answering', 'result', 'ranking')),
  current_round INTEGER DEFAULT 0,
  round_count INTEGER DEFAULT 5,
  difficulty TEXT DEFAULT 'facil',
  current_pergunta TEXT,
  deadline_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Tabela de jogadores da Biblia
-- =====================================================
CREATE TABLE IF NOT EXISTS biblia_players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar TEXT,
  is_host BOOLEAN DEFAULT false,
  is_ready BOOLEAN DEFAULT false,
  score INTEGER DEFAULT 0,
  has_answered BOOLEAN DEFAULT false,
  round INTEGER DEFAULT 0,
  joined_at BIGINT DEFAULT floor(EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- =====================================================
-- Habilitar realtime
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE biblia_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE biblia_players;

-- =====================================================
-- Criar índices para performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_biblia_players_room ON biblia_players(room_id);
CREATE INDEX IF NOT EXISTS idx_biblia_perguntas_dificuldade ON biblia_perguntas(dificuldade);
CREATE INDEX IF NOT EXISTS idx_biblia_perguntas_categoria ON biblia_perguntas(categoria);

-- =====================================================
-- Função para buscar perguntas aleatórias
-- =====================================================
CREATE OR REPLACE FUNCTION get_biblia_perguntas(p_dificuldade TEXT, p_count INTEGER)
RETURNS TABLE(id INTEGER, pergunta TEXT, correta TEXT, opcao1 TEXT, opcao2 TEXT, opcao3 TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT pb.id, pb.pergunta, pb.correta, pb.opcao1, pb.opcao2, pb.opcao3
  FROM biblia_perguntas pb
  WHERE pb.dificuldade = p_dificuldade
  ORDER BY RANDOM()
  LIMIT p_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Função para buscar perguntas por categoria
-- =====================================================
CREATE OR REPLACE FUNCTION get_biblia_perguntas_by_cat(p_categoria TEXT, p_count INTEGER)
RETURNS TABLE(id INTEGER, pergunta TEXT, correta TEXT, opcao1 TEXT, opcao2 TEXT, opcao3 TEXT, dificuldade TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT pb.id, pb.pergunta, pb.correta, pb.opcao1, pb.opcao2, pb.opcao3, pb.dificuldade
  FROM biblia_perguntas pb
  WHERE pb.categoria = p_categoria
  ORDER BY RANDOM()
  LIMIT p_count;
END;
$$ LANGUAGE plpgsql;