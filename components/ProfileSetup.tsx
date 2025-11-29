
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
  
  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (eventStatus === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-center">
        <div>
          <h1 className="text-4xl font-black text-red-500 mb-4">CERRADO</h1>
          <p className="text-white text-lg">El local no admite nuevos registros en este momento.</p>
          <p className="text-slate-500 mt-2">Inténtalo más tarde.</p>
        </div>
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("No se pudo acceder a la cámara. Por favor, verifica los permisos.");
      setIsCameraOpen(false);
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white">Consigue tu Número</h2>
          <p className="mt-2 text-slate-400">Únete a la red exclusiva del local.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
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
                  <div className="relative w-full h-48 border-2 border-slate-700 border-dashed rounded-xl overflow-hidden bg-slate-800/50 flex flex-col items-center justify-center group">
                    {photo ? (
                      <>
                        <img src={photo} alt="Vista previa" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setPhoto(null)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold">Cambiar Foto</button>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <svg className="w-10 h-10 mx-auto text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <p className="text-sm text-slate-500">Sin foto seleccionada</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:bg-slate-700 transition-all text-sm font-bold text-white">
                    <span>📁</span> Galería
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                  <button type="button" onClick={startCamera} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-all text-sm font-bold text-white">
                    <span>📸</span> Cámara
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full bg-black rounded-xl overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover transform scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
                  <button type="button" onClick={closeCamera} className="px-4 py-2 bg-red-500/80 text-white rounded-full text-xs font-bold backdrop-blur-sm">Cancelar</button>
                  <button type="button" onClick={capturePhoto} className="px-6 py-2 bg-white text-black rounded-full text-xs font-bold shadow-lg">Capturar</button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Input label="Descríbete (Palabras Clave)" placeholder="ej. Techno, Tacos, Senderismo" value={traits} onChange={(e) => setTraits(e.target.value)} />
            <textarea className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 min-h-[80px]" placeholder="Tu biografía aparecerá aquí..." value={bio} onChange={(e) => setBio(e.target.value)} required />
            <Button type="button" variant="secondary" onClick={handleGenerateBio} isLoading={isGenerating} disabled={!name || !traits} className="text-xs py-2">✨ Generar Bio con IA</Button>
          </div>

          <Button type="submit" disabled={!photo || !name || !bio || isLoading} isLoading={isLoading}>
            {isLoading ? 'Conectando...' : 'Entrar al Local'}
          </Button>
        </form>
      </div>
    </div>
  );
};
