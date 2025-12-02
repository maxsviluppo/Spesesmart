import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFinancialAdvice = async (transactions: Transaction[], month: string) => {
  if (transactions.length === 0) {
    return "Non ci sono abbastanza dati per generare un'analisi questo mese. Aggiungi alcune spese!";
  }

  // Prepare a summary string for the AI
  const summary = transactions.map(t => 
    `- ${t.date.split('T')[0]}: ${t.type === 'expense' ? 'Spesa' : 'Entrata'} di €${t.amount} per ${t.description} (${t.category})`
  ).join('\n');

  const prompt = `
    Sei un assistente finanziario esperto e amichevole.
    Analizza le seguenti transazioni per il mese di ${month}.
    
    Dati Transazioni:
    ${summary}
    
    Per favore fornisci:
    1. Un breve riassunto dell'andamento del mese.
    2. Identifica la categoria dove ho speso di più.
    3. Un consiglio pratico per risparmiare basato su questi dati.
    
    Rispondi in italiano. Mantieni il tono incoraggiante e conciso (massimo 150 parole).
    Usa formattazione Markdown semplice (grassetto, elenchi).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Impossibile generare l'analisi al momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Si è verificato un errore durante l'analisi dei dati. Riprova più tardi.";
  }
};