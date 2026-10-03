import React, { useEffect, useState, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { 
  Swords, Radio, Tv, Award, CircleDot, Info, Calendar, Trophy, 
  ChevronRight, Share2, HelpCircle, Search, Sliders, RefreshCw, 
  ZoomIn, ZoomOut, ArrowLeft, MapPin, Users, CheckCircle2, ChevronLeft
} from 'lucide-react';
import { CATEGORY_STRUCTURE } from '../utils/categories';
import { getMatchSlotDisplay, calculateRoundsWon } from '../utils/bracketUtils';

export const LiveScores: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // Fetch dynamic categories
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.ok ? res.json() : [])
      .then(data => setDbCategories(data))
      .catch(err => console.error('Error fetching categories in LiveScores:', err));
  }, []);

  // Helper to determine ageCategory from weight class dynamically
  const getAgeCategoryFromWeightClass = (weightClass: string, gender: string): string => {
    if (dbCategories && dbCategories.length > 0) {
      for (const cat of dbCategories) {
        const classes = gender === 'male' ? cat.maleWeightClasses : cat.femaleWeightClasses;
        if (classes && classes.includes(weightClass)) {
          return cat._id;
        }
      }
    }
    // Fallback static check
    for (const [ageCat, genders] of Object.entries(CATEGORY_STRUCTURE)) {
      const gendersObj = genders as Record<string, any>;
      if (gendersObj[gender] && gendersObj[gender][weightClass]) {
        return ageCat;
      }
    }
    return "Senior";
  };

  const categoryOptions = useMemo(() => {
    if (dbCategories && dbCategories.length > 0) {
      return dbCategories.map(c => c._id);
    }
    return ["Sub-Junior", "Cadet", "Junior", "Senior"];
  }, [dbCategories]);

  // Navigation states
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWeightClass, setSelectedWeightClass] = useState<string | null>(null);

  // Data states
  const [events, setEvents] = useState<any[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [categoryDrawStatus, setCategoryDrawStatus] = useState<'draft' | 'finalized'>('draft');

  useEffect(() => {
    if (!selectedEvent || !selectedCategory || !selectedWeightClass || !selectedGender) {
      return;
    }

    const checkDrawStatus = async () => {
      try {
        const res = await fetch(`/api/events/${selectedEvent._id}/draw/${selectedCategory}?weightCategory=${encodeURIComponent(selectedWeightClass)}&gender=${selectedGender}`);
        if (res.ok) {
          const data = await res.json();
          setCategoryDrawStatus(data.status);
        }
      } catch (err) {
        console.error('Failed to retrieve draw status:', err);
      }
    };

    checkDrawStatus();
  }, [selectedEvent, selectedCategory, selectedWeightClass, selectedGender]);

  // Search & Zoom controls (Step 4 Bracket)
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomScale, setZoomScale] = useState(1);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // 1. Fetch Events (Step 1)
  useEffect(() => {
    trackEngagement('page_view_live_scores', '/live');
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (err) {
        console.error('Error fetching events:', err);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);

  // 2. Fetch Matches for the selected Event
  useEffect(() => {
    if (!selectedEvent) {
      setAllMatches([]);
      return;
    }

    const fetchMatches = async () => {
      setLoadingMatches(true);
      try {
        const res = await fetch(`/api/matches?eventId=${selectedEvent._id}`);
        if (res.ok) {
          const data = await res.json();
          setAllMatches(data);
        }
      } catch (err) {
        console.error('Error fetching event matches:', err);
      } finally {
        setLoadingMatches(false);
      }
    };

    fetchMatches();

    // Setup Socket.io for live updates
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Spectator Socket.io connected to Live Room!');
    });

    // Handle score updates
    socket.on('match_score_updated', (updatedMatch: any) => {
      setAllMatches(prev => prev.map(m => m._id === updatedMatch._id ? { ...updatedMatch, eventId: m.eventId || 'evt_autumn2026' } : m));
      showTemporaryBanner(`Match scored: ${updatedMatch.player1Name} vs ${updatedMatch.player2Name}`);
    });

    socket.on('global_match_update', (updatedMatch: any) => {
      setAllMatches(prev => {
        const exists = prev.some(m => m._id === updatedMatch._id);
        const matchWithEvent = { ...updatedMatch, eventId: updatedMatch.eventId || 'evt_autumn2026' };
        if (exists) {
          return prev.map(m => m._id === updatedMatch._id ? matchWithEvent : m);
        } else {
          return [...prev, matchWithEvent];
        }
      });
    });

    socket.on('bracket_generated', (data: any) => {
      fetchMatches(); // refetch on bracket generation
      showTemporaryBanner(`Brackets updated for ${data.gender} ${data.weightCategory}!`);
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedEvent]);

  // Join/leave room in Socket.io when weightClass and gender are chosen (Step 4)
  useEffect(() => {
    if (socketRef.current && selectedWeightClass && selectedGender) {
      const socket = socketRef.current;
      socket.emit('join_room', { weightCategory: selectedWeightClass, gender: selectedGender });
      return () => {
        socket.emit('leave_room', { weightCategory: selectedWeightClass, gender: selectedGender });
      };
    }
  }, [selectedWeightClass, selectedGender]);

  const showTemporaryBanner = (msg: string) => {
    setGlobalMessage(msg);
    setTimeout(() => {
      setGlobalMessage(null);
    }, 4500);
  };

  // STEP 2 computation: Categorize matches and find non-empty categories
  const nonEmptyCategoriesByGender = useMemo(() => {
    const result = {
      male: new Set<string>(),
      female: new Set<string>()
    };

    if (allMatches.length === 0) {
      categoryOptions.forEach(cat => {
        result.male.add(cat);
        result.female.add(cat);
      });
      return result;
    }

    allMatches.forEach(m => {
      const computedCat = getAgeCategoryFromWeightClass(m.weightCategory, m.gender);
      if (m.gender === 'male' || m.gender === 'female') {
        const g = m.gender as 'male' | 'female';
        result[g].add(computedCat);
      }
    });

    return result;
  }, [allMatches, categoryOptions]);

  // STEP 3 computation: Find weight classes with active matches
  const activeWeightClasses = useMemo(() => {
    if (!selectedCategory || !selectedGender) return [];
    
    // Group active matches of this event, gender and category
    const filteredMatches = allMatches.filter(m => {
      const compCat = getAgeCategoryFromWeightClass(m.weightCategory, m.gender);
      return m.gender === selectedGender && compCat === selectedCategory;
    });

    // Return unique list of weight classes with active matches
    let classesWithMatches = Array.from(new Set(filteredMatches.map(m => m.weightCategory)));
    
    if (classesWithMatches.length === 0) {
      if (dbCategories && dbCategories.length > 0) {
        const catObj = dbCategories.find(c => c._id === selectedCategory);
        if (catObj) {
          classesWithMatches = selectedGender === 'male' ? catObj.maleWeightClasses : catObj.femaleWeightClasses;
        }
      } else {
        const fallback = CATEGORY_STRUCTURE[selectedCategory]?.[selectedGender];
        classesWithMatches = fallback ? Object.keys(fallback) : [];
      }
    }
    
    return classesWithMatches;
  }, [allMatches, selectedCategory, selectedGender, dbCategories]);

  // STEP 4 computation: Matches matching selected Step criteria
  const currentCategoryMatches = useMemo(() => {
    if (!selectedWeightClass || !selectedGender) return [];
    return allMatches.filter(m => m.gender === selectedGender && m.weightCategory === selectedWeightClass);
  }, [allMatches, selectedGender, selectedWeightClass]);

  // Bracket coordination logic (drawn dynamically)
  const { sortedRounds, positions, links } = useMemo(() => {
    if (currentCategoryMatches.length === 0) {
      return { sortedRounds: [], positions: {}, links: [] };
    }

    const matchMap = new Map<string, any>();
    currentCategoryMatches.forEach(m => matchMap.set(m._id, m));

    const depthFromFinalMap = new Map<string, number>();
    const getDepthFromFinal = (m: any, visited = new Set<string>()): number => {
      if (!m || visited.has(m._id)) return 0;
      visited.add(m._id);
      if (depthFromFinalMap.has(m._id)) return depthFromFinalMap.get(m._id)!;

      if (!m.nextMatchId || !matchMap.has(m.nextMatchId)) {
        depthFromFinalMap.set(m._id, 0);
        return 0;
      }

      const parent = matchMap.get(m.nextMatchId);
      const parentDepth = getDepthFromFinal(parent, visited);
      const depth = parentDepth + 1;
      depthFromFinalMap.set(m._id, depth);
      return depth;
    };

    currentCategoryMatches.forEach(m => getDepthFromFinal(m));

    let maxDepth = 0;
    depthFromFinalMap.forEach(d => {
      if (d > maxDepth) maxDepth = d;
    });

    const totalRounds = Math.max(1, maxDepth + 1);

    const matchesByColIndex: Record<number, any[]> = {};
    for (let i = 0; i < totalRounds; i++) {
      matchesByColIndex[i] = [];
    }

    currentCategoryMatches.forEach(m => {
      const depth = depthFromFinalMap.get(m._id) ?? 0;
      const colIdx = totalRounds - 1 - depth;
      if (!matchesByColIndex[colIdx]) matchesByColIndex[colIdx] = [];
      matchesByColIndex[colIdx].push(m);
    });

    const sortedRounds: string[] = [];
    const matchesByRound: Record<string, any[]> = {};

    for (let colIdx = 0; colIdx < totalRounds; colIdx++) {
      let label = `Round ${colIdx + 1}`;
      if (colIdx === totalRounds - 1) {
        label = 'Finals';
      } else if (colIdx === 0) {
        label = 'Round 1';
      } else if (colIdx === totalRounds - 2 && totalRounds > 2) {
        label = 'Semifinals';
      } else if (colIdx === totalRounds - 3 && totalRounds > 3) {
        label = 'Quarterfinals';
      }

      sortedRounds.push(label);
      matchesByRound[label] = matchesByColIndex[colIdx] || [];
    }

    const numCols = sortedRounds.length;
    const svgWidth = 860;
    const svgHeight = 440;
    const cardWidth = 185;
    const cardHeight = 84;

    const colWidth = numCols > 1 ? (svgWidth - 230) / (numCols - 1) : 0;
    const positions: Record<string, { _id: string, x: number, y: number, match: any, col: number }> = {};

    sortedRounds.forEach((round, colIdx) => {
      const roundMatches = matchesByRound[round];
      const x = numCols > 1 ? 115 + colIdx * colWidth : svgWidth / 2;

      roundMatches.forEach((match, matchIdx) => {
        let y = 0;
        if (colIdx === 0) {
          const spacing = (svgHeight - 140) / Math.max(1, roundMatches.length - 1);
          y = 85 + matchIdx * spacing;
        } else {
          const prevRound = sortedRounds[colIdx - 1];
          const prevMatches = matchesByRound[prevRound] || [];
          
          const children = prevMatches.filter(pm => {
            const winnerName = pm.winnerId === pm.player1Id ? pm.player1Name : pm.player2Name;
            const isCompleted = pm.status === 'completed';
            return (
              (isCompleted && (winnerName === match.player1Name || winnerName === match.player2Name)) ||
              pm.player1Name === match.player1Name || pm.player2Name === match.player1Name ||
              pm.player1Name === match.player2Name || pm.player2Name === match.player2Name
            );
          });

          if (children.length > 0) {
            const childYSum = children.reduce((sum, child) => {
              const pos = positions[child._id];
              return sum + (pos ? pos.y : 0);
            }, 0);
            y = childYSum / children.length;
          } else {
            const spacing = (svgHeight - 140) / Math.max(1, roundMatches.length - 1);
            y = 85 + matchIdx * spacing;
          }
        }
        positions[match._id] = { _id: match._id, x, y, match, col: colIdx };
      });
    });

    const links: any[] = [];
    sortedRounds.forEach((round, colIdx) => {
      if (colIdx === sortedRounds.length - 1) return;
      const roundMatches = matchesByRound[round];
      const nextRound = sortedRounds[colIdx + 1];
      const nextMatches = matchesByRound[nextRound] || [];

      roundMatches.forEach((childMatch) => {
        const childPos = positions[childMatch._id];
        if (!childPos) return;

        const parentMatch = nextMatches.find(nm => 
          nm.player1Name === childMatch.player1Name || 
          nm.player2Name === childMatch.player1Name || 
          nm.player1Name === childMatch.player2Name || 
          nm.player2Name === childMatch.player2Name ||
          (childMatch.status === 'completed' && (
            nm.player1Name === (childMatch.winnerId === childMatch.player1Id ? childMatch.player1Name : childMatch.player2Name) ||
            nm.player2Name === (childMatch.winnerId === childMatch.player1Id ? childMatch.player1Name : childMatch.player2Name)
          ))
        );

        if (parentMatch) {
          const parentPos = positions[parentMatch._id];
          if (parentPos) {
            links.push({
              source: childPos,
              target: parentPos,
              isLive: childMatch.status === 'live' || parentMatch.status === 'live',
              childMatch,
              parentMatch
            });
          }
        }
      });
    });

    return { sortedRounds, positions, links };
  }, [currentCategoryMatches]);

  // Handle Breadcrumb/back action beautifully
  const navigateBack = () => {
    if (currentStep === 4) {
      setCurrentStep(3);
      setSelectedWeightClass(null);
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setSelectedCategory(null);
    } else if (currentStep === 2) {
      setCurrentStep(1);
      setSelectedEvent(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 animate-fade-in font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Global Toast Message */}
        {globalMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border-l-4 border-red-500 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up">
            <Radio className="w-5 h-5 text-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold font-sans uppercase tracking-wider">{globalMessage}</span>
          </div>
        )}

        {/* Header Breadcrumbs Bar */}
        <div className="bg-white px-6 py-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span 
              onClick={() => { setCurrentStep(1); setSelectedEvent(null); setSelectedCategory(null); setSelectedWeightClass(null); }}
              className="cursor-pointer hover:text-red-600 transition-colors"
            >
              All Events
            </span>
            
            {selectedEvent && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span 
                  onClick={() => { setCurrentStep(2); setSelectedCategory(null); setSelectedWeightClass(null); }}
                  className="cursor-pointer hover:text-red-600 transition-colors text-slate-700"
                >
                  {selectedEvent.name}
                </span>
              </>
            )}

            {selectedCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span 
                  onClick={() => { setCurrentStep(3); setSelectedWeightClass(null); }}
                  className="cursor-pointer hover:text-red-600 transition-colors text-slate-700"
                >
                  {selectedGender === 'male' ? 'Male' : 'Female'} &middot; {selectedCategory}
                </span>
              </>
            )}

            {selectedWeightClass && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-red-600 font-bold">
                  {selectedWeightClass} (Live Bracket)
                </span>
              </>
            )}
          </div>

          {currentStep > 1 && (
            <button 
              onClick={navigateBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-red-600 hover:bg-slate-50 border border-slate-200 bg-white rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}
        </div>

        {/* STEP 1: Events List */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 font-mono tracking-widest uppercase mb-1">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Real-Time Broadcast Active</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Spectator Portal & Live Draw</h1>
              <p className="text-xs text-slate-500 mt-1">
                Select an active, ongoing tournament from the options below to follow along with real-time brackets and scores.
              </p>
            </div>

            {loadingEvents ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-semibold text-slate-400">Querying active tournaments...</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((evt) => (
                  <div 
                    key={evt._id}
                    onClick={() => {
                      setSelectedEvent(evt);
                      setCurrentStep(2);
                    }}
                    className="group bg-white rounded-2xl border border-slate-200/80 shadow-md hover:shadow-xl hover:border-red-500/30 transition-all p-6 cursor-pointer relative flex flex-col justify-between overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-red-500/10 transition-colors" />
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider bg-red-50 border border-red-200 text-red-600 font-mono uppercase">
                          <CircleDot className="w-3 h-3 text-red-500 animate-ping" />
                          LIVE ONGOING
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="font-extrabold text-slate-900 text-lg leading-snug group-hover:text-red-600 transition-colors">
                          {evt.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          Multi-ring championship event format
                        </p>
                      </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-100 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium">{evt.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium truncate">{evt.venue}</span>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                        <span>Enter Live Center</span>
                        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Category List */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <span className="text-xs font-bold text-red-600 font-mono tracking-wider uppercase">
                {selectedEvent.name}
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Select Age Category</h1>
              <p className="text-xs text-slate-500 mt-1">
                Displaying active categories with registered competitors and live matches for this tournament. Empty categories are hidden automatically.
              </p>
            </div>

            {loadingMatches ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-semibold text-slate-400">Loading active registration profiles...</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                
                {/* Male Categories */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <h3 className="font-black text-slate-800 text-sm tracking-wider uppercase">Male Pools</h3>
                  </div>

                  <div className="grid gap-3">
                    {categoryOptions.map((cat) => {
                      const isNonEmpty = nonEmptyCategoriesByGender.male.has(cat);
                      if (!isNonEmpty) return null;

                      // Count matches
                      const count = allMatches.filter(m => m.gender === 'male' && getAgeCategoryFromWeightClass(m.weightCategory, m.gender) === cat).length;

                      return (
                        <div 
                          key={cat}
                          onClick={() => {
                            setSelectedGender('male');
                            setSelectedCategory(cat);
                            setCurrentStep(3);
                          }}
                          className="flex items-center justify-between p-4 bg-white hover:bg-blue-50/20 border border-slate-200 rounded-xl shadow-sm hover:border-blue-400 cursor-pointer transition-all hover:-translate-y-0.5"
                        >
                          <div className="space-y-0.5">
                            <h4 className="font-bold text-slate-950 text-sm">{cat} Division</h4>
                            <p className="text-[10px] text-slate-400 font-medium">Click to select active weight classes</p>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-blue-600 font-mono">
                            {count} Matches
                          </span>
                        </div>
                      );
                    })}

                    {nonEmptyCategoriesByGender.male.size === 0 && (
                      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        No active male category matches found for this tournament yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Female Categories */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <h3 className="font-black text-slate-800 text-sm tracking-wider uppercase">Female Pools</h3>
                  </div>

                  <div className="grid gap-3">
                    {categoryOptions.map((cat) => {
                      const isNonEmpty = nonEmptyCategoriesByGender.female.has(cat);
                      if (!isNonEmpty) return null;

                      // Count matches
                      const count = allMatches.filter(m => m.gender === 'female' && getAgeCategoryFromWeightClass(m.weightCategory, m.gender) === cat).length;

                      return (
                        <div 
                          key={cat}
                          onClick={() => {
                            setSelectedGender('female');
                            setSelectedCategory(cat);
                            setCurrentStep(3);
                          }}
                          className="flex items-center justify-between p-4 bg-white hover:bg-rose-50/20 border border-slate-200 rounded-xl shadow-sm hover:border-rose-400 cursor-pointer transition-all hover:-translate-y-0.5"
                        >
                          <div className="space-y-0.5">
                            <h4 className="font-bold text-slate-950 text-sm">{cat} Division</h4>
                            <p className="text-[10px] text-slate-400 font-medium">Click to select active weight classes</p>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-600 font-mono">
                            {count} Matches
                          </span>
                        </div>
                      );
                    })}

                    {nonEmptyCategoriesByGender.female.size === 0 && (
                      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        No active female category matches found for this tournament yet.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* STEP 3: Weight Class List */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <span className="text-xs font-bold text-slate-500 block">
                {selectedEvent.name} &rsaquo; {selectedGender === 'male' ? 'Male' : 'Female'}
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                {selectedCategory} Division Weight Classes
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Filter the live draw copy specifically for the following active weight classes:
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {activeWeightClasses.map((wClass) => {
                // Determine matches in this class
                const matchItems = allMatches.filter(m => m.gender === selectedGender && m.weightCategory === wClass);
                const liveCount = matchItems.filter(m => m.status === 'live').length;
                const pendingCount = matchItems.filter(m => m.status === 'pending').length;
                const completedCount = matchItems.filter(m => m.status === 'completed').length;

                return (
                  <div 
                    key={wClass}
                    onClick={() => {
                      setSelectedWeightClass(wClass);
                      setCurrentStep(4);
                    }}
                    className="bg-white hover:bg-slate-50/40 p-5 rounded-xl border border-slate-200 shadow-sm hover:border-red-500/50 cursor-pointer transition-all hover:-translate-y-0.5 space-y-4"
                  >
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                        {wClass}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">Click to watch live progression bracket</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px] font-bold font-mono">
                      {liveCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 animate-pulse">
                          {liveCount} LIVE
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {pendingCount} UPCOMING
                        </span>
                      )}
                      {completedCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                          {completedCount} COMPLETED
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeWeightClasses.length === 0 && (
                <div className="col-span-full p-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  No active weight classes matching these filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Live match / Draw view */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {categoryDrawStatus === 'draft' && !isAdmin ? (
              <div className="p-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white shadow-sm flex flex-col items-center justify-center space-y-4">
                <Trophy className="w-12 h-12 text-slate-350 animate-bounce" />
                <h3 className="text-base font-black text-slate-800">Draw not published yet</h3>
                <p className="text-xs text-slate-500 max-w-sm">The official bracket pairing sheet for {selectedWeightClass} ({selectedGender === 'male' ? 'Male' : 'Female'}) in the {selectedCategory} division is currently in draft mode. Pairings will be visible here once finalized and published by the event organizers.</p>
              </div>
            ) : (
              <>
                {/* Draw Status Indicator banner */}
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  categoryDrawStatus === 'finalized'
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-950'
                    : 'bg-amber-50 border-amber-250 text-amber-950'
                }`}>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider block">
                      {categoryDrawStatus === 'finalized' ? '🔒 Official Draw Finalized & Published' : '📝 Bracket Draft Copy (Admin Preview Mode)'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {categoryDrawStatus === 'finalized'
                        ? 'This is the official published draw copy. Pairings are locked and fights are underway.'
                        : 'Organizers are preparing the roster. Only event administrators can preview this draft bracket.'}
                    </span>
                  </div>
                </div>

                {/* Live Scores Marquee Highlights */}
                {currentCategoryMatches.some(m => m.status === 'live') && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 font-mono tracking-wider uppercase">
                  <CircleDot className="w-4 h-4 text-red-600 animate-ping shrink-0" />
                  <span>Live Ring Broadcast</span>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {currentCategoryMatches
                    .filter(m => m.status === 'live')
                    .map((liveMatch) => (
                      <div key={liveMatch._id} className="bg-slate-900 text-white rounded-2xl p-6 border-2 border-red-500 shadow-xl overflow-hidden relative animate-fade-in">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/15 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                          <span className="text-[10px] font-black font-mono tracking-widest text-red-400 uppercase">
                            {liveMatch.round.toUpperCase()}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                            <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
                            <span>LIVE SCORE</span>
                          </div>
                        </div>

                        <div className="space-y-5">
                          {(() => {
                            const rw = calculateRoundsWon(liveMatch);
                            return (
                              <>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-600" />
                                    <span className="font-extrabold text-sm truncate max-w-[140px] text-white">
                                      {liveMatch.player1Name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400 font-mono">Rounds:</span>
                                    <span className="font-mono text-xl font-black text-red-500">
                                      {rw.player1}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-600" />
                                    <span className="font-extrabold text-sm truncate max-w-[140px] text-white">
                                      {liveMatch.player2Name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400 font-mono">Rounds:</span>
                                    <span className="font-mono text-xl font-black text-blue-500">
                                      {rw.player2}
                                    </span>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-800/80 flex justify-between items-center text-[9px] text-slate-500 font-mono">
                          <span>Ref update real-time</span>
                          <span>Category: {liveMatch.weightCategory}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Progression Draw Bracket Tree rendering */}
            {currentCategoryMatches.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-6">
                
                {/* Bracket Toolbar controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">Championship Progression Bracket</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Interactive tournament draw tree updated live by staff</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search competitor */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search competitor..."
                        className="pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 w-44"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Scale slider */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button
                        onClick={() => setZoomScale(Math.max(0.6, zoomScale - 0.1))}
                        title="Zoom Out"
                        className="p-1 rounded hover:bg-white text-slate-600 active:scale-95 transition-all cursor-pointer"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[9px] font-mono font-bold text-slate-600 px-1 w-8 text-center select-none">
                        {Math.round(zoomScale * 100)}%
                      </span>
                      <button
                        onClick={() => setZoomScale(Math.min(1.4, zoomScale + 0.1))}
                        title="Zoom In"
                        className="p-1 rounded hover:bg-white text-slate-600 active:scale-95 transition-all cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setZoomScale(1)}
                        title="Reset Zoom"
                        className="p-1 rounded hover:bg-white text-slate-400 hover:text-slate-600 active:scale-95 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drawn SVG Bracket */}
                <div className="overflow-x-auto overflow-y-hidden border border-slate-100 rounded-xl bg-slate-50/40 p-4 select-none scrollbar-thin relative min-h-[490px]">
                  <div 
                    style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top left', transition: 'transform 0.15s ease-out' }}
                    className="relative w-[860px] h-[480px]"
                  >
                    {/* Floating Column Headers for each Round */}
                    <div className="absolute top-2 left-0 right-0 h-8 flex pointer-events-none">
                      {sortedRounds.map((round, colIdx) => {
                        const numCols = sortedRounds.length;
                        const colWidth = numCols > 1 ? (860 - 230) / (numCols - 1) : 0;
                        const x = numCols > 1 ? 115 + colIdx * colWidth : 860 / 2;
                        return (
                          <div 
                            key={round}
                            style={{ left: `${x - 92}px`, width: '185px' }}
                            className="absolute text-center"
                          >
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-widest bg-slate-900 text-slate-100 uppercase font-mono shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              {round}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {links.map((link, idx) => {
                        const sx = link.source.x + 92;
                        const sy = link.source.y;
                        const tx = link.target.x - 92;
                        const ty = link.target.y;
                        const mx = (sx + tx) / 2;
                        const pathString = `M ${sx} ${sy} H ${mx} V ${ty} H ${tx}`;

                        return (
                          <g key={idx}>
                            {link.isLive && (
                              <path
                                d={pathString}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="5"
                                className="opacity-25 animate-pulse"
                              />
                            )}
                            <path
                              d={pathString}
                              fill="none"
                              stroke={link.isLive ? '#ef4444' : '#38bdf8'}
                              strokeWidth={link.isLive ? '2.5' : '1.5'}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {Object.values(positions).map((pos) => {
                      const m = pos.match;
                      const isLive = m.status === 'live';
                      const isCompleted = m.status === 'completed';
                      const slotInfo = getMatchSlotDisplay(m, currentCategoryMatches, pos.col);
                      
                      const matchesSearch = searchQuery 
                        ? (slotInfo.p1DisplayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           slotInfo.p2DisplayName.toLowerCase().includes(searchQuery.toLowerCase()))
                        : true;

                      const opacityClass = matchesSearch ? 'opacity-100' : 'opacity-25';

                      return (
                        <div
                          key={m._id}
                          style={{ left: `${pos.x - 92}px`, top: `${pos.y - 42}px` }}
                          onClick={() => setSelectedMatch(m)}
                          className={`absolute w-[185px] bg-white rounded-2xl border-2 transition-all p-3 shadow-md hover:shadow-xl cursor-pointer ${
                            isLive 
                              ? 'border-red-500 scale-[1.03] z-10 ring-4 ring-red-500/15' 
                              : isCompleted 
                                ? 'border-slate-300' 
                                : slotInfo.isBothEmpty
                                  ? 'border-slate-200 border-dashed bg-slate-50/40'
                                  : 'border-slate-200 hover:border-slate-400'
                          } ${opacityClass}`}
                        >
                          <div className="flex items-center justify-between text-[8px] font-black font-mono tracking-widest text-slate-400 mb-2.5">
                            <span>{m.round?.toUpperCase() ?? 'FINALS'}</span>
                            {isLive && (
                              <span className="text-red-500 animate-pulse flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                LIVE RING
                              </span>
                            )}
                            {isCompleted && <span className="text-slate-500">ENDED</span>}
                            {!isLive && !isCompleted && slotInfo.isBothEmpty && (
                              <span className="text-slate-400 font-medium">WAITING</span>
                            )}
                          </div>

                          <div className="space-y-1.5 text-[11px] font-semibold text-slate-700">
                            {/* Player 1 (Red Corner) */}
                            <div className={`flex justify-between items-center p-1.5 rounded-lg border-l-2 transition-all ${
                              slotInfo.isP1Winner 
                                ? 'bg-red-50/60 border-red-500 text-red-700' 
                                : !slotInfo.isP1Ready
                                  ? 'bg-slate-50/60 border-slate-300 text-slate-400'
                                  : 'bg-slate-50 border-red-500/60 text-slate-700'
                            }`}>
                              <span className={`truncate max-w-[110px] ${slotInfo.isP1Winner ? 'text-red-700 font-extrabold' : slotInfo.isP1Ready ? 'text-slate-700' : 'text-slate-400 italic font-mono'}`}>
                                {slotInfo.p1DisplayName}
                              </span>
                              <span className={`font-mono font-black px-1.5 py-0.5 rounded text-[10px] ${slotInfo.isP1Winner ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                {slotInfo.showScore && slotInfo.isP1Ready ? slotInfo.p1Score ?? 0 : '-'}
                              </span>
                            </div>

                            {/* Centered subtle vs divider */}
                            <div className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest font-mono">
                              vs
                            </div>
                            
                            {/* Player 2 (Blue Corner) */}
                            <div className={`flex justify-between items-center p-1.5 rounded-lg border-l-2 transition-all ${
                              slotInfo.isP2Winner 
                                ? 'bg-blue-50/60 border-blue-500 text-blue-700' 
                                : !slotInfo.isP2Ready
                                  ? 'bg-slate-50/60 border-slate-300 text-slate-400'
                                  : 'bg-slate-50 border-blue-500/60 text-slate-700'
                            }`}>
                              <span className={`truncate max-w-[110px] ${slotInfo.isP2Winner ? 'text-blue-700 font-extrabold' : slotInfo.isP2Ready ? 'text-slate-700' : 'text-slate-400 italic font-mono'}`}>
                                {slotInfo.p2DisplayName}
                              </span>
                              <span className={`font-mono font-black px-1.5 py-0.5 rounded text-[10px] ${slotInfo.isP2Winner ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {slotInfo.showScore && slotInfo.isP2Ready ? slotInfo.p2Score ?? 0 : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Match detailed summary list (Upcoming, Completed) */}
                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <h3 className="font-extrabold text-slate-900 text-sm">Full Match Registry list</h3>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    {currentCategoryMatches.map((m) => {
                      const isLive = m.status === 'live';
                      const isCompleted = m.status === 'completed';

                      return (
                        <div 
                          key={m._id}
                          className={`p-4 rounded-xl border text-xs flex justify-between items-center transition-all ${
                            isLive 
                              ? 'bg-red-50/20 border-red-200' 
                              : isCompleted 
                                ? 'bg-slate-50/50 border-slate-200 text-slate-500' 
                                : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span>{m.round}</span>
                              <span className="text-slate-300 font-normal">|</span>
                              {isLive && <span className="text-red-600 font-mono">LIVE NOW</span>}
                              {isCompleted && <span className="text-slate-500 font-mono">Completed</span>}
                              {!isLive && !isCompleted && <span className="text-slate-400 font-mono">Scheduled</span>}
                            </div>
                            <p className="font-semibold text-slate-700">
                              {m.player1Name} <span className="text-slate-400 font-normal">vs</span> {m.player2Name}
                            </p>
                            {isCompleted && m.winnerId && (
                              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Winner: {m.winnerId === m.player1Id ? m.player1Name : m.player2Name}
                              </p>
                            )}
                          </div>

                          <div className="text-right font-mono font-black text-xs">
                            {(() => {
                              const rw = calculateRoundsWon(m);
                              return (
                                <div className="flex flex-col items-end">
                                  <span className="text-[9px] font-normal text-slate-400">Rounds Won</span>
                                  <span className="text-sm text-slate-800 font-black">{rw.player1} - {rw.player2}</span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white shadow-sm flex flex-col items-center justify-center space-y-4">
                <Swords className="w-12 h-12 text-slate-300 animate-pulse" />
                <h3 className="text-base font-bold text-slate-800">Draw Bracket Pending</h3>
                <p className="text-xs text-slate-500 max-w-sm">No matches or draw brackets have been generated for {selectedWeightClass} in this event yet. Official bracket pairings are generated once the athlete registration window closes.</p>
                {isAdmin ? (
                  <div className="mt-4 p-6 bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-md text-left space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                      Administrator Control Console
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      As an event organizer, you can instantly run the randomized knockout generator to seed brackets for this category.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/matches/generate', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                              weightCategory: selectedWeightClass,
                              gender: selectedGender,
                              ageCategory: selectedCategory,
                              eventId: selectedEvent?._id
                            })
                          });
                          
                          let data: any = {};
                          const contentType = res.headers.get('content-type');
                          if (contentType && contentType.includes('application/json')) {
                            data = await res.json();
                          } else {
                            const txt = await res.text();
                            data = { error: txt || 'Server returned an invalid response' };
                          }

                          if (!res.ok) {
                            throw new Error(data.error || 'Failed to generate bracket.');
                          }
                          showTemporaryBanner('Knockout bracket generated successfully!');
                          // Refetch matches
                          const matchesRes = await fetch(`/api/matches?eventId=${selectedEvent._id}`);
                          if (matchesRes.ok) {
                            const matchesData = await matchesRes.json();
                            setAllMatches(matchesData);
                          }
                        } catch (err: any) {
                          alert(err.message || 'Error generating brackets. Please verify there are at least 2 registered players in this weight category!');
                        }
                      }}
                      className="w-full py-2 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-center"
                    >
                      ⚡ Seed & Generate Bracket Draw
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 text-xs font-medium text-slate-400 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-100">
                    Schedules and fights will post here live once seeded by organizing staff.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Match Details Overlay Modal */}
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden relative">
              
              {/* Header */}
              <div className="bg-slate-950 text-white p-6 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest bg-red-500/20 text-red-400 uppercase font-mono mb-2">
                      {selectedMatch.round}
                    </span>
                    <h3 className="text-lg font-black tracking-tight">{selectedWeightClass}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Match Ref: {selectedMatch.updatedBy || 'Chief Grandmaster'}</p>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedMatch(null)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                
                {/* Scoreboard block */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  
                  {/* Player 1 (Red Corner) */}
                  <div className={`p-5 rounded-2xl border-2 transition-all ${selectedMatch.winnerId === selectedMatch.player1Id ? 'bg-red-50/20 border-red-500' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                      <span>Chung (Red)</span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-full">
                      {selectedMatch.player1Name}
                    </h4>
                    <div className="mt-4 font-mono font-black text-4xl text-red-600">
                      {selectedMatch.score?.player1 ?? 0}
                    </div>
                  </div>

                  {/* Player 2 (Blue Corner) */}
                  <div className={`p-5 rounded-2xl border-2 transition-all ${selectedMatch.winnerId === selectedMatch.player2Id ? 'bg-blue-50/20 border-blue-500' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                      <span>Hong (Blue)</span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-full">
                      {selectedMatch.player2Name}
                    </h4>
                    <div className="mt-4 font-mono font-black text-4xl text-blue-600">
                      {selectedMatch.score?.player2 ?? 0}
                    </div>
                  </div>

                </div>

                {/* Additional Match Meta Status */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-3.5 text-xs font-semibold text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Match Status:</span>
                    <span className={`capitalize font-bold ${selectedMatch.status === 'live' ? 'text-red-600 animate-pulse' : selectedMatch.status === 'completed' ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {selectedMatch.status}
                    </span>
                  </div>

                  {selectedMatch.winnerId && (
                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-200/60">
                      <span className="text-slate-400">Winner Champion:</span>
                      <span className="text-emerald-600 font-extrabold inline-flex items-center gap-1 text-sm">
                        <Award className="w-4 h-4 text-amber-500" />
                        {selectedMatch.winnerId === selectedMatch.player1Id ? selectedMatch.player1Name : selectedMatch.player2Name}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-200/60 text-[10px] text-slate-400 font-mono">
                    <span>Last Updated:</span>
                    <span>{selectedMatch.updatedAt ? new Date(selectedMatch.updatedAt).toLocaleString() : 'Just Now'}</span>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="px-4 py-2 text-xs font-extrabold text-white bg-slate-950 hover:bg-slate-800 rounded-xl transition-all active:scale-95 cursor-pointer shadow-md"
                >
                  Dismiss Stats
                </button>
              </div>

            </div>
          </div>
          )}
        </div>
        )}

      </div>
    </div>
  );
};
