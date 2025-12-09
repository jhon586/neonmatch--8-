import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, MatchRequest, Message, EventStatus, Report } from '../types';
import { createSupabaseClient, getSupabaseConfig, saveSupabaseConfig } from '../lib/supabase';

interface AppContextType {
  currentUser: User | null;
  allUsers: User[];
  incomingLikes: MatchRequest[];
  matches: MatchRequest[];
  messages: Message[];
  reports: Report[];
  isLoading: boolean;
  isConfigured: boolean;
  eventStatus: EventStatus;
  winners: { king: User | null; queen: User | null } | null;
  
  register: (name: string, bio: string, photoUrl: string | null) => Promise<void>;
  sendLike: (targetId: number) => Promise<{ success: boolean; message: string }>;
  respondToLike: (fromId: number, accept: boolean) => Promise<void>;
  sendMessage: (toId: number, text: string, type?: 'text'|'image'|'dedication', file?: File) => Promise<void>;
  reportUser: (reportedId: number, reason: string) => Promise<void>;
  logout: () => Promise<void>;
  configureServer: (url: string, key: string) => void;
  
  // Admin Functions
  resetEvent: () => Promise<void>;
  kickAllUsers: () => Promise<void>;
  kickSpecificUser: (targetId: number) => Promise<void>;
  toggleEventStatus: (status: EventStatus) => Promise<void>;
  coronateWinners: () => Promise<void>;
  resolveReport: (reportId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SESSION_USER_ID_KEY = 'neonmatch_session_user_id';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabase, setSupabase] = useState<any>(() => createSupabaseClient());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reports, setReports] = useState<Report[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(!!getSupabaseConfig());
  const [eventStatus, setEventStatus] = useState<EventStatus>('open');
  const [winners, setWinners] = useState<{ king: User | null; queen: User | null } | null>(null);

  const commandChannelRef = useRef<any>(null);
  // Keep track of kicked simulated IDs so they don't respawn on refetch
  const kickedSimulatedIdsRef = useRef<Set<number>>(new Set());

  const configureServer = (url: string, key: string) => {
    saveSupabaseConfig(url.trim(), key.trim());
    const newClient = createSupabaseClient();
    setSupabase(newClient);
    setIsConfigured(!!newClient);
  };

  const logout = async () => {
    // Limpieza local inmediata
    setCurrentUser(null);
    localStorage.removeItem(SESSION_USER_ID_KEY);
    
    // Si hay conexión, intentar limpiar rastro en DB (opcional, el admin suele hacerlo)
    if (currentUser && supabase) {
        try {
            // No bloqueamos el logout por fallos de DB
            supabase.from('matches').delete().or(`from_id.eq.${currentUser.id},to_id.eq.${currentUser.id}`).then(() => {});
            supabase.from('users').delete().eq('id', currentUser.id).then(() => {});
        } catch (e) {
            console.error("Logout cleanup error", e);
        }
    }
    window.location.reload();
  };

  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'event_status').single();
      if (settings) setEventStatus(settings.value as EventStatus);

      const { data: usersData } = await supabase.from('users').select('*').order('id', { ascending: true });
      if (usersData) {
        let mappedUsers = usersData.map((u: any) => ({
          id: u.id,
          name: u.name,
          bio: u.bio,
          photoUrl: u.photo_url,
          joinedAt: u.joined_at
        }));

        // --- SIMULATED USERS INJECTION (For Testing) ---
        const simulatedUsers: User[] = [
            {
                id: 68,
                name: "Elena (Sim)",
                bio: "Viviendo la vida loca. 💃",
                photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
                joinedAt: Date.now()
            },
            {
                id: 79,
                name: "Marcos (Sim)",
                bio: "Busco a mi player 2. 🎮",
                photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80",
                joinedAt: Date.now()
            }
        ];

        // Add simulated users if they don't exist in DB data AND haven't been kicked locally
        simulatedUsers.forEach(sim => {
            if (!mappedUsers.some((u: User) => u.id === sim.id) && !kickedSimulatedIdsRef.current.has(sim.id)) {
                mappedUsers.push(sim);
            }
        });
        
        // Re-sort by ID
        mappedUsers.sort((a: User, b: User) => a.id - b.id);

        setAllUsers(mappedUsers);

        const storedId = localStorage.getItem(SESSION_USER_ID_KEY);
        if (storedId) {
          const found = mappedUsers.find((u: User) => u.id === parseInt(storedId));
          if (found) setCurrentUser(found);
          else {
             // Si tengo ID guardado pero no estoy en la DB, me han borrado.
             localStorage.removeItem(SESSION_USER_ID_KEY);
             setCurrentUser(null);
          }
        }
      }

      const { data: matchesData } = await supabase.from('matches').select('*');
      if (matchesData) {
        setMatchRequests(matchesData.map((m: any) => ({
          fromId: m.from_id,
          toId: m.to_id,
          status: m.status,
          timestamp: m.timestamp
        })));
      }

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

    const commandChannel = supabase.channel('global_commands')
      .on('broadcast', { event: 'force_logout' }, () => {
        // Escuchar orden de desalojo total
        console.log("Recibida orden de desalojo total");
        localStorage.removeItem(SESSION_USER_ID_KEY);
        window.location.reload();
      })
      .on('broadcast', { event: 'force_logout_specific' }, (payload: any) => {
         // Escuchar orden de desalojo personal
         const myId = parseInt(localStorage.getItem(SESSION_USER_ID_KEY) || '0');
         if (payload.payload && payload.payload.targetId === myId) {
             alert("Has sido expulsado de la fiesta.");
             localStorage.removeItem(SESSION_USER_ID_KEY);
             window.location.reload();
         }
      })
      .on('broadcast', { event: 'coronation' }, (payload: any) => {
         setWinners(payload.payload);
         setTimeout(() => setWinners(null), 15000); 
      })
      .on('broadcast', { event: 'new_report' }, (payload: any) => {
         setReports(prev => [...prev, payload.payload]);
      })
      .subscribe();
    
    commandChannelRef.current = commandChannel;

    const dbChannel = supabase.channel('public_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, (payload: any) => {
        if (payload.new && payload.new.key === 'event_status') {
           setEventStatus(payload.new.value as EventStatus);
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
      commandChannelRef.current = null;
    };
  }, [supabase]);

  const register = async (name: string, bio: string, photoUrl: string | null) => {
    if (!supabase) return;
    setIsLoading(true);

    const { data: existingUsers } = await supabase.from('users').select('id').order('id', { ascending: true });
    
    let newId = 1;
    if (existingUsers && existingUsers.length > 0) {
        const ids = existingUsers.map((u: any) => u.id);
        for (let i = 0; i < ids.length; i++) {
            if (ids[i] !== i + 1) {
                newId = i + 1; 
                break;
            }
        }
        if (newId === 1 && ids.length > 0 && ids[0] === 1 && ids[ids.length - 1] === ids.length) {
            newId = ids.length + 1;
        }
    }

    const { data, error } = await supabase.from('users').insert([{ 
        id: newId,
        name, 
        bio, 
        photo_url: photoUrl 
    }]).select().single();

    if (error) {
        console.error("Error creating user:", error);
        alert("Error al registrarse. Inténtalo de nuevo.");
        setIsLoading(false);
        return;
    }

    if (data) {
      const newUser: User = { id: data.id, name: data.name, bio: data.bio, photoUrl: data.photo_url, joinedAt: data.joined_at };
      setAllUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
      localStorage.setItem(SESSION_USER_ID_KEY, newUser.id.toString());
    }
    setIsLoading(false);
  };

  const reportUser = async (reportedId: number, reason: string) => {
      if (!currentUser || !supabase) return;
      const report: Report = {
          id: Date.now().toString(),
          reporterId: currentUser.id,
          reportedId,
          reason,
          timestamp: Date.now(),
          status: 'pending'
      };
      // Enviar señal a admins
      const channel = commandChannelRef.current || supabase.channel('global_commands');
      await channel.send({
          type: 'broadcast',
          event: 'new_report',
          payload: report
      });
  };

  const resolveReport = async (reportId: string) => {
      setReports(prev => prev.filter(r => r.id !== reportId));
  };

  // --- ADMIN FUNCTIONS ---

  const kickSpecificUser = async (targetId: number) => {
      // 1. OPTIMISTIC UPDATE: Update UI immediately
      setAllUsers(prev => prev.filter(u => u.id !== targetId));
      kickedSimulatedIdsRef.current.add(targetId);

      if (!supabase) return;

      try {
          const channel = commandChannelRef.current || supabase.channel('global_commands');
          // Broadcast eviction to trigger logout on client side
          channel.send({
              type: 'broadcast',
              event: 'force_logout_specific',
              payload: { targetId }
          }).catch((err: any) => console.error("Broadcast error (non-fatal):", err));

          // 2. DATABASE: Clean up in background
          await supabase.from('messages').delete().or(`sender_id.eq.${targetId},receiver_id.eq.${targetId}`);
          await supabase.from('matches').delete().or(`from_id.eq.${targetId},to_id.eq.${targetId}`);
          await supabase.from('users').delete().eq('id', targetId);
      } catch (e) {
          console.warn("DB Cleanup warning (ignoring as UI is updated):", e);
      }
  };

  const kickAllUsers = async () => {
    // 1. OPTIMISTIC UPDATE: Clear everything immediately
    setAllUsers([]);
    setMatchRequests([]);
    setMessages([]);
    setReports([]);
    
    // Prevent simulated users from respawning
    [68, 79].forEach(id => kickedSimulatedIdsRef.current.add(id));
    
    if (!supabase) return;
    
    try {
        const channel = commandChannelRef.current || supabase.channel('global_commands');
        channel.send({
            type: 'broadcast',
            event: 'force_logout',
            payload: {}
        }).catch((err: any) => console.error("Broadcast error (non-fatal):", err));

        // 2. DATABASE: Mass delete
        await supabase.from('messages').delete().gt('id', 0); 
        await supabase.from('matches').delete().gt('id', 0);
        await supabase.from('users').delete().gt('id', 0);
    } catch (e) {
        console.error("Error borrando DB (ignoring as UI is updated):", e);
    }
  };

  const resetEvent = async () => {
    // Optimistic clear
    setAllUsers([]);
    if (!supabase) {
       window.location.reload();
       return;
    }
    
    try {
        await kickAllUsers(); // Also handles local state clear
        await supabase.from('system_settings').delete().neq('key', 'keep_alive');
        window.location.reload();
    } catch (e) {
        console.error("Error resetting DB:", e);
        // Ensure UI reload even on error
        window.location.reload();
    }
  };

  const toggleEventStatus = async (status: EventStatus) => {
    if (!supabase) return;
    setEventStatus(status); // Optimistic UI
    
    await supabase.from('system_settings').upsert({ key: 'event_status', value: status });
    
    if (status === 'closed') {
        // Opcional: Echar a todos al cerrar
        await kickAllUsers();
    }
  };

  const coronateWinners = async () => {
      const likeCounts: { [key: number]: number } = {};
      matchRequests.forEach(m => {
          likeCounts[m.toId] = (likeCounts[m.toId] || 0) + 1;
      });

      const sortedUsers = [...allUsers].sort((a, b) => {
          return (likeCounts[b.id] || 0) - (likeCounts[a.id] || 0);
      });

      if (sortedUsers.length < 2) {
          alert("Necesitas al menos 2 usuarios con votos.");
          return;
      }

      const k = sortedUsers[0];
      const q = sortedUsers[1];
      const payload = { king: k, queen: q };

      setWinners(payload);
      setTimeout(() => setWinners(null), 15000);

      const channel = commandChannelRef.current || supabase.channel('global_commands');
      await channel.send({
          type: 'broadcast',
          event: 'coronation',
          payload: payload
      });
  };

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
      currentUser, allUsers, incomingLikes, matches, messages, reports, isLoading, isConfigured, eventStatus, winners,
      register, sendLike, respondToLike, sendMessage, reportUser, logout, resetEvent, configureServer, kickAllUsers, kickSpecificUser, toggleEventStatus, coronateWinners, resolveReport
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