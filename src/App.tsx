import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthModal } from './components/AuthModal';
import { ChatApp } from './components/ChatApp';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [botStatus, setBotStatus] = useState<'ON' | 'OFF'>('ON');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('spicehub_theme');
    return saved ? (saved as 'dark' | 'light') : 'dark';
  });
  const [isAdminUrl, setIsAdminUrl] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'admin' || params.get('route') === 'admin';
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const isA = params.get('view') === 'admin' || params.get('route') === 'admin';
      setIsAdminUrl(isA);
      if (isA) {
        setIsAdminOpen(true);
      }
    };

    window.addEventListener('popstate', checkUrl);
    window.addEventListener('pushstate', checkUrl);
    
    // Check initially and on state/url updates
    checkUrl();

    // Small interval to listen for any manually pushed window.history changes nicely
    const interval = setInterval(checkUrl, 500);

    return () => {
      window.removeEventListener('popstate', checkUrl);
      window.removeEventListener('pushstate', checkUrl);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spicehub_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  if (loading) {
    return (
      <div className="min-h-screen bg-base text-content overflow-hidden flex flex-col md:flex-row items-center justify-center gap-16 px-6 py-20 relative">
         <div className="w-full md:w-1/2 flex flex-col items-start gap-8 z-10">
            <div className="w-24 h-24 bg-border/20 rounded-[2rem] animate-pulse"></div>
            <div className="w-3/4 h-20 bg-border/20 rounded-2xl animate-pulse"></div>
            <div className="w-1/2 h-8 bg-border/20 rounded-xl animate-pulse"></div>
            <div className="w-40 h-16 bg-border/20 rounded-xl animate-pulse mt-4"></div>
         </div>
         <div className="hidden w-full md:w-1/2 md:flex flex-col gap-6 z-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-border/20 rounded-3xl animate-pulse"></div>
            ))}
         </div>
         <div className="chat-widget-container flex flex-col overflow-hidden bg-base/95 backdrop-blur-xl border border-border">
            <div className="h-20 bg-border/20 animate-pulse border-b border-border"></div>
            <div className="flex-1 p-6 flex flex-col gap-6">
                <div className="w-3/4 h-16 bg-border/20 rounded-2xl animate-pulse self-start"></div>
                <div className="w-2/3 h-12 bg-border/20 rounded-2xl animate-pulse self-end"></div>
                <div className="w-5/6 h-20 bg-border/20 rounded-2xl animate-pulse self-start"></div>
            </div>
            <div className="h-24 bg-border/20 animate-pulse border-t border-border"></div>
         </div>
      </div>
    );
  }

  const userToPass = adminUser || session?.user;

  // Fully forced bypass for URL query routing parameters if user is not authorized as Admin Owner yet:
  if (isAdminUrl && userToPass?.email !== 'admin@spicehub.com') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0e12] text-white">
        {/* Decorative ambient spots */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/60 via-[#0d0e12] to-black opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px]" />
        
        {/* Brand label above center form */}
        <div className="relative z-[60] mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-tr from-primary to-orange-400 text-[#0d0e12] shadow-2xl shadow-primary/30 rotate-6 hover:rotate-0 transition-transform cursor-pointer">
             <span className="text-3xl font-black italic tracking-tighter">SH</span>
          </div>
        </div>

        <div className="relative z-50 w-full max-w-sm px-4">
          <AuthModal 
            onAuthenticated={(u) => { 
                if (u) { 
                  setAdminUser(u); 
                  if (u.email === 'admin@spicehub.com') {
                    setIsAdminOpen(true); 
                  }
                } 
            }} 
          />
        </div>
        
        {/* Navigation back helper */}
        <button 
          onClick={() => {
            const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.pushState({path:newurl},'',newurl);
            setIsAdminUrl(false);
            setIsAdminOpen(false);
          }}
          className="relative z-50 mt-8 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors border border-white/5 bg-zinc-900/60 hover:bg-zinc-800/80 px-6 py-3 rounded-full backdrop-blur-md cursor-pointer flex items-center gap-2 shadow-lg hover:border-white/10"
        >
          ← Go Back to Landing Page
        </button>
      </div>
    );
  }

  return (
    <>
      <ChatApp 
        user={userToPass || { id: "guest", email: "Guest Visitor", user_metadata: { name: "Guest Visitor" } }} 
        onLogout={() => { 
          setAdminUser(null); 
          supabase.auth.signOut(); 
          setIsAdminOpen(false); 
          const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.pushState({path:newurl},'',newurl);
          setIsAdminUrl(false);
          setShowLoginModal(true); 
        }} 
        toggleTheme={toggleTheme}
        theme={theme}
        botStatus={botStatus}
        onLoginClick={() => setShowLoginModal(true)}
        isAdminOpen={isAdminOpen}
        setIsAdminOpen={setIsAdminOpen}
      />
      {(!userToPass && showLoginModal) && (
        <AuthModal onAuthenticated={(u) => { if (u) { setAdminUser(u); if (u.email === 'admin@spicehub.com') setIsAdminOpen(true); } setShowLoginModal(false); }} onClose={() => setShowLoginModal(false)} />
      )}
      {(userToPass?.email === 'admin@spicehub.com' && isAdminOpen) && (
        <AdminPanel 
          botStatus={botStatus} 
          setBotStatus={setBotStatus} 
          onLogout={() => { 
            setAdminUser(null); 
            supabase.auth.signOut(); 
            setIsAdminOpen(false); 
            const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.pushState({path:newurl},'',newurl);
            setIsAdminUrl(false);
            setShowLoginModal(true); 
          }} 
          onCloseAdmin={() => {
            setIsAdminOpen(false);
            const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.pushState({path:newurl},'',newurl);
            setIsAdminUrl(false);
          }}
        />
      )}
    </>
  );
}
