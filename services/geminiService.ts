import { GoogleGenAI } from "@google/genai";
import { Player, Role } from "../types";

// Helper to get client safely
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateDayNarration = async (
  deadPlayer: Player | null,
  savedPlayer: Player | null
): Promise<string> => {
  const ai = getClient();
  
  // Fallback messages if API is missing or fails
  if (!ai) {
    if (savedPlayer && deadPlayer === null) {
      return `¡Milagro en la costa! La mafia intentó hacer la vuelta, pero el doctor llegó en moto a última hora y salvó a ${savedPlayer.name}. ¡Aquí no se murió nadie hoy!`;
    }
    if (deadPlayer) {
      return `Amaneció medio raro… y por desgracia, a ${deadPlayer.name} se lo llevó la mafia. Dios lo tenga en su gloria costeña.`;
    }
    return "¡Qué noche tan tranquila! Nadie murió, la mafia se quedó dormida o se fueron de rumba.";
  }

  try {
    const prompt = `
      Actúa como un narrador de historias del caribe colombiano (Costeño). 
      Usa jerga colombiana costeña (ej: "No joda", "Eche", "Cule", "Mondá" (suave), "Pilas", "Sapo", "Frio").
      Sé gracioso, sarcástico y con "mamadera de gallo".
      
      Situación:
      ${deadPlayer 
        ? `La mafia mató a ${deadPlayer.name}.` 
        : `La mafia intentó matar a ${savedPlayer?.name || 'alguien'} pero el doctor lo salvó.`
      }
      
      Genera un párrafo corto (máximo 2 frases) anunciando esto al pueblo al amanecer.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Hubo un error en la línea, pero ajá, alguien se murió.";
  } catch (error) {
    console.error("Gemini Error:", error);
    if (deadPlayer) return `Amaneció medio raro… y por desgracia, a ${deadPlayer.name} se lo llevó la mafia.`;
    return "Nadie murió hoy, ¡qué milagro!";
  }
};

export const generateWinMessage = async (winner: Role.MAFIA | Role.CITIZEN): Promise<string> => {
  const ai = getClient();
  if (!ai) {
    return winner === Role.MAFIA 
      ? "¡Ganó la MAFIA! Se los bailaron a todos sabroso." 
      : "¡Ganó el PUEBLO! Sacaron a todas las ratas.";
  }

  try {
    const prompt = `
      Actúa como un narrador costeño eufórico.
      El juego de Mafia terminó.
      Ganador: ${winner === Role.MAFIA ? 'La Mafia (los malos)' : 'El Pueblo (los ciudadanos)'}.
      
      Escribe una frase de celebración épica y graciosa.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "¡Se acabó esta vaina!";
  } catch (e) {
    return "¡Se acabó el juego!";
  }
};