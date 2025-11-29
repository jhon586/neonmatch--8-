import { GoogleGenAI } from "@google/genai";

// En Vite, las variables de entorno se acceden vía import.meta.env
// Usamos 'as any' para evitar errores de TypeScript si no están definidos los tipos
const apiKey = (import.meta as any).env?.VITE_API_KEY || '';

const ai = new GoogleGenAI({ apiKey: apiKey });

export const hasApiKey = (): boolean => !!apiKey;

/**
 * Generates a creative bio based on user keywords (Spanish).
 */
export const generateBio = async (name: string, traits: string): Promise<string> => {
  // Si no hay API Key, devolvemos una bio genérica divertida en lugar de un error técnico
  if (!apiKey) return "Me gusta la fiesta y conocer gente nueva. ¡Pregúntame!";

  try {
    const prompt = `Escribe una biografía corta, ingeniosa y misteriosa para una app de citas (máx 150 caracteres) para una persona llamada ${name}. 
    Gustos/Rasgos: ${traits}. 
    Tono: Divertido, ambiente de "Discoteca/Fiesta", intrigante. 
    Idioma: Español.
    Solo devuelve el texto de la biografía.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "Listo para bailar toda la noche.";
  } catch (error) {
    console.error("Gemini Bio Error:", error);
    // Fallback silencioso en caso de error
    return "Solo estoy aquí por la música y la buena compañía.";
  }
};

/**
 * Suggests a reply in a chat context (Wingman feature) in Spanish.
 */
export const getWingmanSuggestion = async (
  myBio: string,
  partnerBio: string,
  lastMessages: { sender: string; text: string }[]
): Promise<string> => {
  if (!apiKey) return "¿Qué te cuentas?";

  try {
    const context = lastMessages.map(m => `${m.sender}: ${m.text}`).join('\n');
    
    const prompt = `
    Actúa como un "Wingman" (Asistente de ligues). Sugiere una respuesta corta y atractiva (máx 1 frase) para enviar a continuación.
    
    Mi Bio: ${myBio}
    Su Bio: ${partnerBio}
    
    Historial de conversación:
    ${context}
    
    La respuesta debe ser divertida, casual y fomentar que respondan. Idioma: Español. Solo devuelve la sugerencia.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "¿Cuál es tu canción favorita de las que han puesto?";
  } catch (error) {
    console.error("Gemini Wingman Error:", error);
    return "¿Te lo estás pasando bien?";
  }
};