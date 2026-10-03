import React, { useState, useRef, useCallback, useEffect } from 'react';
import HTMLFlipBook from 'react-pageflip';
import {
  ChevronLeft, ChevronRight, BookOpen, ZoomIn, ZoomOut,
  Maximize2, X, RotateCcw, Search, Move, Sparkles, Layers,
  Compass, Volume2, VolumeX, Eye, Info, Bookmark, Stamp
} from 'lucide-react';

export interface PlaybookSpreadData {
  id: number;
  spreadNumber: string;
  plate: string;
  title: string;
  subtitle: string;
  caption: string;
  imageSrc: string;
  tag: string;
  date: string;
  location: string;
  rulesExcerpt: string;
  koreanTitle: string;
}

export const PLAYBOOK_SPREADS: PlaybookSpreadData[] = [
  {
    id: 1,
    spreadNumber: '01',
    plate: 'PLATE I',
    title: 'The Draw / Tournament Bracket',
    subtitle: 'Single-Elimination Knockout Tree',
    caption: 'Automated knockout seedings, single-elimination trees, and real-time competitor pairings.',
    imageSrc: '/images/image1.webp',
    tag: 'BRACKET ENGINE',
    date: 'OCT 14 2026',
    location: 'Central Tournament Desk · Mat 1',
    rulesExcerpt: 'WT Rule 8.2: Knockout seeds drawn by algorithmic random pool assignment with seeding protection for defending champions.',
    koreanTitle: '토너먼트 대진표'
  },
  {
    id: 2,
    spreadNumber: '02',
    plate: 'PLATE II',
    title: 'Results / Podium',
    subtitle: 'Victory Ceremonies & Honors',
    caption: 'Championship gold, silver, and bronze medal podium ceremonies and official division results.',
    imageSrc: '/images/image2.webp',
    tag: 'VICTORY & HONORS',
    date: 'OCT 16 2026',
    location: 'Grand Championship Podium Stage',
    rulesExcerpt: 'WT Rule 19: Grand podium honors for 1st, 2nd, and dual 3rd place semi-finalist athletes with official division diplomas.',
    koreanTitle: '시상대 및 결과'
  },
  {
    id: 3,
    spreadNumber: '03',
    plate: 'PLATE III',
    title: 'Tournament Arena',
    subtitle: 'Olympic Sparring Octagon',
    caption: 'Olympic-dimension 8x8m competition sparring rings with electronic referee judging desks.',
    imageSrc: '/images/image3.webp',
    tag: 'ARENA LAYOUT',
    date: 'OCT 14 2026',
    location: 'Main Arena Hall · Octagonal Ring A',
    rulesExcerpt: 'WT Rule 2.1: Competition area is an 8m x 8m octagonal boundary with safety padding zone of 2m minimum perimeter.',
    koreanTitle: '경기장 구성'
  },
  {
    id: 4,
    spreadNumber: '04',
    plate: 'PLATE IV',
    title: 'Live Match / Competition',
    subtitle: 'Full-Contact Dynamic Sparring',
    caption: 'High-intensity head kicks, body strikes, and dynamic scoring clashes in live combat.',
    imageSrc: '/images/image4.webp',
    tag: 'LIVE COMBAT',
    date: 'OCT 15 2026',
    location: 'Center Mat Combat Zone',
    rulesExcerpt: 'WT Rule 12: Best-of-3 rounds (2 minutes each). Valid scoring techniques require electronic impact threshold confirmation.',
    koreanTitle: '실시간 경기'
  },
  {
    id: 5,
    spreadNumber: '05',
    plate: 'PLATE V',
    title: 'Equipment / Gear',
    subtitle: 'Electronic Scoring & Safety Armor',
    caption: 'Official WT-approved electronic headgear, chest protectors (hogu), Dobok, and sparring pads.',
    imageSrc: '/images/image5.webp',
    tag: 'OFFICIAL GEAR',
    date: 'OCT 13 2026',
    location: 'Weigh-In & Gear Inspection Station',
    rulesExcerpt: 'WT Rule 4: PSS (Protector and Scoring System) chest protector, e-headgear, sensor socks, forearm & shin guards mandatory.',
    koreanTitle: '공인 보호구'
  },
  {
    id: 6,
    spreadNumber: '06',
    plate: 'PLATE VI',
    title: 'Coach & Athlete',
    subtitle: 'Corner Strategy & Mentorship',
    caption: 'Strategic corner guidance, tactical round analysis, and championship athletic mentorship.',
    imageSrc: '/images/image6.webp',
    tag: 'CORNER STRATEGY',
    date: 'OCT 15 2026',
    location: 'Athlete Corner Staging Area',
    rulesExcerpt: 'WT Rule 10: One accredited coach seated in 1m x 1m coaching box. Allowed 1 video replay card challenge per bout.',
    koreanTitle: '코치와 선수'
  },
  {
    id: 7,
    spreadNumber: '07',
    plate: 'PLATE VII',
    title: 'Referee / Live Scoring',
    subtitle: 'World Taekwondo Best-of-3 Officiating',
    caption: 'Real-time World Taekwondo Best-of-3 electronic scorepad, Gam-jeom penalties, and video review.',
    imageSrc: '/images/image7.webp',
    tag: 'OFFICIATING DESK',
    date: 'OCT 15 2026',
    location: 'Judges Scoring & Video Review Table',
    rulesExcerpt: 'WT Rule 14: Center referee directs flow (Kal-yeo / Kye-sok) and enforces Gam-jeom infractions (+1 point to opponent).',
    koreanTitle: '심판 채점 체계'
  },
  {
    id: 8,
    spreadNumber: '08',
    plate: 'PLATE VIII',
    title: 'Tournament Archive',
    subtitle: 'Historical Records & Media Gallery',
    caption: 'Historical bout records, competitor statistics, downloadable PDF draws, and photo galleries.',
    imageSrc: '/images/image8.webp',
    tag: 'DIGITAL ARCHIVE',
    date: 'OCT 16 2026',
    location: 'CombatFlow Cloud Database & Vault',
    rulesExcerpt: 'WT Rule 21: Full electronic logs, score transcripts, and bracket progression preserved in permanent championship archives.',
    koreanTitle: '대회 기록 보관'
  }
];

// Audio synthesizer for realistic physical paper turn rustle
const playPaperTurnSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const duration = 0.16;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const progress = i / bufferSize;
      const envelope = Math.sin(progress * Math.PI) * Math.exp(-progress * 3);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.12;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);
    source.connect(filter);
    filter.connect(ctx.destination);
    source.start();
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
};

// Single Spread Left Page Component (Meng To Art Book Styling)
const SpreadLeftPage = React.forwardRef<HTMLDivElement, { spread: PlaybookSpreadData }>(
  ({ spread }, ref) => {
    return (
      <div
        ref={ref}
        className="page bg-[#faf6ee] w-full h-full p-4 sm:p-7 flex flex-col justify-between select-none overflow-hidden relative border-y border-l border-[#dfd3bc]"
        style={{
          boxSizing: 'border-box',
          borderTopLeftRadius: '20px',
          borderBottomLeftRadius: '20px',
          backgroundImage: `
            radial-gradient(#cbbda3 0.75px, transparent 0.75px),
            linear-gradient(to right, rgba(0,0,0,0.02) 0%, transparent 6%, transparent 88%, rgba(0,0,0,0.06) 100%)
          `,
          backgroundSize: '20px 20px, 100% 100%',
          boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.02), inset -10px 0 16px -8px rgba(90,70,40,0.12)'
        }}
      >
        {/* Top Left Header & Archival Notation */}
        <div className="flex items-center justify-between border-b border-[#dfd2ba] pb-2 font-mono text-[9px] text-[#8c7b64]">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#92400e] bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300/80 shadow-xs">
              {spread.plate}
            </span>
            <span className="font-semibold text-slate-600 hidden sm:inline">
              · {spread.tag}
            </span>
          </div>
          <span className="text-[#a89882] tracking-wider uppercase font-semibold">
            {spread.koreanTitle}
          </span>
        </div>

        {/* Left half crop of the panoramic illustration */}
        <div className="my-auto py-2 flex items-center justify-center flex-grow overflow-hidden relative">
          <div className="w-full h-full flex items-center justify-center overflow-hidden relative group">
            <img
              src={spread.imageSrc}
              alt={`${spread.title} (Left)`}
              className="w-[200%] max-w-none h-full object-cover object-left pointer-events-none drop-shadow-sm"
              style={{
                filter: 'contrast(1.02) saturate(1.04)',
                mixBlendMode: 'multiply'
              }}
              loading="eager"
            />
            {/* Subtle watercolor paper bleed texture */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-amber-900/5 pointer-events-none" />
          </div>
        </div>

        {/* Bottom Left Archival Notes */}
        <div className="border-t border-[#dfd2ba] pt-2 flex items-center justify-between font-mono text-[9px] text-[#8c7b64]">
          <span className="truncate max-w-[200px] font-bold text-slate-800 font-serif">
            {spread.title}
          </span>
          <span className="text-[#9e8c75] truncate max-w-[130px]">{spread.location}</span>
        </div>
      </div>
    );
  }
);
SpreadLeftPage.displayName = 'SpreadLeftPage';

// Single Spread Right Page Component (with Meng To Hanko Seal & Date)
const SpreadRightPage = React.forwardRef<HTMLDivElement, { spread: PlaybookSpreadData }>(
  ({ spread }, ref) => {
    return (
      <div
        ref={ref}
        className="page bg-[#faf6ee] w-full h-full p-4 sm:p-7 flex flex-col justify-between select-none overflow-hidden relative border-y border-r border-[#dfd3bc]"
        style={{
          boxSizing: 'border-box',
          borderTopRightRadius: '20px',
          borderBottomRightRadius: '20px',
          backgroundImage: `
            radial-gradient(#cbbda3 0.75px, transparent 0.75px),
            linear-gradient(to left, rgba(0,0,0,0.02) 0%, transparent 6%, transparent 88%, rgba(0,0,0,0.06) 100%)
          `,
          backgroundSize: '20px 20px, 100% 100%',
          boxShadow: 'inset -2px 2px 8px rgba(0,0,0,0.02), inset 10px 0 16px -8px rgba(90,70,40,0.12)'
        }}
      >
        {/* Top Right Header & Page Number */}
        <div className="flex items-center justify-between border-b border-[#dfd2ba] pb-2 font-mono text-[9px] text-[#8c7b64]">
          <span className="text-[#a89882] tracking-wider font-semibold">
            COMBATFLOW OFFICIAL MANUAL
          </span>
          <span className="font-bold tracking-widest text-[#78350f] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            {spread.spreadNumber} / 08
          </span>
        </div>

        {/* Right half crop of the panoramic artwork with Meng To style Hanko Chop Stamp */}
        <div className="my-auto py-2 flex items-center justify-center flex-grow overflow-hidden relative">
          <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
            <img
              src={spread.imageSrc}
              alt={`${spread.title} (Right)`}
              className="w-[200%] max-w-none h-full object-cover object-right pointer-events-none drop-shadow-sm"
              style={{
                filter: 'contrast(1.02) saturate(1.04)',
                mixBlendMode: 'multiply'
              }}
              loading="eager"
            />

            {/* Authentic Red Artist Chop / Hanko Seal & Date (Meng To Sketchbook Signature Style) */}
            <div className="absolute bottom-1 right-1 flex flex-col items-center gap-0.5 bg-white/60 backdrop-blur-[1px] p-1 rounded-md border border-[#dfd2ba]/70 shadow-xs">
              <div className="w-6 h-6 rounded-md bg-[#b91c1c] text-white flex items-center justify-center shadow-inner border border-[#991b1b]">
                <span className="font-serif font-black text-[10px] leading-none tracking-tighter">武道</span>
              </div>
              <span className="font-mono text-[7.5px] font-bold text-[#78350f] tracking-tighter uppercase">
                {spread.date}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Right Metadata */}
        <div className="border-t border-[#dfd2ba] pt-2 flex items-center justify-between font-mono text-[9px] text-[#8c7b64]">
          <span className="text-[#9e8c75] truncate max-w-[190px]">{spread.subtitle}</span>
          <span className="font-bold text-slate-800">CombatFlow</span>
        </div>
      </div>
    );
  }
);
SpreadRightPage.displayName = 'SpreadRightPage';

export const TournamentPlaybook: React.FC = () => {
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [isLoupeEnabled, setIsLoupeEnabled] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [bookTilt, setBookTilt] = useState({ rotateX: 0, rotateY: 0 });

  const flipBookRef = useRef<any>(null);
  const bookContainerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Brass Loupe Magnifier State
  const [loupeState, setLoupeState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    bgX: number;
    bgY: number;
    imageSrc: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    bgX: 0,
    bgY: 0,
    imageSrc: '',
  });

  const currentSpread = PLAYBOOK_SPREADS[currentSpreadIndex] || PLAYBOOK_SPREADS[0];

  useEffect(() => {
    // Pre-cache all sketchbook images for zero-latency mobile browsing
    PLAYBOOK_SPREADS.forEach(spread => {
      const img = new Image();
      img.src = spread.imageSrc;
    });
  }, []);

  // 3D Pointer Parallax effect (Meng To Sketchbook Depth)
  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bookContainerRef.current) return;
    const rect = bookContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    setBookTilt({
      rotateX: -y * 4,
      rotateY: x * 4,
    });

    if (isLoupeEnabled) {
      const imgX = (e.clientX - rect.left) / rect.width;
      const imgY = (e.clientY - rect.top) / rect.height;
      setLoupeState({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        bgX: Math.min(Math.max(0, imgX * 100), 100),
        bgY: Math.min(Math.max(0, imgY * 100), 100),
        imageSrc: currentSpread.imageSrc,
      });
    }
  };

  const handleContainerMouseLeave = () => {
    setBookTilt({ rotateX: 0, rotateY: 0 });
    setLoupeState((prev) => ({ ...prev, visible: false }));
  };

  // Flip Book page navigation
  const handlePrev = useCallback(() => {
    if (isSoundEnabled) playPaperTurnSound();
    if (flipBookRef.current) {
      try {
        flipBookRef.current.pageFlip().flipPrev();
      } catch (err) {
        console.warn('Flip prev error:', err);
      }
    }
  }, [isSoundEnabled]);

  const handleNext = useCallback(() => {
    if (isSoundEnabled) playPaperTurnSound();
    if (flipBookRef.current) {
      try {
        flipBookRef.current.pageFlip().flipNext();
      } catch (err) {
        console.warn('Flip next error:', err);
      }
    }
  }, [isSoundEnabled]);

  const handleJumpToSpread = useCallback((spreadIdx: number) => {
    if (isSoundEnabled) playPaperTurnSound();
    if (flipBookRef.current) {
      try {
        // Each spread consists of 2 pages (left & right), so page index = spreadIdx * 2
        flipBookRef.current.pageFlip().turnToPage(spreadIdx * 2);
      } catch (err) {
        console.warn('Turn to spread error:', err);
      }
    }
  }, [isSoundEnabled]);

  const handleFlip = useCallback((e: any) => {
    if (e && typeof e.data === 'number') {
      const pageNum = e.data;
      const mappedSpreadIdx = Math.min(Math.max(0, Math.floor(pageNum / 2)), PLAYBOOK_SPREADS.length - 1);
      setCurrentSpreadIndex(mappedSpreadIdx);
      setLoupeState((prev) => ({ ...prev, visible: false }));
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isLightboxOpen) {
          setCurrentSpreadIndex((prev) => Math.max(0, prev - 1));
        } else {
          handlePrev();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isLightboxOpen) {
          setCurrentSpreadIndex((prev) => Math.min(PLAYBOOK_SPREADS.length - 1, prev + 1));
        } else {
          handleNext();
        }
      } else if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, isLightboxOpen]);

  // Lightbox Handlers
  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setLightboxZoom((z) => Math.min(4, z + 0.25));
    } else {
      setLightboxZoom((z) => {
        const next = Math.max(1, z - 0.25);
        if (next === 1) setLightboxPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handlePanStart = (clientX: number, clientY: number) => {
    if (lightboxZoom > 1) {
      setIsPanning(true);
      panStartRef.current = { x: clientX - lightboxPan.x, y: clientY - lightboxPan.y };
    }
  };

  const handlePanMove = (clientX: number, clientY: number) => {
    if (isPanning && lightboxZoom > 1) {
      setLightboxPan({
        x: clientX - panStartRef.current.x,
        y: clientY - panStartRef.current.y,
      });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  return (
    <section 
      className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 select-none font-sans relative overflow-hidden"
      aria-label="CombatFlow Tournament Playbook"
    >
      {/* Background Architectural Drafting Grid & Warm Parchment Glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 20% 25%, rgba(225,200,155,0.45) 0%, transparent 65%),
            radial-gradient(ellipse at 80% 75%, rgba(210,185,140,0.35) 0%, transparent 65%),
            linear-gradient(to right, rgba(160,140,110,0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(160,140,110,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 32px 32px, 32px 32px'
        }}
      />

      {/* Header */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f4ede1] border border-[#ddcfb6] text-[#78350f] text-xs font-mono font-bold uppercase tracking-wider shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          <span>Meng To Inspired Sketchbook Experience</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight font-serif">
          CombatFlow Tournament Playbook
        </h2>

        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-sans leading-relaxed">
          Tactile two-page spreads of World Taekwondo watercolor art, realistic curled page turns, and an interactive brass magnifying loupe.
        </p>

        <div className="h-1 w-16 bg-red-600 mx-auto rounded-full mt-3" />
      </div>

      {/* Main Sketchbook Stage */}
      <div className="relative max-w-5xl mx-auto">
        
        {/* Floating Toolbar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 px-2 font-mono text-xs">
          
          <div className="flex items-center gap-2">
            {/* Brass Loupe Toggle */}
            <button
              type="button"
              onClick={() => setIsLoupeEnabled(!isLoupeEnabled)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isLoupeEnabled
                  ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs ring-2 ring-amber-400/20'
                  : 'bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-amber-700" />
              <span>Brass Loupe: {isLoupeEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Sound Effects Toggle */}
            <button
              type="button"
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSoundEnabled
                  ? 'bg-white/90 border-slate-200 text-slate-700'
                  : 'bg-slate-100 border-slate-300 text-slate-400'
              }`}
              title="Toggle Page-Turn Sound"
            >
              {isSoundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Audio: On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Audio: Off</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLightboxZoom(1.5);
                setLightboxPan({ x: 0, y: 0 });
                setIsLightboxOpen(true);
              }}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Fullscreen Studio View</span>
            </button>
          </div>
        </div>

        {/* 3D Perspective Parallax Book Canvas */}
        <div
          ref={bookContainerRef}
          onMouseMove={handleContainerMouseMove}
          onMouseLeave={handleContainerMouseLeave}
          className="relative transition-transform duration-200 ease-out"
          style={{
            perspective: 1500,
            transform: `rotateX(${bookTilt.rotateX}deg) rotateY(${bookTilt.rotateY}deg)`,
          }}
        >
          {/* Physical Open Sketchbook Container (Meng To Reference Style) */}
          <div className="relative bg-[#ece2d0] rounded-[32px] p-3 sm:p-7 sm:py-8 border-2 border-[#d6c7ae] shadow-[0_32px_75px_-15px_rgba(70,50,20,0.32),0_10px_28px_rgba(0,0,0,0.1)] overflow-hidden">
            
            {/* Realistic Page Thickness Layers (Deckle Edge Stacks on Left & Right) */}
            <div className="hidden sm:block absolute left-2 top-6 bottom-6 w-3 rounded-l-lg bg-gradient-to-r from-[#cfc0a5] via-[#ded1b9] to-[#ebdcc8] shadow-inner opacity-85" />
            <div className="hidden sm:block absolute right-2 top-6 bottom-6 w-3 rounded-r-lg bg-gradient-to-l from-[#cfc0a5] via-[#ded1b9] to-[#ebdcc8] shadow-inner opacity-85" />

            {/* Brass Corner Reinforcements */}
            <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-[#b45309]/60 rounded-tl-xl pointer-events-none" />
            <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-[#b45309]/60 rounded-tr-xl pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-[#b45309]/60 rounded-bl-xl pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-[#b45309]/60 rounded-br-xl pointer-events-none" />

            {/* Central Binding Spine Fold Seam & Curvature Shadow */}
            <div 
              className="hidden sm:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] pointer-events-none z-20 opacity-40"
              style={{
                background: 'linear-gradient(to bottom, #cfc0a5, #887455 50%, #cfc0a5)'
              }}
            />

            {/* Gutter Soft Center Shadow */}
            <div 
              className="hidden sm:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-28 pointer-events-none z-10 opacity-30"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(70,50,20,0.7) 0%, transparent 75%)'
              }}
            />

            {/* Book Flip Navigation Buttons */}
            <div className="relative flex items-center justify-center min-h-[360px] sm:min-h-[460px]">
              
              {/* Previous Spread Button */}
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous Spread"
                className="absolute left-0 sm:-left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-red-600 border border-[#ddd3be] shadow-md hover:shadow-lg flex items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Next Spread Button */}
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next Spread"
                className="absolute right-0 sm:-right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-red-600 border border-[#ddd3be] shadow-md hover:shadow-lg flex items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* 2-Page Spread HTMLFlipBook */}
              <div className="w-full flex items-center justify-center overflow-hidden py-1">
                <HTMLFlipBook
                  ref={flipBookRef}
                  startPage={0}
                  size="stretch"
                  width={460}
                  height={360}
                  minWidth={280}
                  maxWidth={550}
                  minHeight={250}
                  maxHeight={440}
                  drawShadow={true}
                  flippingTime={700}
                  usePortrait={false}
                  startZIndex={0}
                  autoSize={true}
                  maxShadowOpacity={0.45}
                  showCover={false}
                  mobileScrollSupport={true}
                  clickEventForward={true}
                  useMouseEvents={true}
                  swipeDistance={30}
                  showPageCorners={true}
                  disableFlipByClick={false}
                  onFlip={handleFlip}
                  className="sketchbook-twopage-flipbook shadow-lg rounded-2xl overflow-hidden mx-auto"
                  style={{}}
                >
                  {PLAYBOOK_SPREADS.map((spread) => [
                    <SpreadLeftPage key={`left-${spread.id}`} spread={spread} />,
                    <SpreadRightPage key={`right-${spread.id}`} spread={spread} />
                  ])}
                </HTMLFlipBook>
              </div>

            </div>

            {/* Draggable Brass Magnifying Loupe (Meng To Signature Lens) */}
            {isLoupeEnabled && loupeState.visible && (
              <div
                className="pointer-events-none absolute z-50 rounded-full border-4 border-[#78350f] shadow-[0_18px_45px_rgba(0,0,0,0.5),inset_0_0_24px_rgba(255,255,255,0.45)] overflow-hidden hidden sm:block"
                style={{
                  width: 150,
                  height: 150,
                  left: loupeState.x - 75,
                  top: loupeState.y - 75,
                  backgroundImage: `url(${loupeState.imageSrc})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: `${loupeState.bgX}% ${loupeState.bgY}%`,
                  backgroundSize: '290% 290%',
                  backgroundColor: '#faf6ee',
                }}
              >
                {/* Brass Glare Highlight & Lens Crosshair Ring */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent pointer-events-none" />
                <div className="absolute inset-0 border border-amber-400/60 rounded-full pointer-events-none" />
                <div className="absolute inset-[30%] border border-amber-600/20 rounded-full pointer-events-none" />
              </div>
            )}

            {/* Under-Book Editorial Spread Caption & World Taekwondo Rule Excerpt */}
            <div className="mt-6 text-center max-w-xl mx-auto space-y-2 px-4">
              <div className="flex items-center justify-center gap-2 font-mono text-[10px] text-amber-800">
                <span className="font-bold">{currentSpread.plate}</span>
                <span>·</span>
                <span className="text-slate-500">{currentSpread.location}</span>
                <span>·</span>
                <span className="font-bold text-red-600">{currentSpread.date}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight font-serif">
                {currentSpread.spreadNumber} — {currentSpread.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                {currentSpread.caption}
              </p>
              <div className="pt-1">
                <p className="text-[11px] font-mono text-[#8a765d] bg-[#f5ede0] border border-[#e4d7c0] rounded-lg px-3 py-1.5 inline-block text-left">
                  <span className="font-bold text-[#b45309]">Rule Note: </span>
                  {currentSpread.rulesExcerpt}
                </p>
              </div>
            </div>

            {/* Bottom Numbered Jump Tabs 01-08 */}
            <div className="mt-8 pt-5 border-t border-[#ded2bd] flex flex-col sm:flex-row items-center justify-between gap-4">
              
              <span className="text-[11px] font-mono text-[#8c7b64] flex items-center gap-1.5 order-2 sm:order-1">
                <Move className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Drag corners to curl 2-page spread · Hover to inspect watercolor details</span>
                <span className="sm:hidden">Swipe or drag corners to turn spreads</span>
              </span>

              {/* Numbered Jump Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-1 sm:order-2">
                {PLAYBOOK_SPREADS.map((spread, idx) => {
                  const isActive = idx === currentSpreadIndex;
                  return (
                    <button
                      key={spread.id}
                      type="button"
                      onClick={() => handleJumpToSpread(idx)}
                      title={spread.title}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm scale-105 border border-slate-900 ring-2 ring-amber-500/20'
                          : 'bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border border-[#ded5c0]'
                      }`}
                    >
                      {spread.spreadNumber}
                    </button>
                  );
                })}
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* Fullscreen Zoom Studio Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 sm:p-8 animate-fade-in select-none"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full h-[85vh] bg-slate-900/90 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheelZoom}
          >
            {/* Header */}
            <div className="p-4 sm:px-6 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-white font-mono text-xs z-20">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-bold uppercase">
                  {currentSpread.plate} · {currentSpread.tag}
                </span>
                <span className="font-bold">{currentSpread.spreadNumber} — {currentSpread.title}</span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.max(1, z - 0.5))}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <span className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-[11px] font-bold text-slate-300 min-w-[55px] text-center">
                  {Math.round(lightboxZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.min(4, z + 0.5))}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLightboxZoom(1);
                    setLightboxPan({ x: 0, y: 0 });
                  }}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 rounded-lg text-rose-300 hover:text-white transition-colors cursor-pointer ml-2"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Central Canvas */}
            <div
              className={`relative flex-grow flex items-center justify-center p-4 overflow-hidden ${
                lightboxZoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
              }`}
              onMouseDown={(e) => handlePanStart(e.clientX, e.clientY)}
              onMouseMove={(e) => handlePanMove(e.clientX, e.clientY)}
              onMouseUp={handlePanEnd}
              onTouchStart={(e) => handlePanStart(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => handlePanMove(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchEnd={handlePanEnd}
            >
              <button
                type="button"
                onClick={() => {
                  setCurrentSpreadIndex((prev) => Math.max(0, prev - 1));
                  setLightboxPan({ x: 0, y: 0 });
                }}
                disabled={currentSpreadIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 bg-slate-900/90 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 text-white rounded-full transition-all cursor-pointer shadow-xl"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentSpreadIndex((prev) => Math.min(PLAYBOOK_SPREADS.length - 1, prev + 1));
                  setLightboxPan({ x: 0, y: 0 });
                }}
                disabled={currentSpreadIndex === PLAYBOOK_SPREADS.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 bg-slate-900/90 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 text-white rounded-full transition-all cursor-pointer shadow-xl"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              <div
                className="w-full h-full flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={currentSpread.imageSrc}
                  alt={currentSpread.title}
                  className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-xl pointer-events-none select-none"
                  draggable={false}
                />
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono z-20">
              <span className="text-slate-400 text-[11px]">
                {currentSpread.caption}
              </span>

              <div className="flex items-center gap-1.5">
                {PLAYBOOK_SPREADS.map((spread, idx) => (
                  <button
                    key={spread.id}
                    onClick={() => {
                      setCurrentSpreadIndex(idx);
                      setLightboxPan({ x: 0, y: 0 });
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      idx === currentSpreadIndex
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {spread.spreadNumber}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
