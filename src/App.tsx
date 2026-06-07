import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthModal } from './components/AuthModal';
import { ChatApp } from './components/ChatApp';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [botStatus, setBotStatus] = useState<'ON' | 'OFF'>('ON');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-base">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface border-t-primary"></div>
      </div>
    );
  }

  const userToPass = adminUser || session?.user;

  return (
    <>
      {!userToPass ? (
        <AuthModal onAuthenticated={(u) => { if (u) setAdminUser(u); }} />
      ) : (
        <>
          <ChatApp 
            user={userToPass} 
            onLogout={() => { setAdminUser(null); supabase.auth.signOut(); }} 
            toggleTheme={toggleTheme}
            theme={theme}
            botStatus={botStatus}
          />
          {userToPass.email === 'admin@spicehub.com' && (
            <AdminPanel botStatus={botStatus} setBotStatus={setBotStatus} onLogout={() => { setAdminUser(null); supabase.auth.signOut(); }} />
          )}
        </>
      )}
    </>
  );
}
