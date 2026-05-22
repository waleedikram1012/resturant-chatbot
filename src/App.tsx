import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthModal } from './components/AuthModal';
import { ChatApp } from './components/ChatApp';

export default function App() {
  const [session, setSession] = useState<any>(null);
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

  return (
    <>
      {!session ? (
        <AuthModal onAuthenticated={() => {}} />
      ) : (
        <ChatApp 
          user={session.user} 
          onLogout={() => supabase.auth.signOut()} 
          toggleTheme={toggleTheme}
          theme={theme}
        />
      )}
    </>
  );
}
