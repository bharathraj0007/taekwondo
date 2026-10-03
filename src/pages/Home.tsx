import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { 
  Swords, Calendar, MapPin, Users, Award, ShieldAlert, ChevronRight, 
  Zap, Target, Sparkles, BookOpen, ArrowRight, ShieldCheck, CheckCircle2, 
  Clock, Play, Flame, Filter, Trophy, Activity, Radio,
  ExternalLink, Layers, Scale, FileText, Check, AlertCircle, RefreshCw,
  Phone
} from 'lucide-react';
import { MengToSketchbookLandingPage } from '@designcodeio/threeui';
import '@designcodeio/threeui/style.css';
import { WhyCombatFlow } from '../components/WhyCombatFlow';

import heroImage from '../assets/images/hero_taekwondo_kick_1790104161792.jpg';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.456h.005c6.554 0 11.89-5.336 11.893-11.893a11.82 11.82 0 00-3.473-8.413z" />
  </svg>
);

export const Home: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState({ competitors: 482, matches: 238 });

  // Handle direct hash navigation (/ #pricing, #contact, #hero)
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace('#', '');
      const scrollToSection = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      };

      scrollToSection();
      const timer = setTimeout(scrollToSection, 120);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  // Inquiry Form State
  const [inquiryForm, setInquiryForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    organization: '',
    tournamentName: '',
    athleteCount: '',
    message: ''
  });
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquirySubmitting(true);
    setInquiryError(null);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiryForm)
      });
      if (res.ok) {
        setInquirySuccess(true);
        setInquiryForm({
          fullName: '',
          email: '',
          phone: '',
          organization: '',
          tournamentName: '',
          athleteCount: '',
          message: ''
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setInquiryError(data.error || 'Failed to submit inquiry. Please try again or contact admin directly.');
      }
    } catch (err) {
      setInquiryError('Network error. Please try again or reach out to admin directly.');
    } finally {
      setInquirySubmitting(false);
    }
  };

  // Load stats from API
  useEffect(() => {
    trackEngagement('page_view_home', '/');
    
    const fetchStats = async () => {
      try {
        const [regRes, matchRes] = await Promise.all([
          fetch('/api/registrations'),
          fetch('/api/matches')
        ]);
        if (regRes.ok && matchRes.ok) {
          const regs = await regRes.json();
          const matches = await matchRes.json();
          if (regs.length > 0 || matches.length > 0) {
            setStats({
              competitors: Math.max(regs.length, 482),
              matches: Math.max(matches.length, 238)
            });
          }
        }
      } catch (err) {
        console.warn('Real-time stats sync:', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div 
      className="min-h-screen text-[#2b2721] pb-16 relative overflow-x-hidden"
      style={{
        backgroundImage: "url('/images/background.webp'), url('/images/background.png')",
        backgroundColor: '#ece7dc',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center top',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    >

      {/* ========================================================================= */}
      {/* SECTION 02 — HERO                                                         */}
      {/* ========================================================================= */}
      <section id="hero" className="relative overflow-hidden pt-1 pb-12 lg:pt-2 lg:pb-16 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6">
            
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-widest uppercase text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span>TOURNAMENT MANAGEMENT PLATFORM</span>
            </div>

            {/* Main Heading */}
            <h1 className="fluid-h1 font-black tracking-tight text-[#1e293b] font-serif uppercase break-words">
              RUN THE TOURNAMENT.<br />
              <span className="text-red-600">CONTROL EVERY BOUT.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-sm sm:text-base lg:text-lg text-[#2b2721]/80 max-w-2xl leading-relaxed font-sans">
              CombatFlow brings registration, validation, weigh-in, draw management, live scoring, brackets and results into one connected platform built for modern Taekwondo competitions.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              <Link
                to={user ? "/admin" : "/signin"}
                onClick={() => trackEngagement('hero_click_create_tournament', '/')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-xl shadow-md hover:shadow-lg transition-all min-h-[44px]"
              >
                <span>Create a Tournament</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/events"
                onClick={() => trackEngagement('hero_click_explore_events', '/')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-bold text-[#1e293b] bg-[#f5efe4] hover:bg-[#eae2d5] border border-[#2b2721]/20 active:scale-98 rounded-xl shadow-xs transition-all min-h-[44px]"
              >
                <Swords className="w-4 h-4 text-red-600" />
                <span>Explore Live Events</span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
              </Link>
            </div>

          </div>

          {/* Taekwondo competition visual */}
          <div className="mt-8 lg:mt-0 lg:col-span-5 relative lg:-translate-y-16 transition-all duration-300">
            <picture>
              <source srcSet="/images/red-blue-boys-fighting.webp" type="image/webp" />
              <img
                src="/images/red-blue-boys-fighting.png"
                alt="Taekwondo Competition Match"
                width={640}
                height={460}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-auto max-h-[460px] object-contain object-center"
              />
            </picture>
          </div>

        </div>

        {/* Wide Platform Highlights Banner (Matching 2nd image: No box, placed widely across) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16">
          <div className="border-t border-b border-[#2b2721]/15 py-6 sm:py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-4 lg:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[#2b2721]/15">
              
              {/* 01: 6+ TOURNAMENT STAGES */}
              <div className="flex items-center gap-4 py-3 sm:py-0 sm:px-6 lg:px-8 first:sm:pl-0">
                <div className="text-red-600 shrink-0">
                  <Users className="w-9 h-9 sm:w-10 sm:h-10" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-3xl sm:text-4xl font-black font-serif text-[#1e293b] tracking-tight leading-none">
                    6+
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#1e293b] font-mono">
                    TOURNAMENT STAGES
                  </p>
                  <p className="text-[11px] text-[#2b2721]/65 font-sans leading-tight">
                    From registration to final results
                  </p>
                </div>
              </div>

              {/* 02: 1 CONNECTED PLATFORM */}
              <div className="flex items-center gap-4 py-3 sm:py-0 sm:px-6 lg:px-8">
                <div className="text-red-600 shrink-0">
                  <Trophy className="w-9 h-9 sm:w-10 sm:h-10" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-3xl sm:text-4xl font-black font-serif text-[#1e293b] tracking-tight leading-none">
                    1
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#1e293b] font-mono">
                    CONNECTED PLATFORM
                  </p>
                  <p className="text-[11px] text-[#2b2721]/65 font-sans leading-tight">
                    Everything in one place
                  </p>
                </div>
              </div>

              {/* 03: LIVE COMPETITION CONTROL */}
              <div className="flex items-center gap-4 py-3 sm:py-0 sm:px-6 lg:px-8">
                <div className="text-red-600 shrink-0">
                  <Radio className="w-9 h-9 sm:w-10 sm:h-10" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-3xl sm:text-4xl font-black font-serif text-red-600 tracking-tight leading-none">
                    LIVE
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#1e293b] font-mono">
                    COMPETITION CONTROL
                  </p>
                  <p className="text-[11px] text-[#2b2721]/65 font-sans leading-tight">
                    Real-time rings and scoring
                  </p>
                </div>
              </div>

              {/* 04: 100% TOURNAMENT VISIBILITY */}
              <div className="flex items-center gap-4 py-3 sm:py-0 sm:px-6 lg:px-8 last:sm:pr-0">
                <div className="shrink-0 flex items-center justify-center">
                  <svg className="w-9 h-9 sm:w-10 sm:h-10 text-red-600 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
                    <path d="M9 12l2 2 4-4" fill="none" stroke="#ece7dc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <p className="text-3xl sm:text-4xl font-black font-serif text-[#1e293b] tracking-tight leading-none">
                    100%
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#1e293b] font-mono">
                    TOURNAMENT VISIBILITY
                  </p>
                  <p className="text-[11px] text-[#2b2721]/65 font-sans leading-tight">
                    For athletes, coaches and spectators
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 03 — HOW IT WORKS                                                 */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20">
        <div className="text-center space-y-3 mb-14">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-red-600">HOW IT WORKS</p>
          <h2 className="fluid-h2 font-black text-[#1e293b] tracking-tight font-serif uppercase break-words">
            ONE TOURNAMENT.<br className="sm:hidden" /> ONE CONNECTED FLOW.
          </h2>
          <p className="text-sm sm:text-base text-[#2b2721]/75 max-w-2xl mx-auto leading-relaxed">
            From registration to final ranking, CombatFlow connects every operational stage of your tournament in one continuous workflow.
          </p>
        </div>

        {/* 6 Connected Steps */}
        <div className="relative">
          {/* Connector Rail (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-4 right-4 -translate-y-8 h-0.5 bg-[#2b2721]/15 -z-0" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 relative z-10">
            {[
              {
                num: "01",
                name: "REGISTRATION",
                desc: "Athletes and clubs register online before competition day.",
                imgWebp: "/images/REGISTRATION.webp",
                imgPng: "/images/REGISTRATION.png"
              },
              {
                num: "02",
                name: "VALIDATION",
                desc: "Verify athlete details, documents, categories and payments before they enter the draw.",
                imgWebp: "/images/VALIDATION.webp",
                imgPng: "/images/VALIDATION.png"
              },
              {
                num: "03",
                name: "WEIGH-IN",
                desc: "Record weight and confirm eligibility for the correct division.",
                imgWebp: "/images/WEIGH-IN.webp",
                imgPng: "/images/WEIGH-IN.png"
              },
              {
                num: "04",
                name: "DRAW / BRACKET",
                desc: "Generate tournament brackets and manage advancement through the competition.",
                imgWebp: "/images/DRAW-BRACKET.webp",
                imgPng: "/images/DRAW-BRACKET.png"
              },
              {
                num: "05",
                name: "LIVE COMPETITION",
                desc: "Manage rings, bouts, officials and live match status in real time.",
                imgWebp: "/images/LIVE-COMPETITION.webp",
                imgPng: "/images/LIVE-COMPETITION.png"
              },
              {
                num: "06",
                name: "RESULTS & RANKING",
                desc: "Publish final results, medals, rankings and tournament records.",
                imgWebp: "/images/RESULTS-RANKING.webp",
                imgPng: "/images/RESULTS-RANKING.png"
              }
            ].map((step, idx) => (
              <div 
                key={idx}
                className="bg-[#fcfaf6]/90 backdrop-blur-xs p-5 rounded-2xl border border-[#2b2721]/15 flex flex-col justify-between hover:border-red-600/40 hover:shadow-md transition-all shadow-xs group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-black font-mono text-red-600 tracking-tight group-hover:scale-105 transition-transform">
                      {step.num}
                    </span>
                    {idx < 5 && (
                      <span className="xl:hidden text-stone-400 font-mono text-xs">→ next</span>
                    )}
                  </div>

                  {/* Step Image Visualizer with prominent character sizing */}
                  <div className="w-full h-40 sm:h-44 md:h-48 lg:h-44 xl:h-40 rounded-xl overflow-hidden mb-3.5 bg-[#fcfaf6] border border-[#2b2721]/15 flex items-center justify-center p-2">
                    <picture>
                      <source srcSet={step.imgWebp} type="image/webp" />
                      <img 
                        src={step.imgPng} 
                        alt={step.name} 
                        width={320}
                        height={240}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-300"
                      />
                    </picture>
                  </div>

                  <h3 className="text-xs font-bold tracking-wider text-[#1e293b] font-mono mb-1.5 uppercase">
                    {step.name}
                  </h3>
                  <p className="text-[11px] text-[#2b2721]/75 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Visual flow indicator */}
          <div className="mt-8 text-center text-xs font-mono font-bold tracking-widest text-[#2b2721]/60 flex items-center justify-center gap-2">
            <span>01</span>
            <span>→</span>
            <span>02</span>
            <span>→</span>
            <span>03</span>
            <span>→</span>
            <span>04</span>
            <span>→</span>
            <span>05</span>
            <span>→</span>
            <span>06</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 08 — SKETCHBOOK                                                  */}
      {/* ========================================================================= */}
      <section id="sketchbook" className="max-w-7xl mx-auto px-4 sm:px-6 py-14 bg-transparent overflow-hidden scroll-mt-20 w-full" aria-label="Inside the Tournament Sketchbook">
        
        {/* Section Header */}
        <div className="text-center space-y-3.5 mb-10 max-w-3xl mx-auto">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-red-600">
            INSIDE THE TOURNAMENT
          </p>
          <h2 className="fluid-h2 font-black text-[#1e293b] tracking-tight font-serif uppercase leading-tight break-words">
            SEE WHAT HAPPENS BEHIND EVERY BOUT.
          </h2>
          <p className="text-sm sm:text-base text-[#2b2721]/80 leading-relaxed font-sans">
            From the gear and preparation to the arena, live competition, officials, podium, and final archive — explore the moments that bring a Taekwondo tournament to life.
          </p>
          <p className="text-xs sm:text-sm font-serif font-bold italic tracking-wide text-[#1e293b]/90 pt-1">
            Every athlete. Every bout. Every moment.
          </p>
        </div>

        <div className="shader-frame w-full max-w-6xl mx-auto h-[340px] sm:h-[460px] md:h-[580px] lg:h-[660px] relative bg-transparent overflow-hidden">
          <MengToSketchbookLandingPage
            headingFont="instrument-serif"
            bodyFont="newsreader"
            headingWeight="400"
            bodyWeight="400"
            primaryColor="#2b2721"
            headingSize={30}
            bodySize={20}
            headingLetterSpacing={0.010}
            style={{ background: 'transparent', backgroundColor: 'transparent' }}
          />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 09 — WHY COMBATFLOW                                               */}
      {/* ========================================================================= */}
      <WhyCombatFlow />


      {/* ========================================================================= */}
      {/* SECTION 10 — UPCOMING TOURNAMENTS & EVENTS                                */}
      {/* ========================================================================= */}
      <section id="events" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20 w-full">
        <div className="text-center space-y-3 mb-12">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-red-600">TOURNAMENT CALENDAR</p>
          <h2 className="fluid-h2 font-black text-[#1e293b] tracking-tight font-serif uppercase break-words">
            UPCOMING CHAMPIONSHIPS & OPENS.
          </h2>
          <p className="text-sm sm:text-base text-[#2b2721]/75 max-w-2xl mx-auto leading-relaxed">
            Find sanctioned competitions, view divisions, register competitors, or track live brackets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "2026 National Taekwondo Autumn Championships",
              dates: "Oct 14–16, 2026",
              city: "Bengaluru, Karnataka",
              venue: "National Indoor Arena",
              courts: "12 Courts",
              athletes: "482 Athletes",
              status: "LIVE ARENA",
              statusColor: "text-red-600 bg-red-50 border-red-200",
              link: "/live"
            },
            {
              title: "2026 South Asian Taekwondo Open Cup",
              dates: "Nov 20–22, 2026",
              city: "Hyderabad, Telangana",
              venue: "Gachibowli Sports Complex",
              courts: "8 Courts",
              athletes: "320 Registered",
              status: "REGISTRATION OPEN",
              statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
              link: "/register"
            },
            {
              title: "2027 All-India Cadet & Junior Trophy",
              dates: "Jan 08–10, 2027",
              city: "New Delhi",
              venue: "Indira Gandhi Arena",
              courts: "10 Courts",
              athletes: "180 Registered",
              status: "UPCOMING",
              statusColor: "text-blue-700 bg-blue-50 border-blue-200",
              link: "/events"
            }
          ].map((evt, idx) => (
            <div 
              key={idx}
              className="bg-[#fcfaf6]/85 backdrop-blur-xs rounded-2xl p-6 border border-[#2b2721]/15 flex flex-col justify-between hover:shadow-md transition-all space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border ${evt.statusColor}`}>
                    {evt.status}
                  </span>
                  <span className="text-xs font-mono text-stone-500">{evt.courts}</span>
                </div>

                <h3 className="text-lg font-black text-[#1e293b] font-serif uppercase leading-tight break-words">
                  {evt.title}
                </h3>

                <div className="space-y-1.5 text-xs text-[#2b2721]/75 font-sans">
                  <p className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{evt.dates}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{evt.venue} · {evt.city}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{evt.athletes}</span>
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#2b2721]/10 flex items-center justify-between">
                <Link
                  to={evt.link}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 group"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/draws"
                  className="text-xs text-stone-500 hover:text-[#1e293b] font-mono underline"
                >
                  View Draw
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 11 — PRICING & EDITIONS                                           */}
      {/* ========================================================================= */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20 w-full">
        <div className="text-center space-y-3 mb-12">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-red-600">TRANSPARENT PRICING</p>
          <h2 className="fluid-h2 font-black text-[#1e293b] tracking-tight font-serif uppercase break-words">
            CLEAR PLANS FOR EVERY TOURNAMENT TIER.
          </h2>
          <p className="text-sm sm:text-base text-[#2b2721]/75 max-w-2xl mx-auto leading-relaxed">
            Run your tournament without surprise fee surcharges. Contact the CombatFlow owner/admin for pricing details.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* Plan 1 */}
          <div className="bg-[#fcfaf6]/85 backdrop-blur-xs rounded-2xl p-7 border border-[#2b2721]/15 flex flex-col justify-between shadow-xs">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold uppercase text-stone-500">01 — ONE EVENT</span>
              <div>
                <h3 className="text-xl sm:text-2xl font-black font-serif text-[#1e293b] uppercase tracking-tight">
                  SINGLE TOURNAMENT
                </h3>
                <div className="mt-3 space-y-1">
                  <div className="text-2xl sm:text-3xl font-black font-mono text-[#1e293b] tracking-tight uppercase">
                    CUSTOM PRICING
                  </div>
                  <p className="text-[11px] text-[#2b2721]/70 font-mono">
                    Contact the CombatFlow owner/admin for pricing details.
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#2b2721]/75 leading-relaxed">
                For organizers running an individual Taekwondo tournament.
              </p>

              <div className="pt-4 border-t border-[#2b2721]/10 space-y-2 text-xs text-[#2b2721]">
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Registration</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Document Verification</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Weigh-In</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Draw & Brackets</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Live Matches</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Results & Rankings</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Digital Certificates</span>
                </p>
              </div>
            </div>

            <div className="pt-6">
              <a
                href="#contact"
                className="inline-flex items-center justify-center w-full py-2.5 rounded-xl border border-[#2b2721]/20 text-xs font-bold text-[#1e293b] hover:bg-[#f5efe4] transition-colors"
              >
                <span>CONTACT ADMIN →</span>
              </a>
            </div>
          </div>

          {/* Plan 2 - Featured */}
          <div className="bg-[#fcfaf6]/95 backdrop-blur-xs rounded-2xl p-7 border-2 border-red-600 flex flex-col justify-between shadow-xl relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
              POPULAR
            </div>

            <div className="space-y-4">
              <span className="text-xs font-mono font-bold uppercase text-red-600">02 — SCALE WITH ATHLETES</span>
              <div>
                <h3 className="text-xl sm:text-2xl font-black font-serif text-[#1e293b] uppercase tracking-tight">
                  PER ATHLETE
                </h3>
                <div className="mt-3 space-y-1">
                  <div className="text-2xl sm:text-3xl font-black font-mono text-[#1e293b] tracking-tight uppercase">
                    CUSTOM PRICING
                  </div>
                  <p className="text-[11px] text-[#2b2721]/70 font-mono">
                    Contact the CombatFlow owner/admin for pricing details.
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#2b2721]/75 leading-relaxed">
                Flexible pricing based on tournament participation.
              </p>

              <div className="pt-4 border-t border-[#2b2721]/10 space-y-2 text-xs text-[#2b2721]">
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Registration</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Club Management</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Weigh-In</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Live Scoring</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Brackets</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Public Live</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Analytics</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Results Archive</span>
                </p>
              </div>
            </div>

            <div className="pt-6">
              <a
                href="#contact"
                className="inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-sm"
              >
                <span>CONTACT ADMIN →</span>
              </a>
            </div>
          </div>

          {/* Plan 3 */}
          <div className="bg-[#fcfaf6]/85 backdrop-blur-xs rounded-2xl p-7 border border-[#2b2721]/15 flex flex-col justify-between shadow-xs">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold uppercase text-stone-500">03 — MULTIPLE EVENTS</span>
              <div>
                <h3 className="text-xl sm:text-2xl font-black font-serif text-[#1e293b] uppercase tracking-tight">
                  ORGANIZER PLAN
                </h3>
                <div className="mt-3 space-y-1">
                  <div className="text-2xl sm:text-3xl font-black font-mono text-[#1e293b] tracking-tight uppercase">
                    CUSTOM PRICING
                  </div>
                  <p className="text-[11px] text-[#2b2721]/70 font-mono">
                    Contact the CombatFlow owner/admin for pricing details.
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#2b2721]/75 leading-relaxed">
                For organizers running multiple Taekwondo tournaments.
              </p>

              <div className="pt-4 border-t border-[#2b2721]/10 space-y-2 text-xs text-[#2b2721]">
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Multiple Events</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Athlete Database</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Club Management</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Tournament Templates</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Results History</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Rankings</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Analytics</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Priority Support</span>
                </p>
              </div>
            </div>

            <div className="pt-6">
              <a
                href="#contact"
                className="inline-flex items-center justify-center w-full py-2.5 rounded-xl border border-[#2b2721]/20 text-xs font-bold text-[#1e293b] hover:bg-[#f5efe4] transition-colors"
              >
                <span>TALK TO COMBATFLOW →</span>
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 12 — CONTACT & TOURNAMENT INQUIRY                                 */}
      {/* ========================================================================= */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column: Editorial Contact Information */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-red-600">GET IN TOUCH</p>
              <h2 className="fluid-h2 font-black text-[#1e293b] font-serif uppercase tracking-tight leading-tight break-words">
                LET'S TALK ABOUT YOUR TOURNAMENT.
              </h2>
              <p className="text-sm sm:text-base text-[#2b2721]/80 leading-relaxed font-sans">
                Planning a Taekwondo tournament? Contact the CombatFlow owner or admin to discuss your tournament requirements, features, and pricing.
              </p>
            </div>

            {/* Custom Pricing Note */}
            <div className="p-4 rounded-2xl bg-[#fcfaf6]/90 border border-amber-600/30 shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Custom Tournament Tiering</span>
              </div>
              <p className="text-xs text-[#2b2721]/85 leading-relaxed font-sans">
                Pricing is customized based on your tournament requirements. Contact the CombatFlow owner or admin for details.
              </p>
            </div>

            {/* Direct WhatsApp Contact */}
            <a
              href="https://wa.me/918088742767?text=Hello%20CombatFlow%2C%20I%20would%20like%20to%20inquire%20about%20managing%20our%20Taekwondo%20tournament."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3.5 p-4 rounded-2xl bg-[#fcfaf6]/90 border border-emerald-600/30 hover:border-emerald-600 hover:bg-emerald-50/50 transition-all shadow-xs group cursor-pointer w-full"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                <WhatsAppIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-800">
                  WhatsApp Contact
                </p>
                <p className="text-base sm:text-lg font-bold font-mono text-[#1e293b] group-hover:text-emerald-700 transition-colors">
                  +91 8088742767
                </p>
              </div>
            </a>
          </div>

          {/* Right Column: Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="bg-[#fcfaf6]/95 backdrop-blur-xs rounded-3xl p-6 sm:p-8 lg:p-10 border border-[#2b2721]/15 shadow-xl relative">
              <div className="border-b border-[#2b2721]/10 pb-4 mb-6">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-600">INQUIRY DESK</span>
                <h3 className="text-xl sm:text-2xl font-black font-serif text-[#1e293b] uppercase tracking-tight mt-1">
                  Submit Tournament Details
                </h3>
              </div>

              {inquirySuccess ? (
                <div className="py-8 px-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-emerald-900 font-serif uppercase tracking-wide">
                      Inquiry Received
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                      Thank you! Your tournament details have been registered. The CombatFlow owner or tournament admin will connect with you shortly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInquirySuccess(false)}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  {inquiryError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{inquiryError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div>
                      <label htmlFor="inquiry-fullName" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#1e293b] mb-1.5">
                        Full Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="inquiry-fullName"
                        type="text"
                        required
                        placeholder="e.g. Master John Doe"
                        value={inquiryForm.fullName}
                        onChange={(e) => setInquiryForm((prev) => ({ ...prev, fullName: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2b2721]/20 text-xs sm:text-sm text-[#1e293b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition-all font-sans"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="inquiry-email" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#1e293b] mb-1.5">
                        Email <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="inquiry-email"
                        type="email"
                        required
                        placeholder="e.g. director@taekwondo.org"
                        value={inquiryForm.email}
                        onChange={(e) => setInquiryForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2b2721]/20 text-xs sm:text-sm text-[#1e293b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition-all font-sans"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Phone Number */}
                    <div>
                      <label htmlFor="inquiry-phone" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#1e293b] mb-1.5">
                        Phone Number <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="inquiry-phone"
                        type="tel"
                        required
                        placeholder="e.g. +1 555-019-2834"
                        value={inquiryForm.phone}
                        onChange={(e) => setInquiryForm((prev) => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2b2721]/20 text-xs sm:text-sm text-[#1e293b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition-all font-sans"
                      />
                    </div>

                    {/* Organization / Club */}
                    <div>
                      <label htmlFor="inquiry-organization" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#1e293b] mb-1.5">
                        Organization / Club <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="inquiry-organization"
                        type="text"
                        required
                        placeholder="e.g. National TKD Federation"
                        value={inquiryForm.organization}
                        onChange={(e) => setInquiryForm((prev) => ({ ...prev, organization: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2b2721]/20 text-xs sm:text-sm text-[#1e293b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition-all font-sans"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tournament Name */}
                    <div>
                      <label htmlFor="inquiry-tournament" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#1e293b] mb-1.5">
                        Tournament Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="inquiry-tournament"
                        type="text"
                        required
                        placeholder="e.g. Autumn Open Championship"
                        value={inquiryForm.tournamentName}
                        onChange={(e) => setInquiryForm((prev) => ({ ...prev, tournamentName: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2b2721]/20 text-xs sm:text-sm text-[#1e293b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition-all font-sans"
                      />
                    </div>

                    {/* Number of Athletes */}
                    <div>
                      <label htmlFor="inquiry-athletes" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#1e293b] mb-1.5">
                        Number of Athletes
                      </label>
                      <input
                        id="inquiry-athletes"
                        type="number"
                        min="1"
                        placeholder="e.g. 250"
                        value={inquiryForm.athleteCount}
                        onChange={(e) => setInquiryForm((prev) => ({ ...prev, athleteCount: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2b2721]/20 text-xs sm:text-sm text-[#1e293b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="inquiry-message" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#1e293b] mb-1.5">
                      Message <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="inquiry-message"
                      rows={3}
                      required
                      placeholder="Tell us about your tournament format, target dates, rings required, or specific features..."
                      value={inquiryForm.message}
                      onChange={(e) => setInquiryForm((prev) => ({ ...prev, message: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2b2721]/20 text-xs sm:text-sm text-[#1e293b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition-all font-sans resize-y"
                    />
                  </div>

                  {/* Button: SEND INQUIRY → */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={inquirySubmitting}
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-98 disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer font-sans"
                    >
                      {inquirySubmitting ? (
                        <span>SENDING INQUIRY...</span>
                      ) : (
                        <span>SEND INQUIRY →</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};
