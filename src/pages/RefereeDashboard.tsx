import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck, Radio, CheckCircle, Clock, Trophy, RefreshCw,
  LogOut, Filter, Swords, ChevronRight, Award, AlertCircle, PlayCircle, Eye, ArrowLeft, Home
} from 'lucide-react';
import { io } from 'socket.io-client';
import { calculateRoundsWon } from '../utils/bracketUtils';

export const RefereeDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [matches, setMatches] = useState<any[]>([]);
  const [finalizedDrawsCount, setFinalizedDrawsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'live' | 'completed'>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [matFilter, setMatFilter] = useState<string>('all');
  const [weightFilter, setWeightFilter] = useState<string>('all');
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Derive unique filter values from matches
  const uniqueMats = Array.from(new Set(matches.map(m => m.matNumber || (m.matchIndex !== undefined ? (m.matchIndex % 4) + 1 : '1')))).sort();
  const uniqueWeights = Array.from(new Set(matches.map(m => m.weightCategory))).filter(Boolean).sort();
  const uniqueAges = Array.from(new Set(matches.map(m => m.ageCategory))).filter(Boolean).sort();

  // Fetch referee matches and events
  const loadData = async (isManual = false) => {
    if (!user) return;
    if (isManual) setRefreshing(true);

    const fetchData = async () => {
      try {
        const eventsRes = await fetch('/api/referee/events', {
          credentials: 'include'
        });
        
        if (!eventsRes.ok) {
          const text = await eventsRes.text();
          console.error('[Referee Dashboard] Events fetch failed:', eventsRes.status, text.substring(0, 100));
          throw new Error(`Events API error: ${eventsRes.status}. Please check your connection.`);
        }
        
        const contentType = eventsRes.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await eventsRes.text();
          console.error('[Referee Dashboard] Events received non-JSON response:', text.substring(0, 100));
          throw new Error('Events API returned invalid data format. Please refresh the page.');
        }

        const eventsData = await eventsRes.json();
        setEvents(eventsData);

        const matchesRes = await fetch(`/api/referee/matches${selectedEventId ? `?eventId=${selectedEventId}` : ''}`, {
          credentials: 'include'
        });

        if (!matchesRes.ok) {
          const text = await matchesRes.text();
          console.error('[Referee Dashboard] Matches fetch failed:', matchesRes.status, text.substring(0, 100));
          throw new Error(`Matches API error: ${matchesRes.status}. Please check your connection.`);
        }

        const mContentType = matchesRes.headers.get('content-type');
        if (!mContentType || !mContentType.includes('application/json')) {
          const text = await matchesRes.text();
          console.error('[Referee Dashboard] Matches received non-JSON response:', text.substring(0, 100));
          throw new Error('Matches API returned invalid data format. Please refresh the page.');
        }

        const matchesData = await matchesRes.json();
        setMatches(matchesData.matches || []);
        setFinalizedDrawsCount(matchesData.finalizedDrawsCount || 0);
      } catch (err: any) {
        console.error('Referee dashboard fetch error:', err);
        setError(err.message || 'Error loading tournament data.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    fetchData();
  };

  useEffect(() => {
    loadData();

    // Socket.io for live updates
    const socket = io(window.location.origin);

    socket.on('global_match_update', (updatedMatch) => {
      setMatches((prev) =>
        prev.map((m) => (m._id === updatedMatch._id ? { ...m, ...updatedMatch } : m))
      );
    });

    socket.on('global_draw_update', () => {
      loadData();
    });

    const interval = setInterval(() => {
      loadData();
    }, 15000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [user, selectedEventId]);

  const handleLogout = () => {
    logout();
    navigate('/referee/login');
  };

  // Filtered match list
  const filteredMatches = matches.filter((m) => {
    // Status filter
    if (statusFilter === 'upcoming' && m.status !== 'upcoming' && m.status !== 'pending') return false;
    if (statusFilter === 'live' && m.status !== 'live') return false;
    if (statusFilter === 'completed' && m.status !== 'completed') return false;

    // Gender filter
    if (genderFilter !== 'all' && m.gender !== genderFilter) return false;

    // Mat filter
    const matchMat = String(m.matNumber || (m.matchIndex !== undefined ? (m.matchIndex % 4) + 1 : '1'));
    if (matFilter !== 'all' && matchMat !== matFilter) return false;

    // Weight filter
    if (weightFilter !== 'all' && m.weightCategory !== weightFilter) return false;

    // Age filter
    if (ageFilter !== 'all' && m.ageCategory !== ageFilter) return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const p1Match = (m.player1Name || '').toLowerCase().includes(q);
      const p2Match = (m.player2Name || '').toLowerCase().includes(q);
      const weightMatch = (m.weightCategory || '').toLowerCase().includes(q);
      const catMatch = (m.ageCategory || '').toLowerCase().includes(q);
      const roundMatch = (m.round || '').toLowerCase().includes(q);
      return p1Match || p2Match || weightMatch || catMatch || roundMatch;
    }

    return true;
  });

  // Group filtered matches by division & weight category
  const groupedCategories: Record<string, any[]> = {};
  filteredMatches.forEach((m) => {
    const key = `${m.ageCategory || 'General'} · ${m.weightCategory} (${(m.gender || 'male').toUpperCase()})`;
    if (!groupedCategories[key]) {
      groupedCategories[key] = [];
    }
    groupedCategories[key].push(m);
  });

  const liveMatchesCount = matches.filter((m) => m.status === 'live').length;
  const upcomingMatchesCount = matches.filter((m) => m.status === 'upcoming' || m.status === 'pending').length;
  const completedMatchesCount = matches.filter((m) => m.status === 'completed').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Dedicated Referee Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Brand & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-md shadow-red-900/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-white uppercase font-mono">
                  Officiating Desk Control
                </h1>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-red-950 text-red-400 border border-red-800 uppercase">
                  REFEREE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Logged in as <strong className="text-white">{user?.name}</strong>
              </p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 text-xs font-mono font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              title={user?.role === 'admin' ? 'Return to Admin Control Panel' : 'Return to Home Arena'}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{user?.role === 'admin' ? 'Back to Admin' : 'Back to Home'}</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sync Draw Matches"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-500' : ''}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 text-xs font-mono font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Wrapper */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-grow space-y-6">
        
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Finalized Draw Divisions
            </span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-white font-mono">{finalizedDrawsCount}</span>
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-[10px] text-slate-500">Only verified finalized brackets</p>
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              In Progress / Live
            </span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-red-500 font-mono">{liveMatchesCount}</span>
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-500">Actively on scoring mat</p>
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Upcoming Matches
            </span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-blue-400 font-mono">{upcomingMatchesCount}</span>
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-[10px] text-slate-500">Queued for next round</p>
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Completed & Locked
            </span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-emerald-400 font-mono">{completedMatchesCount}</span>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-[10px] text-slate-500">Official results submitted</p>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-rose-950/70 border border-rose-800 text-rose-200 text-xs p-4 rounded-xl flex items-center gap-2.5 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 3. Tournament Event & Category Selector Toolbar */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Event Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Tournament Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="block w-full sm:w-72 bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white px-3 py-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none cursor-pointer"
              >
                <option value="">All Events (Global Roster)</option>
                {events.map((evt) => (
                  <option key={evt._id} value={evt._id}>
                    {evt.name} ({evt.eventYear || 2026})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="space-y-1 flex-grow max-w-xs">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Search Athlete / Round
              </label>
              <input
                type="text"
                placeholder="Name or round..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Detailed Filters Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">Mat / Ring</label>
              <select
                value={matFilter}
                onChange={(e) => setMatFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-[11px] font-mono font-bold text-white px-2 py-1.5 rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
              >
                <option value="all">All Mats</option>
                {uniqueMats.map(mat => (
                  <option key={mat} value={String(mat)}>Mat {mat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">Gender</label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-[11px] font-mono font-bold text-white px-2 py-1.5 rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">Age Division</label>
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-[11px] font-mono font-bold text-white px-2 py-1.5 rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
              >
                <option value="all">All Divisions</option>
                {uniqueAges.map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">Weight Class</label>
              <select
                value={weightFilter}
                onChange={(e) => setWeightFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-[11px] font-mono font-bold text-white px-2 py-1.5 rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
              >
                <option value="all">All Weights</option>
                {uniqueWeights.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              {[
                { id: 'all', label: `All Matches (${matches.length})` },
                { id: 'live', label: `Live Scoring (${liveMatchesCount})`, icon: Radio },
                { id: 'upcoming', label: `Upcoming (${upcomingMatchesCount})` },
                { id: 'completed', label: `Completed (${completedMatchesCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition-all flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {tab.id === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Match Categories and Pairings Display */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-red-500 animate-spin mx-auto" />
            <p className="text-xs font-mono text-slate-400 uppercase font-bold">
              Loading Finalized Bracket Officiating Pool...
            </p>
          </div>
        ) : Object.keys(groupedCategories).length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-black text-white font-mono uppercase">
                No Finalized Officiating Matches Found
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Matches are automatically unlocked for referees only after the tournament administrator generates and finalizes the draw bracket.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedCategories).map(([categoryTitle, categoryMatches]) => (
              <div key={categoryTitle} className="space-y-3">
                {/* Category Division Section Banner */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-red-500" />
                    <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-200">
                      {categoryTitle}
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800 font-bold">
                    {categoryMatches.length} Matches in Division
                  </span>
                </div>

                {/* Match Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryMatches.map((match: any) => {
                    const isLive = match.status === 'live';
                    const isCompleted = match.status === 'completed';
                    const isTBD = match.player1Name === 'TBD' || match.player2Name === 'TBD';
                    const isBye = match.player1Name === 'BYE' || match.player2Name === 'BYE';

                    return (
                      <div
                        key={match._id}
                        className={`bg-slate-900 rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-lg ${
                          isLive
                            ? 'border-red-500/80 ring-2 ring-red-500/20 shadow-red-950/40'
                            : isCompleted
                            ? 'border-emerald-800/40 opacity-90'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Top Match Metadata Tag - Highlighted Mat Number, Weight Category & Start Time */}
                        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-col gap-2 font-mono">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {/* Prominent Mat Badge */}
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/80 text-red-400 border border-red-800/80 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                <Swords className="w-3 h-3 text-red-500" />
                                <span>MAT {match.matNumber || ((match.matchIndex !== undefined ? match.matchIndex : 0) % 4) + 1}</span>
                              </span>
                              <span className="font-bold text-slate-300 text-[10px] uppercase">{match.round || 'Round 1'}</span>
                              {match.matchIndex !== undefined && (
                                <span className="text-slate-500 text-[10px]">#M{match.matchIndex + 1}</span>
                              )}
                            </div>

                            <div>
                              {isLive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white font-black text-[9px] uppercase animate-pulse shadow-md">
                                  <Radio className="w-3 h-3" /> Live Officiating
                                </span>
                              ) : isCompleted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-black text-[9px] uppercase">
                                  <CheckCircle className="w-3 h-3" /> Locked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-bold text-[9px] uppercase">
                                  <Clock className="w-3 h-3 text-amber-400" /> Upcoming
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Weight Category & Start Time Bar */}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-900/80 text-slate-400">
                            <span className="font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              🏋️ {match.weightCategory || 'Open Weight'}
                            </span>
                            <span className="flex items-center gap-1 text-slate-400 font-mono">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{match.startTime || match.scheduledTime || `Est: ${10 + ((match.matchIndex || 0) % 6)}:${((match.matchIndex || 0) * 15) % 60 === 0 ? '00' : ((match.matchIndex || 0) * 15) % 60} AM`}</span>
                            </span>
                          </div>
                        </div>

                        {/* Competitors Score Display Box */}
                        {(() => {
                          const roundsWon = calculateRoundsWon(match);
                          return (
                            <div className="p-4 space-y-3 font-sans">
                              {/* RED (Hong) Competitor */}
                              <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                                match.winnerId && (match.winnerId === match.player1Id)
                                  ? 'bg-red-950/50 border-red-600/80 ring-1 ring-red-500'
                                  : 'bg-slate-950/60 border-red-900/30'
                              }`}>
                                <div className="space-y-0.5 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500" />
                                    <span className="text-[10px] font-mono font-black text-red-400 uppercase tracking-widest">
                                      RED (HONG)
                                    </span>
                                  </div>
                                  <div className="text-sm font-extrabold text-white truncate max-w-[170px]">
                                    {match.player1Name || 'TBD'}
                                  </div>
                                </div>
                                <div className="text-right font-mono px-2">
                                  <span className="text-[9px] font-normal uppercase text-slate-400 block tracking-wider">Rounds</span>
                                  <span className="text-2xl font-black text-red-400">
                                    {roundsWon.player1}
                                  </span>
                                </div>
                              </div>

                              {/* BLUE (Chung) Competitor */}
                              <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                                match.winnerId && (match.winnerId === match.player2Id)
                                  ? 'bg-blue-950/50 border-blue-600/80 ring-1 ring-blue-500'
                                  : 'bg-slate-950/60 border-blue-900/30'
                              }`}>
                                <div className="space-y-0.5 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500" />
                                    <span className="text-[10px] font-mono font-black text-blue-400 uppercase tracking-widest">
                                      BLUE (CHUNG)
                                    </span>
                                  </div>
                                  <div className="text-sm font-extrabold text-white truncate max-w-[170px]">
                                    {match.player2Name || 'TBD'}
                                  </div>
                                </div>
                                <div className="text-right font-mono px-2">
                                  <span className="text-[9px] font-normal uppercase text-slate-400 block tracking-wider">Rounds</span>
                                  <span className="text-2xl font-black text-blue-400">
                                    {roundsWon.player2}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Card Action Footer */}
                        <div className="p-3 bg-slate-950/50 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[130px]">
                            {match.updatedBy ? `By ${match.updatedBy}` : 'Unassigned'}
                          </span>

                          <Link
                            to={`/referee/match/${match._id}`}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer shadow-md ${
                              isLive
                                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-900/50 animate-pulse ring-2 ring-red-400/40'
                                : isCompleted
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-red-900/30'
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-slate-400" />
                                <span>View Result</span>
                              </>
                            ) : isLive ? (
                              <>
                                <Radio className="w-3.5 h-3.5 text-white animate-spin" />
                                <span>Start Officiating</span>
                              </>
                            ) : (
                              <>
                                <PlayCircle className="w-3.5 h-3.5 text-red-300" />
                                <span>Start Officiating</span>
                              </>
                            )}
                            <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 5. Minimal Referee Bottom Bar */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-6 text-center text-[10px] font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Taekwondo Electronic Scoring System · Official Referee Console</span>
        <span>Secure Session Protected by JWT & Role-Based Guard</span>
      </footer>
    </div>
  );
};
