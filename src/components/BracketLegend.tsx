import React from 'react';
import { Trophy, HelpCircle, CheckCircle2, Radio, Clock, Shield, Sparkles } from 'lucide-react';

interface BracketLegendProps {
  className?: string;
}

export const BracketLegend: React.FC<BracketLegendProps> = ({ className = '' }) => {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white font-mono flex items-center gap-2">
              Draw & Bracket Legend
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                Official Guide
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reference guide for competitor corner designations, match status codes, and bracket progression symbols.
            </p>
          </div>
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Corner Designations */}
        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Corner Designations
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600 ring-2 ring-red-300 dark:ring-red-900" />
                <span className="font-bold text-red-900 dark:text-red-300">🔴 Chung (Red)</span>
              </div>
              <span className="text-[10px] font-mono text-red-700 dark:text-red-400 font-medium">Top Competitor</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-300 dark:ring-blue-900" />
                <span className="font-bold text-blue-900 dark:text-blue-300">🔵 Hong (Blue)</span>
              </div>
              <span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 font-medium">Bottom Competitor</span>
            </div>
          </div>
        </div>

        {/* Column 2: Progression Symbols */}
        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Bracket Symbols
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[10px]">
                  TBD
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">To Be Decided</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Awaiting prior bout</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  Winner
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Advances next round</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                  BYE
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">Automatic Seed</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Direct advancement</span>
            </div>
          </div>
        </div>

        {/* Column 3: Bout Status Colors */}
        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-emerald-500" />
            Match Status
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="font-bold text-red-700 dark:text-red-400">LIVE / In Ring</span>
              </div>
              <span className="text-[10px] font-mono text-red-600 dark:text-red-400">Active Scoring</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-emerald-700 dark:text-emerald-400">FINAL / Completed</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Official Result</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Scheduled / Upcoming</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">In Queue</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
