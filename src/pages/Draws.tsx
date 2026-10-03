import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { BracketVisualizer } from '../components/BracketVisualizer';
import { BracketLegend } from '../components/BracketLegend';
import { sanitizeMatchesForInitialDraw, exportBracketSvg, exportBracketPdf } from '../utils/bracketUtils';
import { 
  Calendar, Trophy, CheckCircle, Swords, 
  Clock, Sliders, CheckCircle2, ShieldCheck, 
  RefreshCw, AlertCircle, Users, Download, FileText
} from 'lucide-react';

interface Event {
  _id: string;
  name: string;
  date: string;
  venue: string;
  description?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  eventYear: number;
}

export const Draws: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [bracketAgeCategory, setBracketAgeCategory] = useState('Senior');
  const [bracketGender, setBracketGender] = useState<'male' | 'female'>('male');
  const [bracketWeight, setBracketWeight] = useState('');
  const [bracketMatches, setBracketMatches] = useState<any[]>([]);
  const [drawStatus, setDrawStatus] = useState<'draft' | 'finalized'>('draft');
  const [drawDetails, setDrawDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Page Load: Events & Categories
  useEffect(() => {
    trackEngagement('page_view_draws', '/draws', user?._id);

    const loadInitialData = async () => {
      try {
        const [eventsRes, catRes] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/categories')
        ]);

        if (!eventsRes.ok) throw new Error('Failed to load events.');
        const eventsData: Event[] = await eventsRes.json();
        setEvents(eventsData);

        const catData = catRes.ok ? await catRes.json() : [];
        setCategories(catData);

        // Pre-select event from URL or first available event
        const urlEventId = searchParams.get('event');
        if (urlEventId && eventsData.some(e => e._id === urlEventId)) {
          setSelectedEventId(urlEventId);
        } else if (eventsData.length > 0) {
          setSelectedEventId(eventsData[0]._id);
        }

        // Pre-select category/gender/weight from URL if present
        const urlAge = searchParams.get('age');
        if (urlAge) setBracketAgeCategory(urlAge);

        const urlGender = searchParams.get('gender');
        if (urlGender === 'male' || urlGender === 'female') setBracketGender(urlGender);

        const urlWeight = searchParams.get('weight');
        if (urlWeight) setBracketWeight(urlWeight);

      } catch (err: any) {
        setError(err.message || 'Error initializing bracket explorer.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);

  // 2. Compute available weight classes for active age + gender
  const weightClasses = useMemo(() => {
    if (categories.length > 0) {
      const matched = categories.find(c => c.name.toLowerCase() === bracketAgeCategory.toLowerCase());
      if (matched) {
        return bracketGender === 'male' ? matched.maleWeightClasses : matched.femaleWeightClasses;
      }
    }
    return [];
  }, [bracketAgeCategory, bracketGender, categories]);

  // Sync default weight class when list changes
  useEffect(() => {
    if (weightClasses.length > 0) {
      if (!weightClasses.includes(bracketWeight)) {
        setBracketWeight(weightClasses[0]);
      }
    } else {
      setBracketWeight('');
    }
  }, [weightClasses, bracketWeight]);

  // 3. Fetch Bracket Draw when selections change (silent = false on initial load/manual button)
  const fetchBracketDraw = useCallback(async (silent = false) => {
    if (!selectedEventId || !bracketWeight) {
      setBracketMatches([]);
      setDrawStatus('draft');
      setDrawDetails(null);
      return;
    }

    if (!silent) {
      setBracketLoading(true);
    }
    try {
      const isAdmin = user?.role === 'admin';
      const res = await fetch(`/api/events/${selectedEventId}/draw/${encodeURIComponent(bracketAgeCategory)}?weightCategory=${encodeURIComponent(bracketWeight)}&gender=${bracketGender}&preview=${isAdmin ? 'true' : 'false'}`);
      if (res.ok) {
        const data = await res.json();
        setDrawStatus(data.status);
        setDrawDetails(data.draw || null);
        setBracketMatches(data.matches || []);
      } else {
        setDrawStatus('draft');
        setDrawDetails(null);
        setBracketMatches([]);
      }
    } catch (err) {
      console.error('Error fetching bracket draw details:', err);
      setDrawStatus('draft');
      setDrawDetails(null);
      setBracketMatches([]);
    } finally {
      if (!silent) {
        setBracketLoading(false);
      }
      setLastRefreshedAt(new Date());
    }
  }, [selectedEventId, bracketAgeCategory, bracketGender, bracketWeight, user?.role]);

  const [publishing, setPublishing] = useState(false);
  const handleFinalizeFromDraws = async () => {
    const isAdmin = user?.role === 'admin';
    if (!isAdmin) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/draws/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          eventId: selectedEventId,
          category: bracketAgeCategory,
          weightCategory: bracketWeight,
          gender: bracketGender
        })
      });
      if (res.ok) {
        setDrawStatus('finalized');
        fetchBracketDraw(false);
      }
    } catch (err) {
      console.error('Error finalizing draw from Draws page:', err);
    } finally {
      setPublishing(false);
    }
  };

  // View Draw / Bracket page requirement:
  // ONLY Round 1 retains competitor names and scores. All subsequent rounds (Quarterfinals, Semifinals, Finals)
  // are permanently sanitized to empty "TBD vs TBD" placeholder slots in this view.
  const displayBracketMatches = useMemo(() => {
    return sanitizeMatchesForInitialDraw(bracketMatches);
  }, [bracketMatches]);

  const getBracketCanvasSvg = (): SVGSVGElement | null => {
    return (
      document.querySelector('#draw-bracket-visualizer-container svg[data-bracket-canvas="true"]') as SVGSVGElement | null ||
      document.querySelector('#draw-bracket-visualizer-container svg#d3-bracket-canvas-svg') as SVGSVGElement | null ||
      document.querySelector('#draw-bracket-visualizer-container svg.bracket-svg-canvas') as SVGSVGElement | null
    );
  };

  const handleDownloadBracketPdf = async () => {
    const svgEl = getBracketCanvasSvg();
    if (!svgEl) return;
    setPdfExporting(true);
    const safeTitle = `CombatFlow_Draw_${bracketAgeCategory}_${bracketWeight}_${bracketGender}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    await exportBracketPdf(svgEl, `${safeTitle}.pdf`, {
      title: `${selectedEvent?.name || 'Tournament Championship'} • ${bracketAgeCategory} Division`,
      eventName: selectedEvent?.name,
      category: bracketAgeCategory,
      weightCategory: bracketWeight,
      gender: bracketGender === 'male' ? 'Male Competitors' : 'Female Competitors'
    });
    setPdfExporting(false);
  };

  const handleDownloadBracketSvg = () => {
    const svgEl = getBracketCanvasSvg();
    if (!svgEl) return;
    const safeTitle = `CombatFlow_Draw_${bracketAgeCategory}_${bracketWeight}_${bracketGender}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    exportBracketSvg(svgEl, `${safeTitle}.svg`);
  };

  // Initial load on category/weight change + targeted match completion event listener (NO background interval polling)
  useEffect(() => {
    if (!loading) {
      // Fetch initial data for the chosen category
      fetchBracketDraw(false);
      
      // Initialize Socket.io connection for match completion and bracket updates
      const socket = io();
      
      // Join room scoped to selected weight category + gender
      if (bracketWeight && bracketGender) {
        socket.emit('join_room', { weightCategory: bracketWeight, gender: bracketGender });
      }

      // ONLY re-fetch silently when a match is actually COMPLETED so the winner advances to the next round slot
      socket.on('match_completed', (data: any) => {
        if (
          (!data.weightCategory || data.weightCategory?.toLowerCase() === bracketWeight?.toLowerCase()) &&
          (!data.gender || data.gender?.toLowerCase() === bracketGender?.toLowerCase())
        ) {
          fetchBracketDraw(true);
        }
      });

      socket.on('match_updated', (data: any) => {
        // Only trigger update if match was just completed (to advance winner)
        if (
          data?.status === 'completed' &&
          (!data.weightCategory || data.weightCategory?.toLowerCase() === bracketWeight?.toLowerCase()) &&
          (!data.gender || data.gender?.toLowerCase() === bracketGender?.toLowerCase())
        ) {
          fetchBracketDraw(true);
        }
      });

      socket.on('draw_status_updated', (data: any) => {
        if (
          (!data.eventId || data.eventId === selectedEventId) &&
          (!data.category || data.category?.toLowerCase() === bracketAgeCategory?.toLowerCase()) &&
          (!data.weightCategory || data.weightCategory?.toLowerCase() === bracketWeight?.toLowerCase()) &&
          (!data.gender || data.gender?.toLowerCase() === bracketGender?.toLowerCase())
        ) {
          fetchBracketDraw(true);
        }
      });

      socket.on('bracket_generated', (data: any) => {
        if (
          data.weightCategory?.toLowerCase() === bracketWeight?.toLowerCase() &&
          data.gender?.toLowerCase() === bracketGender?.toLowerCase()
        ) {
          fetchBracketDraw(true);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [fetchBracketDraw, loading, selectedEventId, bracketAgeCategory, bracketGender, bracketWeight]);

  const selectedEvent = useMemo(() => {
    return events.find(e => e._id === selectedEventId) || events[0] || null;
  }, [events, selectedEventId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-600">
        <Swords className="w-12 h-12 text-rose-500 animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Loading tournament brackets...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-rose-600 text-xs font-bold uppercase tracking-widest bg-rose-50 px-3.5 py-1.5 rounded-full border border-rose-100">
          Official Tournament Draws
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-3 sm:text-4xl">
          Tournament Draws & Brackets
        </h1>
        <p className="mt-3 text-base text-slate-500">
          Inspect official published seeding, knockout trees, scheduled order of fights, and real-time winner progressions.
        </p>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 rounded-r-lg text-sm font-medium mb-8">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Selection & Filter Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Registry
                </span>
                {drawStatus === 'finalized' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Finalized & Published
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
                Division & Bracket Selections
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Choose the championship event, age division, gender, and weight category to inspect its official tournament bracket.
              </p>
            </div>

            {/* Action Controls: Refresh & Download Bracket (PDF / SVG) */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={handleDownloadBracketPdf}
                disabled={bracketLoading || displayBracketMatches.length === 0 || pdfExporting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer shadow-sm shadow-rose-600/20 disabled:opacity-50"
                title="Download official Draw / Bracket PDF document"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{pdfExporting ? 'Generating PDF...' : 'Download PDF'}</span>
              </button>
              <button
                onClick={handleDownloadBracketSvg}
                disabled={bracketLoading || displayBracketMatches.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
                title="Download official Draw / Bracket SVG vector file"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>SVG</span>
              </button>
              <button
                onClick={() => fetchBracketDraw(false)}
                disabled={bracketLoading}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
                title="Refresh tournament bracket draw"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${bracketLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
                Synced: {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Interactive Division & Category Selection Controls */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Event Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                Championship Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setSearchParams({ event: e.target.value });
                }}
                className="w-full text-xs font-semibold border border-slate-300 p-2.5 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer shadow-sm"
              >
                {events.map((evt) => (
                  <option key={evt._id} value={evt._id}>
                    {evt.name} ({evt.status})
                  </option>
                ))}
                {events.length === 0 && <option value="">No events available</option>}
              </select>
            </div>

            {/* Age Division Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                Age Division
              </label>
              <select
                value={bracketAgeCategory}
                onChange={(e) => setBracketAgeCategory(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 p-2.5 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer shadow-sm"
              >
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
                {categories.length === 0 && (
                  <>
                    <option value="Sub-Junior">Sub-Junior</option>
                    <option value="Cadet">Cadet</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                  </>
                )}
              </select>
            </div>

            {/* Gender Group Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                Gender Pool
              </label>
              <select
                value={bracketGender}
                onChange={(e) => setBracketGender(e.target.value as any)}
                className="w-full text-xs font-semibold border border-slate-300 p-2.5 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer shadow-sm"
              >
                <option value="male">Male Competitors</option>
                <option value="female">Female Competitors</option>
              </select>
            </div>

            {/* Weight Class Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                Weight Category
              </label>
              <select
                value={bracketWeight}
                onChange={(e) => setBracketWeight(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 p-2.5 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer shadow-sm"
              >
                {weightClasses.map((w: string, idx: number) => (
                  <option key={idx} value={w}>{w}</option>
                ))}
                {weightClasses.length === 0 && <option value="">No categories defined</option>}
              </select>
            </div>
          </div>

          {/* Selected Target Summary Info Tag */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Active Scope:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-semibold">
                {selectedEvent?.name || 'Selected Event'}
              </span>
              <span>•</span>
              <span className="font-mono bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 font-semibold">
                {bracketAgeCategory} | {bracketGender === 'male' ? 'Male' : 'Female'} | {bracketWeight || 'None'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Total Bouts:</span>
              <span className="font-mono font-bold text-slate-800">{bracketMatches.length}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BRACKET CONTENT AREA */}
        {/* ========================================================================= */}
        {bracketLoading && bracketMatches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-600 shadow-sm">
            <Swords className="w-12 h-12 text-rose-500 animate-spin mb-4" />
            <p className="text-sm font-bold tracking-wide text-slate-800">Retrieving official bracket nodes...</p>
            <p className="text-xs text-slate-400 mt-1">Connecting to tournament draw registry</p>
          </div>
        ) : drawStatus === 'draft' && (!user || user.role !== 'admin' || bracketMatches.length === 0) ? (
          /* DRAFT STATE: Draw not published yet */
          <div className="bg-white rounded-3xl border border-dashed border-amber-200 p-12 sm:p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            <span className="inline-block text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 font-mono mb-2">
              Draft Status
            </span>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Draw not published yet
            </h3>
            <p className="text-sm text-slate-500 max-w-lg mx-auto mt-2 leading-relaxed">
              The official tournament bracket for <strong className="text-slate-700">{bracketWeight}</strong> ({bracketGender === 'male' ? 'Male' : 'Female'}) in the <strong className="text-slate-700">{bracketAgeCategory}</strong> division is currently being seeded and finalized by tournament officials.
            </p>
            <div className="mt-6 p-4 bg-slate-50 rounded-2xl max-w-md mx-auto border border-slate-200 text-left text-xs text-slate-600 space-y-1.5">
              <div className="font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                What happens next?
              </div>
              <p className="text-slate-500">
                Once tournament administrators finalize and publish this bracket, the full progression tree, athlete matchups, ring schedules, and live scoring will immediately be accessible here.
              </p>
            </div>
          </div>
        ) : bracketMatches.length === 0 ? (
          /* FINALIZED BUT EMPTY MATCHES */
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center shadow-sm">
            <Swords className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-800">Draw published without bouts</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              This division is marked as finalized, but no individual bout records were populated. Please check back as matches are assigned.
            </p>
          </div>
        ) : (
          /* VERIFIED OR ADMIN DRAFT PREVIEW BRACKET DISPLAY */
          <div className="space-y-8">
            {/* Publication or Draft Preview Status Card */}
            {drawStatus === 'draft' ? (
              <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold uppercase font-mono tracking-wider text-amber-900 text-xs">
                        Admin Draft Preview • {bracketMatches.length} Matches Seeded
                      </p>
                      <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded">
                        Unpublished Draft
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 mt-0.5">
                      This bracket tree is currently in draft mode. Athletes and spectators cannot view it until you publish.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleFinalizeFromDraws}
                  disabled={publishing}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{publishing ? 'Publishing...' : 'Publish Draw Live 🚀'}</span>
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-emerald-950">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold uppercase font-mono tracking-wider text-emerald-800 text-xs">
                        Official Published Draw Sheet
                      </p>
                      <span className="bg-emerald-200/60 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        Read-Only
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      This draw is locked against structural changes and is actively tracked by referee scorepads.
                    </p>
                  </div>
                </div>

                {drawDetails?.finalizedAt && (
                  <div className="text-xs text-emerald-800 font-mono bg-white/80 py-1.5 px-3 rounded-xl border border-emerald-200 shrink-0">
                    <span className="text-slate-400">Published: </span>
                    {new Date(drawDetails.finalizedAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Interactive Progression Tree (D3 BracketVisualizer Engine) - Initial Draw Only Mode */}
            <div id="draw-bracket-visualizer-container">
              <BracketVisualizer 
                matches={displayBracketMatches} 
                initialDrawOnly={true}
                showScores={false}
                title={`${bracketAgeCategory} Division • ${bracketWeight} (${bracketGender === 'male' ? 'Male Competitors' : 'Female Competitors'})`}
              />
            </div>

            {/* Dedicated Bracket Legend Component */}
            <BracketLegend />
          </div>
        )}
      </div>
    </div>
  );
};
