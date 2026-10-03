import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#ebe4d7] border-t border-[#2b2721]/15 text-[#2b2721] pt-14 pb-10 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <span className="font-mono font-black text-sm tracking-tighter">CF</span>
              </div>
              <span className="text-xl font-black tracking-tight text-[#1e293b] font-serif">
                Combat<span className="text-red-600">Flow</span>
              </span>
            </Link>

            <p className="text-xs text-[#2b2721]/75 max-w-sm leading-relaxed">
              CombatFlow is the premier Taekwondo tournament-management operating system. Unifying registration, document validation, weigh-in checks, bracket generation, electronic sensor rings, and real-time medal archives in one connected flow.
            </p>

            <div className="flex items-center gap-2 text-xs font-mono text-[#2b2721]/60">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Engineered for World Taekwondo Competition Rules</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1e293b] font-mono">Platform Flow</p>
            <ul className="space-y-2 text-xs text-[#2b2721]/80">
              <li>
                <a href="#how-it-works" className="hover:text-red-600 transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#events" className="hover:text-red-600 transition-colors">Tournaments & Events</a>
              </li>
              <li>
                <Link to="/admin" className="hover:text-red-600 transition-colors">Tournament Control Center</Link>
              </li>
              <li>
                <Link to="/draws" className="hover:text-red-600 transition-colors">Smart Draw & Brackets</Link>
              </li>
              <li>
                <Link to="/live" className="hover:text-red-600 transition-colors">Live Scoring Arena</Link>
              </li>
              <li>
                <a href="#pricing" className="hover:text-red-600 transition-colors">Organizer Pricing</a>
              </li>
            </ul>
          </div>

          {/* Tournament Operations */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1e293b] font-mono">Operations</p>
            <ul className="space-y-2 text-xs text-[#2b2721]/80">
              <li>
                <Link to="/events" className="hover:text-red-600 transition-colors">Events Calendar</Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-red-600 transition-colors">Athlete Registration</Link>
              </li>
              <li>
                <Link to="/referee/login" className="hover:text-red-600 transition-colors flex items-center gap-1">
                  <span>Referee Desk</span>
                  <ArrowUpRight className="w-3 h-3 text-red-600" />
                </Link>
              </li>
              <li>
                <Link to="/gallery" className="hover:text-red-600 transition-colors">Championship Gallery</Link>
              </li>
              <li>
                <a href="#contact" className="hover:text-red-600 transition-colors">Contact & Inquiries</a>
              </li>
            </ul>
          </div>

          {/* Technical Standards */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1e293b] font-mono">Federation Standards</p>
            <ul className="space-y-2 text-xs text-[#2b2721]/80">
              <li><span>WT PSS Electronic Scoring</span></li>
              <li><span>Daedo & KPNP System Protocol</span></li>
              <li><span>8m x 8m Octagonal Ring Specs</span></li>
              <li><span>Single & Double Elimination Trees</span></li>
              <li><span>Gam-jeom Rule Consolidation</span></li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-[#2b2721]/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#2b2721]/70 font-mono text-center sm:text-left">
          <p>© {new Date().getFullYear()} CombatFlow Systems. Built for athletic integrity.</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 gap-y-1">
            <a href="#how-it-works" className="hover:text-red-600 transition-colors">Operational Protocols</a>
            <span className="hidden sm:inline">·</span>
            <a href="#events" className="hover:text-red-600 transition-colors">Sanctioned Rules</a>
            <span className="hidden sm:inline">·</span>
            <span className="text-red-600 font-bold">WT Approved Scoring Flow</span>
          </div>
        </div>

      </div>
    </footer>
  );
};



