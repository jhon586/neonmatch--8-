
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getWingmanSuggestion } from '../services/geminiService';

export const ChatInterface: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUser, matches, allUsers, messages, sendMessage } = useApp();
  
  const [activePartnerId, setActivePartnerId] = useState<number | null>(() => {
    const stored = localStorage.getItem('neonmatch_open_chat');
    if (stored) {
      localStorage.removeItem('neonmatch_open_chat');
      return parseInt(stored);
    }
    return null;
  });

  const [inputText, setInputText] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isGettingSuggestion, setIsGettingSuggestion] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null); // State for lightbox
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPartnerId = (req: any) => req.fromId === currentUser?.id ? req.toId : req.fromId;

  // Auto-select
  useEffect(() => {
    if (!activePartnerId && matches.length > 0) setActivePartnerId(getPartnerId(matches[0]));
  }, [matches, activePartnerId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activePartnerId]);

  if (!currentUser) return null;

  const activePartner = allUsers.find(u => u.id === activePartnerId);
  
  const currentChatMessages = messages.filter(m => 
    (m.senderId === currentUser.id && m.receiverId === activePartnerId) ||
    (m.senderId === activePartnerId && m.receiverId === currentUser.id)
  ).sort((a, b) => a.timestamp - b.timestamp);

  const handleSend = (text: string = inputText, type: 'text'|'dedication'|'image' = 'text') => {
    if ((!text.trim() && type !== 'image') || !activePartnerId) return;
    sendMessage(activePartnerId, text, type);
    setInputText('');
    setSuggestion(null);
    setShowTools(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePartnerId) {
      sendMessage(activePartnerId, "📷 Foto enviada", "image", file);
      setShowTools(false);
    }
  };

  const handleDedicateSong = () => {
    const song = prompt("¿Qué canción quieres dedicarle?");
    if (song && activePartnerId) {
      sendMessage(activePartnerId, `🎵 Te dedico: ${song}`, "dedication");
      setShowTools(false);
    }
  };

  const handleSendWhatsApp = () => {
    const phone = prompt("Introduce tu número de WhatsApp (con prefijo):");
    if (phone && activePartnerId) {
       const link = `https://wa.me/${phone.replace('+', '')}`;
       sendMessage(activePartnerId, `📞 ¡Hablemos por WhatsApp! ${link}`, "text");
       setShowTools(false);
    }
  };

  const handleWingman = async () => {
    if (!activePartner) return;
    setIsGettingSuggestion(true);
    const lastMsgs = currentChatMessages.slice(-5).map(m => ({
      sender: m.senderId === currentUser.id ? 'Yo' : 'Ella/Él',
      text: m.text
    }));
    
    const sug = await getWingmanSuggestion(currentUser.bio, activePartner.bio, lastMsgs);
    setSuggestion(sug);
    setIsGettingSuggestion(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 max-w-md mx-auto relative">
      {/* Lightbox Modal for Images */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-2 animate-fade-in-up"
          onClick={() => setEnlargedImage(null)}
        >
          <button className="absolute top-4 right-4 text-white p-2 bg-slate-800 rounded-full z-50">✕</button>
          <img 
            src={enlargedImage} 
            className="max-w-full max-h-full object-contain rounded-lg" 
            alt="Ampliada"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
            onContextMenu={(e) => e.preventDefault()} // Disable right click
          />
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 p-4 flex items-center gap-4 border-b border-slate-700 shadow-lg z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        
        <div className="flex-1 overflow-x-auto scrollbar-hide flex gap-3">
          {matches.map(m => {
            const pid = getPartnerId(m);
            const p = allUsers.find(u => u.id === pid);
            if (!p) return null;
            const isActive = pid === activePartnerId;
            return (
              <div key={pid} onClick={() => setActivePartnerId(pid)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all whitespace-nowrap ${isActive ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                 <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-600"><img src={p.photoUrl || ''} className="w-full h-full object-cover" /></div>
                 <span className="text-sm font-bold">#{p.id}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900">
        {activePartner ? (
          <>
             <div className="text-center py-6 opacity-50">
                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden mb-2"><img src={activePartner.photoUrl || ''} className="w-full h-full object-cover" /></div>
                <p className="text-sm">Match con <span className="font-bold">{activePartner.name}</span></p>
             </div>

             {currentChatMessages.map(msg => {
               const isMe = msg.senderId === currentUser.id;
               const isDedication = msg.type === 'dedication';
               const isImage = msg.type === 'image';
               
               return (
                 <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                     isMe ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'
                   } ${isDedication ? 'border-2 border-yellow-400 bg-slate-900 bg-none' : ''}`}>
                     
                     {isDedication && <div className="text-yellow-400 font-bold mb-1">🎵 Dedicatoria</div>}
                     
                     {isImage ? (
                        msg.attachmentUrl ? (
                          <div className="relative group cursor-pointer" onClick={() => setEnlargedImage(msg.attachmentUrl || null)}>
                            <img 
                              src={msg.attachmentUrl} 
                              className="rounded-lg max-h-48 w-full object-cover border border-white/10" 
                              alt="adjunto" 
                              onContextMenu={(e) => e.preventDefault()}
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                              <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded-full">🔍 Ampliar</span>
                            </div>
                          </div>
                        ) : <span className="italic opacity-70">Subiendo foto...</span>
                     ) : (
                       // Detectar enlaces (como whatsapp)
                       msg.text.includes('https://') ? 
                         <a href={msg.text.match(/https:\/\/[^\s]+/)?.[0]} target="_blank" className="underline hover:text-blue-300">{msg.text}</a> : 
                         msg.text
                     )}
                   </div>
                 </div>
               );
             })}
             <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">Selecciona un match</div>
        )}
      </div>

      {/* Input Area */}
      {activePartner && (
        <div className="p-4 bg-slate-800 border-t border-slate-700 relative">
          
          {/* Tools Menu */}
          {showTools && (
            <div className="absolute bottom-20 left-4 bg-slate-700 rounded-xl shadow-xl p-2 flex flex-col gap-2 animate-fade-in-up mb-2 z-20">
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-600 rounded-lg text-white">
                <span>📷</span> Enviar Foto
              </button>
              <button onClick={handleDedicateSong} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-600 rounded-lg text-yellow-300">
                <span>🎵</span> Dedicar Canción
              </button>
              <button onClick={handleSendWhatsApp} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-600 rounded-lg text-green-400">
                <span>📞</span> Enviar WhatsApp
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>
          )}

          {suggestion && (
            <div className="mb-3 animate-fade-in-up bg-indigo-900/50 border border-indigo-500/30 rounded-lg p-3 flex justify-between items-center">
                <p className="text-xs text-indigo-200 italic mr-2">" {suggestion} "</p>
                <button onClick={() => { setInputText(suggestion); setSuggestion(null); }} className="text-xs font-bold text-indigo-400">Usar</button>
            </div>
          )}

          <div className="flex gap-2 items-center">
             <button onClick={() => setShowTools(!showTools)} className={`p-2 rounded-full transition-colors ${showTools ? 'bg-pink-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
             </button>

             <button onClick={handleWingman} disabled={isGettingSuggestion} className="p-2 rounded-full bg-slate-700 text-yellow-400">
               {isGettingSuggestion ? <span className="animate-spin block">✨</span> : <span>✨</span>}
             </button>
             
             <input 
               className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-white focus:outline-none focus:border-pink-500"
               placeholder="Escribe..."
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
             />
             
             <button onClick={() => handleSend()} disabled={!inputText.trim()} className="p-2 rounded-full bg-pink-600 text-white disabled:opacity-50">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
