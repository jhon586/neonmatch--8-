
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './Button';
import { Input } from './Input';
import { getSupabaseConfig, generateInviteCode } from '../lib/supabase';

export const Dashboard: React.FC<{ onViewChange: (view: 'chat') => void }> = ({ onViewChange }) => {
  const { 
    currentUser, sendLike, incomingLikes, respondToLike, matches, logout, allUsers, 
    resetEvent, kickAllUsers, toggleEventStatus, eventStatus 
  } = useApp();
  const [targetId, setTargetId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [baseUrlOverride, setBaseUrlOverride] = useState('');

  useEffect(() => {
    setBaseUrlOverride(window.location.origin + window.location.pathname);
    const params = new URLSearchParams(window.location.search);
    const voteParam = params.get('vote');
    if (voteParam) setTargetId(voteParam);
  }, []);

  if (!currentUser) return null;

  const handleLike = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsVoting(true);
    const result = await sendLike(parseInt(targetId));
    setIsVoting(false);
    setFeedback({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) {
      setTargetId('');
    }
  };

  const handleAcceptLike = async (fromId: number) => {
    await respondToLike(fromId, true);
    localStorage.setItem('neonmatch_open_chat', fromId.toString());
    onViewChange('chat');
  };

  const handleResetEvent = async () => {
    if (window.confirm("🔴 PELIGRO: Esto borrará TODOS los usuarios, matches y mensajes y expulsará a todos.\n\n¿Estás seguro?")) {
      await resetEvent();
    }
  };

  const handleKickAll = async () => {
    if (window.confirm("¿Quieres cerrar la sesión de TODOS los usuarios conectados? (No borra datos, solo los echa de la app)")) {
      await kickAllUsers();
      alert("Señal de desconexión enviada.");
    }
  };

  const getPartnerId = (req: any) => req.fromId === currentUser.id ? req.toId : req.fromId;
  const config = getSupabaseConfig();
  const cleanBaseUrl = baseUrlOverride.replace(/\/$/, '');
  const inviteCode = config ? generateInviteCode(config.url, config.key) : '';
  const magicLink = `${cleanBaseUrl}?invite=${encodeURIComponent(inviteCode)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(magicLink)}`;

  const whatsappMessage = `¡Únete a la fiesta! 🥂 Escanea o pulsa aquí para entrar y conseguir tu número: ${magicLink}`;
  const shareViaWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
  const copyToClipboard = () => { navigator.clipboard.writeText(magicLink); alert("¡Enlace copiado!"); };

  return (
    <div className="max-w-md mx-auto min-h-screen pb-20 pt-6 px-4 space-y-6">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden mb-4 shadow-lg">
            {currentUser.photoUrl && <img src={currentUser.photoUrl} alt="Me" className="w-full h-full object-cover" /> }
          </div>
          <p className="text-white/80 font-medium tracking-widest uppercase text-xs">Tu Número</p>
          <h1 className="text-6xl font-black tracking-tighter mt-1">{currentUser.id}</h1>
          <p className="mt-2 text-white/90 font-medium">{currentUser.name}</p>
        </div>
      </div>

      {eventStatus === 'closed' && (
        <div className="bg-red-500 text-white p-3 rounded-xl text-center font-bold text-sm">
          ⛔ EL LOCAL ESTÁ CERRADO (Solo Admins)
        </div>
      )}

      <Button onClick={() => setShowInviteModal(true)} variant="secondary" className="bg-slate-800 border-pink-500/50 text-pink-400">
        INVITAR / VER QR
      </Button>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative shadow-2xl space-y-6 text-center my-auto">
             <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1">✕</button>
             <h3 className="text-xl font-black text-slate-900">¡Invita a la Fiesta!</h3>
             <div className="text-left">
                <label className="text-xs font-bold text-slate-400 uppercase">Dirección Web (Opcional)</label>
                <input className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono mt-1" value={baseUrlOverride} onChange={(e) => setBaseUrlOverride(e.target.value)} />
             </div>
             <div className="bg-slate-100 p-4 rounded-xl inline-block mx-auto border-4 border-slate-900">
               <img src={qrImageUrl} alt="QR Invitación" className="w-48 h-48 mix-blend-multiply" />
             </div>
             <div className="space-y-3">
               <button onClick={shareViaWhatsApp} className="w-full py-3 rounded-xl font-bold bg-[#25D366] text-white flex items-center justify-center gap-2"><span>📲</span> Enviar por WhatsApp</button>
               <button onClick={copyToClipboard} className="w-full py-3 rounded-xl font-bold text-slate-600 bg-slate-200">Copiar Enlace</button>
             </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span className="text-pink-500">❤️</span> ¿Has visto a alguien?</h3>
        <form onSubmit={handleLike} className="flex gap-3">
          <Input type="number" placeholder="Nº (ej. 39)" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="text-lg font-bold" />
          <Button type="submit" className="w-auto px-6" disabled={!targetId || isVoting} isLoading={isVoting}>Votar</Button>
        </form>
        {feedback && <p className={`mt-3 text-sm ${feedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{feedback.text}</p>}
      </div>

      {incomingLikes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white px-2">Votos Pendientes ({incomingLikes.length})</h3>
          {incomingLikes.map(req => {
             const user = allUsers.find(u => u.id === req.fromId);
             return (
              <div key={req.fromId} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden">
                     {user?.photoUrl && <img src={user.photoUrl} className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="font-bold text-white">Número {req.fromId}</p>
                    <p className="text-xs text-pink-400 font-bold mt-1">Te ha votado</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => respondToLike(req.fromId, false)} className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 hover:bg-red-500/20">✕</button>
                  <button onClick={() => handleAcceptLike(req.fromId)} className="w-8 h-8 rounded-full bg-pink-500 text-white hover:bg-pink-600 shadow-lg shadow-pink-500/30">✓</button>
                </div>
              </div>
             );
          })}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-lg font-bold text-white">Coincidencias (Matches)</h3>
          {matches.length > 0 && <button onClick={() => onViewChange('chat')} className="text-xs text-pink-400 font-bold">Ver Todo &rarr;</button>}
        </div>
        {matches.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {matches.map(match => {
              const partnerId = getPartnerId(match);
              const partner = allUsers.find(u => u.id === partnerId);
              if (!partner) return null;
              return (
                <div key={partner.id} onClick={() => onViewChange('chat')} className="flex-shrink-0 flex flex-col items-center cursor-pointer group">
                  <div className="w-16 h-16 rounded-full border-2 border-pink-500 p-1 relative">
                    <img src={partner.photoUrl || ''} className="w-full h-full rounded-full object-cover" />
                  </div>
                  <span className="mt-1 text-xs font-bold text-white group-hover:text-pink-400">#{partner.id}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl"><p>Sin coincidencias aún.</p></div>
        )}
      </div>

      <div className="pt-8 pb-8 text-center border-t border-slate-800 mt-8">
        <button onClick={logout} className="text-slate-500 text-sm hover:text-white underline mb-4 block w-full">Cerrar Sesión</button>
        
        {!isAdminPanelOpen ? (
           <button onClick={() => setIsAdminPanelOpen(true)} className="text-[10px] text-slate-800 hover:text-slate-700">Admin</button>
        ) : (
           <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mt-4 text-left">
              <p className="text-pink-400 font-bold text-xs mb-4 uppercase text-center">Panel de Control (Admin)</p>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                 <div className="bg-slate-800 p-2 rounded-lg text-center">
                    <span className="block text-2xl font-bold text-white">{allUsers.length}</span>
                    <span className="text-[10px] text-slate-400">Usuarios</span>
                 </div>
                 <div className="bg-slate-800 p-2 rounded-lg text-center">
                    <span className="block text-2xl font-bold text-white">{(matches.length + incomingLikes.length)}</span>
                    <span className="text-[10px] text-slate-400">Votos/Matches</span>
                 </div>
              </div>

              <h4 className="text-xs font-bold text-white mb-2">Estado del Local</h4>
              <div className="flex gap-2 mb-4">
                <button 
                  onClick={() => toggleEventStatus('open')} 
                  className={`flex-1 py-2 rounded-lg text-xs font-bold ${eventStatus === 'open' ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  ABIERTO
                </button>
                <button 
                  onClick={() => toggleEventStatus('closed')} 
                  className={`flex-1 py-2 rounded-lg text-xs font-bold ${eventStatus === 'closed' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  CERRADO
                </button>
              </div>

              <h4 className="text-xs font-bold text-white mb-2">Acciones Masivas</h4>
              <button onClick={handleKickAll} className="w-full py-2 bg-slate-700 text-white font-bold rounded-lg text-xs mb-2 hover:bg-slate-600">
                🚪 Echar a Todos (Cerrar Sesiones)
              </button>
              <button onClick={handleResetEvent} className="w-full py-2 bg-red-600 text-white font-bold rounded-lg text-xs hover:bg-red-700">
                ⚠️ BORRAR TODO Y REINICIAR
              </button>

              <h4 className="text-xs font-bold text-white mt-4 mb-2">Usuarios en Tiempo Real</h4>
              <div className="max-h-40 overflow-y-auto bg-slate-800 rounded-lg p-2 space-y-1">
                 {allUsers.map(u => (
                   <div key={u.id} className="flex justify-between items-center text-xs text-slate-300 p-1 hover:bg-slate-700 rounded">
                      <span>#{u.id} - {u.name}</span>
                      <span className="text-[10px] opacity-50">{new Date(u.joinedAt).toLocaleTimeString()}</span>
                   </div>
                 ))}
              </div>

              <button onClick={() => setIsAdminPanelOpen(false)} className="mt-4 w-full text-slate-500 text-xs text-center">Cerrar Panel</button>
           </div>
        )}
      </div>
    </div>
  );
};
