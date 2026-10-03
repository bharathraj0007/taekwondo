import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Camera, ArrowLeft } from 'lucide-react';

export const Gallery: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
        
        {/* Decorative Badge */}
        <div className="inline-flex mx-auto items-center justify-center bg-red-50 text-red-600 w-16 h-16 rounded-full shadow-inner">
          <Camera className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Feature Coming Soon</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Championship Gallery</h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Our official cloud-hosted gallery for action captures, podium ceremonies, and highlight reels is currently under optimization. Check back during final bouts!
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-100">
          <Link
            to="/"
            className="inline-flex items-center gap-2 justify-center w-full py-2.5 px-4 rounded-xl shadow-sm text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Homepage</span>
          </Link>
        </div>

      </div>
    </div>
  );
};
