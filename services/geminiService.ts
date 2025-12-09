import { GoogleGenAI } from "@google/genai";

// En Vite, las variables de entorno se acceden vía import.meta.env
const apiKey = (import.meta as any).env?.VITE_API_KEY || '';

const ai = new GoogleGenAI({ apiKey: apiKey });

export const hasApiKey = (): boolean => !!apiKey;

// Respuestas de respaldo para cuando no hay API Key o falla la conexión
const BIOS_FALLBACK = [
  "Aquí por las risas y quizás algo más. 🍸",
  "Experto en pedir pizza a las 3am. 🍕",
  "Buscando a mi player 2. 🎮",
  "Si te gusta el techno, ya nos llevamos bien. 🎧",
  "Aventurero a tiempo parcial, soñador a tiempo completo. ✈️",
  "Menos drama, más tequila. 🍋",
  "¿Bailamos o solo nos miramos? 💃",
  "Coleccionando momentos, no cosas. ✨",
  "Mi perro piensa que soy cool. 🐶",
  "Haciendo historia o desastre, lo que surja. 🔥",
  "Me gusta mi café negro y mis mañanas brillantes. ☕",
  "Si la vida te da limones, pide sal y tequila. 🧂"
];

const WINGMAN_FALLBACK = [
  "¡Me encanta tu estilo! ¿De dónde es esa foto?",
  "Parece que tenemos mucho en común... ¿o me equivoco? 😏",
  "¿Cuál es tu trago favorito? La siguiente ronda va por mí. 🍹",
  "Si adivinas mi canción favorita, ganas un premio. 🎵",
  "¿Vienes mucho por aquí o es tu primera vez?",
  "Esa sonrisa es ilegal en 3 estados. 😉",
  "¿Team playa o team montaña? Es decisivo. 🏖️⛰️",
  "Hola, ¿qué tal la fiesta? 🥂",
  "Tengo una duda existencial: ¿Pizza con o sin piña? 🍍",
  "Estaba a punto de irme, pero vi tu perfil... 👀",
  "¿Del 1 al 10, qué tan peligroso eres? 🔥",
  "Tu bio me ha hecho reír, eso suma puntos."
];

const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generates a creative bio based on user keywords (Spanish).
 * Creatividad aumentada.
 */
export const generateBio = async (name: string, traits: string): Promise<string> => {
  if (!apiKey) {
      // Simulación de "pensar" para UX
      await new Promise(r => setTimeout(r, 800)); 
      return getRandom(BIOS_FALLBACK);
  }

  try {
    const styles = [
      "misterioso, breve y noir", 
      "caótico divertido", 
      "sarcástico nivel dios", 
      "poético pero de barrio", 
      "energía pura de festival", 
      "directo y sin filtros",
      "fanático de los memes"
    ];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];

    const prompt = `
    Eres un ghostwriter para perfiles de Tinder.
    Nombre: ${name}.
    Gustos: ${traits}.
    
    Tu misión: Escribir una bio ÚNICA.
    Estilo OBLIGATORIO: ${randomStyle}.
    
    Reglas estrictas:
    - NO uses "me gusta viajar" ni "amigos de mis amigos".
    - Máximo 120 caracteres.
    - Español natural y moderno.
    - Intenta ser diferente a lo habitual.
    
    Solo el texto.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 1.8,
        topK: 40,
      }
    });

    return response.text?.trim() || getRandom(BIOS_FALLBACK);
  } catch (error) {
    console.error("Gemini Bio Error:", error);
    return getRandom(BIOS_FALLBACK);
  }
};

export const getWingmanSuggestion = async (
  myBio: string,
  partnerBio: string,
  lastMessages: { sender: string; text: string }[]
): Promise<string> => {
  if (!apiKey) {
      await new Promise(r => setTimeout(r, 600));
      return getRandom(WINGMAN_FALLBACK);
  }

  try {
    const context = lastMessages.map(m => `${m.sender}: ${m.text}`).join('\n');
    
    const prompt = `
    Actúa como un experto en seducción y conversación (Wingman).
    
    YO (Bio): ${myBio}
    ELLA/ÉL (Bio): ${partnerBio}
    
    CONTEXTO DEL CHAT (Últimos mensajes):
    ${context}
    
    TU TAREA:
    Genera UNA respuesta para que YO envíe ahora.
    
    REGLAS:
    1. Si no hay mensajes previos, genera un abridor (Icebreaker) basado en su Bio.
    2. Si hay mensajes, continúa la conversación de forma divertida, coqueta o interesante.
    3. NO seas robótico. Sé natural, informal, usa jerga suave si encaja.
    4. NO uses comillas. NO expliques por qué elegiste la frase. Solo el texto.
    5. Máximo 15 palabras.
    6. Varía el tono.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 1.6,
      }
    });

    return response.text?.trim() || getRandom(WINGMAN_FALLBACK);
  } catch (error) {
    return getRandom(WINGMAN_FALLBACK);
  }
};