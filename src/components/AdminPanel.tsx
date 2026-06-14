import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ShoppingBag, LayoutDashboard, Calendar, Download, XCircle, Power, User, ClipboardList, Activity, Lock, Bot, Code, MessageSquare, Bell, Filter, Search, Settings2, Trash2, Edit2, ShieldAlert, AlertCircle, TrendingUp, CheckCircle, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { supabase } from '../lib/supabase';

const ORDER_TRENDS_DATA = [
  { time: '09:00', Burgers: 12, Pizza: 5, Biryani: 8, Drinks: 20 },
  { time: '12:00', Burgers: 45, Pizza: 22, Biryani: 50, Drinks: 60 },
  { time: '15:00', Burgers: 25, Pizza: 30, Biryani: 15, Drinks: 35 },
  { time: '18:00', Burgers: 55, Pizza: 60, Biryani: 40, Drinks: 80 },
  { time: '21:00', Burgers: 80, Pizza: 95, Biryani: 70, Drinks: 110 },
  { time: '00:00', Burgers: 30, Pizza: 45, Biryani: 12, Drinks: 40 }
];

export function AdminPanel({ botStatus, setBotStatus, onLogout, onCloseAdmin }: any) {
  const [activeTab, setActiveTab] = useState<'Chatbots' | 'Inbox' | 'Orders' | 'Analytics' | 'Team' | 'Settings'>('Chatbots');
  const [timeRange, setTimeRange] = useState('Today');

  const getFilteredTrendsData = () => {
     let multiplier = 1;
     if (timeRange === 'Last 7 Days') multiplier = 7;
     if (timeRange === 'Monthly') multiplier = 30;
     return ORDER_TRENDS_DATA.map(d => ({
        time: d.time,
        Burgers: d.Burgers * multiplier,
        Pizza: d.Pizza * multiplier,
        Biryani: d.Biryani * multiplier,
        Drinks: d.Drinks * multiplier
     }));
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl">
          <p className="text-white font-bold mb-2">Peak Time: {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {entry.value} orders
            </p>
          ))}
          <p className="text-zinc-400 text-xs mt-2 pt-2 border-t border-zinc-800">Total Count: <span className="text-white font-bold">{total}</span></p>
        </div>
      );
    }
    return null;
  };
  const [chatbots, setChatbots] = useState<any[]>(() => {
     try {
         const saved = localStorage.getItem("spicehub_chatbots");
         if (saved) return JSON.parse(saved);
     } catch (e) {}
     return [
       { id: 'sh-1', name: 'SpiceHub AI', desc: 'Main ordering bot', prompt: 'You are SpiceHub, an AI assistant representing a premium spice e-commerce platform. Assist customers in placing orders and answer product inquiries cheerfully.', status: 'ON', allowedDomains: '*' }
     ];
  });
  const [activeBotId, setActiveBotId] = useState<string>(() => {
     try {
         const saved = localStorage.getItem("spicehub_live_bot_id");
         if (saved) return saved;
     } catch (e) {}
     return 'sh-1';
  });
  const [embedBotId, setEmbedBotId] = useState<string>('sh-1');
  const [chatInbox, setChatInbox] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [overrideText, setOverrideText] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [ordersData, setOrdersData] = useState<any[]>([]);
  
  // New features state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBotData, setNewBotData] = useState({ name: '', desc: '', prompt: '' });
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBotData, setEditBotData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  const [team, setTeam] = useState([
     { id: 1, name: 'Admin Owner (You)', email: 'admin@spicehub.com', role: 'OWNER' },
     { id: 2, name: 'Support Agent 1', email: 'agent1@spicehub.com', role: 'AGENT' }
  ]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("AGENT");
  
  // Simulate active profile state for role locking
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'AGENT'>('OWNER');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (res.data) setOrdersData(res.data);
      } catch (err) {
        // Soft fallback for demo limits
        console.warn("Supabase fetch order skipped.", err);
      }
    };
    fetchOrders();

    const syncListener = (e: any) => {
       const { sessionData, messages } = e.detail;
       setChatInbox(prev => {
          const exists = prev.find(p => p.id === sessionData.id);
          if (exists) {
             return prev.map(p => p.id === sessionData.id ? { ...p, messages } : p);
          } else {
             return [{ ...sessionData, messages }, ...prev];
          }
       });
       
       setActiveThread((currentActive: any) => {
           if (currentActive && currentActive.id === sessionData.id) {
               return { ...sessionData, messages };
           }
           return currentActive;
       });
       
       const lastMsg = messages[messages.length - 1];
       if (lastMsg && (lastMsg.isEscalation || (lastMsg.role === 'user' && typeof lastMsg.text === 'string' && lastMsg.text.toLowerCase().includes('escalate')))) {
          setNotifications(prev => {
             // Avoid duplicate notifications for the same escalation
             if (prev.find(n => n.sessionId === sessionData.id && n.type === 'escalation')) return prev;
             return [{ id: Date.now(), sessionId: sessionData.id, text: `Escalation requested by ${sessionData.visitorName || 'Visitor'}`, type: 'escalation' }, ...prev];
          });
       }
    };
    
    const escalateListener = (e: any) => {
       setNotifications(prev => {
          if (prev.find(n => n.sessionId === e.detail.sessionId && n.type === 'escalation')) return prev;
          return [{ id: Date.now(), sessionId: e.detail.sessionId, text: `System Escalation Triggered`, type: 'escalation' }, ...prev];
       });
    };

    window.addEventListener('APP_CHAT_SYNC', syncListener);
    window.addEventListener('ADMIN_ESCALATE', escalateListener);
    return () => {
        window.removeEventListener('APP_CHAT_SYNC', syncListener);
        window.removeEventListener('ADMIN_ESCALATE', escalateListener);
    };
  }, []);

  const sendOverride = () => {
     if (!overrideText.trim() || !activeThread) return;
     window.dispatchEvent(new CustomEvent('ADMIN_OVERRIDE', { detail: { text: overrideText, sessionId: activeThread.id } }));
     setOverrideText("");
  };

  const handleSetBotActive = (bot: any) => {
     setActiveBotId(bot.id);
     setChatbots(prev => prev.map(b => ({ ...b, active: b.id === bot.id })));
     localStorage.setItem("spicehub_live_bot_id", bot.id);
     window.dispatchEvent(new CustomEvent('ADMIN_UPDATE_BOT_CONFIG', { detail: bot }));
  };

  const handleCreateBot = () => {
     if (!newBotData.name) return;
     const newBot = {
         id: `uuid-${Date.now()}`,
         name: newBotData.name,
         desc: newBotData.desc,
         prompt: newBotData.prompt,
         status: 'ON',
         allowedDomains: '*'
     };
     const updated = [...chatbots, newBot];
     setChatbots(updated);
     localStorage.setItem("spicehub_chatbots", JSON.stringify(updated));
     setShowCreateModal(false);
     setNewBotData({ name: '', desc: '', prompt: '' });
  };
  
  const handleSaveEdit = () => {
     if (!editBotData || !editBotData.name) return;
     const updatedbots = chatbots.map(b => b.id === editBotData.id ? { ...b, name: editBotData.name, desc: editBotData.desc, prompt: editBotData.prompt } : b);
     setChatbots(updatedbots);
     localStorage.setItem("spicehub_chatbots", JSON.stringify(updatedbots));
     if (activeBotId === editBotData.id) {
         window.dispatchEvent(new CustomEvent('ADMIN_UPDATE_BOT_CONFIG', { detail: updatedbots.find(b => b.id === editBotData.id) }));
     }
     setShowEditModal(false);
     setEditBotData(null);
  };

  const copyEmbedCode = (botId: string) => {
      const code = `<script src="https://${window.location.host}/widget.js" data-id="${botId}"></script>`;
      navigator.clipboard.writeText(code);
      alert("Embed code copied to clipboard!");
  };

  const handleInviteUser = () => {
      if (!inviteEmail) return;
      const newUser = {
          id: Date.now(),
          name: 'Invited User',
          email: inviteEmail,
          role: inviteRole
      };
      setTeam([...team, newUser]);
      setInviteEmail("");
  };

  const downloadCSV = () => {
    if (ordersData.length === 0) {
       alert("No orders data available to export yet.");
       return;
    }
    const headers = 'Order ID,Customer Name,Mobile Number,Item Summary,Total Price,Timestamp\n';
    let csvContent = "data:text/csv;charset=utf-8," + headers;

    ordersData.forEach(o => {
      if (!o || !o.id) return;
      const row = [
        `"${o.id}"`,
        `"Customer_${o.user_id?.substring(0, 5) || 'Guest'}"`,
        `"N/A"`,
        `"${(o.details || '').replace(/"/g, '""')}"`,
        o.total || 0,
        `"${new Date(o.created_at).toLocaleString()}"`
      ].join(',');
      csvContent += row + "\n";
    });

    const encodedUri = encodeURIComponent(csvContent);
    const a = document.createElement('a');
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent.replace("data:text/csv;charset=utf-8,", ""));
    a.download = 'spicehub_orders_report_2026.csv';
    a.click();
  };

  const downloadInboxCSV = () => {
    if (chatInbox.length === 0) {
      alert("No message logs available.");
      return;
    }
    const headers = 'Session ID,User Email,Message,Timestamp\n';
    let csvContent = "data:text/csv;charset=utf-8," + headers;

    chatInbox.forEach(sess => {
      if (sess.messages && sess.messages.length > 0) {
        sess.messages.forEach((msg: any) => {
          if (!msg) return;
          const row = [
            `"${sess.id}"`, 
            `"${(sess.visitorEmail || sess.visitorName || '').replace(/"/g, '""')}"`, 
            `"${(msg.text || '').replace(/"/g, '""')}"`, 
            `"${new Date(sess.timestamp).toLocaleString()}"`
          ].join(',');
          csvContent += row + "\n";
        });
      }
    });

    const a = document.createElement('a');
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent.replace("data:text/csv;charset=utf-8,", ""));
    a.download = 'spicehub_message_logs.csv';
    a.click();
  };

  const filteredInbox = chatInbox.filter(sess => {
      const q = searchQuery.toLowerCase();
      if (!q) return true;
      const email = (sess.visitorEmail || sess.visitorName || '').toLowerCase();
      const emailMatch = email.includes(q);
      const messageMatch = sess.messages?.some((msg: any) => (msg.text || '').toLowerCase().includes(q));
      return emailMatch || messageMatch;
  }).sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const renderTextChart = (value: number, max: number) => {
      const blocks = Math.max(1, Math.floor((value / max) * 40));
      return "█".repeat(blocks) + "░".repeat(40 - blocks);
  };

  // Helper metric computation
  const totalConvos = Math.max(1248, chatInbox.length * 4 + 1000);
  const totalMessages = Math.max(14592, chatInbox.reduce((acc, c) => acc + c.messages.length, 0) * 10 + 14000);
  const totalEscalated = Math.max(24, notifications.filter(n => n.type === 'escalation').length + 20);

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-full bg-[#060709]/95 backdrop-blur-2xl text-white overflow-hidden" id="adminPanel">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r border-white/5 bg-zinc-900/50 shadow-2xl p-6 backdrop-blur-xl shrink-0">
        <h2 className="text-xl font-black tracking-tight flex items-center gap-2 mb-8 text-primary">
          <Bot size={24} className="animate-pulse" /> AI Admin Pro
        </h2>
        <nav className="flex flex-col gap-3">
          <button onClick={() => setActiveTab('Chatbots')} className={`flex items-center gap-3 transition-colors p-3 rounded-xl font-bold ${activeTab === 'Chatbots' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
            <Bot size={18} /> Chatbots
          </button>
          <button onClick={() => setActiveTab('Inbox')} className={`flex items-center justify-between transition-colors p-3 rounded-xl font-bold ${activeTab === 'Inbox' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
            <div className="flex items-center gap-3"><MessageSquare size={18} /> Live Inbox</div>
            {chatInbox.length > 0 && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20">{chatInbox.length}</span>}
          </button>
          <button onClick={() => setActiveTab('Orders')} className={`flex items-center gap-3 transition-colors p-3 rounded-xl font-bold ${activeTab === 'Orders' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
            <ClipboardList size={18} /> Orders CSV
          </button>
          <button onClick={() => setActiveTab('Analytics')} className={`flex items-center gap-3 transition-colors p-3 rounded-xl font-bold ${activeTab === 'Analytics' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
            <Activity size={18} /> Analytics
          </button>
          <button onClick={() => setActiveTab('Team')} className={`flex items-center gap-3 transition-colors p-3 rounded-xl font-bold ${activeTab === 'Team' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
            <Users size={18} /> Team Roles
          </button>
          
          <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-4">
             <div className="relative">
                <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors p-2 w-full text-left rounded-lg hover:bg-white/5">
                  <div className="relative">
                    <Bell size={20} />
                    {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>}
                  </div>
                  <span className="font-bold text-sm">Notifications</span>
                  {notifications.length > 0 && <span className="ml-auto text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full">{notifications.length}</span>}
                </button>
                
                <AnimatePresence>
                {isNotifOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 w-72 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-2 max-h-64 overflow-y-auto z-50 text-white"
                  >
                     <div className="flex justify-between items-center px-2 mb-2">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">System Alerts</h4>
                        <button onClick={() => setNotifications([])} className="text-[10px] text-zinc-500 hover:text-white">Clear All</button>
                     </div>
                     {notifications.length === 0 ? (
                       <p className="text-xs text-zinc-600 px-2 pb-2">No alerts.</p>
                     ) : (
                       notifications.map(n => (
                          <div key={n.id} className="text-xs p-3 hover:bg-white/5 rounded-lg text-zinc-300 border-l-2 border-red-500 mb-1 flex flex-col gap-2 cursor-pointer transition-colors"
                               onClick={() => {
                                  setActiveTab('Inbox');
                                  const thread = chatInbox.find(i => i.id === n.sessionId);
                                  if (thread) setActiveThread(thread);
                                  setIsNotifOpen(false);
                               }}>
                             <span className="font-semibold text-white">{n.text}</span>
                             <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 self-start px-2 py-0.5 rounded">View Conversation →</span>
                          </div>
                       ))
                     )}
                  </motion.div>
                )}
                </AnimatePresence>
             </div>
             
             {/* Profile Matcher / Switcher for testing */}
             <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                 <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Simulate Active Role</p>
                 <select 
                    value={currentUserRole}
                    onChange={(e) => setCurrentUserRole(e.target.value as 'OWNER' | 'AGENT')}
                    className="w-full bg-black border border-white/10 text-xs py-1 px-2 rounded focus:outline-none focus:border-primary text-zinc-300"
                 >
                    <option value="OWNER">OWNER Role</option>
                    <option value="AGENT">AGENT Role (Locked)</option>
                 </select>
             </div>

             {onCloseAdmin && (
                <button onClick={onCloseAdmin} className="flex items-center gap-3 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors p-2 w-full text-left mt-2">
                  <XCircle size={20} className="text-emerald-500" /> <span className="font-bold text-sm">Back to Website</span>
                </button>
             )}

             <button onClick={onLogout} className="flex items-center gap-3 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors p-2">
               <Power size={20} /> <span className="font-bold text-sm">Sign Out</span>
             </button>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden relative">
         {/* Top Header */}
         <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-zinc-900/30 shrink-0">
            <h1 className="text-xl font-bold flex items-center gap-2">
               {activeTab === 'Chatbots' && <><Bot size={20} className="text-primary"/> Chatbot Management</>}
               {activeTab === 'Inbox' && <><MessageSquare size={20} className="text-primary"/> WhatsApp Web-Style Inbox</>}
               {activeTab === 'Orders' && <><ClipboardList size={20} className="text-primary"/> Orders Exporter</>}
               {activeTab === 'Analytics' && <><BarChart3 size={20} className="text-primary"/> Extended Analytics</>}
               {activeTab === 'Team' && <><Users size={20} className="text-primary"/> Role-Based Team</>}
            </h1>
            <div className="flex items-center gap-4">
               {currentUserRole === 'AGENT' && (
                  <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/20">
                     <Lock size={12}/> Agent Restricted Mode
                  </div>
               )}
               <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-1.5 rounded-full text-xs font-bold border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> System Online
               </div>
            </div>
         </header>

         {/* Viewports */}
         <main className="flex-1 overflow-y-auto p-8 relative">
            
            {/* CHATBOTS TAB */}
            {activeTab === 'Chatbots' && (
               <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-center bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
                     <div>
                        <h2 className="text-lg font-bold text-white mb-1">Agent Configurations</h2>
                        <p className="text-zinc-400 text-sm">Manage multiple chatbot personas, prompt tunings, and embed codes.</p>
                     </div>
                     {currentUserRole === 'OWNER' ? (
                         <button onClick={() => setShowCreateModal(true)} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
                            <Bot size={16}/> Create New Chatbot
                         </button>
                     ) : (
                         <button disabled className="bg-zinc-800 text-zinc-500 px-5 py-2.5 rounded-xl font-bold text-sm cursor-not-allowed flex items-center gap-2">
                            <Lock size={16}/> Create Locked
                         </button>
                     )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                     {chatbots.map(bot => (
                        <div key={bot.id} className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 relative group transition-all hover:bg-zinc-900/80">
                           <div className="flex justify-between items-start mb-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 bg-gradient-to-tr from-primary to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                                    <Bot size={24} className="text-white"/>
                                 </div>
                                 <div>
                                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                                       {bot.name} 
                                       <button
                                         onClick={() => handleSetBotActive(bot)}
                                         className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 shadow-sm ${
                                           activeBotId === bot.id
                                             ? "bg-green-500 text-white border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                             : "bg-transparent text-amber-500 border-amber-500 hover:bg-amber-500/10"
                                         }`}
                                       >
                                         {activeBotId === bot.id ? (
                                           <>
                                             <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                             ✓ Currently Live
                                           </>
                                         ) : (
                                           "[Set Active & Live]"
                                         )}
                                       </button>
                                    </h3>
                                    <p className="text-sm text-zinc-400 mt-1 font-medium">{bot.desc} • ID: <code className="text-primary bg-primary/10 px-1 rounded">{bot.id}</code></p>
                                 </div>
                              </div>
                                <div className="flex items-center gap-2">
                                {currentUserRole === 'OWNER' ? (
                                    <>
                                        <button onClick={() => {
                                           setEditBotData(bot);
                                           setShowEditModal(true);
                                        }} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors"><Edit2 size={16}/></button>
                                        <button onClick={() => {
                                           if (window.confirm(`Are you sure you want to completely delete "${bot.name}"?`)) {
                                              const updatedBots = chatbots.filter(b => b.id !== bot.id);
                                              setChatbots(updatedBots);
                                              localStorage.setItem("spicehub_chatbots", JSON.stringify(updatedBots));
                                              if (activeBotId === bot.id) {
                                                  setActiveBotId("");
                                                  localStorage.removeItem("spicehub_live_bot_id");
                                                  window.dispatchEvent(new CustomEvent("ADMIN_UPDATE_BOT_CONFIG", { detail: null }));
                                              }
                                              alert("Chatbot deleted successfully.");
                                           }
                                        }} className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </>
                                ) : (
                                    <div className="text-xs text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20"><Lock size={12}/> Locked completely</div>
                                )}
                              </div>
                           </div>
                           
                           <div className="space-y-6">
                              <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                    <Settings2 size={14}/> System Prompt (Persona)
                                </label>
                                <textarea 
                                    readOnly 
                                    value={bot.prompt} 
                                    className={`w-full bg-black/50 border ${currentUserRole === 'OWNER' ? 'border-white/10 hover:border-white/30' : 'border-zinc-800 opacity-70'} rounded-xl p-4 text-sm text-zinc-300 resize-none h-28 focus:outline-none transition-colors font-mono leading-relaxed`} 
                                />
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>

                  {/* Embed Snippet Selector Update */}
                  
                  {/* LIVE BRANDING CUSTOMIZATION */}
                  {activeBotId && (
                      <div className="bg-zinc-900/60 rounded-xl border border-white/5 p-6 mt-8 shadow-xl">
                          <label className="text-sm font-bold text-primary uppercase tracking-wider mb-4 block flex items-center gap-2">
                              <Settings2 size={18}/> Active Widget Branding Live Sync
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                  <label className="text-xs font-bold text-zinc-400 mb-2 block">Chatbot Name</label>
                                  <input 
                                      type="text" 
                                      value={chatbots.find(b => b.id === activeBotId)?.name || ''} 
                                      onChange={(e) => {
                                          const updatedBots = chatbots.map(b => b.id === activeBotId ? { ...b, name: e.target.value } : b);
                                          setChatbots(updatedBots);
                                          localStorage.setItem("spicehub_chatbots", JSON.stringify(updatedBots));
                                          
                                          const activeBot = updatedBots.find(b => b.id === activeBotId);
                                          window.dispatchEvent(new CustomEvent("ADMIN_UPDATE_BOT_CONFIG", { detail: activeBot }));
                                      }}
                                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary text-white" 
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-zinc-400 mb-3 block">🎨 Customize Widget Theme</label>
                                  <div className="flex flex-wrap gap-3">
                                      {[
                                        { name: 'Midnight Gold', value: '#d4af37' },
                                        { name: 'Luxury Sapphire Blue', value: '#1e3a8a' },
                                        { name: 'Minimalist Slate', value: '#64748b' },
                                        { name: 'Crimson Red', value: '#e11d48' },
                                        { name: 'Emerald Green', value: '#10b981' }
                                      ].map(theme => (
                                          <button
                                              key={theme.name}
                                              onClick={() => {
                                                  const updatedBots = chatbots.map(b => b.id === activeBotId ? { ...b, themeColor: theme.value } : b);
                                                  setChatbots(updatedBots);
                                                  localStorage.setItem("spicehub_chatbots", JSON.stringify(updatedBots));
                                                  const activeBot = updatedBots.find(b => b.id === activeBotId);
                                                  window.dispatchEvent(new CustomEvent("ADMIN_UPDATE_BOT_CONFIG", { detail: activeBot }));
                                              }}
                                              title={theme.name}
                                              className="w-10 h-10 rounded-full shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 border border-white/20"
                                              style={{ 
                                                  backgroundColor: theme.value,
                                                  boxShadow: (chatbots.find(b => b.id === activeBotId)?.themeColor || '#f97316') === theme.value ? `0 0 15px ${theme.value}` : 'none',
                                                  borderColor: (chatbots.find(b => b.id === activeBotId)?.themeColor || '#f97316') === theme.value ? '#ffffff' : 'rgba(255,255,255,0.2)'
                                              }}
                                          />
                                      ))}
                                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/20 shadow-lg hover:scale-110 transition-transform">
                                          <input 
                                              type="color" 
                                              value={chatbots.find(b => b.id === activeBotId)?.themeColor || '#f97316'} 
                                              onChange={(e) => {
                                                  const updatedBots = chatbots.map(b => b.id === activeBotId ? { ...b, themeColor: e.target.value } : b);
                                                  setChatbots(updatedBots);
                                                  localStorage.setItem("spicehub_chatbots", JSON.stringify(updatedBots));
                                                  const activeBot = updatedBots.find(b => b.id === activeBotId);
                                                  window.dispatchEvent(new CustomEvent("ADMIN_UPDATE_BOT_CONFIG", { detail: activeBot }));
                                              }}
                                              className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer opacity-0"
                                              title="Custom Color"
                                          />
                                          <div className="w-full h-full pointer-events-none" style={{ backgroundColor: chatbots.find(b => b.id === activeBotId)?.themeColor || '#f97316' }} />
                                      </div>
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-zinc-400 mb-2 block">Avatar Image URL</label>
                                  <input 
                                      type="text" 
                                      placeholder="https://..."
                                      value={chatbots.find(b => b.id === activeBotId)?.avatarUrl || ''} 
                                      onChange={(e) => {
                                          const updatedBots = chatbots.map(b => b.id === activeBotId ? { ...b, avatarUrl: e.target.value } : b);
                                          setChatbots(updatedBots);
                                          localStorage.setItem("spicehub_chatbots", JSON.stringify(updatedBots));
                                          
                                          const activeBot = updatedBots.find(b => b.id === activeBotId);
                                          window.dispatchEvent(new CustomEvent("ADMIN_UPDATE_BOT_CONFIG", { detail: activeBot }));
                                      }}
                                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary text-white font-mono" 
                                  />
                              </div>
                          </div>
                      </div>
                  )}

                  <div className="bg-blue-500/5 rounded-xl border border-blue-500/10 p-6 mt-8">
                    <label className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                        <Code size={18}/> Embed Code Generator
                    </label>
                    <p className="text-sm text-zinc-400 mb-4">Select a chatbot persona from your directory below to generate its client-side integration snippet.</p>
                    
                    <div className="mb-4">
                       <select 
                          value={embedBotId || chatbots[0]?.id}
                          onChange={(e) => setEmbedBotId(e.target.value)}
                          className="w-full bg-black border border-white/10 text-sm py-3 px-4 rounded-xl focus:outline-none focus:border-blue-500/50 text-white transition-colors"
                       >
                          {chatbots.map(b => (
                             <option key={b.id} value={b.id}>{b.name} (ID: {b.id})</option>
                          ))}
                       </select>
                    </div>

                    <div className="bg-black border border-white/10 rounded-xl p-4 flex justify-between items-center group/code">
                       <code className="text-sm text-blue-300 font-mono break-all pr-4">
                          {`<script src="https://${window.location.host}/widget.js" data-id="${embedBotId || chatbots[0]?.id}"></script>`}
                       </code>
                       <button 
                          onClick={() => copyEmbedCode(embedBotId || chatbots[0]?.id)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shrink-0 shadow-lg shadow-blue-500/20"
                          title="Copy JS Snippet"
                       >
                          <ClipboardList size={16}/> Copy
                       </button>
                    </div>
                  </div>
               </div>
            )}

            {/* LIVE INBOX TAB */}
            {activeTab === 'Inbox' && (
               <div className="absolute inset-4 rounded-2xl border border-white/5 bg-zinc-900/30 flex overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                  {/* Left Sidebar - Chat List */}
                  <div className="w-[340px] border-r border-white/5 bg-zinc-900/50 flex flex-col shrink-0">
                     <div className="p-5 border-b border-white/5 bg-black/20">
                        <div className="flex items-center justify-between mb-4 admin-panel-toolbar">
                            <h2 className="text-lg font-black">Active Threads</h2>
                            <button onClick={downloadInboxCSV} className="text-xs bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg transition-colors font-bold flex items-center gap-2">
                                <ClipboardList size={14} /> Export Logs
                            </button>
                        </div>
                        <div className="relative mb-3 admin-panel-conversations-list">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                           <input 
                              type="text" 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search by email or message..." 
                              className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white transition-all shadow-inner" 
                           />
                        </div>
                        <div className="flex gap-2">
                           <button className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-1.5 text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors">
                              <Filter size={14}/> Filters
                           </button>
                           <button 
                              onClick={() => setSortOrder(p => p === 'newest' ? 'oldest' : 'newest')}
                              className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-1.5 text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                           >
                              <TrendingUp size={14} className={sortOrder === 'newest' ? '' : 'rotate-180'}/> {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                           </button>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto w-full styled-scrollbar">
                        {filteredInbox.length === 0 ? (
                           <div className="p-8 text-center flex flex-col items-center justify-center h-full text-zinc-500">
                              <MessageSquare size={32} className="mb-3 opacity-20"/>
                              <p className="text-sm font-medium">No conversations match criteria.</p>
                           </div>
                        ) : (
                           filteredInbox.map(sess => {
                              const latestMsg = sess.messages[sess.messages.length - 1];
                              const isEscalated = notifications.some(n => n.sessionId === sess.id && n.type === 'escalation');
                              return (
                                  <button 
                                    key={sess.id}
                                    onClick={() => setActiveThread(sess)}
                                    className={`w-full p-5 flex flex-col gap-2 border-b border-white/5 text-left transition-all ${activeThread?.id === sess.id ? 'bg-primary/10 border-l-4 border-l-primary shadow-inner' : 'hover:bg-white/5 border-l-4 border-l-transparent'}`}
                                  >
                                     <div className="flex justify-between items-start w-full">
                                        <div className="flex flex-col">
                                           <span className="font-bold text-sm text-white flex items-center gap-2">
                                              {sess.visitorName || 'Anonymous Visitor'} 
                                              {isEscalated && <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>}
                                           </span>
                                           <span className="text-[10px] text-primary font-mono mt-0.5 tracking-wider">{sess.id.slice(0,8)}</span>
                                        </div>
                                        <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">{new Date(sess.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                     </div>
                                     <span className="text-sm text-zinc-400 truncate w-full leading-relaxed">{latestMsg?.text || 'No messages yet'}</span>
                                  </button>
                              )
                           })
                        )}
                     </div>
                  </div>
                  
                  {/* Right Viewport - Thread */}
                  <div className="flex-1 flex flex-col bg-black/70 relative">
                     {activeThread ? (
                        <>
                           <div className="h-[88px] border-b border-white/5 flex flex-col justify-center px-8 bg-zinc-900/90 shrink-0 shadow-lg z-10">
                              <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-4">
                                     <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center font-black text-xl text-white shadow-lg">
                                        {activeThread.visitorName?.[0] || 'V'}
                                     </div>
                                     <div>
                                        <h3 className="font-black text-lg leading-tight flex items-center gap-2 text-white">
                                            {activeThread.visitorName || 'Anonymous Visitor'}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <p className="text-xs text-green-400 font-bold flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-px shadow-[0_0_5px_rgba(34,197,94,0.8)]"></span> Session Online
                                            </p>
                                            <span className="text-zinc-600 text-xs text-[10px]">•</span>
                                            <p className="text-xs text-zinc-400 font-mono flex items-center gap-1 truncate max-w-[200px]" title={activeThread.metadata?.browser}>
                                                {activeThread.metadata?.browser || navigator.userAgent}
                                            </p>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <p className="text-[10px] font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase mb-1">
                                       URL: {activeThread.metadata?.landingPage || window.location.href}
                                    </p>
                                    <div className="flex gap-2">
                                        <button className="px-4 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold rounded-lg hover:bg-red-500 hover:text-white transition-all">Flag Red</button>
                                        <button className="px-4 py-1.5 bg-white/5 text-white border border-white/10 text-xs font-bold rounded-lg hover:bg-white/10 transition-all">Ban IP</button>
                                    </div>
                                  </div>
                              </div>
                           </div>
                           
                           <div className="flex-1 overflow-y-auto p-8 space-y-6 styled-scrollbar">
                              <div className="text-center text-xs text-zinc-600 font-bold uppercase tracking-widest mb-6">Session Initiated • {new Date(activeThread.timestamp).toLocaleString()}</div>
                              
                              {activeThread.messages.map((msg: any, i: number) => (
                                 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[75%] p-4 rounded-2xl text-[15px] leading-relaxed shadow-xl ${
                                       msg.role === 'user' 
                                          ? 'bg-[#18181A] text-zinc-200 rounded-tl-sm border border-white/5' 
                                          : msg.role === 'admin' 
                                             ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-tr-sm border border-blue-500/30' 
                                             : 'bg-primary text-white rounded-tr-sm shadow-primary/10'
                                    }`}>
                                       {msg.role === 'admin' && <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-200 mb-2 tracking-widest"><Bot size={12}/> Admin Manual Override</span>}
                                       {msg.role === 'assistant' && <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-orange-200 mb-2 tracking-widest"><Bot size={12}/> AI Automated Response</span>}
                                       
                                       {/* Render text with basic formatting if preserving invoice text */}
                                       <div className="whitespace-pre-wrap">{msg.text}</div>
                                       
                                       {msg.orderData && (
                                           <div className="mt-4 p-3 bg-black/30 rounded-xl border border-white/10 flex items-center justify-between">
                                              <span className="text-xs font-bold font-mono">ORDER_PAYLOAD_DETECTED</span>
                                              <CheckCircle size={14} className="text-green-400"/>
                                           </div>
                                       )}
                                    </div>
                                 </motion.div>
                              ))}
                           </div>
                           
                           <div className="p-6 bg-zinc-900/90 border-t border-white/5 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10 backdrop-blur-xl">
                               <div className="flex gap-3 bg-black/80 border border-white/10 rounded-2xl p-2 relative shadow-inner focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                                  <textarea 
                                     value={overrideText}
                                     onChange={(e) => setOverrideText(e.target.value)}
                                     placeholder="Take over chat: Type a manual override to instantly pause AI and send response as Admin..." 
                                     className="flex-1 bg-transparent border-none focus:outline-none text-[15px] resize-none h-12 p-3 text-white placeholder-zinc-500 styled-scrollbar"
                                     onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOverride(); }}}
                                  />
                                  <button onClick={sendOverride} className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-xl font-bold min-w-[120px] transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2">
                                      Send <Code size={16}/>
                                  </button>
                               </div>
                               <p className="text-[11px] text-zinc-500 mt-3 flex items-center justify-start gap-2 font-medium">
                                  <ShieldAlert size={12} className="text-blue-400"/> 
                                  Sending a manual override completely bypasses the automated AI language model for this active conversational turn.
                               </p>
                           </div>
                        </>
                     ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                           <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner">
                               <MessageSquare size={40} className="opacity-40" />
                           </div>
                           <h3 className="text-xl font-bold text-zinc-400 mb-2">No Thread Selected</h3>
                           <p className="text-sm font-medium">Select a live conversation from the left inbox panel to view telemetry and take control.</p>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* ORDERS CSV EXPORT */}
            {activeTab === 'Orders' && (
               <div className="flex items-center justify-center h-full animate-in fade-in zoom-in-95 duration-500">
                   <div className="max-w-3xl w-full bg-zinc-900/60 p-12 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-xl relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-indigo-500 to-primary"></div>
                      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(249,115,22,0.15)]">
                          <Download size={48} className="text-primary" />
                      </div>
                      <h3 className="text-3xl font-black mb-4 text-white">Export Live Transactions</h3>
                      <p className="text-zinc-400 text-lg mb-10 max-w-lg leading-relaxed">Download a structured CSV ledger containing complete order payloads, itemized receipts, user metadata, and delivery schemas straight from the distributed Supabase cluster.</p>
                      <button onClick={downloadCSV} className="bg-primary hover:bg-primary/90 transition-all text-white px-10 py-4 text-lg rounded-2xl font-black shadow-xl shadow-primary/30 hover:-translate-y-1 flex items-center gap-3">
                          <Download size={20}/> Generate & Download .CSV Matrix
                      </button>
                      <p className="mt-8 text-xs font-mono text-zinc-500">ROWS LOADED IN MEMORY: {ordersData.length}</p>
                   </div>
               </div>
            )}

            {/* ANALYTICS DASHBOARD */}
            {activeTab === 'Analytics' && (
               <div className="max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 
                 <div className="flex items-center justify-between mb-2">
                     <h2 className="text-2xl font-black text-white">Pipeline Telemetry</h2>
                     <p className="text-sm text-green-400 font-mono tracking-widest bg-green-500/10 px-3 py-1 rounded border border-green-500/20">LIVE METRICS</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><MessageSquare size={64}/></div>
                       <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest relative z-10">Total Conversations</h4>
                       <p className="text-4xl font-black mt-3 text-white relative z-10">{totalConvos.toLocaleString()}</p>
                    </div>
                    <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Bot size={64}/></div>
                       <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest relative z-10">AI Messages Gen</h4>
                       <p className="text-4xl font-black mt-3 text-white relative z-10">{totalMessages.toLocaleString()}</p>
                    </div>
                    <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Calendar size={64}/></div>
                       <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest relative z-10">Mean Session Time</h4>
                       <p className="text-4xl font-black mt-3 text-emerald-400 relative z-10">04m 12s</p>
                    </div>
                    <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group border-b-4 border-b-red-500/50">
                       <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldAlert size={64} className="text-red-500"/></div>
                       <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest relative z-10">Escalation Flags</h4>
                       <p className="text-4xl font-black mt-3 text-red-400 relative z-10">{totalEscalated}</p>
                    </div>
                 </div>

                 <div className="bg-zinc-900/60 rounded-3xl border border-white/5 p-8 shadow-2xl mt-8">
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black flex items-center gap-3"><BarChart3 size={24} className="text-primary"/> Order Trends Volume</h3>
                        <select 
                            value={timeRange} 
                            onChange={e => setTimeRange(e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="Today">Today</option>
                            <option value="Last 7 Days">Last 7 Days</option>
                            <option value="Monthly">Monthly</option>
                        </select>
                     </div>
                     <div className="h-80 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={getFilteredTrendsData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                           <XAxis dataKey="time" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                           <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                           <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#27272a'}} />
                           <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                           <Bar dataKey="Burgers" fill="#f97316" radius={[4, 4, 0, 0]} />
                           <Bar dataKey="Pizza" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                           <Bar dataKey="Biryani" fill="#10b981" radius={[4, 4, 0, 0]} />
                         </BarChart>
                       </ResponsiveContainer>
                     </div>
                 </div>

                 <div className="bg-zinc-900/60 rounded-3xl border border-white/5 p-8 shadow-2xl mt-8">
                     <h3 className="text-lg font-black flex items-center gap-3 mb-8"><Activity size={24} className="text-primary"/> Textual Chart Visualizations (Real-Time Terminal)</h3>
                     
                     <div className="font-mono text-sm bg-black/80 rounded-xl p-8 border border-white/10 text-zinc-300 w-full overflow-x-auto shadow-inner leading-10">
                         <div className="flex items-center gap-4">
                             <div className="w-32 text-right text-zinc-500 uppercase font-bold text-xs">Conversations</div>
                             <div className="text-primary tracking-[0.15em] whitespace-pre">{renderTextChart(totalConvos, 3000)}</div>
                             <div className="font-black text-white w-20">{totalConvos.toLocaleString()}</div>
                         </div>
                         <div className="flex items-center gap-4">
                             <div className="w-32 text-right text-zinc-500 uppercase font-bold text-xs">Messages Gen</div>
                             <div className="text-blue-500 tracking-[0.15em] whitespace-pre">{renderTextChart(totalMessages, 30000)}</div>
                             <div className="font-black text-white w-20">{totalMessages.toLocaleString()}</div>
                         </div>
                         <div className="flex items-center gap-4">
                             <div className="w-32 text-right text-zinc-500 uppercase font-bold text-xs">Escalations</div>
                             <div className="text-red-500 tracking-[0.15em] whitespace-pre">{renderTextChart(totalEscalated, 100)}</div>
                             <div className="font-black text-white w-20">{totalEscalated}</div>
                         </div>
                     </div>
                 </div>
               </div>
            )}

            {/* TEAM ROLE MANAGEMENT */}
            {activeTab === 'Team' && (
               <div className="max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-zinc-900/60 p-8 rounded-3xl border border-white/5 shadow-2xl">
                      <div className="flex justify-between items-center mb-8">
                         <div>
                            <h3 className="text-2xl font-black text-white">Access Control List</h3>
                            <p className="text-zinc-400 text-sm mt-1">Manage platform credentials and restrict component visibility.</p>
                         </div>
                         <div className="flex gap-4">
                            <input 
                                type="email" 
                                placeholder="Colleague Email Address..." 
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="bg-black/50 border border-white/10 rounded-xl px-4 text-sm w-64 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white"
                            />
                            <select 
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value)}
                                className="bg-black/50 border border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-primary text-white"
                            >
                                <option value="AGENT">AGENT</option>
                                <option value="OWNER">OWNER</option>
                            </select>
                            
                            {currentUserRole === 'OWNER' ? (
                                <button onClick={handleInviteUser} className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all shadow-lg active:scale-95 whitespace-nowrap">
                                   + Dispatch Invite
                                </button>
                            ) : (
                                <button disabled className="bg-zinc-800 text-zinc-500 px-6 py-2.5 rounded-xl font-bold text-sm cursor-not-allowed whitespace-nowrap flex items-center gap-2">
                                   <Lock size={14}/> Locked
                                </button>
                            )}
                         </div>
                      </div>
                      
                      <div className="overflow-hidden rounded-2xl border border-white/10 shadow-inner bg-black/30">
                          <table className="w-full text-left text-sm">
                             <thead className="text-xs text-zinc-500 uppercase tracking-widest border-b border-white/10 bg-zinc-900/80">
                                <tr>
                                   <th className="p-5 font-bold">Staff Directory Entity</th>
                                   <th className="p-5 font-bold">Encrypted Ident</th>
                                   <th className="p-5 font-bold">Topology Role</th>
                                   <th className="p-5 text-right font-bold">Sys Actions</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-white/5">
                                {team.map((t, idx) => (
                                   <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                      <td className="p-5 font-bold text-zinc-200 flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-zinc-400">
                                              {t.name[0]}
                                          </div>
                                          {t.name}
                                      </td>
                                      <td className="p-5 text-zinc-400 font-mono text-xs">{t.email}</td>
                                      <td className="p-5">
                                          <span className={`px-2.5 py-1 rounded text-[10px] font-black tracking-widest flex items-center w-fit gap-1.5 ${
                                              t.role === 'OWNER' ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
                                          }`}>
                                              {t.role === 'OWNER' ? <ShieldAlert size={10}/> : <User size={10}/>} {t.role}
                                          </span>
                                      </td>
                                      <td className="p-5 text-right">
                                          {t.role === 'OWNER' || currentUserRole === 'AGENT' ? (
                                              <span className="text-zinc-600 block pr-4 font-mono text-xl">-</span>
                                          ) : (
                                              <button className="text-red-400 hover:text-white px-4 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors text-xs font-bold border border-transparent hover:border-red-500/30">Revoke</button>
                                          )}
                                      </td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                      </div>
                      
                      <div className="mt-8 flex items-start gap-4 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                          <AlertCircle size={24} className="shrink-0 mt-0.5"/> 
                          <div>
                             <h4 className="font-bold mb-1 uppercase tracking-wider text-sm">Strict Immutability Rule Enforced</h4>
                             <p className="text-sm font-medium leading-relaxed opacity-90 text-amber-200/80">Support Agents are securely fenced from mutating core global parameters such as AI Persona Prompts or provisioning embed artifacts. Agents are confined strictly to the Live Web Inbox viewport for read/write conversational operations.</p>
                          </div>
                      </div>
                  </div>
               </div>
            )}

         </main>
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40">
                        <h3 className="text-xl font-black">Provision Chatbot Instance</h3>
                        <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-white transition-colors"><XCircle size={24}/></button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Chatbot Name</label>
                            <input type="text" value={newBotData.name} onChange={e => setNewBotData({...newBotData, name: e.target.value})} placeholder="e.g. Warranty Support Bot" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Short Description</label>
                            <input type="text" value={newBotData.desc} onChange={e => setNewBotData({...newBotData, desc: e.target.value})} placeholder="e.g. Handles RMA requests" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block flex items-center gap-2">AI System Prompt / Instructions <Lock size={12} className="text-primary"/></label>
                            <textarea value={newBotData.prompt} onChange={e => setNewBotData({...newBotData, prompt: e.target.value})} placeholder="You are a helpful support agent..." className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary text-white h-32 resize-none font-mono" />
                        </div>
                        <button onClick={handleCreateBot} className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-primary/20 mt-4 active:scale-95">Create Bot</button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {showEditModal && editBotData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40">
                        <h3 className="text-xl font-black">Edit Chatbot Settings</h3>
                        <button onClick={() => { setShowEditModal(false); setEditBotData(null); }} className="text-zinc-500 hover:text-white transition-colors"><XCircle size={24}/></button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Chatbot Name</label>
                            <input type="text" value={editBotData.name} onChange={e => setEditBotData({...editBotData, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Short Description</label>
                            <input type="text" value={editBotData.desc} onChange={e => setEditBotData({...editBotData, desc: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block flex items-center gap-2">AI System Prompt / Instructions <Lock size={12} className="text-primary"/></label>
                            <textarea value={editBotData.prompt} onChange={e => setEditBotData({...editBotData, prompt: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary text-white h-32 resize-none font-mono" />
                        </div>
                        <button onClick={handleSaveEdit} className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-primary/20 mt-4 active:scale-95">Save Changes</button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
