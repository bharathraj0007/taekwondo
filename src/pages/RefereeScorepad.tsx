import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck, ArrowLeft, Play, Pause, RotateCcw, Undo2,
  CheckCircle, AlertCircle, Radio, Trophy, Lock, Swords, 
  ChevronRight, X, Sparkles, Volume2, VolumeX, AlertTriangle,
  Award, Flame, ShieldAlert, Flag, Check, Layers
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface RoundState {
  p1: number;
  p2: number;
  p1Penalties: number;
  p2Penalties: number;
  winner: string | null; // 'player1' | 'player2' | null
  isFinished: boolean;
}

interface ScoreAction {
  id: string;
  roundName: string;
  type: 'point' | 'gamjeom' | 'deduct';
  target: 'player1' | 'player2';
  value: number;
  description: string;
  timestamp: string;
}

export const RefereeScorepad: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [match, setMatch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Bout Round State ('Round 1' | 'Round 2' | 'Round 3' | 'Golden Pt')
  const [activeBoutRound, setActiveBoutRound] = useState<string>('Round 1');

  // Round-by-Round Data Map
  const [roundScores, setRoundScores] = useState<Record<string, RoundState>>({
    'Round 1': { p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false },
    'Round 2': { p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false },
    'Round 3': { p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false },
    'Golden Pt': { p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false },
  });

  // Designated Match Winner & Decision Method
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [decisionMethod, setDecisionMethod] = useState<string>('PTF'); // PTF, PTG, RSC, DSQ, WDR, SUP
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);
  const [showAwardRoundModal, setShowAwardRoundModal] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Undo Action History Stack
  const [actionHistory, setActionHistory] = useState<ScoreAction[]>([]);

  // Round Timer State (Default 2:00 = 120s)
  const [timerSeconds, setTimerSeconds] = useState<number>(120);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Sound alert
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Derived Rounds Won calculation
  const roundsWon = useMemo(() => {
    let p1Wins = 0;
    let p2Wins = 0;
    ['Round 1', 'Round 2', 'Round 3', 'Golden Pt'].forEach((r) => {
      const state = roundScores[r];
      if (state && state.winner === 'player1') p1Wins++;
      if (state && state.winner === 'player2') p2Wins++;
    });
    return { player1: p1Wins, player2: p2Wins };
  }, [roundScores]);

  // Current active round points & penalties
  const currentRoundState = roundScores[activeBoutRound] || {
    p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false
  };

  // Play audio beep when timer reaches 0
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch {
      // Audio context might be restricted before interaction
    }
  };

  // 1. Fetch Match Details
  const fetchMatch = async () => {
    if (!matchId) return;
    try {
      setError(null);
      const res = await fetch(`/api/referee/match/${matchId}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to load match scorepad details.');
      }

      const data = await res.json();
      const m = data.match;
      setMatch(m);

      // Restore detailed roundScores if existing
      if (Array.isArray(m.roundScores) && m.roundScores.length > 0) {
        const restored: Record<string, RoundState> = {
          'Round 1': { p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false },
          'Round 2': { p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false },
          'Round 3': { p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false },
          'Golden Pt': { p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false },
        };

        m.roundScores.forEach((rs: any) => {
          const rKey = rs.round || rs.name || 'Round 1';
          restored[rKey] = {
            p1: Number(rs.p1 ?? rs.player1 ?? 0),
            p2: Number(rs.p2 ?? rs.player2 ?? 0),
            p1Penalties: Number(rs.p1Penalties ?? rs.p1Gamjeom ?? 0),
            p2Penalties: Number(rs.p2Penalties ?? rs.p2Gamjeom ?? 0),
            winner: rs.winner || null,
            isFinished: rs.isFinished || !!rs.winner,
          };
        });
        setRoundScores(restored);
      } else if (m.score) {
        // Fallback initial score
        setRoundScores((prev) => ({
          ...prev,
          'Round 1': {
            ...prev['Round 1'],
            p1: m.score.player1 ?? 0,
            p2: m.score.player2 ?? 0,
            p1Penalties: m.penalties?.player1 ?? 0,
            p2Penalties: m.penalties?.player2 ?? 0,
          }
        }));
      }

      if (m.boutRound) {
        setActiveBoutRound(m.boutRound);
      }

      if (m.winnerId) {
        setSelectedWinnerId(m.winnerId);
      }

      if (m.status === 'completed') {
        setIsLocked(true);
      }
    } catch (err: any) {
      console.error('Referee scorepad fetch error:', err);
      setError(err.message || 'Error loading match data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatch();

    const socket = io(window.location.origin);
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [matchId]);

  // Timer Tick
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            playBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timerSeconds]);

  // Sync Live Score to Backend & Sockets
  const syncLiveState = async (
    updatedRounds: Record<string, RoundState>,
    activeRoundName: string
  ) => {
    if (!matchId || isLocked) return;

    try {
      // Format roundScores array
      const roundScoresArray = Object.entries(updatedRounds).map(([rName, state]) => ({
        round: rName,
        p1: state.p1,
        p2: state.p2,
        p1Penalties: state.p1Penalties,
        p2Penalties: state.p2Penalties,
        winner: state.winner,
        isFinished: state.isFinished,
      }));

      // Calculate rounds won
      let p1Wins = 0;
      let p2Wins = 0;
      roundScoresArray.forEach((r) => {
        if (r.winner === 'player1') p1Wins++;
        if (r.winner === 'player2') p2Wins++;
      });

      const totalPenalties = {
        player1: Object.values(updatedRounds).reduce((acc, r) => acc + r.p1Penalties, 0),
        player2: Object.values(updatedRounds).reduce((acc, r) => acc + r.p2Penalties, 0),
      };

      // Current active round score for live badge
      const activeState = updatedRounds[activeRoundName] || { p1: 0, p2: 0 };

      await fetch(`/api/referee/match/${matchId}/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          score: { player1: activeState.p1, player2: activeState.p2 },
          roundsWon: { player1: p1Wins, player2: p2Wins },
          roundScores: roundScoresArray,
          penalties: totalPenalties,
          boutRound: activeRoundName,
          status: 'live',
        })
      });
    } catch (err) {
      console.error('Failed to sync live score:', err);
    }
  };

  // Add Points for Active Round
  const handleAddPoints = (target: 'player1' | 'player2', points: number, label: string) => {
    if (isLocked) return;

    const current = roundScores[activeBoutRound] || {
      p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false
    };

    const newP1 = target === 'player1' ? Math.max(0, current.p1 + points) : current.p1;
    const newP2 = target === 'player2' ? Math.max(0, current.p2 + points) : current.p2;

    const updatedRound: RoundState = {
      ...current,
      p1: newP1,
      p2: newP2,
    };

    const nextRoundScores = {
      ...roundScores,
      [activeBoutRound]: updatedRound,
    };

    setRoundScores(nextRoundScores);

    // Add to Undo History
    const athleteName = target === 'player1' ? (match?.player1Name || 'RED') : (match?.player2Name || 'BLUE');
    const action: ScoreAction = {
      id: Math.random().toString(),
      roundName: activeBoutRound,
      type: 'point',
      target,
      value: points,
      description: `+${points} ${label} → ${athleteName} (${activeBoutRound})`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setActionHistory((prev) => [action, ...prev.slice(0, 19)]);

    syncLiveState(nextRoundScores, activeBoutRound);

    // Point Gap Check (PTG: 12-point gap in WT)
    if (Math.abs(newP1 - newP2) >= 12 && (newP1 >= 12 || newP2 >= 12)) {
      setSuccessMessage(`Point Gap (PTG: 12+ pts difference) reached in ${activeBoutRound}!`);
    }
  };

  // Deduct 1 Point for Active Round
  const handleDeductPoint = (target: 'player1' | 'player2') => {
    if (isLocked) return;

    const current = roundScores[activeBoutRound];
    if (!current) return;

    const newP1 = target === 'player1' ? Math.max(0, current.p1 - 1) : current.p1;
    const newP2 = target === 'player2' ? Math.max(0, current.p2 - 1) : current.p2;

    const updatedRound: RoundState = {
      ...current,
      p1: newP1,
      p2: newP2,
    };

    const nextRoundScores = {
      ...roundScores,
      [activeBoutRound]: updatedRound,
    };

    setRoundScores(nextRoundScores);

    const athleteName = target === 'player1' ? (match?.player1Name || 'RED') : (match?.player2Name || 'BLUE');
    const action: ScoreAction = {
      id: Math.random().toString(),
      roundName: activeBoutRound,
      type: 'deduct',
      target,
      value: 1,
      description: `-1 Pt correction on ${athleteName} (${activeBoutRound})`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setActionHistory((prev) => [action, ...prev.slice(0, 19)]);

    syncLiveState(nextRoundScores, activeBoutRound);
  };

  // Gam-Jeom (Penalty): WT rules award 1 point to opponent and increment penalty
  const handleGamJeom = (penalizedTarget: 'player1' | 'player2') => {
    if (isLocked) return;

    const current = roundScores[activeBoutRound] || {
      p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false
    };

    const opponent = penalizedTarget === 'player1' ? 'player2' : 'player1';

    const newPenaltiesP1 = penalizedTarget === 'player1' ? current.p1Penalties + 1 : current.p1Penalties;
    const newPenaltiesP2 = penalizedTarget === 'player2' ? current.p2Penalties + 1 : current.p2Penalties;

    const newP1 = opponent === 'player1' ? current.p1 + 1 : current.p1;
    const newP2 = opponent === 'player2' ? current.p2 + 1 : current.p2;

    const updatedRound: RoundState = {
      ...current,
      p1: newP1,
      p2: newP2,
      p1Penalties: newPenaltiesP1,
      p2Penalties: newPenaltiesP2,
    };

    const nextRoundScores = {
      ...roundScores,
      [activeBoutRound]: updatedRound,
    };

    setRoundScores(nextRoundScores);

    const penalizedName = penalizedTarget === 'player1' ? (match?.player1Name || 'RED') : (match?.player2Name || 'BLUE');
    const action: ScoreAction = {
      id: Math.random().toString(),
      roundName: activeBoutRound,
      type: 'gamjeom',
      target: penalizedTarget,
      value: 1,
      description: `Gam-jeom (Penalty) on ${penalizedName} → +1 pt to opponent`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setActionHistory((prev) => [action, ...prev.slice(0, 19)]);

    syncLiveState(nextRoundScores, activeBoutRound);

    // 5 Gam-jeom Disqualification Warning
    const penaltyCount = penalizedTarget === 'player1' ? newPenaltiesP1 : newPenaltiesP2;
    if (penaltyCount >= 5) {
      setError(`⚠️ 5 Gam-jeoms reached by ${penalizedName}! Match may be declared DSQ (Disqualification).`);
    }
  };

  // Undo Last Action
  const handleUndo = () => {
    if (isLocked || actionHistory.length === 0) return;

    const [lastAction, ...remaining] = actionHistory;
    const targetRound = lastAction.roundName;
    const current = roundScores[targetRound];
    if (!current) return;

    let updatedRound = { ...current };

    if (lastAction.type === 'point') {
      if (lastAction.target === 'player1') {
        updatedRound.p1 = Math.max(0, current.p1 - lastAction.value);
      } else {
        updatedRound.p2 = Math.max(0, current.p2 - lastAction.value);
      }
    } else if (lastAction.type === 'deduct') {
      if (lastAction.target === 'player1') {
        updatedRound.p1 = current.p1 + lastAction.value;
      } else {
        updatedRound.p2 = current.p2 + lastAction.value;
      }
    } else if (lastAction.type === 'gamjeom') {
      const opponent = lastAction.target === 'player1' ? 'player2' : 'player1';
      if (lastAction.target === 'player1') {
        updatedRound.p1Penalties = Math.max(0, current.p1Penalties - 1);
        updatedRound.p2 = Math.max(0, current.p2 - 1);
      } else {
        updatedRound.p2Penalties = Math.max(0, current.p2Penalties - 1);
        updatedRound.p1 = Math.max(0, current.p1 - 1);
      }
    }

    const nextRoundScores = {
      ...roundScores,
      [targetRound]: updatedRound,
    };

    setRoundScores(nextRoundScores);
    setActionHistory(remaining);
    syncLiveState(nextRoundScores, activeBoutRound);
  };

  // Award / Conclude Current Round
  const handleAwardRound = (winner: 'player1' | 'player2') => {
    if (isLocked) return;

    const current = roundScores[activeBoutRound] || {
      p1: 0, p2: 0, p1Penalties: 0, p2Penalties: 0, winner: null, isFinished: false
    };

    const updatedRound: RoundState = {
      ...current,
      winner,
      isFinished: true,
    };

    const nextRoundScores = {
      ...roundScores,
      [activeBoutRound]: updatedRound,
    };

    setRoundScores(nextRoundScores);
    setShowAwardRoundModal(false);

    // Compute updated rounds won
    let p1Wins = 0;
    let p2Wins = 0;
    ['Round 1', 'Round 2', 'Round 3', 'Golden Pt'].forEach((r) => {
      const state = nextRoundScores[r];
      if (state && state.winner === 'player1') p1Wins++;
      if (state && state.winner === 'player2') p2Wins++;
    });

    const winnerName = winner === 'player1' ? (match?.player1Name || 'RED') : (match?.player2Name || 'BLUE');
    setSuccessMessage(`${activeBoutRound} officially awarded to ${winnerName}! (Rounds: RED ${p1Wins} - ${p2Wins} BLUE)`);

    // Check if Best-of-3 Match is already won (2 rounds won)
    if (p1Wins >= 2) {
      setSelectedWinnerId(match.player1Id);
      setShowConfirmSubmitModal(true);
    } else if (p2Wins >= 2) {
      setSelectedWinnerId(match.player2Id);
      setShowConfirmSubmitModal(true);
    } else {
      // Auto-advance to next round
      if (activeBoutRound === 'Round 1') {
        setActiveBoutRound('Round 2');
        setTimerSeconds(120);
        setIsTimerRunning(false);
      } else if (activeBoutRound === 'Round 2') {
        if (p1Wins === 1 && p2Wins === 1) {
          setActiveBoutRound('Round 3');
          setTimerSeconds(120);
          setIsTimerRunning(false);
        }
      } else if (activeBoutRound === 'Round 3') {
        if (p1Wins === p2Wins) {
          setActiveBoutRound('Golden Pt');
          setTimerSeconds(60);
          setIsTimerRunning(false);
        }
      }
    }

    syncLiveState(nextRoundScores, activeBoutRound);
  };

  // Reset Round Score
  const handleResetCurrentRound = () => {
    if (isLocked) return;
    if (!confirm(`Are you sure you want to reset all points and penalties for ${activeBoutRound}?`)) return;

    const nextRoundScores = {
      ...roundScores,
      [activeBoutRound]: {
        p1: 0,
        p2: 0,
        p1Penalties: 0,
        p2Penalties: 0,
        winner: null,
        isFinished: false,
      }
    };

    setRoundScores(nextRoundScores);
    syncLiveState(nextRoundScores, activeBoutRound);
  };

  // Timer Controls
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleResetTimer = (defaultTime = 120) => {
    setIsTimerRunning(false);
    setTimerSeconds(defaultTime);
  };

  // Submit Final Official Score & Lock
  const handleSubmitFinalScore = async () => {
    if (!matchId || isLocked) return;

    if (!selectedWinnerId) {
      alert('Please select the designated winning competitor before submitting official result.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const winnerName = selectedWinnerId === match.player1Id ? match.player1Name : match.player2Name;

    // Build comprehensive roundScores
    const roundScoresArray = Object.entries(roundScores).map(([rName, state]) => ({
      round: rName,
      p1: state.p1,
      p2: state.p2,
      p1Penalties: state.p1Penalties,
      p2Penalties: state.p2Penalties,
      winner: state.winner,
      isFinished: state.isFinished,
    }));

    const totalPenalties = {
      player1: Object.values(roundScores).reduce((acc, r) => acc + r.p1Penalties, 0),
      player2: Object.values(roundScores).reduce((acc, r) => acc + r.p2Penalties, 0),
    };

    try {
      const res = await fetch(`/api/referee/match/${matchId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          winnerId: selectedWinnerId,
          winnerName,
          decisionMethod,
          score: {
            player1: roundsWon.player1,
            player2: roundsWon.player2,
          },
          roundsWon: {
            player1: roundsWon.player1,
            player2: roundsWon.player2,
          },
          roundScores: roundScoresArray,
          penalties: totalPenalties,
          finalRound: match.round, // Preserve bracket round stage
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit official score.');
      }

      setIsLocked(true);
      setShowConfirmSubmitModal(false);
      setSuccessMessage(`Match result officially locked! Winner "${winnerName}" (${roundsWon.player1}-${roundsWon.player2}) advanced in tournament bracket.`);
      fetchMatch();
    } catch (err: any) {
      console.error('Submit final score error:', err);
      setError(err.message || 'Error submitting score.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Radio className="w-10 h-10 text-red-500 animate-spin mb-3" />
        <p className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
          Initializing World Taekwondo Electronic Scorepad Engine...
        </p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-lg font-mono font-black uppercase">Match Record Not Found</h2>
        <p className="text-xs text-slate-400">{error || 'Unable to load match data.'}</p>
        <Link
          to="/referee/dashboard"
          className="px-4 py-2 bg-slate-800 text-xs font-mono font-bold rounded-xl text-white hover:bg-slate-700"
        >
          Return to Referee Console
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none font-sans overflow-x-hidden">
      
      {/* 1. Header Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Identity & Match Meta */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/referee/dashboard')}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              title="Return to Referee Console"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black text-white uppercase">
                  {match.ageCategory || 'Senior'} · {match.weightCategory} ({match.gender ? match.gender.toUpperCase() : 'MALE'})
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-red-400 border border-slate-700 uppercase">
                  {match.round || 'Round 1'}
                </span>
                {isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Mat #{match.matNumber || 1} · Officiating Judge: <strong className="text-white">{user?.name}</strong>
              </p>
            </div>
          </div>

          {/* Central Rounds Won Scoreboard Banner */}
          <div className="bg-slate-950 px-4 py-1.5 rounded-2xl border border-slate-800 flex items-center gap-3 shadow-inner">
            <div className="text-center">
              <span className="text-[9px] font-mono uppercase text-red-400 font-black block">RED ROUNDS</span>
              <span className="text-2xl font-black font-mono text-red-500 leading-none">{roundsWon.player1}</span>
            </div>
            <div className="text-slate-600 font-mono font-bold text-sm">:</div>
            <div className="text-center">
              <span className="text-[9px] font-mono uppercase text-blue-400 font-black block">BLUE ROUNDS</span>
              <span className="text-2xl font-black font-mono text-blue-500 leading-none">{roundsWon.player2}</span>
            </div>
          </div>

          {/* Actions & Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              title={soundEnabled ? 'Mute buzzer' : 'Enable buzzer'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              onClick={handleUndo}
              disabled={isLocked || actionHistory.length === 0}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-slate-700 text-slate-200 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Undo last scoring action"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Undo</span>
            </button>

            <button
              onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/referee/dashboard')}
              className="px-3 py-1.5 bg-blue-900/80 hover:bg-blue-800 border border-blue-700 text-blue-200 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{user?.role === 'admin' ? 'Admin' : 'Console'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-3">
          <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs p-3 rounded-2xl flex items-center justify-between shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold font-mono">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white p-1 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-3">
          <div className="bg-rose-950/90 border border-rose-700 text-rose-200 text-xs p-3 rounded-2xl flex items-center justify-between shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-bold font-mono">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white p-1 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Bout Round Switcher & Stopwatch Toolbar */}
      <div className="max-w-7xl mx-auto w-full px-4 py-2 space-y-2">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          
          {/* Round Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {['Round 1', 'Round 2', 'Round 3', 'Golden Pt'].map((rName) => {
              const rState = roundScores[rName];
              const isActive = activeBoutRound === rName;
              const hasWinner = !!rState?.winner;

              return (
                <button
                  key={rName}
                  disabled={isLocked}
                  onClick={() => {
                    setActiveBoutRound(rName);
                    syncLiveState(roundScores, rName);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-red-600 text-white shadow-md'
                      : hasWinner
                      ? 'bg-slate-900 text-slate-300 border border-slate-700'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{rName}</span>
                  {hasWinner && (
                    <span className={`w-2 h-2 rounded-full ${rState.winner === 'player1' ? 'bg-red-400' : 'bg-blue-400'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Stopwatch Countdown */}
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-black font-mono tracking-widest px-3 py-1 rounded-xl bg-slate-950 border ${
              timerSeconds <= 10 && timerSeconds > 0
                ? 'text-red-500 border-red-800 animate-pulse ring-2 ring-red-500/30'
                : timerSeconds === 0
                ? 'text-rose-400 border-rose-800'
                : 'text-amber-400 border-slate-800'
            }`}>
              {formatTimer(timerSeconds)}
            </span>

            {/* Timer Actions */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95 ${
                  isTimerRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isTimerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Start</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleResetTimer(120)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                title="Reset 2:00 Minutes"
              >
                2:00
              </button>

              <button
                onClick={() => handleResetTimer(60)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                title="Reset 1:00 Minute"
              >
                1:00
              </button>

              <button
                onClick={() => setTimerSeconds((s) => s + 10)}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                title="+10s"
              >
                +10s
              </button>
            </div>
          </div>

          {/* Round Award / Conclude Trigger */}
          <div className="flex items-center gap-2">
            <button
              disabled={isLocked}
              onClick={() => setShowAwardRoundModal(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-mono font-bold text-xs uppercase rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Conclude & Award {activeBoutRound}</span>
            </button>

            <button
              disabled={isLocked}
              onClick={handleResetCurrentRound}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl font-mono text-xs cursor-pointer"
              title="Reset points in active round"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* 3. Main Touchpad Arena: RED vs BLUE Corners */}
      <main className="max-w-7xl mx-auto w-full px-4 py-2 flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* ================= RED CORNER (HONG) ================= */}
        <div className={`rounded-3xl border p-5 flex flex-col justify-between space-y-4 shadow-2xl relative overflow-hidden transition-all ${
          selectedWinnerId === match.player1Id
            ? 'bg-gradient-to-b from-red-950 via-slate-900 to-slate-950 border-red-500 ring-4 ring-red-500/30'
            : 'bg-slate-900/90 border-red-900/60 hover:border-red-600/60'
        }`}>
          {/* Header */}
          <div className="space-y-1 relative">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-mono font-black uppercase tracking-widest shadow-md shadow-red-900/50">
                🔴 RED CORNER (HONG)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-red-400 bg-red-950/80 px-2.5 py-1 rounded-lg border border-red-800">
                  Rounds Won: <strong className="text-white text-sm">{roundsWon.player1}</strong>
                </span>
                <span className="text-xs font-mono font-bold text-red-300 bg-red-950/80 px-2 py-1 rounded-lg border border-red-800">
                  Gam-jeom: <strong className="text-white">{currentRoundState.p1Penalties}</strong>
                </span>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">
                {match.player1Name || 'TBD Competitor'}
              </h3>
              <p className="text-[11px] text-red-300/80 font-mono">
                {match.player1Club || 'Team Red · Verified Official Entry'}
              </p>
            </div>
          </div>

          {/* Huge Touchpad Round Score Display */}
          <div className="text-center my-1 bg-slate-950/80 py-4 rounded-2xl border border-red-950 shadow-inner">
            <div className="text-7xl lg:text-8xl font-black font-mono text-red-500 tracking-tighter drop-shadow-md leading-none">
              {currentRoundState.p1}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                {activeBoutRound} Points
              </span>
              <button
                disabled={isLocked || currentRoundState.p1 <= 0}
                onClick={() => handleDeductPoint('player1')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700 rounded text-[10px] font-mono font-bold cursor-pointer disabled:opacity-30"
                title="Deduct 1 point"
              >
                -1 Pt
              </button>
            </div>
          </div>

          {/* Point Buttons Grid */}
          <div className="space-y-2 font-mono">
            <div className="grid grid-cols-3 gap-2 text-xs font-bold">
              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player1', 1, 'Punch')}
                className="py-3.5 bg-red-700 hover:bg-red-600 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow-md transition-all cursor-pointer flex flex-col items-center justify-center space-y-0.5"
              >
                <span className="text-base font-black">+1</span>
                <span className="text-[9px] font-normal uppercase opacity-90">Punch</span>
              </button>

              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player1', 2, 'Body Kick')}
                className="py-3.5 bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow-md transition-all cursor-pointer flex flex-col items-center justify-center space-y-0.5"
              >
                <span className="text-base font-black">+2</span>
                <span className="text-[9px] font-normal uppercase opacity-90">Body Kick</span>
              </button>

              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player1', 3, 'Head Kick')}
                className="py-3.5 bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow-md transition-all cursor-pointer flex flex-col items-center justify-center space-y-0.5"
              >
                <span className="text-base font-black">+3</span>
                <span className="text-[9px] font-normal uppercase opacity-90">Head Kick</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player1', 4, 'Turning Body Kick')}
                className="py-2.5 bg-red-800/80 hover:bg-red-700 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="text-sm font-black">+4</span>
                <span className="text-[10px] uppercase">Turning Body</span>
              </button>

              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player1', 5, 'Turning Head Kick')}
                className="py-2.5 bg-red-800/80 hover:bg-red-700 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="text-sm font-black">+5</span>
                <span className="text-[10px] uppercase">Turning Head</span>
              </button>
            </div>

            {/* Gam-Jeom & Round Award */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-bold">
              <button
                disabled={isLocked}
                onClick={() => handleGamJeom('player1')}
                className="py-2.5 bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300 rounded-xl shadow cursor-pointer active:scale-95 transition-all text-center leading-tight"
              >
                <div className="text-[10px] font-bold uppercase">+1 Gam-Jeom (Penalty)</div>
                <div className="text-[8px] opacity-75 font-normal">(+1 pt to Blue)</div>
              </button>

              <button
                disabled={isLocked}
                onClick={() => handleAwardRound('player1')}
                className="py-2.5 bg-red-600/30 hover:bg-red-600 border border-red-500 text-red-200 hover:text-white rounded-xl shadow cursor-pointer active:scale-95 transition-all text-center font-bold text-[10px] uppercase"
              >
                🏆 Award {activeBoutRound} to RED
              </button>
            </div>
          </div>
        </div>

        {/* ================= BLUE CORNER (CHUNG) ================= */}
        <div className={`rounded-3xl border p-5 flex flex-col justify-between space-y-4 shadow-2xl relative overflow-hidden transition-all ${
          selectedWinnerId === match.player2Id
            ? 'bg-gradient-to-b from-blue-950 via-slate-900 to-slate-950 border-blue-500 ring-4 ring-blue-500/30'
            : 'bg-slate-900/90 border-blue-900/60 hover:border-blue-600/60'
        }`}>
          {/* Header */}
          <div className="space-y-1 relative">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-mono font-black uppercase tracking-widest shadow-md shadow-blue-900/50">
                🔵 BLUE CORNER (CHUNG)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-800">
                  Rounds Won: <strong className="text-white text-sm">{roundsWon.player2}</strong>
                </span>
                <span className="text-xs font-mono font-bold text-blue-300 bg-blue-950/80 px-2 py-1 rounded-lg border border-blue-800">
                  Gam-jeom: <strong className="text-white">{currentRoundState.p2Penalties}</strong>
                </span>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">
                {match.player2Name || 'TBD Competitor'}
              </h3>
              <p className="text-[11px] text-blue-300/80 font-mono">
                {match.player2Club || 'Team Blue · Verified Official Entry'}
              </p>
            </div>
          </div>

          {/* Huge Touchpad Round Score Display */}
          <div className="text-center my-1 bg-slate-950/80 py-4 rounded-2xl border border-blue-950 shadow-inner">
            <div className="text-7xl lg:text-8xl font-black font-mono text-blue-400 tracking-tighter drop-shadow-md leading-none">
              {currentRoundState.p2}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                {activeBoutRound} Points
              </span>
              <button
                disabled={isLocked || currentRoundState.p2 <= 0}
                onClick={() => handleDeductPoint('player2')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded text-[10px] font-mono font-bold cursor-pointer disabled:opacity-30"
                title="Deduct 1 point"
              >
                -1 Pt
              </button>
            </div>
          </div>

          {/* Point Buttons Grid */}
          <div className="space-y-2 font-mono">
            <div className="grid grid-cols-3 gap-2 text-xs font-bold">
              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player2', 1, 'Punch')}
                className="py-3.5 bg-blue-700 hover:bg-blue-600 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow-md transition-all cursor-pointer flex flex-col items-center justify-center space-y-0.5"
              >
                <span className="text-base font-black">+1</span>
                <span className="text-[9px] font-normal uppercase opacity-90">Punch</span>
              </button>

              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player2', 2, 'Body Kick')}
                className="py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow-md transition-all cursor-pointer flex flex-col items-center justify-center space-y-0.5"
              >
                <span className="text-base font-black">+2</span>
                <span className="text-[9px] font-normal uppercase opacity-90">Body Kick</span>
              </button>

              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player2', 3, 'Head Kick')}
                className="py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow-md transition-all cursor-pointer flex flex-col items-center justify-center space-y-0.5"
              >
                <span className="text-base font-black">+3</span>
                <span className="text-[9px] font-normal uppercase opacity-90">Head Kick</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player2', 4, 'Turning Body Kick')}
                className="py-2.5 bg-blue-800/80 hover:bg-blue-700 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="text-sm font-black">+4</span>
                <span className="text-[10px] uppercase">Turning Body</span>
              </button>

              <button
                disabled={isLocked}
                onClick={() => handleAddPoints('player2', 5, 'Turning Head Kick')}
                className="py-2.5 bg-blue-800/80 hover:bg-blue-700 active:scale-95 disabled:opacity-40 text-white rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="text-sm font-black">+5</span>
                <span className="text-[10px] uppercase">Turning Head</span>
              </button>
            </div>

            {/* Gam-Jeom & Round Award */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-bold">
              <button
                disabled={isLocked}
                onClick={() => handleGamJeom('player2')}
                className="py-2.5 bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-300 rounded-xl shadow cursor-pointer active:scale-95 transition-all text-center leading-tight"
              >
                <div className="text-[10px] font-bold uppercase">+1 Gam-Jeom (Penalty)</div>
                <div className="text-[8px] opacity-75 font-normal">(+1 pt to Red)</div>
              </button>

              <button
                disabled={isLocked}
                onClick={() => handleAwardRound('player2')}
                className="py-2.5 bg-blue-600/30 hover:bg-blue-600 border border-blue-500 text-blue-200 hover:text-white rounded-xl shadow cursor-pointer active:scale-95 transition-all text-center font-bold text-[10px] uppercase"
              >
                🏆 Award {activeBoutRound} to BLUE
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* 4. Bottom Scorepad Action & Submission Tray */}
      <footer className="bg-slate-900 border-t border-slate-800 p-3.5 sticky bottom-0 z-30 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Round-by-Round Summary Strip */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto text-xs font-mono">
            <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0">Bout Summary:</span>
            {['Round 1', 'Round 2', 'Round 3'].map((rName) => {
              const r = roundScores[rName];
              if (!r) return null;
              return (
                <div
                  key={rName}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] flex items-center gap-1.5 ${
                    r.isFinished
                      ? r.winner === 'player1'
                        ? 'bg-red-950/60 border-red-800 text-red-300'
                        : 'bg-blue-950/60 border-blue-800 text-blue-300'
                      : activeBoutRound === rName
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="font-bold">{rName}:</span>
                  <span>{r.p1} - {r.p2}</span>
                  {r.winner && <span className="font-black">{r.winner === 'player1' ? '🔴' : '🔵'}</span>}
                </div>
              );
            })}
          </div>

          {/* Action History or Submit Final Score */}
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
            {isLocked ? (
              <div className="flex items-center gap-2 bg-emerald-950 text-emerald-400 border border-emerald-800 px-4 py-2 rounded-xl font-mono text-xs font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>OFFICIAL MATCH RESULT LOCKED</span>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmSubmitModal(true)}
                disabled={submitting}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>Finalize & Lock Match ({roundsWon.player1} - {roundsWon.player2})</span>
              </button>
            )}
          </div>

        </div>
      </footer>

      {/* 5. Award Round Modal */}
      {showAwardRoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-white font-mono uppercase">
                  Conclude {activeBoutRound}
                </h3>
                <p className="text-xs text-slate-400">
                  Select which competitor is officially awarded the round victory.
                </p>
              </div>
            </div>

            {/* Current points in this round */}
            <div className="grid grid-cols-2 gap-3 text-center font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-red-900/60">
                <div className="text-[10px] text-red-400 font-bold uppercase">{match.player1Name} (RED)</div>
                <div className="text-3xl font-black text-red-500 mt-1">{currentRoundState.p1} pts</div>
                <div className="text-[9px] text-slate-500 mt-0.5">Penalties: {currentRoundState.p1Penalties}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-blue-900/60">
                <div className="text-[10px] text-blue-400 font-bold uppercase">{match.player2Name} (BLUE)</div>
                <div className="text-3xl font-black text-blue-400 mt-1">{currentRoundState.p2} pts</div>
                <div className="text-[9px] text-slate-500 mt-0.5">Penalties: {currentRoundState.p2Penalties}</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 font-mono">
              <button
                type="button"
                onClick={() => handleAwardRound('player1')}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <span>Award {activeBoutRound} to {match.player1Name} (RED)</span>
              </button>

              <button
                type="button"
                onClick={() => handleAwardRound('player2')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <span>Award {activeBoutRound} to {match.player2Name} (BLUE)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAwardRoundModal(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Submit Final Score Confirmation Modal */}
      {showConfirmSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-white font-mono uppercase">
                  Confirm Official Match Result
                </h3>
                <p className="text-xs text-slate-400">
                  Submitting will permanently lock the scorepad result and automatically advance the winner in the bracket.
                </p>
              </div>
            </div>

            {/* Score Summary Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Division / Stage:</span>
                <span className="font-bold text-white">{match.ageCategory} · {match.weightCategory} ({match.round || 'Round 1'})</span>
              </div>

              {/* Rounds Won Badges */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div 
                  onClick={() => setSelectedWinnerId(match.player1Id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedWinnerId === match.player1Id
                      ? 'bg-red-950/80 border-red-500 text-red-300 font-bold ring-2 ring-red-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[10px] text-red-400 uppercase font-black">RED (HONG)</div>
                  <div className="text-sm text-white font-black truncate">{match.player1Name}</div>
                  <div className="text-2xl font-black text-red-500 mt-1">{roundsWon.player1} Rounds</div>
                  {selectedWinnerId === match.player1Id && (
                    <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full inline-block mt-1 font-bold">
                      🏆 WINNER
                    </span>
                  )}
                </div>

                <div 
                  onClick={() => setSelectedWinnerId(match.player2Id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedWinnerId === match.player2Id
                      ? 'bg-blue-950/80 border-blue-500 text-blue-300 font-bold ring-2 ring-blue-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[10px] text-blue-400 uppercase font-black">BLUE (CHUNG)</div>
                  <div className="text-sm text-white font-black truncate">{match.player2Name}</div>
                  <div className="text-2xl font-black text-blue-400 mt-1">{roundsWon.player2} Rounds</div>
                  {selectedWinnerId === match.player2Id && (
                    <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full inline-block mt-1 font-bold">
                      🏆 WINNER
                    </span>
                  )}
                </div>
              </div>

              {/* Decision Method Selector */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Method of Victory (Decision):
                </label>
                <select
                  value={decisionMethod}
                  onChange={(e) => setDecisionMethod(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white px-3 py-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer font-mono"
                >
                  <option value="PTF">PTF - Final Points (Best of 3 Rounds)</option>
                  <option value="PTG">PTG - Point Gap (12+ pt differential)</option>
                  <option value="GDP">GDP - Golden Point Round (Overtime)</option>
                  <option value="RSC">RSC / KO - Referee Stops Contest / Knockout</option>
                  <option value="DSQ">DSQ - Disqualification (5 Gam-jeoms / Violation)</option>
                  <option value="WDR">WDR - Withdrawal (Injury / Forfeit)</option>
                  <option value="SUP">SUP - Superiority Decision</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 justify-end font-mono">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmSubmitModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Back to Scoring
              </button>

              <button
                type="button"
                disabled={submitting || !selectedWinnerId}
                onClick={handleSubmitFinalScore}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Locking Result...' : 'Confirm & Submit Result'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
