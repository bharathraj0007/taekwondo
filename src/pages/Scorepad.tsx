import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { Swords, Radio, Tv, ShieldAlert, CheckCircle, ChevronRight, RotateCcw, Plus, Minus, UserCheck, Trophy, Sparkles, ExternalLink } from 'lucide-react';
import { calculateRoundsWon } from '../utils/bracketUtils';

interface Match {
  _id: string;
  round: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  winnerId: string | null;
  score: { player1: number; player2: number };
  status: 'pending' | 'live' | 'completed';
  gender: string;
  weightCategory: string;
  ageCategory: string;
  eventId?: string;
}

export const Scorepad: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authorized (Referee or Admin only)
  useEffect(() => {
    trackEngagement('page_view_referee_scorepad', '/scorepad');
    if (!user) {
      navigate('/signin');
      return;
    }
    if (user.role !== 'admin' && user.role !== 'referee') {
      navigate('/');
    }
  }, [user, navigate]);

  const [categories, setCategories] = useState<any[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Senior');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [selectedWeight, setSelectedWeight] = useState('');
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);

  const [loading, setLoading] = useState(true);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Warnings / Gam-jeoms counter (penalties)
  const [player1Warnings, setPlayer1Warnings] = useState(0);
  const [player2Warnings, setPlayer2Warnings] = useState(0);
  const [showDeclareWinnerModal, setShowDeclareWinnerModal] = useState(false);

  // Load categories and matches
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const catRes = await fetch('/api/categories');
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData);
          if (catData.length > 0) {
            setSelectedCategory(catData[0].name);
          }
        }

        const matchRes = await fetch('/api/matches');
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          setMatches(matchData);
        }
      } catch (err: any) {
        setError('Failed to retrieve categories or tournament matches.');
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Compute available weight classes
  const weightClasses = React.useMemo(() => {
    if (categories.length > 0) {
      const match = categories.find(c => c.name === selectedCategory);
      if (match) {
        return selectedGender === 'male' ? match.maleWeightClasses : match.femaleWeightClasses;
      }
    }
    return [];
  }, [selectedCategory, selectedGender, categories]);

  // Handle setting default weight when classes change
  useEffect(() => {
    if (weightClasses.length > 0) {
      if (!weightClasses.includes(selectedWeight)) {
        setSelectedWeight(weightClasses[0]);
      }
    } else {
      setSelectedWeight('');
    }
  }, [weightClasses, selectedWeight]);

  // Filter matches for the scorepad selection list
  const filteredMatches = React.useMemo(() => {
    return matches.filter(m => {
      const genderMatch = m.gender === selectedGender;
      const weightMatch = m.weightCategory === selectedWeight;
      const ageMatch = !m.ageCategory || m.ageCategory.toLowerCase() === selectedCategory.toLowerCase();
      return genderMatch && weightMatch && ageMatch;
    });
  }, [matches, selectedGender, selectedWeight, selectedCategory]);

  // Start scoring pad for a match
  const handleSelectMatch = (match: Match) => {
    setActiveMatch(match);
    setPlayer1Warnings(0);
    setPlayer2Warnings(0);
    setError(null);
    setSuccess(null);
  };

  // Sync match scores/statuses directly with MongoDB backend
  const updateMatchOnServer = async (updatedFields: Partial<Match>) => {
    if (!activeMatch || !user) return;
    setScoringLoading(true);

    try {
      const res = await fetch(`/api/matches/${activeMatch._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updatedFields)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to persist updates to server.');
      }

      // Update local lists
      setActiveMatch(data.match);
      setMatches(prev => prev.map(m => m._id === data.match._id ? data.match : m));
      setSuccess('Match synchronized with server.');
      setTimeout(() => setSuccess(null), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to sync with database.');
    } finally {
      setScoringLoading(false);
    }
  };

  // Direct increment / decrement scoring pads
  const handleScoreAdjust = async (playerKey: 'player1' | 'player2', amount: number) => {
    if (!activeMatch) return;

    const newScore = { ...activeMatch.score };
    newScore[playerKey] = Math.max(0, newScore[playerKey] + amount);

    await updateMatchOnServer({ score: newScore });
  };

  // Warning (Gam-jeom) increments 1 point for the opponent
  const handleWarningAdd = async (playerKey: 'player1' | 'player2') => {
    if (!activeMatch) return;

    if (playerKey === 'player1') {
      const nextWarnings = player1Warnings + 1;
      setPlayer1Warnings(nextWarnings);
      // Give 1 point to player 2 (Hong/Blue)
      const newScore = { ...activeMatch.score };
      newScore.player2 += 1;
      await updateMatchOnServer({ score: newScore });
    } else {
      const nextWarnings = player2Warnings + 1;
      setPlayer2Warnings(nextWarnings);
      // Give 1 point to player 1 (Chung/Red)
      const newScore = { ...activeMatch.score };
      newScore.player1 += 1;
      await updateMatchOnServer({ score: newScore });
    }
  };

  const handleUpdateStatus = async (status: 'pending' | 'live' | 'completed') => {
    if (!activeMatch) return;

    const updates: any = { status };
    if (status === 'completed') {
      // Determine winner ID based on points
      const winnerId = activeMatch.score.player1 > activeMatch.score.player2 
        ? activeMatch.player1Id 
        : activeMatch.player2Id;
      updates.winnerId = winnerId;
    } else {
      updates.winnerId = null;
    }

    await updateMatchOnServer(updates);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-600">
        <Swords className="w-12 h-12 text-rose-500 animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Loading referee scorepad panels...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Banner */}
      <div className="mb-8 border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-rose-500 animate-pulse" />
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight font-mono">Referee Combat Scorer</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Authorized scorepad entry system. Select an active bout inside any class to record points, apply penalties, and advance winners.
          </p>
        </div>
        <Link
          to="/referee/dashboard"
          className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-mono font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer shrink-0 transition-all active:scale-95"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Launch Official Referee Console</span>
          <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 rounded-lg text-xs font-semibold mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-lg text-xs font-semibold mb-6 flex items-center gap-1.5 animate-fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {!activeMatch ? (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Filtering sidebar */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 h-fit">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b pb-2">Filter Class Pool</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Division</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 px-3 py-2 rounded-lg bg-slate-50 cursor-pointer font-mono"
                >
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender</label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value as any)}
                  className="w-full text-xs font-semibold border border-slate-200 px-3 py-2 rounded-lg bg-slate-50 cursor-pointer font-mono"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Weight Group</label>
                <select
                  value={selectedWeight}
                  onChange={(e) => setSelectedWeight(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 px-3 py-2 rounded-lg bg-slate-50 cursor-pointer font-mono"
                >
                  {weightClasses.map((cat: string, idx: number) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                  {weightClasses.length === 0 && <option value="">No classes</option>}
                </select>
              </div>
            </div>
          </div>

          {/* Fight matches listing */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 text-white p-4 rounded-t-xl text-xs font-bold font-mono uppercase">
              Available Fights in Category
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {filteredMatches.map((m) => {
                const isLive = m.status === 'live';
                const isCompleted = m.status === 'completed';

                return (
                  <div
                    key={m._id}
                    onClick={() => handleSelectMatch(m)}
                    className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow transition-all cursor-pointer relative flex flex-col justify-between ${
                      isLive ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center border-b pb-2 mb-3">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{m.round}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isLive ? 'bg-red-50 text-red-600 border border-red-200' :
                          isCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                          'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {m.status}
                        </span>
                      </div>

                      {(() => {
                        const roundsWon = calculateRoundsWon(m);
                        return (
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                <span className={isCompleted && m.winnerId === m.player1Id ? 'text-red-600 underline decoration-amber-500' : ''}>{m.player1Name}</span>
                              </span>
                              <span className="font-mono text-red-600 font-bold">{roundsWon.player1} <span className="text-[9px] font-normal text-slate-400">RNDS</span></span>
                            </div>
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <span className={isCompleted && m.winnerId === m.player2Id ? 'text-blue-600 underline decoration-amber-500' : ''}>{m.player2Name}</span>
                              </span>
                              <span className="font-mono text-blue-600 font-bold">{roundsWon.player2} <span className="text-[9px] font-normal text-slate-400">RNDS</span></span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="mt-4 pt-3 border-t flex justify-between items-center text-[10px] font-bold">
                      <Link
                        to={`/referee/match/${m._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-red-600 hover:text-red-700 underline flex items-center gap-0.5 font-mono"
                      >
                        Official Touchpad ↗
                      </Link>
                      <div className="text-rose-500 flex items-center gap-1">
                        <span>Open Quick Deck</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredMatches.length === 0 && (
                <div className="col-span-2 bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400 space-y-2">
                  <Swords className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
                  <p className="text-xs font-bold text-slate-800">No Fights Seeded Yet</p>
                  <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                    Knockout brackets must be generated by administrators in the draws console first.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Full-Screen Scorer Pad View */
        <div className="space-y-6">
          <button
            onClick={() => setActiveMatch(null)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            ← Back to Fights Catalog
          </button>

          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-8 space-y-8">
            {/* Header / Info */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 pb-4 gap-4">
              <div>
                <span className="text-rose-500 font-mono text-xs font-bold uppercase tracking-widest bg-rose-950/50 px-2.5 py-1 rounded-full border border-rose-900/50">
                  REF BOARD · {activeMatch._id.toUpperCase()}
                </span>
                <h2 className="text-xl font-black mt-2 tracking-tight">
                  {activeMatch.round.toUpperCase()} · {activeMatch.ageCategory.toUpperCase()} {activeMatch.gender.toUpperCase()}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-1">{activeMatch.weightCategory}</p>
              </div>

              {/* Status controllers */}
              <div className="flex gap-3">
                {activeMatch.status === 'pending' && (
                  <button
                    onClick={() => handleUpdateStatus('live')}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider font-mono cursor-pointer"
                  >
                    ⚡ Start Live Match
                  </button>
                )}

                {activeMatch.status === 'live' && (
                  <button
                    onClick={() => setShowDeclareWinnerModal(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider font-mono cursor-pointer animate-pulse"
                  >
                    🏆 End Fight & Declare Winner
                  </button>
                )}

                {activeMatch.status === 'completed' && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-900/50 px-3 py-2 rounded-lg">
                      Match Finished
                    </span>
                    <button
                      onClick={() => handleUpdateStatus('live')}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[10px] uppercase font-mono cursor-pointer"
                    >
                      Reopen Scorepad
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Combatants Grid Split Side Panel */}
            <div className="grid md:grid-cols-2 gap-8 relative">
              {/* Divider lines */}
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-800" />

              {/* CHUNG (RED) */}
              <div className="space-y-6 flex flex-col items-center p-4 bg-red-950/10 border border-red-900/10 rounded-2xl">
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-black tracking-widest text-red-500 font-mono uppercase bg-red-950 px-3 py-1 rounded border border-red-900">Chung / Red Corner</span>
                  <h3 className="text-2xl font-black tracking-tight">{activeMatch.player1Name}</h3>
                </div>

                {/* Score digits */}
                <div className="text-8xl font-black font-mono text-red-500 tracking-tighter">
                  {activeMatch.score.player1}
                </div>

                {/* Live Increment Controls */}
                {activeMatch.status === 'live' && (
                  <div className="w-full space-y-4">
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => handleScoreAdjust('player1', -1)}
                        className="w-14 h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl flex items-center justify-center font-black text-lg transition-transform cursor-pointer shrink-0"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => handleScoreAdjust('player1', 1)}
                        className="w-14 h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl flex items-center justify-center font-black text-lg transition-transform cursor-pointer shrink-0"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleScoreAdjust('player1', 2)}
                        className="flex-grow h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex items-center justify-center font-black text-base transition-transform cursor-pointer shadow-lg"
                      >
                        🥊 Spar Point (+2)
                      </button>
                    </div>

                    {/* Warning (Gam-jeom) updates opponent's score */}
                    <button
                      onClick={() => handleWarningAdd('player1')}
                      className="w-full py-2.5 bg-red-950/50 hover:bg-red-950 text-red-400 border border-dashed border-red-900 rounded-xl text-xs font-bold tracking-wide transition-colors cursor-pointer"
                    >
                      ⚠️ Warn Player 1 (Gam-jeom) (Penalties: {player1Warnings})
                    </button>
                  </div>
                )}
              </div>

              {/* HONG (BLUE) */}
              <div className="space-y-6 flex flex-col items-center p-4 bg-blue-950/10 border border-blue-900/10 rounded-2xl">
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-black tracking-widest text-blue-500 font-mono uppercase bg-blue-950 px-3 py-1 rounded border border-blue-900">Hong / Blue Corner</span>
                  <h3 className="text-2xl font-black tracking-tight">{activeMatch.player2Name}</h3>
                </div>

                {/* Score digits */}
                <div className="text-8xl font-black font-mono text-blue-500 tracking-tighter">
                  {activeMatch.score.player2}
                </div>

                {/* Live Increment Controls */}
                {activeMatch.status === 'live' && (
                  <div className="w-full space-y-4">
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => handleScoreAdjust('player2', -1)}
                        className="w-14 h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl flex items-center justify-center font-black text-lg transition-transform cursor-pointer shrink-0"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => handleScoreAdjust('player2', 1)}
                        className="w-14 h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl flex items-center justify-center font-black text-lg transition-transform cursor-pointer shrink-0"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleScoreAdjust('player2', 2)}
                        className="flex-grow h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center font-black text-base transition-transform cursor-pointer shadow-lg"
                      >
                        🥊 Spar Point (+2)
                      </button>
                    </div>

                    {/* Warning (Gam-jeom) updates opponent's score */}
                    <button
                      onClick={() => handleWarningAdd('player2')}
                      className="w-full py-2.5 bg-blue-950/50 hover:bg-blue-950 text-blue-400 border border-dashed border-blue-900 rounded-xl text-xs font-bold tracking-wide transition-colors cursor-pointer"
                    >
                      ⚠️ Warn Player 2 (Gam-jeom) (Penalties: {player2Warnings})
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Declare Winner Selection Overlay Modal */}
          {showDeclareWinnerModal && activeMatch && (
            <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 max-w-md w-full space-y-6">
                <div className="text-center space-y-1">
                  <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-2 animate-bounce" />
                  <h3 className="text-base font-black uppercase tracking-wider font-mono">Select Match Winner</h3>
                  <p className="text-xs text-slate-400">
                    Bout {activeMatch._id.toUpperCase()} has ended. Please explicitly select the winner to advance them to the next bracket round:
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      setShowDeclareWinnerModal(false);
                      await updateMatchOnServer({
                        status: 'completed',
                        winnerId: activeMatch.player1Id
                      });
                    }}
                    className="w-full p-4 bg-red-950/40 hover:bg-red-900/60 border border-red-900 rounded-2xl text-left flex justify-between items-center transition-all cursor-pointer font-bold text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                      <span>{activeMatch.player1Name} (Chung)</span>
                    </span>
                    <span className="font-mono bg-red-950 border border-red-800 px-2.5 py-0.5 rounded text-[10px]">
                      {activeMatch.score.player1} Pts
                    </span>
                  </button>

                  <button
                    onClick={async () => {
                      setShowDeclareWinnerModal(false);
                      await updateMatchOnServer({
                        status: 'completed',
                        winnerId: activeMatch.player2Id
                      });
                    }}
                    className="w-full p-4 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-900 rounded-2xl text-left flex justify-between items-center transition-all cursor-pointer font-bold text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                      <span>{activeMatch.player2Name} (Hong)</span>
                    </span>
                    <span className="font-mono bg-blue-950 border border-blue-800 px-2.5 py-0.5 rounded text-[10px]">
                      {activeMatch.score.player2} Pts
                    </span>
                  </button>
                </div>

                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => setShowDeclareWinnerModal(false)}
                    className="px-4 py-1.5 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
