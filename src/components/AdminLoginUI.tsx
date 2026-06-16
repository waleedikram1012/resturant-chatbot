import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';

export function AdminLoginUI({ onAuthenticated }: { onAuthenticated: (user?: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setLoading(true);

    if (email === 'admin@spicehub.com' && password === 'admin123') {
      onAuthenticated({ id: 'admin', email: 'admin@spicehub.com', role: 'admin', user_metadata: { name: 'Admin' } });
      setLoading(false);
      return;
    }
    
    // Simulate slight delay for 3D effect
    await new Promise(res => setTimeout(res, 600));

    let res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) {
      setErrorText(res.error.message || "Authentication failed.");
    } else {
      onAuthenticated(res.data.user);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060709] text-white flex flex-col font-sans overflow-hidden items-center justify-center">
      {/* Premium dark-mode theme background from main website */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />

      {/* Main Content Layout */}
      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        
        {/* Brand Title */}
        <div className="text-center mb-8">
           <h1 className="text-3xl font-black tracking-tight drop-shadow-md text-white">
             Spice<span className="text-primary drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">Hub</span> <span className="text-red-500 italic drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">Elite</span>
           </h1>
        </div>

        {/* Card 1: Auth Modal (Glassmorphism) */}
        <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
           <div className="absolute -top-32 -right-32 w-64 h-64 bg-red-500/20 rounded-full blur-3xl pointer-events-none"></div>

           <h2 className="text-center text-xl font-bold text-white mb-8">Account Login</h2>
           
           <form onSubmit={handleLogin} className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-400">Username / Email</label>
                <input 
                  type="email" 
                  placeholder="admin@spicehub.com"
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-zinc-600"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold text-zinc-400">Password</label>
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-zinc-600"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  className="absolute right-4 top-[36px] text-zinc-500 hover:text-white transition-colors focus:outline-none"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {errorText && (
                <div className="text-center text-sm text-red-500 font-medium bg-red-500/10 py-2 rounded-lg">
                  {errorText}
                </div>
              )}

              <button 
                 type="submit" 
                 disabled={loading}
                 className="w-full mt-4 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Authenticating...' : 'Login'}
              </button>
           </form>
        </div>
      </div>
      
    </div>
  );
}
