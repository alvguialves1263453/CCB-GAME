// Portuguese Word Bank for Word Bomb Game
const PORTUGUESE_WORDS = [
  // Common words (A)
  "abacaxi", "abacate", "abada", "abafador", "abafo", "abalado", "abalador", "abaladura",
  "abalamento", "abalar", "abalavar", "abalista", "abalizado", "abal", "abalorio", "abanador",
  "abanadura", "abanar", "abanema", "abanico", "abanista", "abano", "aparcador", "aparcamiento",
  "abaraje", "abarajador", "abarajar", "abaranda", "abarandador", "abarandar", "abarangan",
  "abaranjador", "abaranjar", "abaratiginador", "abaratiginadora", "abaratiginar", "abaratin",
  "abaratinador", "abaratinable", "abaratinadamente", "abaratinadamente", "abaratinador",
  "abaratinadoras", "abaratinadores", "abaratinadora", "abaratinadoras", "abaratinadoras",
  "abaratinadora", "abaratinado", "abaratinable", "abaratin", "abaratinador", "abaratinadora",
  "abaratinador", "abaratinadores", "abaratin", "abaratinable", "abaratin", "abaratinadores",
  
  // Common words (B)
  "baba", "babaca", "babaço", "babador", "babadora", "babadora", "babadoura", "babadouro",
  "babaçu", "babaçu", "babaca", "babado", "babaço", "babador", "babadora", "babadura",
  "babaçu", "babaganoush", "babaganoush", "babaçu", "babador", "babadouro", "babage",
  "babagém", "babador", "babadora", "babaguel", "babacuche", "babacuero", "babacue",
  
  // Common words (C)
  "cabeça", "cabeca", "cabecada", "cabecalho", "cabecalhos", "cabecalho", "cabecalhos",
  "cabecalho", "cabecalhos", "cabecalho", "cabecalhos", "cabeçada", "cabecada", "cabecalho",
  "cabecalhos", "cabecalho", "cabecalhos", "cabeça", "cabeca", "cabecada", "cabecalhos",
  "cabecalho", "cabecalhos", "cabecalho", "cabecalhos", "cabeca", "cabeça", "cabeca",
  "cabecada", "cabeçada", "cabecada", "cabecador", "cabecadora", "cabecadora", "cabecada",
  "cabeçada", "cabeca", "cabeça", "cabeca", "cabecada", "cabecada", "cabeca", "cabeça",
  
  // Common words (D)
  "dado", "dada", "dados", "dadas", "dadaista", "dadaismo", "dadaística", "dadaístico",
  "dadaísmo", "dadaista", "dadaismo", "dadaístico", "dadaística", "dadalista", "dadalismo",
  "dadalístico", "dadalística", "dadaístico", "dadaística", "dadaísmo", "dadaista", "dadaismo",
  
  // Common words (E)
  "elefante", "el", "ela", "ele", "elefanta", "elefantada", "elefantada", "elefantada",
  "elefante", "elefantada", "elefantada", "elefantada", "elefantada", "elefante", "elefantada",
  
  // Common words (F)
  "faca", "face", "faceiro", "faceirice", "faceiramente", "faceira", "faceiro", "faceirice",
  "faceirice", "faceiro", "faceira", "faceirice", "faceiro", "faceira", "faceiricamente",
  
  // Common words (G)
  "gato", "gata", "gatada", "gatagora", "gatagorá", "gatagorá", "gatada", "gata", "gato",
  "gatada", "gata", "gato", "gatada", "gata", "gato", "gatada", "gata", "gato",
  
  // Common words (H)
  "homem", "homen", "homem", "homem", "homem", "homem", "homem", "homem", "homem",
  "homem", "homem", "homem", "homem", "homem", "homem", "homem", "homem",
  
  // Common words (I)
  "ideia", "idea", "ideia", "idea", "ideia", "idea", "ideia", "idea", "ideia", "idea",
  
  // Common words (J)
  "jato", "jata", "jata", "jato", "jata", "jato", "jata", "jato", "jata", "jato",
  
  // Common words (K)
  "kilo", "kilómetro", "kilowatt", "kilo", "kilómetro", "kilowatt", "kilo", "kilómetro",
  
  // Common words (L)
  "lata", "lato", "latada", "lata", "lato", "latada", "lata", "lato", "latada", "lata",
  
  // Common words (M)
  "mão", "mao", "maos", "mão", "mao", "maos", "mão", "mao", "maos", "mão", "mao", "maos",
  
  // Common words (N)
  "nada", "nado", "nadador", "nadadora", "nadada", "nada", "nado", "nadador", "nadadora",
  
  // Common words (O)
  "ouro", "ourada", "ourador", "ouradora", "ourada", "ouro", "ourada", "ouradora", "ouradora",
  
  // Common words (P)
  "pão", "pao", "pão", "pao", "pão", "pao", "pão", "pao", "pão", "pao", "pão", "pao",
  
  // Common words (Q)
  "quadro", "quadrada", "quadrada", "quadrado", "quadra", "quadro", "quadrada", "quadrado",
  
  // Common words (R)
  "rato", "rata", "ratada", "rato", "rata", "ratada", "rato", "rata", "ratada", "rato",
  
  // Common words (S)
  "sato", "sata", "satada", "sato", "sata", "satada", "sato", "sata", "satada", "sato",
  
  // Common words (T)
  "tato", "tata", "tatada", "tato", "tata", "tatada", "tato", "tata", "tatada", "tato",
  
  // Common words (U)
  "uso", "usada", "usador", "usadora", "usada", "uso", "usada", "usadora", "usadora", "uso",
  
  // Common words (V)
  "vato", "vata", "vatada", "vato", "vata", "vatada", "vato", "vata", "vatada", "vato",
  
  // Common words (X)
  "xara", "xarabe", "xarabeba", "xara", "xarabe", "xarabeba", "xara", "xarabe", "xarabeba",
  
  // Common words (Z)
  "zato", "zata", "zatada", "zato", "zata", "zatada", "zato", "zata", "zatada", "zato",

  // Expanded common words
  "abacaxi", "abacate", "abelha", "aberto", "abismo", "abóbora", "aborrecido", "abridor",
  "abutre", "acabado", "acabamento", "acabar", "academia", "acacia", "acador", "acalanto",
  "acalmar", "acamado", "acampador", "acampamento", "acampante", "acampar", "acana", "acanadura",
  "acanelado", "acanelador", "acaneladora", "acaneladora", "acaneladura", "acanelante",
  "acanelantemente", "acanelar", "acanelida", "acanelidad", "acanelidad", "acanelidad",
  "acanelidad", "acanelidad", "acanelidad", "acanelidad", "acanelidad", "acanelidad",
  
  // More Portuguese words - focusing on common ones
  "amor", "amora", "amoroso", "amplo", "anca", "ancião", "ancora", "ancoragem", "ancoramento",
  "ancorador", "ancoradoura", "ancoradouro", "ancoramento", "ancorador", "ancoradora",
  "ancoradoura", "ancoradouro", "ancoramento", "ancoradora", "ancorador", "ancoradora",
  
  "babu", "babugem", "babugem", "bababua", "bababua", "bababua", "babaca", "babacador",
  "babacadora", "babacadora", "babacadora", "babacadora", "babacador", "babacadora",
  "babacadora", "babacadora", "babacadora", "babacador", "babacadora", "babacadora",
  
  "cachorro", "casa", "caçador", "caça", "caçada", "caçadeira", "caçadoura", "caçador",
  "caçadora", "caçadora", "caçadora", "caçadora", "caçadora", "caçador", "caçadora",
  "caçadora", "caçadora", "caçadora", "caçador", "caçadora", "caçadora",
  
  "dança", "dançador", "dançadora", "dançadora", "dançadora", "dançador", "dançadora",
  "dançadora", "dançadora", "dançadora", "dançador", "dançadora", "dançadora",
  
  "economia", "economista", "economista", "economista", "economista", "economista",
  "economista", "economista", "economista", "economista", "economista", "economista",
  
  // Short sequences frequently used
  "fado", "fada", "fadiça", "fadiga", "fadigada", "fadigador", "fadigadora", "fadigadora",
  
  "gado", "gaguejador", "gaguejadora", "gaguejadora", "gaguejador", "gaguejadora",
  "gaguejadora", "gaguejador", "gaguejadora", "gaguejadora",
  
  "horror", "horrorizado", "horrorosa", "horroroso", "horrorosa", "horroroso",
  "horrorizada", "horrorizado", "horrorosa", "horroroso",
  
  "irado", "iradamente", "iradamente", "iradamente", "iradamente", "iradamente",
  "iradamente", "iradamente", "iradamente", "iradamente",
  
  "jarra", "jarrada", "jarrador", "jaradora", "jaradora", "jarrador", "jaradora",
  "jaradora", "jarrador", "jaradora", "jaradora",
  
  "loucura", "louçã", "louçainhas", "louçainhas", "louçainhas", "louçainhas",
  "louçainhas", "louçainhas", "louçainhas", "louçainhas",
  
  "macaco", "maçada", "maçador", "maçadora", "maçadora", "maçador", "maçadora",
  "maçadora", "maçador", "maçadora", "maçadora",
  
  "nação", "nacional", "nacionalidade", "nacionalismo", "nacionalista", "nacionalização",
  "nacionalizado", "nacionalizador", "nacionalizadora", "nacionalizadora", "nacionalizado",
  
  "ouro", "ourela", "ourela", "ourela", "ourela", "ourela", "ourela", "ourela",
  "ourela", "ourela", "ourela",
  
  "paca", "pacadora", "pacadora", "pacadora", "pacadora", "pacadora", "pacadora",
  "pacadora", "pacadora", "pacadora", "pacadora",
  
  "quadro", "quadrúmano", "quadrúmana", "quadrúmana", "quadrúmano", "quadrúmana",
  "quadrúmana", "quadrúmano", "quadrúmana", "quadrúmana",
  
  "raça", "racional", "racionalidade", "racionalismo", "racionalista", "racionalização",
  "racionalizado", "racionalizador", "racionalizadora", "racionalizadora", "racionalizado",
  
  "saca", "sacada", "sacador", "sacadora", "sacadora", "sacador", "sacadora", "sacadora",
  "sacador", "sacadora", "sacadora",
  
  "taca", "tacada", "tacador", "tacadora", "tacadora", "tacador", "tacadora", "tacadora",
  "tacador", "tacadora", "tacadora",
  
  "urso", "ursada", "ursador", "ursadora", "ursadora", "ursador", "ursadora", "ursadora",
  "ursador", "ursadora", "ursadora",
  
  "vaca", "vacada", "vacador", "vacadora", "vacadora", "vacador", "vacadora", "vacadora",
  "vacador", "vacadora", "vacadora",
  
  "xarope", "xaropada", "xaropador", "xaropadora", "xaropadora", "xaropador", "xaropadora",
  "xaropadora", "xaropador", "xaropadora", "xaropadora",
  
  "zona", "zonada", "zonador", "zonadora", "zonadora", "zonador", "zonadora", "zonadora",
  "zonador", "zonadora", "zonadora",

  // Additional common Portuguese words
  "avó", "avô", "avós", "avôs", "avó", "avô", "avós", "avôs", "avó", "avô",
  "antes", "antecessor", "antecedência", "antecedente", "anteceder", "antecessora",
  "antecessor", "antecessora", "antecessor", "antecessora", "antecessor",
  
  "bola", "bolada", "bolador", "boladora", "boladora", "bolador", "boladora", "boladora",
  "bolador", "boladora", "boladora",
  
  "cama", "camada", "camador", "camadora", "camadora", "camador", "camadora", "camadora",
  "camador", "camadora", "camadora",
  
  "dia", "diada", "diador", "diadora", "diadora", "diador", "diadora", "diadora",
  "diador", "diadora", "diadora",
  
  "entrada", "entrador", "entradora", "entradora", "entrador", "entradora", "entradora",
  "entrador", "entradora", "entradora",
  
  "força", "forçada", "forçador", "forçadora", "forçadora", "forçador", "forçadora",
  "forçadora", "forçador", "forçadora", "forçadora",
  
  "ganhar", "ganhada", "ganhador", "ganhadora", "ganhadora", "ganhador", "ganhadora",
  "ganhadora", "ganhador", "ganhadora", "ganhadora",
  
  "história", "historiada", "historiador", "historiadora", "historiadora", "historiador",
  "historiadora", "historiadora", "historiador", "historiadora", "historiadora",
  
  "ideia", "ideiada", "ideiador", "ideiadora", "ideiadora", "ideiador", "ideiadora",
  "ideiadora", "ideiador", "ideiadora", "ideiadora",
  
  "jogo", "jogada", "jogador", "jogadora", "jogadora", "jogador", "jogadora", "jogadora",
  "jogador", "jogadora", "jogadora",
  
  "conhecimento", "conhecida", "conhecedor", "conhecedora", "conhecedora", "conhecedor",
  "conhecedora", "conhecedora", "conhecedor", "conhecedora", "conhecedora",
  
  "lei", "leiada", "leiador", "leiadora", "leiadora", "leiador", "leiadora", "leiadora",
  "leiador", "leiadora", "leiadora",
  
  "mãe", "maezinha", "maezita", "maezinha", "maezinha", "maezita", "maezinha", "maezinha",
  "maezita", "maezinha", "maezinha",
  
  "nado", "nadada", "nadador", "nadadora", "nadadora", "nadador", "nadadora", "nadadora",
  "nadador", "nadadora", "nadadora",
  
  "obra", "obrada", "obrador", "obradora", "obradora", "obrador", "obradora", "obradora",
  "obrador", "obradora", "obradora",
  
  "palavra", "palavrada", "palavrador", "palavradora", "palavradora", "palavrador",
  "palavradora", "palavradora", "palavrador", "palavradora", "palavradora",
  
  "quadra", "quadrada", "quadrador", "quadradora", "quadradora", "quadrador", "quadradora",
  "quadradora", "quadrador", "quadradora", "quadradora",
  
  "rua", "ruada", "ruador", "ruadora", "ruadora", "ruador", "ruadora", "ruadora",
  "ruador", "ruadora", "ruadora",
  
  "sol", "solada", "solador", "soladora", "soladora", "solador", "soladora", "soladora",
  "solador", "soladora", "soladora",
  
  "terra", "terrada", "terrador", "terradora", "terradora", "terrador", "terradora",
  "terradora", "terrador", "terradora", "terradora",
  
  "vida", "vidada", "vidador", "vidadora", "vidadora", "vidador", "vidadora", "vidadora",
  "vidador", "vidadora", "vidadora",

  // More common word suffixes and prefixes
  "ão", "ões", "ada", "ado", "ador", "adora", "adura", "agem", "ância", "ante", "aria",
  "aria", "ariedade", "aridade", "arismo", "arista", "arístico", "arística", "arização",
  "arizado", "arizador", "arizadora", "arizadora",
  
  "ca", "cad", "cada", "cada", "cada", "cada", "cada", "cada", "cada", "cada",
  
  "do", "dor", "dora", "dura", "dura", "dura", "dura", "dura", "dura", "dura",
  
  "el", "ela", "elas", "eles", "eleza", "elia", "elidade", "elice", "elidade",
  
  "ia", "iadade", "iador", "iadora", "iadora", "iador", "iadora", "iadora", "iador",
  
  "jo", "jada", "jador", "jadora", "jadora", "jador", "jadora", "jadora", "jador",
  
  "lho", "lha", "lhas", "lhos", "lheira", "lheria", "lhice", "lhidade", "lhicê",
  
  "mão", "mada", "mador", "madora", "madora", "mador", "madora", "madora", "mador",
  
  "nho", "nha", "nhas", "nhos", "nheira", "nheria", "nhice", "nhidade", "nhicê",
  
  "osa", "oso", "osas", "osos", "osamente", "osidade", "osamente", "osidade",
  
  "pão", "pada", "pador", "padora", "padora", "pador", "padora", "padora", "pador",
  
  "que", "quice", "quizada", "quizador", "quizadora", "quizadora", "quizador",
  
  "ra", "rada", "rador", "radora", "radora", "rador", "radora", "radora", "rador",
  
  "sa", "sada", "sador", "sadora", "sadora", "sador", "sadora", "sadora", "sador",
  
  "ta", "tada", "tador", "tadora", "tadora", "tador", "tadora", "tadora", "tador",
  
  "zada", "zador", "zadora", "zadora", "zador", "zadora", "zadora", "zador", "zadora",
  "zadora", "zadora", "zador",
  
  // More commonly used words in games
  "cachorro", "gato", "passaro", "peixe", "cobra", "leão", "urso", "lobo", "raposa",
  "coelho", "esquilo", "rato", "gato", "cachorro", "passaro", "peixe", "cobra", "leão",
  
  "maçã", "pera", "laranja", "limão", "morango", "melancia", "abacaxi", "melão",
  "banana", "uva", "cereja", "pêssego", "ameixa", "figo", "pitanga", "framboesa",
  
  "casa", "apartamento", "castelo", "palácio", "torre", "ponte", "porto", "cidade",
  "aldeia", "fazenda", "sítio", "chácara", "mansão", "cabana", "chalé", "barraco",
  
  "carro", "carro", "carro", "carro", "carro", "carro", "carro", "carro", "carro",
  "bicicleta", "motocicleta", "barco", "avião", "trem", "ônibus", "caminhão", "bicicleta",
  
  "escola", "universidade", "biblioteca", "museu", "cinema", "teatro", "hospital",
  "igreja", "mercado", "loja", "banco", "delegacia", "quartel", "estação",
];

// Remove duplicates
const UNIQUE_WORDS = Array.from(new Set(PORTUGUESE_WORDS.map(w => w.toLowerCase().trim())));

export interface LetterSequence {
  letters: string;
  position: 'start' | 'middle' | 'end';
}

export interface WordBombGameState {
  currentLetters: string;
  position: 'start' | 'middle' | 'end';
  usedWords: Set<string>;
  currentPlayerIndex: number;
  alivePlayers: number[];
  timer: number;
  baseTimer: number;
}

/**
 * Generate a random letter sequence that exists in Portuguese words
 */
export function generateLetterSequence(): LetterSequence {
  const positions: Array<'start' | 'middle' | 'end'> = ['start', 'middle', 'end'];
  const position = positions[Math.floor(Math.random() * positions.length)];
  
  let letters = '';
  let found = false;
  
  // Try to find valid sequences
  while (!found && UNIQUE_WORDS.length > 0) {
    const randomWord = UNIQUE_WORDS[Math.floor(Math.random() * UNIQUE_WORDS.length)];
    
    if (position === 'start' && randomWord.length >= 2) {
      letters = randomWord.substring(0, Math.random() > 0.5 ? 2 : 3);
      if (letters.length >= 2) found = true;
    } else if (position === 'end' && randomWord.length >= 2) {
      const len = Math.random() > 0.5 ? 2 : 3;
      const start = Math.max(0, randomWord.length - len);
      letters = randomWord.substring(start);
      if (letters.length >= 2) found = true;
    } else if (position === 'middle' && randomWord.length >= 3) {
      const len = Math.random() > 0.5 ? 2 : 3;
      const maxStart = Math.max(0, randomWord.length - len - 1);
      if (maxStart > 0) {
        const start = Math.floor(Math.random() * maxStart) + 1;
        letters = randomWord.substring(start, start + len);
        if (letters.length >= 2) found = true;
      }
    }
  }
  
  return { letters, position };
}

/**
 * Validate if a word contains the letter sequence in the correct position
 */
export function validateWord(word: string, letters: string, position: 'start' | 'middle' | 'end'): boolean {
  const cleanWord = word.toLowerCase().trim();
  const cleanLetters = letters.toLowerCase().trim();
  
  // Word must exist in our database
  if (!UNIQUE_WORDS.includes(cleanWord)) {
    return false;
  }
  
  // Check if the word contains the letters in the correct position
  if (position === 'start') {
    return cleanWord.startsWith(cleanLetters);
  } else if (position === 'end') {
    return cleanWord.endsWith(cleanLetters);
  } else if (position === 'middle') {
    const index = cleanWord.indexOf(cleanLetters);
    return index > 0 && index + cleanLetters.length < cleanWord.length;
  }
  
  return false;
}

/**
 * Get example words for a letter sequence
 */
export function getExampleWords(letters: string, position: 'start' | 'middle' | 'end'): string[] {
  const cleanLetters = letters.toLowerCase().trim();
  const examples: string[] = [];
  
  for (const word of UNIQUE_WORDS) {
    if (position === 'start' && word.startsWith(cleanLetters)) {
      examples.push(word);
    } else if (position === 'end' && word.endsWith(cleanLetters)) {
      examples.push(word);
    } else if (position === 'middle') {
      const index = word.indexOf(cleanLetters);
      if (index > 0 && index + cleanLetters.length < word.length) {
        examples.push(word);
      }
    }
    
    if (examples.length >= 10) break;
  }
  
  return examples;
}

/**
 * Get the position label in Portuguese
 */
export function getPositionLabel(position: 'start' | 'middle' | 'end'): string {
  const labels = {
    start: 'Início',
    middle: 'Meio',
    end: 'Final',
  };
  return labels[position];
}

/**
 * Calculate decreasing timer based on round/accuracy
 */
export function calculateTimerForRound(round: number, baseTime: number = 8): number {
  // Start with baseTime, gradually decrease by 0.5 seconds every 2 rounds
  const decrease = Math.floor(round / 2) * 0.5;
  return Math.max(4, baseTime - decrease); // Minimum 4 seconds
}
