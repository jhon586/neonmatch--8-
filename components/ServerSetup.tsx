import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './Button';
import { Input } from './Input';
import { getSupabaseConfig } from '../lib/supabase';

export const ServerSetup: React.FC = () => {
  const { configureServer } = useApp();
  const [accessCode, setAccessCode] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // States para config manual si falla la automática
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleAccess = () => {
    if (accessCode === '#31881985#') {
      // 1. Intentar conectar automáticamente con lo que haya (env o localstorage o hardcoded)
      const existingConfig = getSupabaseConfig();
      if (existingConfig) {
        configureServer(existingConfig.url, existingConfig.key);
      } else {
        // Si no hay config, desbloqueamos el formulario manual
        setIsUnlocked(true);
        setError('');
      }
    } else {
      setError('Contraseña incorrecta. Intruso detectado. 🚨');
    }
  };

  const handleManualSave = () => {
    if (url && key) {
      configureServer(url, key);
    }
  };

  if (isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center space-y-6">
           <h2 className="text-2xl font-bold text-white">Configuración Inicial</h2>
           <p className="text-slate-400 text-sm">
             No se detectaron credenciales guardadas. Por favor, ingrésalas por única vez o añádelas al archivo <code>lib/supabase.ts</code> para memorizarlas.
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
            <Button onClick={handleManualSave} disabled={!url || !key}>
              Guardar y Conectar
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center space-y-6 animate-fade-in-up">
        
        <div className="mb-4">
           <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto flex items-center justify-center text-4xl shadow-inner border border-slate-700">
             🔐
           </div>
        </div>

        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600">
          NeonMatch
        </h1>
        
        <p className="text-white text-lg font-medium">
          Acceso Restringido
        </p>

        <div className="text-left">
           <Input 
             type="password"
             placeholder="Contraseña de Acceso"
             value={accessCode}
             onChange={(e) => { setAccessCode(e.target.value); setError(''); }}
             className="text-center tracking-widest text-xl"
           />
           {error && <p className="text-red-500 text-xs text-center mt-2 font-bold">{error}</p>}
        </div>
        
        <Button onClick={handleAccess} disabled={!accessCode}>
          Entrar al Club
        </Button>

      </div>
    </div>
  );
};