import React from 'react';
import { Target, Timer, Wifi, Users, Database } from 'lucide-react';

export const WhyCombatFlow: React.FC = () => {
  return (
    <section id="why-combatflow" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 scroll-mt-20">
      <div className="border-t border-b border-[#2b2721]/15 py-8 sm:py-10 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
        
        {/* Left Column: Heading and Editorial Narrative */}
        <div className="w-full lg:max-w-xl space-y-2.5">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1e293b]">
            WHY COMBATFLOW
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1e293b] tracking-tight font-serif uppercase leading-tight">
            THE COMPLETE TAEKWONDO TOURNAMENT MANAGEMENT PLATFORM
          </h2>
          <p className="text-xs sm:text-sm text-[#2b2721]/80 leading-relaxed font-sans pt-1">
            <strong className="font-bold text-[#1e293b]">Save time, reduce manual work</strong> and deliver a better experience for athletes, coaches, officials and spectators.
          </p>
        </div>

        {/* Right Column: 5 Feature Pillars with Thin Vertical Dividers */}
        <div className="w-full lg:w-auto max-w-full grid grid-cols-5 divide-x divide-[#2b2721]/15 items-start justify-center">
          
          {/* Pillar 1: Built for Taekwondo */}
          <div className="flex flex-col items-center justify-center text-center px-1 sm:px-4 md:px-5 lg:px-6 first:pl-0 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center text-[#1e293b]">
              <Target className="w-5 h-5 sm:w-7 sm:h-7 lg:w-8 lg:h-8 stroke-[1.75]" />
            </div>
            <div className="text-center mt-1.5 sm:mt-2 font-mono text-[9px] sm:text-xs font-bold uppercase tracking-tight text-[#1e293b] leading-tight break-words">
              <p>Built for</p>
              <p>TKD</p>
            </div>
          </div>

          {/* Pillar 2: Less Manual Work */}
          <div className="flex flex-col items-center justify-center text-center px-1 sm:px-4 md:px-5 lg:px-6 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center text-[#1e293b]">
              <Timer className="w-5 h-5 sm:w-7 sm:h-7 lg:w-8 lg:h-8 stroke-[1.75]" />
            </div>
            <div className="text-center mt-1.5 sm:mt-2 font-mono text-[9px] sm:text-xs font-bold uppercase tracking-tight text-[#1e293b] leading-tight break-words">
              <p>Less</p>
              <p>Manual</p>
            </div>
          </div>

          {/* Pillar 3: Real-Time Control */}
          <div className="flex flex-col items-center justify-center text-center px-1 sm:px-4 md:px-5 lg:px-6 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center text-[#1e293b]">
              <Wifi className="w-5 h-5 sm:w-7 sm:h-7 lg:w-8 lg:h-8 stroke-[1.75]" />
            </div>
            <div className="text-center mt-1.5 sm:mt-2 font-mono text-[9px] sm:text-xs font-bold uppercase tracking-tight text-[#1e293b] leading-tight break-words">
              <p>Real-Time</p>
              <p>Control</p>
            </div>
          </div>

          {/* Pillar 4: Public Live Tracking */}
          <div className="flex flex-col items-center justify-center text-center px-1 sm:px-4 md:px-5 lg:px-6 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center text-[#1e293b]">
              <Users className="w-5 h-5 sm:w-7 sm:h-7 lg:w-8 lg:h-8 stroke-[1.75]" />
            </div>
            <div className="text-center mt-1.5 sm:mt-2 font-mono text-[9px] sm:text-xs font-bold uppercase tracking-tight text-[#1e293b] leading-tight break-words">
              <p>Live</p>
              <p>Tracking</p>
            </div>
          </div>

          {/* Pillar 5: From Event Day to Archive */}
          <div className="flex flex-col items-center justify-center text-center px-1 sm:px-4 md:px-5 lg:px-6 last:pr-0 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center text-[#1e293b]">
              <Database className="w-5 h-5 sm:w-7 sm:h-7 lg:w-8 lg:h-8 stroke-[1.75]" />
            </div>
            <div className="text-center mt-1.5 sm:mt-2 font-mono text-[9px] sm:text-xs font-bold uppercase tracking-tight text-[#1e293b] leading-tight break-words">
              <p>Archive</p>
              <p>& History</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
