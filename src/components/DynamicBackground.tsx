import React from 'react';

export function DynamicBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#0c0d12]">
      {/* Soft core gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#0c0d12] to-black opacity-80" />
      
      {/* Network glow lines simulating the background */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="network" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M0 0l60 60M60 60l60-60M60 60v60" stroke="#ffffff" strokeWidth="0.5" fill="none" opacity="0.1"/>
            <circle cx="60" cy="60" r="1.5" fill="#ffffff" opacity="0.3"/>
            <circle cx="0" cy="0" r="1" fill="#ffffff" opacity="0.2"/>
            <circle cx="120" cy="0" r="1" fill="#ffffff" opacity="0.2"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#network)" />
      </svg>

      {/* Add soft ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[40vw] h-[40vw] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}
