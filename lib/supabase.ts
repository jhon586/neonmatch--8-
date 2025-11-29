import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'neonmatch_sb_url';
const STORAGE_KEY_KEY = 'neonmatch_sb_key';

// Función simple para ofuscar las credenciales en el enlace (Base64)
export const generateInviteCode = (url: string, key: string) => {
  try {
    const data = JSON.stringify({ u: url, k: key });
    return btoa(data); // Encriptar a Base64
  } catch (e) {
    return '';
  }
};

export const getSupabaseConfig = () => {
  const params = new URLSearchParams(window.location.search);
  
  // 1. Detección de Invitación Mágica (?invite=CODIGO)
  const inviteCode = params.get('invite');
  if (inviteCode) {
    try {
      const decoded = atob(inviteCode);
      const config = JSON.parse(decoded);
      
      if (config.u && config.k) {
        localStorage.setItem(STORAGE_KEY_URL, config.u);
        localStorage.setItem(STORAGE_KEY_KEY, config.k);
        
        // Limpiar la URL para que el usuario no vea el código largo
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
        
        return { url: config.u, key: config.k };
      }
    } catch (e) {
      console.error("Invitación inválida");
    }
  }

  // 2. Intentar leer de localStorage (Configuración guardada)
  const storedUrl = localStorage.getItem(STORAGE_KEY_URL);
  const storedKey = localStorage.getItem(STORAGE_KEY_KEY);

  if (storedUrl && storedKey) {
    return { url: storedUrl, key: storedKey };
  }

  // 3. Variables de entorno (Vite/Netlify)
  // Usamos import.meta.env para Vite
  const env = (import.meta as any).env;
  if (env?.VITE_SUPABASE_URL && env?.VITE_SUPABASE_KEY) {
    return { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_KEY };
  }

  return null;
};

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
};

export const createSupabaseClient = () => {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    return createClient(config.url, config.key);
  } catch (error) {
    console.error("Error inicializando Supabase:", error);
    return null;
  }
};