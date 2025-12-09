import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './Button';
import { Input } from './Input';
import { getSupabaseConfig, generateInviteCode } from '../lib/supabase';

const MASTER_PIN = "#31881985#";

type SecurityAction = 
  | { type: 'KICK_USER'; id: number; name: string }
  | { type: 'KICK_ALL' }
  | { type: 'RESET_EVENT' };

export const Dashboard: React.FC<{ onViewChange: (view: 'chat') => void }> = ({ onViewChange }) => {
  const { 
    currentUser, sendLike, incomingLikes, respondToLike, matches, logout, allUsers, 
    resetEvent, kickAllUsers, kickSpecificUser, toggleEventStatus, eventStatus, coronateWinners, winners,
    reports, resolveReport, messages
  } = useApp();
  const [targetId, setTargetId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  // Admin State
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [baseUrlOverride, setBaseUrlOverride] = useState('');
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [hearts, setHearts] = useState<{id: number, left: number, delay: number}[]>([]);

  // Security Modal State
  const [securityAction, setSecurityAction] = useState<SecurityAction | null>(null);
  const [securityPin, setSecurityPin] = useState('');

  // Estados para temporizador
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("02:00");
  const [timerEnabled, setTimerEnabled] = useState(false);

  useEffect(() => {
    setBaseUrlOverride(window.location.origin + window.location.pathname);
    const params = new URLSearchParams(window.location.search);
    const voteParam = params.get('vote');
    if (voteParam) setTargetId(voteParam);
  }, []);

  // AUTO-OPEN ADMIN PANEL si el usuario se llama Admin (ingreso por backdoor)
  useEffect(() => {
    if (currentUser && currentUser.name === 'Admin') {
        setIsAdminPanelOpen(true);
    }
  }, [currentUser]);

  // Efecto de corazones cuando hay ganadores
  useEffect(() => {
    if (winners) {
        // Generar 50 corazones
        const newHearts = Array.from({ length: 50 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100, // posición horizontal %
            delay: Math.random() * 5 // retraso en segundos
        }));
        setHearts(newHearts);
    } else {
        setHearts([]);
    }
  }, [winners]);

  // Lógica del Temporizador (Cliente Admin ejecuta el check)
  useEffect(() => {
    if (!timerEnabled || !isAdminPanelOpen) return;
    
    const checkTime = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;
        
        // Lógica de cruce de medianoche (ej 18:00 a 02:00)
        let isOpen = false;
        if (startTotal < endTotal) {
            isOpen = currentMinutes >= startTotal && currentMinutes < endTotal;
        } else {
            // Cruza medianoche (ej. empieza 22:00, acaba 04:00)
            isOpen = currentMinutes >= startTotal || currentMinutes < endTotal;
        }

        if (isOpen && eventStatus === 'closed') toggleEventStatus('open');
        if (!isOpen && eventStatus === 'open') toggleEventStatus('closed');
    };
    
    const interval = setInterval(checkTime, 30000); // Revisar cada 30s
    checkTime(); 
    return () => clearInterval(interval);
  }, [timerEnabled, startTime, endTime, eventStatus, isAdminPanelOpen]);


  if (!currentUser) return null;

  const handleAdminLogin = (e?: React.FormEvent) => {
      e?.preventDefault();
      if (adminPinInput === MASTER_PIN) {
          setIsAdminPanelOpen(true);
          setShowAdminLogin(false);
          setAdminPinInput("");
          // Auto-scroll to panel for better UX
          setTimeout(() => {
             document.getElementById('admin-panel')?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
      } else {
          alert("PIN Incorrecto");
      }
  };

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

  // --- LOGICA DE SEGURIDAD (PIN MAESTRO) ---

  const initiateResetEvent = () => setSecurityAction({ type: 'RESET_EVENT' });
  const initiateKickAll = () => setSecurityAction({ type: 'KICK_ALL' });
  const initiateKickUser = (id: number, name: string) => setSecurityAction({ type: 'KICK_USER', id, name });

  const confirmSecurityAction = async () => {
      if (securityPin !== MASTER_PIN) {
          alert("⛔ PIN Incorrecto. Acceso denegado.");
          return;
      }

      if (securityAction?.type === 'RESET_EVENT') {
          await resetEvent();
          alert("✅ Evento reiniciado.");
      } else if (securityAction?.type === 'KICK_ALL') {
          await kickAllUsers();
          alert("✅ Todos los usuarios expulsados.");
      } else if (securityAction?.type === 'KICK_USER') {
          await kickSpecificUser(securityAction.id);
      }

      // Cleanup
      setSecurityAction(null);
      setSecurityPin('');
  };

  const closeSecurityModal = () => {
      setSecurityAction(null);
      setSecurityPin('');
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
    <div className="max-w-md mx-auto min-h-screen pb-20 pt-6 px-4 space-y-6 relative">
      
      {/* MODAL DE SEGURIDAD PARA LOGIN ADMIN */}
      {showAdminLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in-up">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-xs relative">
                  <button onClick={() => setShowAdminLogin(false)} className="absolute top-3 right-3 text-slate-400 hover:text-white">✕</button>
                  <h3 className="text-xl font-bold text-white mb-4 text-center">🔐 Acceso Master</h3>
                  
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <input 
                        type="password" 
                        placeholder="PIN MAESTRO" 
                        autoFocus
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 px-4 text-center text-white text-lg tracking-[0.5em] focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                        value={adminPinInput} 
                        onChange={e => setAdminPinInput(e.target.value)}
                    />
                    <button type="submit" className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-500 transition-all shadow-lg shadow-pink-500/20">
                        Entrar
                    </button>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL DE SEGURIDAD ACCIONES (KICK/RESET) */}
      {securityAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in-up">
              <div className="bg-slate-900 border-2 border-red-500/50 rounded-2xl p-6 w-full max-w-xs shadow-2xl relative">
                  <button onClick={closeSecurityModal} className="absolute top-3 right-3 text-slate-400 hover:text-white">✕</button>
                  
                  <div className="text-center space-y-4">
                      <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-2xl border border-red-500/30">
                          👮‍♂️
                      </div>
                      
                      <div>
                          <h3 className="text-lg font-bold text-white">Verificación Master</h3>
                          <p className="text-xs text-red-300 font-bold mt-1">
                              {securityAction.type === 'KICK_USER' && `Expulsar a ${securityAction.name}`}
                              {securityAction.type === 'KICK_ALL' && "EXPULSAR A TODOS"}
                              {securityAction.type === 'RESET_EVENT' && "BORRAR BASE DE DATOS"}
                          </p>
                      </div>

                      <input 
                        type="password" 
                        placeholder="PIN MAESTRO" 
                        autoFocus
                        className="w-full bg-black/50 border border-slate-700 rounded-lg py-3 px-4 text-center text-white text-lg tracking-[0.5em] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        value={securityPin}
                        onChange={(e) => setSecurityPin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmSecurityAction()}
                      />

                      <button 
                        onClick={confirmSecurityAction}
                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all"
                      >
                          CONFIRMAR ACCIÓN
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ANIMACIÓN DE CORAZONES FLOTANTES (GLOBAL) */}
      {winners && (
        <div className="floating-hearts-container">
            {hearts.map(h => (
                <div 
                    key={h.id} 
                    className="heart" 
                    style={{ left: `${h.left}%`, animationDuration: `${3 + Math.random() * 2}s`, animationDelay: `${h.delay}s` }}
                >
                    ❤️
                </div>
            ))}
        </div>
      )}

      {/* OVERLAY DE GANADORES (Rey y Reina) */}
      {winners && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-fade-in-up text-center">
              <div className="space-y-6 relative z-50">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-yellow-500/20 to-transparent blur-3xl pointer-events-none"></div>
                  
                  <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 uppercase drop-shadow-[0_2px_10px_rgba(234,179,8,0.5)] animate-bounce">
                      👑 Reyes de la Pista 👑
                  </h1>
                  
                  <div className="flex flex-col sm:flex-row justify-center gap-8 items-center">
                      {winners.king && (
                          <div className="flex flex-col items-center transform hover:scale-105 transition-transform">
                              <div className="relative">
                                  <div className="absolute -top-6 -right-4 text-4xl animate-bounce">👑</div>
                                  <img src={winners.king.photoUrl || ''} className="w-32 h-32 rounded-full border-4 border-yellow-400 object-cover shadow-[0_0_30px_rgba(250,204,21,0.6)]" />
                              </div>
                              <p className="text-2xl font-black text-white mt-4 tracking-tight">#{winners.king.id} {winners.king.name}</p>
                              <p className="text-yellow-400 text-sm font-bold uppercase tracking-widest mt-1">El Rey</p>
                          </div>
                      )}
                      {winners.queen && (
                          <div className="flex flex-col items-center transform hover:scale-105 transition-transform">
                               <div className="relative">
                                  <div className="absolute -top-6 -left-4 text-4xl animate-bounce delay-100">👑</div>
                                  <img src={winners.queen.photoUrl || ''} className="w-32 h-32 rounded-full border-4 border-pink-400 object-cover shadow-[0_0_30px_rgba(244,114,182,0.6)]" />
                              </div>
                              <p className="text-2xl font-black text-white mt-4 tracking-tight">#{winners.queen.id} {winners.queen.name}</p>
                              <p className="text-pink-400 text-sm font-bold uppercase tracking-widest mt-1">La Reina</p>
                          </div>
                      )}
                  </div>
                  <p className="text-white/50 text-sm mt-8 animate-pulse">¡Felicidades a los más populares!</p>
              </div>
          </div>
      )}

      {/* Lightbox para Admin (Ver fotos en grande) */}
      {enlargedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setEnlargedPhoto(null)}>
           <img src={enlargedPhoto} className="max-w-full max-h-full rounded-xl shadow-2xl" />
           <button className="absolute top-4 right-4 text-white bg-slate-800 rounded-full p-2">✕</button>
        </div>
      )}

      {/* Visor de Reportes (Disputas) */}
      {viewingReport && (
          <div className="fixed inset-0 z-50 bg-slate-900 p-6 overflow-y-auto animate-fade-in-up">
              <button onClick={() => setViewingReport(null)} className="mb-4 text-slate-400 hover:text-white flex items-center gap-2">← Volver al Panel</button>
              
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl mb-6">
                <h2 className="text-xl font-bold text-red-400">Disputa Activa</h2>
                <p className="text-white mt-1 font-medium">Motivo: "{viewingReport.reason}"</p>
                <p className="text-sm text-red-300 mt-2">Reporter ID: {viewingReport.reporterId} | Reported ID: {viewingReport.reportedId}</p>
              </div>
              
              <div className="bg-slate-800 p-4 rounded-xl space-y-3 mb-6 shadow-xl">
                  <h3 className="font-bold text-white border-b border-slate-700 pb-2 flex items-center gap-2">
                      <span>🕵️‍♂️</span> Historial de Chat
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {messages.filter(m => 
                        (m.senderId === viewingReport.reporterId && m.receiverId === viewingReport.reportedId) ||
                        (m.senderId === viewingReport.reportedId && m.receiverId === viewingReport.reporterId)
                    ).map(m => (
                        <div key={m.id} className={`flex flex-col ${m.senderId === viewingReport.reporterId ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] text-sm p-3 rounded-xl ${m.senderId === viewingReport.reporterId ? 'bg-indigo-900/50 text-indigo-100 rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                                <span className="font-bold text-[10px] block mb-1 opacity-70 uppercase tracking-wider">{m.senderId === viewingReport.reporterId ? 'Reporter' : 'Reported'}</span>
                                {m.type === 'image' ? (
                                    <div className="text-xs bg-black/30 p-2 rounded">📷 [Imagen Enviada]</div>
                                ) : m.text}
                            </div>
                        </div>
                    ))}
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { resolveReport(viewingReport.id); setViewingReport(null); }} className="bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-500 transition-colors">
                      ✅ Marcar Resuelto
                  </button>
                  <button onClick={() => { initiateKickAll(); setViewingReport(null); }} className="bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-red-500 transition-colors">
                      🛑 Echar a Todos
                  </button>
              </div>
          </div>
      )}

      {/* Tarjeta de Perfil */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden mb-4 shadow-lg ring-4 ring-white/5">
            {currentUser.photoUrl && <img src={currentUser.photoUrl} alt="Me" className="w-full h-full object-cover" /> }
          </div>
          <p className="text-white/80 font-medium tracking-widest uppercase text-xs">Tu Número</p>
          <h1 className="text-7xl font-black tracking-tighter mt-1 drop-shadow-lg">{currentUser.id}</h1>
          <p className="mt-2 text-white/90 font-medium text-lg">{currentUser.name}</p>
        </div>
      </div>

      {eventStatus === 'closed' && (
        <div className="bg-red-500 text-white p-4 rounded-xl text-center font-bold shadow-lg animate-pulse border-2 border-red-400">
          ⛔ EL LOCAL ESTÁ CERRADO <br/><span className="text-xs font-normal opacity-90">(Solo Admins pueden operar)</span>
        </div>
      )}

      <Button onClick={() => setShowInviteModal(true)} variant="secondary" className="bg-slate-800 border-pink-500/50 text-pink-400 hover:bg-slate-700">
        🎫 INVITAR / MOSTRAR QR
      </Button>

      {/* Modal Invitación */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative shadow-2xl space-y-6 text-center my-auto">
             <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-2 font-bold">✕</button>
             <h3 className="text-2xl font-black text-slate-900 tracking-tight">¡Invita a la Fiesta!</h3>
             
             <div className="bg-slate-100 p-4 rounded-2xl inline-block mx-auto border-4 border-slate-900 shadow-xl">
               <img src={qrImageUrl} alt="QR Invitación" className="w-48 h-48 mix-blend-multiply" />
             </div>
             
             <div className="space-y-3">
               <button onClick={shareViaWhatsApp} className="w-full py-3.5 rounded-xl font-bold bg-[#25D366] text-white flex items-center justify-center gap-2 hover:brightness-105 transition-all shadow-lg shadow-green-500/30">
                 <span>📲</span> Enviar por WhatsApp
               </button>
               <button onClick={copyToClipboard} className="w-full py-3.5 rounded-xl font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors">
                 Copiar Enlace
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Área de Votación */}
      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span className="text-pink-500 text-2xl">❤️</span> ¿Te gusta alguien?</h3>
        <form onSubmit={handleLike} className="flex gap-3">
          <Input 
            type="number" 
            placeholder="Nº (ej. 39)" 
            value={targetId} 
            onChange={(e) => setTargetId(e.target.value)} 
            className="text-2xl font-black text-center tracking-widest placeholder:text-sm placeholder:tracking-normal placeholder:font-normal" 
          />
          <Button type="submit" className="w-auto px-8 bg-pink-600 hover:bg-pink-500" disabled={!targetId || isVoting} isLoading={isVoting}>
            Votar
          </Button>
        </form>
        {feedback && <p className={`mt-3 text-sm font-bold text-center p-2 rounded-lg ${feedback.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{feedback.text}</p>}
      </div>

      {/* Likes Recibidos */}
      {incomingLikes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white px-2 flex items-center gap-2">
            🔥 Te han votado <span className="bg-pink-600 text-white text-xs px-2 py-0.5 rounded-full">{incomingLikes.length}</span>
          </h3>
          {incomingLikes.map(req => {
             const user = allUsers.find(u => u.id === req.fromId);
             return (
              <div key={req.fromId} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between animate-fade-in-up shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-700 overflow-hidden ring-2 ring-pink-500/30">
                     {user?.photoUrl && <img src={user.photoUrl} className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="font-black text-xl text-white">#{req.fromId}</p>
                    <p className="text-xs text-pink-400 font-bold uppercase tracking-wide">Nuevo Like</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => respondToLike(req.fromId, false)} className="w-10 h-10 rounded-full bg-slate-700 text-slate-400 hover:bg-red-500 hover:text-white transition-all">✕</button>
                  <button onClick={() => handleAcceptLike(req.fromId)} className="w-10 h-10 rounded-full bg-pink-500 text-white hover:bg-pink-400 shadow-lg shadow-pink-500/40 transition-all transform hover:scale-110">✓</button>
                </div>
              </div>
             );
          })}
        </div>
      )}

      {/* Lista de Matches */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-lg font-bold text-white">Tus Matches 💬</h3>
          {matches.length > 0 && <button onClick={() => onViewChange('chat')} className="text-xs text-pink-400 font-bold bg-pink-500/10 px-3 py-1 rounded-full hover:bg-pink-500/20">Abrir Chat &rarr;</button>}
        </div>
        {matches.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-2">
            {matches.map(match => {
              const partnerId = getPartnerId(match);
              const partner = allUsers.find(u => u.id === partnerId);
              if (!partner) return null;
              return (
                <div key={partner.id} onClick={() => onViewChange('chat')} className="flex-shrink-0 flex flex-col items-center cursor-pointer group w-20">
                  <div className="w-16 h-16 rounded-full border-2 border-pink-500 p-1 relative shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform">
                    <img src={partner.photoUrl || ''} className="w-full h-full rounded-full object-cover" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                  </div>
                  <span className="mt-2 text-sm font-bold text-white group-hover:text-pink-400 transition-colors">#{partner.id}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
            <p>Aún no tienes matches. ¡Vota a alguien!</p>
          </div>
        )}
      </div>

      <div className="pt-8 pb-8 text-center border-t border-slate-800 mt-8">
        <button onClick={logout} className="text-slate-500 text-sm hover:text-red-400 transition-colors underline mb-6 block w-full">Cerrar Sesión (Libera tu número)</button>
        
        {/* Acceso Admin */}
        {!showAdminLogin && !isAdminPanelOpen && (
           <button onClick={() => setShowAdminLogin(true)} className="px-4 py-2 bg-slate-900 text-[10px] text-slate-600 hover:text-slate-400 rounded-lg border border-slate-800">
             🔐 Acceso Admin
           </button>
        )}

        {/* PANEL DE ADMINISTRADOR */}
        {isAdminPanelOpen && (
           <div id="admin-panel" className="bg-slate-900 border border-indigo-500/50 rounded-xl p-4 mt-4 text-left shadow-2xl ring-1 ring-indigo-500/20 animate-fade-in-up">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-2">
                <p className="text-indigo-400 font-black text-sm uppercase tracking-wider flex items-center gap-2">
                   🛠️ Panel de Control
                </p>
                <button onClick={() => setIsAdminPanelOpen(false)} className="text-xs text-slate-500 hover:text-white px-2 py-1 bg-slate-800 rounded">Cerrar</button>
              </div>

              {/* REPORTES */}
              <div className="mb-6 border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider opacity-70">Disputas ({reports.length})</h4>
                  {reports.length === 0 ? <p className="text-xs text-slate-500 italic bg-slate-950 p-2 rounded">Todo tranquilo. Sin reportes.</p> : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                          {reports.map(r => (
                              <div key={r.id} className="bg-red-900/20 border border-red-500/30 p-3 rounded-lg flex justify-between items-center">
                                  <div>
                                      <p className="text-xs text-red-300 font-bold">#{r.reporterId} ⚔️ #{r.reportedId}</p>
                                      <p className="text-[10px] text-red-200/70 truncate w-32">{r.reason}</p>
                                  </div>
                                  <button onClick={() => setViewingReport(r)} className="bg-red-600 hover:bg-red-500 text-white text-[10px] px-3 py-1.5 rounded-md font-bold shadow-sm">
                                      Revisar
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              {/* TEMPORIZADOR */}
              <div className="mb-6 border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider opacity-70">Temporizador Automático</h4>
                  <div className="flex items-center gap-2 mb-3 bg-slate-950 p-2 rounded-lg">
                      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-slate-800 text-white text-xs p-1.5 rounded border border-slate-700" />
                      <span className="text-slate-500 font-bold">a</span>
                      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-slate-800 text-white text-xs p-1.5 rounded border border-slate-700" />
                  </div>
                  <button 
                    onClick={() => setTimerEnabled(!timerEnabled)} 
                    className={`w-full py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${timerEnabled ? 'bg-green-600/20 text-green-400 border border-green-500/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${timerEnabled ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></span>
                    {timerEnabled ? 'Temporizador ACTIVADO' : 'Temporizador APAGADO'}
                  </button>
              </div>

              {/* EVENT STATUS */}
              <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider opacity-70">Control Manual</h4>
              <div className="flex gap-2 mb-6">
                <button onClick={() => toggleEventStatus('open')} className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all ${eventStatus === 'open' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🌤️ LEVANTAR PERSIANA</button>
                <button onClick={() => toggleEventStatus('closed')} className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all ${eventStatus === 'closed' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🔒 CERRAR LOCAL</button>
              </div>

              {/* FOTOS DE USUARIOS Y KICK MANUAL */}
              <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider opacity-70">Moderación Visual (Tocar 'X' para echar)</h4>
              <div className="grid grid-cols-5 gap-2 mb-6 max-h-52 overflow-y-auto bg-slate-950 p-2 rounded-lg border border-slate-800">
                 {allUsers.map(u => (
                     <div key={u.id} className="relative group aspect-square">
                         <img 
                           src={u.photoUrl || ''} 
                           className="w-full h-full object-cover rounded-md border border-slate-700 cursor-pointer" 
                           onClick={() => setEnlargedPhoto(u.photoUrl)}
                         />
                         <span className="absolute bottom-0 left-0 bg-black/80 text-white text-[8px] px-1 rounded-tr-md">#{u.id}</span>
                         
                         {/* BOTÓN ECHAR INDIVIDUAL (Fixed styling) */}
                         <div 
                           onClick={(e) => { e.stopPropagation(); initiateKickUser(u.id, u.name); }}
                           className="absolute top-1 right-1 w-7 h-7 bg-red-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg z-30 hover:bg-red-500 active:scale-95 border-2 border-slate-900"
                           title="Expulsar"
                         >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                           </svg>
                         </div>
                     </div>
                 ))}
                 {allUsers.length === 0 && <p className="col-span-5 text-center text-[10px] text-slate-600 py-4">Sin usuarios</p>}
              </div>

              {/* ACCIONES */}
              <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider opacity-70">Acciones Críticas</h4>
              <button onClick={coronateWinners} className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black rounded-lg text-xs mb-2 hover:from-yellow-400 hover:to-yellow-500 shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2">
                👑 Coronar Rey y Reina
              </button>
              <div className="grid grid-cols-2 gap-2">
                  <button onClick={initiateKickAll} className="w-full py-3 bg-slate-700 text-white font-bold rounded-lg text-xs hover:bg-slate-600 border border-slate-600">
                    🛑 Echar a Todos
                  </button>
                  <button onClick={initiateResetEvent} className="w-full py-3 bg-red-600/20 text-red-500 border border-red-500/50 font-bold rounded-lg text-xs hover:bg-red-600/30">
                    ♻️ REINICIAR EVENTO
                  </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
