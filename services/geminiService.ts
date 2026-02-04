// GEMINI SERVICE REMOVED - USING STATIC MESSAGES
// L'utente ha richiesto di non usare API Key esterne per questo.

const MOTIVATIONAL_MESSAGES = [
  "Ottima sfida! Supera i tuoi limiti.",
  "La tua mente è agile come un calcolatore!",
  "Stai andando alla grande, continua così!",
  "Incredibile velocità di pensiero!",
  "Sei un vero campione dei numeri!",
  "Logica impeccabile!",
  "Non fermarti ora, il record è vicino!",
  "Fantastico! I tuoi neuroni stanno correndo!",
  "Precisione chirurgica!",
  "Un vero maestro dell'aritmetica!"
];

export async function getIQInsights(score: number, level: number, timeLeft: number) {
  // Simple logic to pick a message based on performance
  if (score > 1000) return "Livello Genio! Prestazione eccezionale.";
  if (level > 10) return "Stai scalando le vette della classifica!";
  if (timeLeft > 50) return "Velocità luce! Sei rapidissimo.";

  // Random fallback
  const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length);
  return MOTIVATIONAL_MESSAGES[randomIndex];
}
