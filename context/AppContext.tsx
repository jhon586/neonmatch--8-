
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, MatchRequest, Message, EventStatus } from '../types';
import { createSupabaseClient, getSupabaseConfig, saveSupabaseConfig } from '../lib/supabase';

interface AppContextType {
  currentUser: User | null;
  allUsers: User[];
  incomingLikes: MatchRequest[];
  matches: MatchRequest[];
  messages: Message[];
  isLoading: boolean;
  isConfigured: boolean;
  eventStatus: EventStatus;
  
  register: (name: string, bio: string, photoUrl: string | null) => Promise<void>;
  sendLike: (targetId: number) => Promise<{ success: boolean; message: string }>;
  respondToLike: (fromId: number, accept: boolean) => Promise<void>;
  sendMessage: (toId: number, text: string, type?: 'text'|'image'|'dedication', file?: File) => Promise<void>;
  logout: () => void;
  configureServer: (url: string, key: string) => void;
  
  // Admin Functions
  resetEvent: () => Promise<void>;
  kickAllUsers: () => Promise<void>;
  toggleEventStatus: (status: EventStatus) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SESSION_USER_ID_KEY = 'neonmatch_session_user_id';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabase, setSupabase] = useState<any>(() => createSupabaseClient());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(!!getSupabaseConfig());
  const [eventStatus, setEventStatus] = useState<EventStatus>('open');

  const configureServer = (url: string, key: string) => {
    saveSupabaseConfig(url.trim(), key.trim());
    const newClient = createSupabaseClient();
    setSupabase(newClient);
    setIsConfigured(!!newClient);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_USER_ID_KEY);
    window.location.reload();
  };

  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      // 1. Cargar Estado del Evento
      const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'event_status').single();
      if (settings) setEventStatus(settings.value as EventStatus);

      // 2. Cargar Usuarios
      const { data: usersData } = await supabase.from('users').select('*').order('id', { ascending: true });
      if (usersData) {
        const mappedUsers = usersData.map((u: any) => ({
          id: u.id,
          name: u.name,
          bio: u.bio,
          photoUrl: u.photo_url,
          joinedAt: u.joined_at
        }));
        setAllUsers(mappedUsers);

        const storedId = localStorage.getItem(SESSION_USER_ID_KEY);
        if (storedId) {
          const found = mappedUsers.find((u: User) => u.id === parseInt(storedId));
          if (found) setCurrentUser(found);
        }
      }

      // 3. Cargar Matches
      const { data: matchesData } = await supabase.from('matches').select('*');
      if (matchesData) {
        setMatchRequests(matchesData.map((m: any) => ({
          fromId: m.from_id,
          toId: m.to_id,
          status: m.status,
          timestamp: m.timestamp
        })));
      }

      // 4. Cargar Mensajes
      const { data: msgData } = await supabase.from('messages').select('*').order('timestamp', { ascending: true });
      if (msgData) {
        setMessages(msgData.map((m: any) => ({
          id: m.id.toString(),
          senderId: m.sender_id,
          receiverId: m.receiver_id,
          text: m.text,
          type: m.type || 'text',
          attachmentUrl: m.attachment_url,
          timestamp: m.timestamp
        })));
      }
    };

    fetchData();

    // CANAL DE COMANDOS GLOBALES (ADMIN KICK)
    const commandChannel = supabase.channel('global_commands')
      .on('broadcast', { event: 'force_logout' }, () => {
        console.log("Admin ha forzado el cierre de sesión");
        logout();
      })
      .subscribe();

    // CANAL DE CAMBIOS EN BASE DE DATOS
    const dbChannel = supabase.channel('public_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, (payload: any) => {
        if (payload.new && payload.new.key === 'event_status') {
           setEventStatus(payload.new.value as EventStatus);
           if (payload.new.value === 'closed' && !localStorage.getItem(SESSION_USER_ID_KEY)) {
             window.location.reload();
           }
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const newMsg = payload.new;
        setMessages(prev => {
           if (prev.some(m => m.id === newMsg.id.toString())) return prev;
           return [...prev, {
            id: newMsg.id.toString(),
            senderId: newMsg.sender_id,
            receiverId: newMsg.receiver_id,
            text: newMsg.text,
            type: newMsg.type || 'text',
            attachmentUrl: newMsg.attachment_url,
            timestamp: newMsg.timestamp
          }];
        });
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(commandChannel);
      supabase.removeChannel(dbChannel); 
    };
  }, [supabase]);

  const register = async (name: string, bio: string, photoUrl: string | null) => {
    if (!supabase) return;
    if (eventStatus === 'closed') {
      alert("El evento está cerrado. No se admiten nuevos registros.");
      return;
    }
    setIsLoading(true);
    const { data } = await supabase.from('users').insert([{ name, bio, photo_url: photoUrl }]).select().single();
    if (data) {
      const newUser: User = { id: data.id, name: data.name, bio: data.bio, photoUrl: data.photo_url, joinedAt: data.joined_at };
      setAllUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
      localStorage.setItem(SESSION_USER_ID_KEY, newUser.id.toString());
    }
    setIsLoading(false);
  };

  // --- ADMIN FUNCTIONS ---

  const resetEvent = async () => {
    if (!supabase) return;
    setIsLoading(true);
    
    // 1. Echar a todos antes de borrar
    await kickAllUsers();
    
    // 2. Intentar usar la función de base de datos para reinicio TOTAL (IDs a 1)
    const { error } = await supabase.rpc('reset_event');
    
    if (error) {
      console.warn("Función 'reset_event' no encontrada en Supabase. Borrando manualmente (IDs no se reiniciarán a 1).", error);
      // Fallback: Borrado manual (no reinicia contador)
      await supabase.from('messages').delete().neq('id', 0);
      await supabase.from('matches').delete().neq('id', 0);
      await supabase.from('users').delete().neq('id', 0);
    }
    
    // 3. Limpiar estado local
    setAllUsers([]);
    setMatchRequests([]);
    setMessages([]);
    setCurrentUser(null);
    setIsLoading(false);
    
    // Recargar para limpiar todo
    window.location.reload();
  };

  const kickAllUsers = async () => {
    if (!supabase) return;
    await supabase.channel('global_commands').send({
      type: 'broadcast',
      event: 'force_logout',
      payload: {}
    });
  };

  const toggleEventStatus = async (status: EventStatus) => {
    if (!supabase) return;
    await supabase.from('system_settings').upsert({ key: 'event_status', value: status });
    setEventStatus(status);
  };

  // --- STANDARD FUNCTIONS ---

  const sendLike = async (targetId: number): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || !supabase) return { success: false, message: 'Error de conexión' };
    if (targetId === currentUser.id) return { success: false, message: "¡No puedes votarte a ti mismo!" };

    const targetUser = allUsers.find(u => u.id === targetId);
    if (!targetUser) return { success: false, message: 'Ese número no existe todavía.' };

    const existing = matchRequests.find(r => (r.fromId === currentUser.id && r.toId === targetId) || (r.fromId === targetId && r.toId === currentUser.id));
    if (existing) return { success: false, message: 'Ya habéis interactuado.' };

    await supabase.from('matches').insert([{ from_id: currentUser.id, to_id: targetId, status: 'pending' }]);
    return { success: true, message: `¡Has votado al Número ${targetId}!` };
  };

  const respondToLike = async (fromId: number, accept: boolean) => {
    if (!currentUser || !supabase) return;
    const status = accept ? 'accepted' : 'rejected';
    
    setMatchRequests(prev => prev.map(m => {
      if (m.fromId === fromId && m.toId === currentUser.id) return { ...m, status: status as any };
      return m;
    }));
    
    await supabase.from('matches').update({ status: status }).eq('from_id', fromId).eq('to_id', currentUser.id);
  };

  const sendMessage = async (toId: number, text: string, type: 'text'|'image'|'dedication' = 'text', file?: File) => {
    if (!currentUser || !supabase) return;

    let attachmentUrl = null;

    if (file && type === 'image') {
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.storage.from('chat-images').upload(fileName, file);
      
      if (!error && data) {
         const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
         attachmentUrl = urlData.publicUrl;
      }
    }

    const tempId = Date.now().toString();
    const newMsg: Message = {
      id: tempId,
      senderId: currentUser.id,
      receiverId: toId,
      text,
      type,
      attachmentUrl: attachmentUrl || undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMsg]);

    const { data } = await supabase.from('messages').insert([{
      sender_id: currentUser.id,
      receiver_id: toId,
      text: text,
      type: type,
      attachment_url: attachmentUrl
    }]).select().single();
    
    if (data) {
       setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id.toString() } : m));
    }
  };

  const incomingLikes = matchRequests.filter(req => req.toId === currentUser?.id && req.status === 'pending');
  const matches = matchRequests.filter(req => (req.fromId === currentUser?.id || req.toId === currentUser?.id) && req.status === 'accepted');

  return (
    <AppContext.Provider value={{
      currentUser, allUsers, incomingLikes, matches, messages, isLoading, isConfigured, eventStatus,
      register, sendLike, respondToLike, sendMessage, logout, resetEvent, configureServer, kickAllUsers, toggleEventStatus
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
