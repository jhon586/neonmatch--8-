
import { GoogleGenAI } from "@google/genai";

// En Vite, las variables de entorno se acceden vía import.meta.env
const apiKey = (import.meta as any).env?.VITE_API_KEY || '';

const ai = new GoogleGenAI({ apiKey: apiKey });

export const hasApiKey = (): boolean => !!apiKey;

/**
 * Generates a creative bio based on user keywords (Spanish).
 * Ahora con mucha más aleatoriedad para evitar repeticiones.
 */
export const generateBio = async (name: string, traits: string): Promise<string> => {
  if (!apiKey) return "Me gusta la fiesta y conocer gente nueva. ¡Pregúntame!";

  try {
    // Lista de estilos aleatorios para forzar variedad
    const styles = [
      "misterioso y breve", 
      "muy divertido y bromista", 
      "sarcástico pero encantador", 
      "poético de noche", 
      "energético y fiestero", 
      "chill y relajado",
      "directo al grano",
      "un poco coqueto"
    ];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];

    const prompt = `
    Rol: Eres un asistente para perfiles de citas en una discoteca.
    Tarea: Escribe una biografía CORTA y ORIGINAL en Español.
    Usuario: ${name}.
    Gustos/Palabras clave: ${traits}.
    Estilo obligatorio: ${randomStyle}.
    Reglas:
    1. Máximo 140 caracteres.
    2. NO uses frases típicas como "me gusta viajar".
    3. Haz que suene humano, imperfecto y real.
    4. Varía la estructura de la frase.
    Solo devuelve el texto de la bio.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 1.4, // Temperatura alta para máxima creatividad
        topK: 40,
      }
    });

    return response.text?.trim() || "Listo para bailar toda la noche.";
  } catch (error) {
    console.error("Gemini Bio Error:", error);
    return "Solo estoy aquí por la música y la buena compañía.";
  }
};

/**
 * Identifica una canción a partir de un fragmento de audio en base64
 */
export const identifySong = async (audioBase64: string): Promise<string> => {
  if (!apiKey) return "No tengo oídos (Configura la API Key).";

  try {
    const prompt = "Escucha este audio. Identifica la canción que suena. Devuelve SOLO el formato 'Artista - Título'. Si es solo ruido o voz, di 'No reconozco música'.";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/mp3', data: audioBase64 } },
          { text: prompt }
        ]
      }
    });

    return response.text?.trim() || "No pude identificarla.";
  } catch (error) {
    console.error("Gemini Audio Error:", error);
    return "Error escuchando.";
  }
};

export const getWingmanSuggestion = async (
  myBio: string,
  partnerBio: string,
  lastMessages: { sender: string; text: string }[]
): Promise<string> => {
  if (!apiKey) return "¿Qué te cuentas?";

  try {
    const context = lastMessages.map(m => `${m.sender}: ${m.text}`).join('\n');
    
    const prompt = `
    Actúa como un "Wingman" (ayudante de ligue).
    Contexto: Estamos en una fiesta/discoteca.
    Mi Bio: ${myBio}
    Su Bio: ${partnerBio}
    Chat reciente:
    ${context}
    
    Tarea: Sugiere una respuesta o frase para continuar la conversación. Que sea divertida, corta y natural en Español de España o Latino neutro.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "¿Cuál es tu canción favorita?";
  } catch (error) {
    return "¿Te lo estás pasando bien?";
  }
};
