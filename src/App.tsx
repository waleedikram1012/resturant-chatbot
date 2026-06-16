import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthModal } from './components/AuthModal';
import { ChatApp } from './components/ChatApp';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginUI } from './components/AdminLoginUI';

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
      if (session?.user?.user_metadata?.theme) {
        setTheme(session.user.user_metadata.theme);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.user_metadata?.theme) {
        setTheme(session.user.user_metadata.theme);
      }
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

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (session?.user) {
      await supabase.auth.updateUser({
        data: { theme: newTheme }
      });
    }
  };

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
      <AdminLoginUI 
        onAuthenticated={(u) => { 
          if (u) { 
            setAdminUser(u); 
            if (u.email === 'admin@spicehub.com') {
              setIsAdminOpen(true); 
            }
          } 
        }} 
      />
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
