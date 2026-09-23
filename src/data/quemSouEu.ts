// Dados e regras do jogo "Quem Sou Eu?" (mímica local, pass-and-play).

export const QS_TIMER_SECONDS = 90;
export const QS_GOAL_POINTS = 1000;
export const QS_SWAPS_PER_ROUND = 3;
export const QS_MIN_PLAYERS = 3;
export const QS_MAX_PLAYERS = 10;

export interface QSWord {
  texto: string;
  categoria: string;
}

export interface QSPlayer {
  id: string;
  nome: string;
  pontos: number;
  trocasUsadas: number;
}

export function makePlayerId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Pontos de quem acerta: 20 + 2 × segundos restantes. */
export function calcPontos(segRestantes: number): number {
  const s = Math.max(0, Math.round(segRestantes));
  return 20 + 2 * s;
}

/** Pontos do mímico: metade do acertador, arredondando pra cima. */
export function calcPontosMimico(pontosAcertador: number): number {
  return Math.ceil(pontosAcertador / 2);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// Fallback offline (subconjunto do banco). Usado se o SELECT no Supabase falhar.
export const FALLBACK_WORDS: QSWord[] = [
  { texto: "Jesus", categoria: "Personagens" },
  { texto: "Moisés", categoria: "Personagens" },
  { texto: "Davi", categoria: "Personagens" },
  { texto: "Golias", categoria: "Personagens" },
  { texto: "Noé", categoria: "Personagens" },
  { texto: "Pedro", categoria: "Personagens" },
  { texto: "Sansão", categoria: "Personagens" },
  { texto: "Faraó", categoria: "Personagens" },
  { texto: "Dança", categoria: "Ações" },
  { texto: "Natação", categoria: "Ações" },
  { texto: "Dormir", categoria: "Ações" },
  { texto: "Dirigir", categoria: "Ações" },
  { texto: "Cozinhar", categoria: "Ações" },
  { texto: "Jogar futebol", categoria: "Ações" },
  { texto: "Tirar selfie", categoria: "Ações" },
  { texto: "Surfar", categoria: "Ações" },
  { texto: "Boxe", categoria: "Ações" },
  { texto: "Violão", categoria: "Instrumentos" },
  { texto: "Bateria", categoria: "Instrumentos" },
  { texto: "Piano", categoria: "Instrumentos" },
  { texto: "Saxofone", categoria: "Instrumentos" },
  { texto: "Pandeiro", categoria: "Instrumentos" },
  { texto: "Sanfona", categoria: "Instrumentos" },
  { texto: "Cruz", categoria: "Objetos" },
  { texto: "Celular", categoria: "Objetos" },
  { texto: "Guarda-chuva", categoria: "Objetos" },
  { texto: "Avião", categoria: "Objetos" },
  { texto: "Microfone", categoria: "Objetos" },
  { texto: "Leão", categoria: "Animais" },
  { texto: "Macaco", categoria: "Animais" },
  { texto: "Elefante", categoria: "Animais" },
  { texto: "Pinguim", categoria: "Animais" },
  { texto: "Tubarão", categoria: "Animais" },
  { texto: "Dinossauro", categoria: "Animais" },
  { texto: "Palhaço", categoria: "Diversão" },
  { texto: "Pirata", categoria: "Diversão" },
  { texto: "Robô", categoria: "Diversão" },
  { texto: "Bebê", categoria: "Diversão" },
  { texto: "Super-herói", categoria: "Diversão" },
  { texto: "Churrasco", categoria: "Diversão" },
];
