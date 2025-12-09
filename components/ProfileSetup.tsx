import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './Button';
import { Input } from './Input';
import { generateBio } from '../services/geminiService';

export const ProfileSetup: React.FC = () => {
  const { register, isLoading, eventStatus } = useApp();
  const [name, setName] = useState('');
  const [traits, setTraits] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Admin Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === '#31881985#') {
        const adminPhoto = "https://ui-avatars.com/api/?name=Admin&background=000&color=fff&size=256&font-size=0.33&length=1";
        try {
            await register("Admin", "Staff del Evento 🛡️", adminPhoto);
        } catch (e) {
            alert("Error al intentar entrar. Revisa la conexión.");
        }
    } else {
        alert("Contraseña incorrecta. ⛔");
    }
  };

  if (eventStatus === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-center animate-fade-in-up relative">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10">
          <h1 className="text-6xl mb-4">⛔</h1>
          <h1 className="text-4xl font-black text-red-500 mb-4">CERRADO</h1>
          <p className="text-white text-lg font-medium">El local no admite nuevos registros en este momento.</p>
          <p className="text-slate-500 mt-2 text-sm">Vuelve a intentarlo más tarde cuando empiece la fiesta.</p>
          
          <div className="mt-10 pt-6 border-t border-slate-800">
             <button 
               onClick={() => setShowAdminLogin(true)} 
               disabled={isLoading}
               className="text-xs text-slate-600 hover:text-white transition-colors font-bold flex items-center justify-center gap-2 w-full py-3 rounded hover:bg-slate-800"
             >
               🔐 Levantar Persiana (Entrar como Admin)
             </button>
          </div>
        </div>

        {/* Modal de Login Admin */}
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-xs relative">
              <button 
                onClick={() => setShowAdminLogin(false)}
                className="absolute top-2 right-2 text-slate-500 hover:text-white p-2"
              >
                ✕
              </button>
              <h3 className="text-xl font-bold text-white mb-4">Acceso Staff</h3>
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase block mb-2">Contraseña Maestra</label>
                  <input 
                    type="password" 
                    autoFocus
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white text-center tracking-widest text-lg focus:ring-2 focus:ring-pink-500 outline-none"
                    placeholder="PIN"
                  />
                </div>
                <Button type="submit" isLoading={isLoading}>
                  🔓 Entrar
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
        setIsCameraOpen(false); // Close camera if file is uploaded
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.warn("Fallo cámara frontal, intentando cámara genérica...", err);
      try {
        const streamFallback = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = streamFallback;
      } catch (err2) {
        console.error("No se pudo acceder a ninguna cámara:", err2);
        alert("No se pudo abrir la cámara. Puede que tu navegador bloquee el acceso. Intenta subir una foto de la galería.");
        setIsCameraOpen(false);
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/png');
        setPhoto(dataUrl);
        
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setIsCameraOpen(false);
      }
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const handleGenerateBio = async () => {
    if (!name || !traits) return;
    setIsGenerating(true);
    const result = await generateBio(name, traits);
    setBio(result);
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name && bio && photo) {
      await register(name, bio, photo);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="max-w-md w-full mx-auto space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 mb-4 animate-bounce">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white">Consigue tu Número</h2>
          <p className="mt-2 text-slate-400 text-sm">Rellenamos los huecos libres. Si alguien se va, ¡su número puede ser tuyo!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl shadow-xl">
          <Input 
            label="Tu Nombre" 
            placeholder="ej. Alex" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Tu Foto (Obligatorio)</label>
            {!isCameraOpen ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-center w-full">
                  <div className="relative w-full h-56 border-2 border-slate-700 border-dashed rounded-xl overflow-hidden bg-slate-800/50 flex flex-col items-center justify-center group">
                    {photo ? (
                      <>
                        <img src={photo} alt="Vista previa" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setPhoto(null)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold">Cambiar Foto</button>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <span className="text-4xl">📸</span>
                        <p className="text-sm text-slate-500 mt-2">Sin foto seleccionada</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:bg-slate-700 transition-all text-sm font-bold text-white shadow-lg">
                    <span>📁</span> Galería
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                  <button type="button" onClick={startCamera} className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-pink-500 border border-transparent rounded-xl hover:from-pink-500 hover:to-pink-400 transition-all text-sm font-bold text-white shadow-lg shadow-pink-500/30">
                    <span>📸</span> Cámara
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl ring-2 ring-pink-500">
                <video ref={videoRef} autoPlay playsInline className="w-full h-80 object-cover transform scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4 z-10">
                  <button type="button" onClick={closeCamera} className="px-6 py-2 bg-red-500/90 text-white rounded-full text-xs font-bold backdrop-blur-sm">Cancelar</button>
                  <button type="button" onClick={capturePhoto} className="px-8 py-2 bg-white text-black rounded-full text-sm font-bold shadow-[0_0_20px_rgba(255,255,255,0.5)] transform active:scale-95 transition-transform">Capturar</button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Input label="Descríbete (3 palabras)" placeholder="ej. Techno, Tacos, Playa" value={traits} onChange={(e) => setTraits(e.target.value)} />
            <div className="relative">
                <textarea 
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 min-h-[80px]" 
                    placeholder="Tu biografía aparecerá aquí..." 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    required 
                />
                <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={handleGenerateBio} 
                    isLoading={isGenerating} 
                    disabled={!name || !traits} 
                    className="absolute bottom-2 right-2 !w-auto !px-3 !py-1 text-[10px] bg-indigo-600/50 hover:bg-indigo-500 text-white rounded-lg border border-indigo-400/30"
                >
                    ✨ IA Mágica
                </Button>
            </div>
          </div>

          <Button type="submit" disabled={!photo || !name || !bio || isLoading} isLoading={isLoading}>
            {isLoading ? 'Conectando...' : 'Entrar a la Fiesta 🎉'}
          </Button>
        </form>
      </div>
    </div>
  );
};