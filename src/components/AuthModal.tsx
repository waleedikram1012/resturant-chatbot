import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { Eye, EyeOff, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AuthModal({ onAuthenticated, onClose }: { onAuthenticated: (user?: any) => void, onClose?: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);
  const [successText, setSuccessText] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');
    setLoading(true);

    if (mode === 'signup') {
      if (!name.trim()) {
        setErrorText('Name is required.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setErrorText('Passwords do not perfectly match.');
        setLoading(false);
        return;
      }
      
      if (password.length < 6) {
        setErrorText('Password must be at least 6 characters long.');
        setLoading(false);
        return;
      }
      
      const isGmail = /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
      const isAdmin = email === 'admin@spicehub.com';
      if (!isGmail && !isAdmin) {
        setErrorText('Please enter a valid @gmail.com address (or use admin@spicehub.com).');
        setLoading(false);
        return;
      }

      let res = await supabase.auth.signUp({ 
        email, 
        password, 
        options: { 
          data: { name },
          emailRedirectTo: window.location.origin
        } 
      });
      if (res.error) {
        setErrorText(res.error.message);
      } else {
        onAuthenticated(res.data.user);
      }
    } else if (mode === 'login') {
      if (email === 'admin@spicehub.com' && password === 'admin123') {
        onAuthenticated({ id: 'admin', email: 'admin@spicehub.com', role: 'admin', user_metadata: { name: 'Admin' } });
        setLoading(false);
        return;
      }
      let res = await supabase.auth.signInWithPassword({ email, password });
      if (res.error) {
        setErrorText(res.error.message || "Authentication failed.");
      } else {
        onAuthenticated(res.data.user);
      }
    }

    setLoading(false);
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup': return "Create Account";
      default: return "Account Login";
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-md cursor-pointer"
      onClick={onClose}
    >
      <motion.div 
        key={mode}
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-sm rounded-[24px] bg-surface p-8 shadow-2xl border border-border cursor-default"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-12 left-0 right-0 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-white shadow-xl shadow-primary/30 rotate-12 transition-transform hover:rotate-0">
               <span className="text-2xl font-black italic tracking-tighter">SH</span>
            </div>
        </div>

        {onClose && (
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }} 
            className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-white border border-white/5 transition-colors duration-200 z-50 cursor-pointer flex items-center justify-center"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        )}

        <h2 className="text-center text-2xl font-bold tracking-tight text-content mt-4">
          SpiceHub <span className="text-primary italic">Elite</span>
        </h2>
        <p className="text-center text-sm text-content-muted mt-2 mb-6 tracking-wide uppercase">
          {getTitle()}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <input 
                type="text" 
                placeholder="Name"
                className="w-full rounded-xl border border-border bg-base px-4 py-3 text-sm text-content focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <>
              <div>
                <input 
                  type="email" 
                  placeholder="Gmail Address"
                  className="w-full rounded-xl border border-border bg-base px-4 py-3 text-sm text-content focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full rounded-xl border border-border bg-base px-4 py-3 text-sm text-content pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
             <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  className="w-full rounded-xl border border-border bg-base px-4 py-3 text-sm text-content pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
             </div>
          )}

          {errorText && (
             <div className="flex items-start rounded-lg bg-red-500/10 p-3 text-sm text-red-500 mb-4">
               <p>{errorText}</p>
             </div>
          )}

          {successText && (
             <div className="flex items-start rounded-lg bg-green-500/10 p-3 text-sm text-green-500 mb-4 font-black">
               <p>{successText}</p>
             </div>
          )}

          <button 
             type="submit" 
             disabled={loading}
             className="w-full rounded-xl bg-primary py-3 text-sm font-semibold tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processing...' : (
              mode === 'signup' ? 'Sign Up' : 'Login'
            )}
          </button>
        </form>

        {(mode === 'login' || mode === 'signup') && (
           <p className="mt-6 text-center text-xs text-content-muted">
             {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
             <button 
                type="button"
                className="ml-1 font-medium text-primary hover:underline"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErrorText(''); setSuccessText(''); }}
             >
               {mode === 'login' ? "Sign Up" : "Back to Login"}
             </button>
           </p>
        )}
      </motion.div>
    </div>
  );
}

