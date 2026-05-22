import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AuthModal({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);
  const [bypassed, setBypassed] = useState(false);

  const checkStrength = (pass: string) => {
    if (pass.length === 0) return null;
    if (pass.length < 6) return { text: 'Weak', class: 'bg-red-500 w-1/3' };
    const hasNumbers = /\d/.test(pass);
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    
    if (pass.length >= 8 && hasNumbers && hasLetters && hasSpecial) {
      return { text: 'Strong', class: 'bg-green-500 w-full' };
    }
    if (pass.length >= 6 && hasNumbers && hasLetters) {
      return { text: 'Medium', class: 'bg-yellow-500 w-2/3' };
    }
    return { text: 'Weak', class: 'bg-red-500 w-1/3' }; // Fallback
  };

  const strength = checkStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setLoading(true);

    let res;
    if (isLogin) {
      res = await supabase.auth.signInWithPassword({ email, password });
    } else {
      res = await supabase.auth.signUp({ email, password });
    }

    if (res.error) {
      setErrorText(res.error.message || "Invalid credentials.");
    } else {
      onAuthenticated();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setBypassed(true)}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.4 }}
        className="relative w-full max-w-sm rounded-[24px] bg-surface p-8 shadow-2xl border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-12 left-0 right-0 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-white shadow-xl shadow-primary/30 rotate-12 transition-transform hover:rotate-0">
               <span className="text-2xl font-black italic tracking-tighter">SH</span>
            </div>
        </div>

        <h2 className="text-center text-2xl font-bold tracking-tight text-content mt-4">
          SpiceHub <span className="text-primary italic">Elite</span>
        </h2>
        <p className="text-center text-sm text-content-muted mt-2 mb-6">
          {isLogin ? "Sign In" : "Create Your Account"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input 
              type="email" 
              placeholder="Email address"
              className="w-full rounded-xl border border-border bg-base px-4 py-3 text-sm text-content focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full rounded-xl border border-border bg-base px-4 py-3 text-sm text-content pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button 
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          {/* Password Strength Meter */}
          <AnimatePresence>
            {password.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-content-muted">Password strength</span>
                  <span className={cn(
                    "font-medium",
                    strength?.text === 'Weak' && 'text-red-500',
                    strength?.text === 'Medium' && 'text-yellow-500',
                    strength?.text === 'Strong' && 'text-green-500'
                  )}>{strength?.text}</span>
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-border overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-300", strength?.class)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            {(errorText || bypassed) && (
             <div className="flex items-start rounded-lg bg-red-500/10 p-3 text-sm text-red-500 mb-4">
               <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0" />
               <p>{errorText || "Invalid credentials."}</p>
             </div>
          )}

          <button 
             type="submit" 
             disabled={loading}
             className="w-full rounded-xl bg-primary py-3 text-sm font-semibold tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-content-muted">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button 
             type="button"
             className="ml-1 font-medium text-primary hover:underline"
             onClick={() => { setIsLogin(!isLogin); setErrorText(''); setBypassed(false); }}
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
