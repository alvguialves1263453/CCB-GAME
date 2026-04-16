import { supabase } from "../lib/supabase";

export interface Hymn {
  id: number;
  title: string;
  snippet: string;
  fullText: string;
}

export interface Question {
  question: string;
  snippet: string;
  options: string[];
  correct: number;
}

export async function fetchHymns(): Promise<Hymn[]> {
  const { data, error } = await supabase
    .from('hymn_snippets')
    .select('*')
    .order('hymn_id', { ascending: true });

  if (error) {
    console.error("Error fetching hymns from Supabase:", error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn("No hymns found in Supabase 'hymn_snippets' table.");
    return [];
  }
  
  return data.map(h => ({
    id: h.hymn_id,
    title: h.title,
    snippet: h.snippet,
    fullText: h.snippet
  }));
}

export function generateQuestions(hymns: Hymn[], allHymnsFromSupabase: Hymn[]): Question[] {
  const questions: Question[] = [];
  
  // Create a unique list of trimmed titles to avoid duplicates in options
  const uniqueTitlesPool = Array.from(new Set(allHymnsFromSupabase.map(h => h.title.trim())));

  if (uniqueTitlesPool.length < 4) {
    console.error("Not enough unique hymn titles in Supabase to generate options (minimum 4 required).");
    return [];
  }

  for (let i = 0; i < hymns.length; i++) {
    const current = hymns[i];
    const currentTitle = current.title.trim();
    
    // Filter out the correct title from the wrong answers pool (case-insensitive)
    const wrongTitlesPool = uniqueTitlesPool.filter(title => 
      title.toLowerCase() !== currentTitle.toLowerCase()
    );
    
    // Pick 3 random wrong answers
    const shuffledOthers = [...wrongTitlesPool].sort(() => 0.5 - Math.random());
    const wrongAnswers = shuffledOthers.slice(0, 3);
    
    // Combine correct and wrong answers (using the exact original titles from pool)
    const options = [currentTitle, ...wrongAnswers];
    
    // Shuffle options
    const shuffledOptions = [...options].sort(() => 0.5 - Math.random());
    
    // Find the new index of the correct answer (robust match)
    const correctIndex = shuffledOptions.findIndex(opt => 
      opt.toLowerCase() === currentTitle.toLowerCase()
    );
    
    questions.push({
      question: "Qual é o hino?",
      snippet: current.snippet,
      options: shuffledOptions,
      correct: correctIndex
    });
  }
  
  return questions;
}
