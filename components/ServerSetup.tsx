import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './Button';
import { Input } from './Input';

export const ServerSetup: React.FC = () => {
  const { configureServer } = useApp();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);

  const handleSave = () => {
    if (url && key) {
      configureServer(url, key);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center">
        
        {/* Vista para Invitados (Por defecto) */}
        {!isAdminMode ? (
          <div className="space-y-6">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600">
              NeonMatch
            </h1>
            <p className="text-white text-lg font-medium">
              ¡Bienvenido a la Fiesta!
            </p>
            <div className="bg-slate-800 p-4 rounded-xl text-slate-300 text-sm">
              <p className="mb-2">👋 <b>¿Eres un invitado?</b></p>
              <p>Por favor, escanea el <b>Código QR</b> que hay en el local o pide el enlace de invitación.</p>
              <p className="mt-2 text-xs opacity-50">Así entrarás automáticamente sin configurar nada.</p>
            </div>
            
            <div className="pt-8">
               <button 
                 onClick={() => setIsAdminMode(true)} 
                 className="text-xs text-slate-700 hover:text-slate-500 underline"
               >
                 Soy el Organizador (Admin)
               </button>
            </div>
          </div>
        ) : (
          /* Vista de Admin (Solo tú la ves si pulsas el botón) */
          <div className="space-y-4 text-left">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Configuración Admin</h2>
              <button onClick={() => setIsAdminMode(false)} className="text-xs text-red-400">Cancelar</button>
            </div>
            
            <p className="text-slate-400 text-xs mb-4">
              Introduce las claves de Supabase para activar el sistema.
            </p>

            <Input 
              label="Project URL" 
              placeholder="https://xyz.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Input 
              label="API Key (Anon/Public)" 
              type="password"
              placeholder="eyJh..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <Button onClick={handleSave} disabled={!url || !key}>
              Conectar Discoteca
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};