import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Trophy, Swords, Radio, CheckCircle2, ZoomIn, ZoomOut, 
  RotateCcw, Maximize2, Minimize2, ChevronRight, ChevronLeft, User, Download, FileText,
  Move, MousePointer
} from 'lucide-react';
import { getMatchSlotDisplay, calculateBracketDepths, exportBracketSvg, exportBracketPdf } from '../utils/bracketUtils';

export interface BracketMatch {
  _id: string;
  round: string;
  player1Id?: string;
  player2Id?: string;
  player1Name: string;
  player2Name: string;
  winnerId?: string | null;
  score?: {
    player1: number;
    player2: number;
  };
  status?: 'pending' | 'upcoming' | 'live' | 'completed';
  nextMatchId?: string | null;
  nextMatchPlayerSlot?: 'player1' | 'player2' | null;
  matchIndex?: number;
  ageCategory?: string;
  weightCategory?: string;
  gender?: string;
  eventId?: string;
}

interface BracketVisualizerProps {
  matches: BracketMatch[];
  onMatchClick?: (match: BracketMatch) => void;
  selectedMatchId?: string;
  title?: string;
  className?: string;
  initialDrawOnly?: boolean;
  showScores?: boolean;
}

const CARD_WIDTH = 230;
const CARD_HEIGHT = 100;
const COL_GAP = 80;
const ROW_GAP = 24;

export const BracketVisualizer: React.FC<BracketVisualizerProps> = ({
  matches,
  onMatchClick,
  selectedMatchId,
  title,
  className = '',
  initialDrawOnly = false,
  showScores = !initialDrawOnly
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const isZoomInitializedRef = useRef<boolean>(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [activeRoundIdx, setActiveRoundIdx] = useState<number>(0);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [showScrollHint, setShowScrollHint] = useState<boolean>(false);
  const scrollHintTimeoutRef = useRef<any>(null);

  // Group matches by round and establish canonical round order
  const { sortedRounds, matchesByRound, layoutNodes, layoutLinks, bounds } = useMemo(() => {
    if (!matches || matches.length === 0) {
      return { 
        sortedRounds: [], 
        matchesByRound: {}, 
        layoutNodes: [], 
        layoutLinks: [], 
        bounds: { width: 600, height: 400 } 
      };
    }

    // Build tree depth map relative to Championship Final (root)
    const matchMap = new Map<string, BracketMatch>();
    matches.forEach(m => matchMap.set(m._id, m));

    const depthFromFinalMap = new Map<string, number>();
    const getDepthFromFinal = (m: BracketMatch, visited = new Set<string>()): number => {
      if (!m || visited.has(m._id)) return 0;
      visited.add(m._id);
      if (depthFromFinalMap.has(m._id)) return depthFromFinalMap.get(m._id)!;

      if (!m.nextMatchId || !matchMap.has(m.nextMatchId)) {
        depthFromFinalMap.set(m._id, 0);
        return 0;
      }

      const parent = matchMap.get(m.nextMatchId);
      const parentDepth = getDepthFromFinal(parent!, visited);
      const depth = parentDepth + 1;
      depthFromFinalMap.set(m._id, depth);
      return depth;
    };

    matches.forEach(m => getDepthFromFinal(m));

    let maxDepth = 0;
    depthFromFinalMap.forEach(d => {
      if (d > maxDepth) maxDepth = d;
    });

    const totalRounds = Math.max(1, maxDepth + 1);

    // Group matches by calculated column index (0 = Round 1, totalRounds - 1 = Final)
    const matchesByColIndex: Record<number, BracketMatch[]> = {};
    for (let i = 0; i < totalRounds; i++) {
      matchesByColIndex[i] = [];
    }

    matches.forEach(m => {
      const depth = depthFromFinalMap.get(m._id) ?? 0;
      const colIdx = totalRounds - 1 - depth; // All leaf/first-round matches land in colIdx = 0
      if (!matchesByColIndex[colIdx]) matchesByColIndex[colIdx] = [];
      matchesByColIndex[colIdx].push(m);
    });

    // Generate canonical sorted round names and round map
    const sortedRounds: string[] = [];
    const byRound: Record<string, BracketMatch[]> = {};

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
      byRound[label] = matchesByColIndex[colIdx] || [];
    }

    // Compute 2D grid positions for each match
    const positions: Record<string, { x: number; y: number; match: BracketMatch; col: number; row: number }> = {};

    for (let colIdx = 0; colIdx < totalRounds; colIdx++) {
      const colName = sortedRounds[colIdx];
      const roundMatches = [...(byRound[colName] || [])].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
      const colX = colIdx * (CARD_WIDTH + COL_GAP) + 40;

      if (colIdx === 0) {
        // Base leaf round positions evenly spaced vertically
        roundMatches.forEach((m, rowIndex) => {
          const rowY = rowIndex * (CARD_HEIGHT + ROW_GAP) + 60;
          positions[m._id] = { x: colX, y: rowY, match: m, col: colIdx, row: rowIndex };
        });
      } else {
        // Parent matches are centered vertically between their feeding child matches from previous column
        roundMatches.forEach((m, rowIndex) => {
          const children = matches.filter(c => c.nextMatchId === m._id);
          let targetY = 0;

          if (children.length > 0) {
            const childYs = children.map(c => positions[c._id]?.y).filter(y => y !== undefined);
            if (childYs.length > 0) {
              targetY = childYs.reduce((a, b) => a + b, 0) / childYs.length;
            } else {
              const step = Math.pow(2, colIdx);
              targetY = rowIndex * (CARD_HEIGHT + ROW_GAP) * step + 60 + ((step - 1) * (CARD_HEIGHT / 2));
            }
          } else {
            const step = Math.pow(2, colIdx);
            targetY = rowIndex * (CARD_HEIGHT + ROW_GAP) * step + 60 + ((step - 1) * (CARD_HEIGHT / 2));
          }

          positions[m._id] = { x: colX, y: targetY, match: m, col: colIdx, row: rowIndex };
        });
      }
    }

    // Build connections/links directly linking child matches to parent nextMatchId
    const layoutLinks: Array<{
      id: string;
      source: { x: number; y: number };
      target: { x: number; y: number };
      sourceMatch: BracketMatch;
      targetMatch: BracketMatch;
      isWinnerPath: boolean;
      isLive: boolean;
    }> = [];

    matches.forEach(m => {
      let targetNode = m.nextMatchId ? positions[m.nextMatchId] : null;

      // Fallback link inference if nextMatchId was missing
      if (!targetNode && positions[m._id]) {
        const currentPos = positions[m._id];
        const nextColIndex = currentPos.col + 1;
        if (nextColIndex < sortedRounds.length) {
          const nextRoundName = sortedRounds[nextColIndex];
          const nextRoundMatches = [...(byRound[nextRoundName] || [])].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
          const parentRowIndex = Math.floor(currentPos.row / 2);
          const parentMatch = nextRoundMatches[parentRowIndex];
          if (parentMatch && positions[parentMatch._id]) {
            targetNode = positions[parentMatch._id];
          }
        }
      }

      if (targetNode && positions[m._id]) {
        const sourcePos = positions[m._id];
        const targetPos = targetNode;

        const sx = sourcePos.x + CARD_WIDTH;
        const sy = sourcePos.y + (CARD_HEIGHT / 2);
        const tx = targetPos.x;
        const ty = targetPos.y + (CARD_HEIGHT / 2);

        const isWinnerPath = Boolean(
          !initialDrawOnly &&
          m.status === 'completed' && 
          m.winnerId && 
          (targetPos.match.player1Id === m.winnerId || targetPos.match.player2Id === m.winnerId)
        );

        const isLive = !initialDrawOnly && (m.status === 'live' || targetPos.match.status === 'live');

        layoutLinks.push({
          id: `${m._id}->${targetPos.match._id}`,
          source: { x: sx, y: sy },
          target: { x: tx, y: ty },
          sourceMatch: m,
          targetMatch: targetPos.match,
          isWinnerPath,
          isLive
        });
      }
    });

    const layoutNodes = Object.values(positions);

    // Compute bounding box including Champion Showcase Box
    const hasFinals = layoutNodes.length > 0;
    const champExtra = hasFinals ? (CARD_WIDTH + COL_GAP + 60) : 0;
    const maxX = Math.max(...layoutNodes.map(n => n.x + CARD_WIDTH + champExtra), 880) + 60;
    const maxY = Math.max(...layoutNodes.map(n => n.y + CARD_HEIGHT), 500) + 80;

    return {
      sortedRounds,
      matchesByRound: byRound,
      layoutNodes,
      layoutLinks,
      bounds: { width: maxX, height: maxY }
    };
  }, [matches]);

  // Setup D3 Zoom & Pan with ResizeObserver for responsiveness
  useEffect(() => {
    if (!svgRef.current || !gRef.current || bounds.width <= 0) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3.0])
      .filter((event) => {
        // Prevent scroll hijacking: Only zoom on wheel if Ctrl/Cmd is pressed, or if in fullscreen mode
        if (event.type === 'wheel') {
          return isFullscreen || event.ctrlKey || event.metaKey;
        }
        // Allow primary pointer/mouse button (0) or touch gestures
        return !event.button || event.type.startsWith('touch');
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        setZoomPercent(Math.round(event.transform.k * 100));
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    const fitToContainer = () => {
      if (containerRef.current && svgRef.current) {
        const containerWidth = containerRef.current.clientWidth || 900;
        const containerHeight = isFullscreen ? window.innerHeight - 120 : (containerWidth < 640 ? 460 : 540);

        // On small screens, scale comfortably and focus on Round 1
        if (containerWidth < 640) {
          const mobileScale = 0.75;
          const initialTransform = d3.zoomIdentity
            .translate(16, 20)
            .scale(mobileScale);
          svg.transition().duration(400).call(zoom.transform, initialTransform);
          setZoomPercent(Math.round(mobileScale * 100));
        } else {
          const scaleX = (containerWidth - 60) / bounds.width;
          const scaleY = (containerHeight - 60) / bounds.height;
          const initialScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 1.0);

          const initialTransform = d3.zoomIdentity
            .translate(20, 20)
            .scale(initialScale);

          svg.transition().duration(400).call(zoom.transform, initialTransform);
          setZoomPercent(Math.round(initialScale * 100));
        }
      }
    };

    // Only run initial zoom positioning once on mount or fullscreen toggle (do not reset camera on live updates)
    if (!isZoomInitializedRef.current) {
      fitToContainer();
      isZoomInitializedRef.current = true;
    }

    // Responsive ResizeObserver
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (containerRef.current && svgRef.current && !isZoomInitializedRef.current) {
            fitToContainer();
          }
        });
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      svg.on('.zoom', null);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [bounds, isFullscreen]);

  // Zoom control helpers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.25);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.8);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth || 900;
      const containerHeight = isFullscreen ? window.innerHeight - 120 : (containerWidth < 640 ? 460 : 540);
      const scaleX = (containerWidth - 60) / bounds.width;
      const scaleY = (containerHeight - 60) / bounds.height;
      const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.55), 1.0);

      const transform = d3.zoomIdentity.translate(20, 20).scale(fitScale);
      d3.select(svgRef.current).transition().duration(350).call(zoomBehaviorRef.current.transform, transform);
    }
  };

  const handleZoomTo100 = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleTo, 1.0);
    }
  };

  const handleScrollToRound = (roundIdx: number) => {
    setActiveRoundIdx(roundIdx);
    if (!svgRef.current || !zoomBehaviorRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth || 600;
    const containerHeight = isFullscreen ? window.innerHeight - 120 : (containerWidth < 640 ? 460 : 540);
    const roundName = sortedRounds[roundIdx];
    const roundMatches = matchesByRound[roundName] || [];

    const colX = roundIdx * (CARD_WIDTH + COL_GAP) + 40;
    const targetScale = containerWidth < 640 ? 0.78 : (containerWidth < 1024 ? 0.88 : 0.95);
    const targetX = Math.max(16, (containerWidth - CARD_WIDTH * targetScale) / 2 - (colX * targetScale));

    let targetY = 20;
    if (roundMatches.length > 0) {
      const matchPositions = roundMatches.map(m => layoutNodes.find(n => n.match._id === m._id)?.y).filter(y => y !== undefined) as number[];
      if (matchPositions.length > 0) {
        const avgY = matchPositions.reduce((a, b) => a + b, 0) / matchPositions.length;
        targetY = Math.max(20, (containerHeight / 2) - (avgY * targetScale) - (CARD_HEIGHT * targetScale / 2));
      }
    }

    const transform = d3.zoomIdentity.translate(targetX, targetY).scale(targetScale);
    d3.select(svgRef.current).transition().duration(400).ease(d3.easeCubicOut).call(zoomBehaviorRef.current.transform, transform);
  };

  const handlePrevRound = () => {
    if (activeRoundIdx > 0) {
      handleScrollToRound(activeRoundIdx - 1);
    }
  };

  const handleNextRound = () => {
    if (activeRoundIdx < sortedRounds.length - 1) {
      handleScrollToRound(activeRoundIdx + 1);
    }
  };

  const handleCenterFinals = () => {
    if (sortedRounds.length > 0) {
      handleScrollToRound(sortedRounds.length - 1);
    }
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
        <Swords className="w-10 h-10 mx-auto mb-3 text-slate-300 animate-pulse" />
        <p className="text-sm font-bold text-slate-700">No Bracket Tree Generated Yet</p>
        <p className="text-xs text-slate-400 mt-1">Generate bracket draw to visualize knockout progression tree.</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'w-full'
      } ${className}`}
    >
      {/* Top Header & Interactive Canvas Controls */}
      <div className="bg-slate-900/90 backdrop-blur-md px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 flex items-center justify-center shadow-md shadow-rose-600/20">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider font-mono text-white">
                {title || 'World Taekwondo Knockout Tree'}
              </h4>
              <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                D3 Dynamic Engine
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Interactive elimination bracket • Drag to pan • Scroll to zoom
            </p>
          </div>
        </div>

        {/* Legend Indicators */}
        <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono text-slate-300 bg-slate-950/60 px-3.5 py-1.5 rounded-xl border border-slate-800">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-red-500/20" />
            Chung (Red)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-500/20" />
            Hong (Blue)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            Winner Advance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Live In Ring
          </span>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 select-none min-w-[38px] text-center" title="Current Zoom Scale">
            {zoomPercent}%
          </span>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Fit to Screen"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCenterFinals}
            className="px-2 py-1 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white text-[10px] font-mono font-bold transition-all cursor-pointer"
            title="Focus Championship Final"
          >
            Finals 🏆
          </button>
          <button
            onClick={async () => {
              if (isExportingPdf) return;
              setIsExportingPdf(true);
              const safeTitle = (title || 'Tournament_Bracket').replace(/[^a-zA-Z0-9_-]/g, '_');
              await exportBracketPdf(svgRef.current, `${safeTitle}.pdf`, {
                title: title || 'Official Tournament Knockout Tree',
                bounds: bounds
              });
              setIsExportingPdf(false);
            }}
            disabled={isExportingPdf}
            className="px-2.5 py-1 hover:bg-slate-800 rounded-lg text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-mono font-bold border border-emerald-500/30 bg-emerald-950/40 disabled:opacity-50"
            title="Download Bracket PDF"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
          </button>
          <button
            onClick={() => exportBracketSvg(svgRef.current, `${(title || 'Tournament_Bracket').replace(/[^a-zA-Z0-9_-]/g, '_')}.svg`)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Download Bracket SVG"
          >
            <Download className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer ml-1"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Accessible Round Navigation Bar for Quick Scrolling / Stepping */}
      {sortedRounds.length > 0 && (
        <div className="bg-slate-900/95 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none z-10 relative">
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-500">Jump to Round:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {sortedRounds.map((roundName, idx) => {
              const count = (matchesByRound[roundName] || []).length;
              const isSelected = activeRoundIdx === idx;
              const isFinal = idx === sortedRounds.length - 1;
              return (
                <button
                  key={roundName}
                  onClick={() => handleScrollToRound(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30 ring-1 ring-rose-400'
                      : isFinal
                      ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                  }`}
                  title={`Scroll and focus on ${roundName}`}
                >
                  <span>{roundName}</span>
                  {count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-950/60 text-slate-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Stepper Chevrons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handlePrevRound}
              disabled={activeRoundIdx <= 0}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
              title="Previous Round"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextRound}
              disabled={activeRoundIdx >= sortedRounds.length - 1}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
              title="Next Round"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive D3 SVG Canvas */}
      <div 
        className="w-full relative overflow-hidden bg-radial from-slate-900 to-slate-950 cursor-grab active:cursor-grabbing select-none"
        style={{ 
          height: isFullscreen ? 'calc(100vh - 105px)' : '540px',
          touchAction: 'pan-y'
        }}
        onWheel={(e) => {
          if (!isFullscreen && !e.ctrlKey && !e.metaKey) {
            setShowScrollHint(true);
            if (scrollHintTimeoutRef.current) clearTimeout(scrollHintTimeoutRef.current);
            scrollHintTimeoutRef.current = setTimeout(() => {
              setShowScrollHint(false);
            }, 1800);
          }
        }}
      >
        {/* Subtle Scroll/Zoom Hint Overlay when mouse wheel is used without Ctrl */}
        {showScrollHint && (
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center pointer-events-none z-30 animate-fade-in">
            <div className="bg-slate-900/95 border border-slate-700 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>Use <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-amber-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-amber-300">Scroll</kbd> or Toolbar Buttons (+ / -) to zoom bracket</span>
            </div>
          </div>
        )}

        {/* Floating Quick-Pan Steppers for Mobile Screen Accessibility */}
        <button
          onClick={handlePrevRound}
          disabled={activeRoundIdx <= 0}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-0 pointer-events-auto backdrop-blur-sm sm:hidden"
          title="Scroll Left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handleNextRound}
          disabled={activeRoundIdx >= sortedRounds.length - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-0 pointer-events-auto backdrop-blur-sm sm:hidden"
          title="Scroll Right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Mobile Gesture Helper Badge */}
        <div className="absolute bottom-3 left-3 z-20 pointer-events-none hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800/80">
          <Move className="w-3 h-3 text-slate-400" />
          <span>Drag or trackpad to pan • Scroll or pinch to zoom • Tap match for info</span>
        </div>
        <svg
          ref={svgRef}
          id="d3-bracket-canvas-svg"
          data-bracket-canvas="true"
          className="w-full h-full block bracket-svg-canvas"
          style={{ minHeight: '100%' }}
        >
          <defs>
            {/* Live bout gradient marker */}
            <linearGradient id="liveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="winnerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
            </linearGradient>

            {/* Drop shadow for tournament nodes */}
            <filter id="bracketShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.45" />
            </filter>
            <filter id="glowGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* D3 Zoom Transform Container */}
          <g ref={gRef} data-bracket-root="true">
            {/* Round Column Column Headers */}
            {sortedRounds.map((roundName, colIdx) => {
              const colX = colIdx * (CARD_WIDTH + COL_GAP) + 40;
              const isFinal = colIdx === sortedRounds.length - 1;
              const matchesInCol = matchesByRound[roundName] || [];
              const numMatches = matchesInCol.length;
              const numPlayers = numMatches * 2;

              let displayTitle = roundName.toUpperCase();
              if (displayTitle === 'FINALS') displayTitle = 'FINAL';
              if (colIdx === 0 && sortedRounds.length === 4) displayTitle = 'ROUND OF 16';

              const subtitle = `${numPlayers} Players • ${numMatches} ${numMatches === 1 ? 'Match' : 'Matches'}`;

              return (
                <g key={roundName} transform={`translate(${colX}, 15)`}>
                  {/* Top accent line */}
                  <line
                    x1="0"
                    y1="0"
                    x2={CARD_WIDTH}
                    y2="0"
                    stroke={isFinal ? '#f59e0b' : '#38bdf8'}
                    strokeWidth="2"
                  />
                  <rect
                    x="0"
                    y="6"
                    width={CARD_WIDTH}
                    height="32"
                    rx="8"
                    fill={isFinal ? '#451a03' : '#0f172a'}
                    fillOpacity="0.8"
                    stroke={isFinal ? '#b45309' : '#1e293b'}
                    strokeWidth="1"
                  />
                  <text
                    x={CARD_WIDTH / 2}
                    y="21"
                    textAnchor="middle"
                    fill={isFinal ? '#fbbf24' : '#ffffff'}
                    fontSize="11"
                    fontWeight="900"
                    fontFamily="monospace"
                    letterSpacing="0.08em"
                  >
                    {displayTitle}
                  </text>
                  <text
                    x={CARD_WIDTH / 2}
                    y="32"
                    textAnchor="middle"
                    fill={isFinal ? '#fef08a' : '#94a3b8'}
                    fontSize="8.5"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {subtitle}
                  </text>
                </g>
              );
            })}

            {/* Stepped Orthogonal 90-degree Bracket Progression Paths */}
            {layoutLinks.map((link) => {
              const isHovered = hoveredMatchId === link.sourceMatch._id || hoveredMatchId === link.targetMatch._id;
              const strokeColor = link.isWinnerPath 
                ? '#38bdf8' 
                : link.isLive 
                  ? '#ef4444' 
                  : isHovered 
                    ? '#0284c7' 
                    : '#334155';

              const strokeWidth = link.isWinnerPath || link.isLive || isHovered ? 2.5 : 1.5;

              // Crisp Orthogonal 90-degree Elbow Path (M x1 y1 H xMid V y2 H x2)
              const x1 = link.source.x;
              const y1 = link.source.y;
              const x2 = link.target.x;
              const y2 = link.target.y;
              const xMid = (x1 + x2) / 2;

              const pathData = `M ${x1} ${y1} H ${xMid} V ${y2} H ${x2}`;

              return (
                <g key={link.id} className="transition-all duration-200">
                  {/* Outer glow for active or winning paths */}
                  {(link.isWinnerPath || link.isLive || isHovered) && (
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth + 3}
                      strokeOpacity="0.25"
                      className={link.isLive ? 'animate-pulse' : ''}
                    />
                  )}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={link.sourceMatch.status === 'completed' && !link.isWinnerPath ? '4 3' : 'none'}
                    strokeOpacity={link.sourceMatch.status === 'completed' && !link.isWinnerPath ? 0.35 : 1}
                  />
                </g>
              );
            })}

            {/* Bout Nodes rendered as interactive high-fidelity SVG Cards */}
            {layoutNodes.map((node) => {
              const m = node.match;
              const isEffectiveLive = !initialDrawOnly && m.status === 'live';
              const isEffectiveCompleted = initialDrawOnly ? (node.col === 0 && m.status === 'completed') : (m.status === 'completed');
              const isSelected = selectedMatchId === m._id || selectedMatch?._id === m._id;
              const isHovered = hoveredMatchId === m._id;

              const slotInfo = getMatchSlotDisplay(m, matches, node.col, initialDrawOnly, showScores);
              const p1IsWinner = !initialDrawOnly && slotInfo.isP1Winner;
              const p2IsWinner = !initialDrawOnly && slotInfo.isP2Winner;
              const isBye = m.player2Id === 'bye_placeholder' || m.player2Name?.includes('BYE');

              return (
                <g
                  key={m._id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMatchId(m._id)}
                  onMouseLeave={() => setHoveredMatchId(null)}
                  onClick={() => {
                    setSelectedMatch(m);
                    if (onMatchClick) onMatchClick(m);
                  }}
                >
                  {/* Card Base Outline */}
                  <rect
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    rx="14"
                    fill={isSelected ? '#1e293b' : isEffectiveLive ? '#18181b' : slotInfo.isBothEmpty ? '#080d1a' : '#0f172a'}
                    stroke={
                      isSelected
                        ? '#38bdf8'
                        : isEffectiveLive
                          ? '#ef4444'
                          : isHovered
                            ? '#64748b'
                            : slotInfo.isBothEmpty
                              ? '#1e293b'
                              : '#1e293b'
                    }
                    strokeWidth={isSelected || isEffectiveLive ? 2.5 : 1.5}
                    strokeDasharray={slotInfo.isBothEmpty && !isEffectiveLive && !isEffectiveCompleted ? '4 3' : 'none'}
                    filter="url(#bracketShadow)"
                    className="transition-colors duration-150"
                  />

                  {/* Header Sub-bar */}
                  <rect
                    x="1"
                    y="1"
                    width={CARD_WIDTH - 2}
                    height="20"
                    rx="12"
                    fill="#020617"
                    fillOpacity="0.8"
                  />

                  {/* Bout Reference Tag */}
                  <text
                    x="10"
                    y="14"
                    fill="#64748b"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="800"
                    letterSpacing="0.05em"
                  >
                    #{m._id.slice(-6).toUpperCase()} • {m.round?.toUpperCase() ?? 'MATCH'}
                  </text>

                  {/* Status Indicator Pill */}
                  {isEffectiveLive && (
                    <g transform={`translate(${CARD_WIDTH - 54}, 4)`}>
                      <rect width="44" height="13" rx="4" fill="#ef4444" />
                      <circle cx="8" cy="6.5" r="2.5" fill="#ffffff" className="animate-ping" />
                      <circle cx="8" cy="6.5" r="2.5" fill="#ffffff" />
                      <text x="16" y="9.5" fill="#ffffff" fontSize="7.5" fontWeight="900" fontFamily="sans-serif">
                        LIVE
                      </text>
                    </g>
                  )}
                  {isEffectiveCompleted && (
                    <g transform={`translate(${CARD_WIDTH - 58}, 4)`}>
                      <rect width="48" height="13" rx="4" fill="#065f46" fillOpacity="0.8" />
                      <text x="24" y="9.5" textAnchor="middle" fill="#34d399" fontSize="7.5" fontWeight="800" fontFamily="monospace">
                        FINAL
                      </text>
                    </g>
                  )}
                  {!isEffectiveLive && !isEffectiveCompleted && (
                    <g transform={`translate(${CARD_WIDTH - 52}, 4)`}>
                      <text x="24" y="9.5" textAnchor="middle" fill="#475569" fontSize="7" fontWeight="700" fontFamily="monospace">
                        {slotInfo.isBothEmpty ? 'WAITING' : 'PENDING'}
                      </text>
                    </g>
                  )}

                  {/* Red Corner (Chung) Row */}
                  <g transform="translate(6, 26)">
                    <rect
                      width={CARD_WIDTH - 12}
                      height="26"
                      rx="7"
                      fill={p1IsWinner ? '#450a0a' : slotInfo.isP1Ready ? '#1e1b4b' : '#020617'}
                      fillOpacity={p1IsWinner ? 0.9 : slotInfo.isP1Ready ? 0.4 : 0.6}
                      stroke={p1IsWinner ? '#dc2626' : slotInfo.isP1Ready ? '#312e81' : '#1e293b'}
                      strokeWidth={p1IsWinner ? 1.5 : 1}
                      strokeDasharray={!slotInfo.isP1Ready ? '3 2' : 'none'}
                    />
                    {/* Red corner strip or muted strip if TBD */}
                    <rect 
                      x="0" 
                      y="0" 
                      width="4" 
                      height="26" 
                      rx="2" 
                      fill={slotInfo.isP1Ready ? '#ef4444' : '#334155'} 
                    />
                    
                    {/* Athlete Name or TBD placeholder */}
                    <text
                      x="12"
                      y="17"
                      fill={p1IsWinner ? '#fecaca' : slotInfo.isP1Ready ? '#e2e8f0' : '#64748b'}
                      fontSize="10"
                      fontWeight={p1IsWinner ? '800' : slotInfo.isP1Ready ? '600' : '500'}
                      fontFamily={slotInfo.isP1Ready ? 'sans-serif' : 'monospace'}
                      fontStyle={slotInfo.isP1Ready ? 'normal' : 'italic'}
                    >
                      {slotInfo.isP1Ready 
                        ? (slotInfo.p1DisplayName.length > 20 ? slotInfo.p1DisplayName.slice(0, 18) + '…' : slotInfo.p1DisplayName)
                        : 'TBD'}
                    </text>

                    {/* Winner Trophy Icon */}
                    {!initialDrawOnly && p1IsWinner && (
                      <text x={CARD_WIDTH - 24} y="17" fontSize="10">🏆</text>
                    )}

                    {/* Score Badge (only rendered if showScores is true and match is active/completed and ready) */}
                    {showScores && slotInfo.showScore && slotInfo.isP1Ready && (
                      <>
                        <rect
                          x={CARD_WIDTH - 36}
                          y="4"
                          width="20"
                          height="18"
                          rx="5"
                          fill={p1IsWinner ? '#dc2626' : '#0f172a'}
                        />
                        <text
                          x={CARD_WIDTH - 26}
                          y="16.5"
                          textAnchor="middle"
                          fill={p1IsWinner ? '#ffffff' : '#94a3b8'}
                          fontSize="9.5"
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {slotInfo.p1Score ?? 0}
                        </text>
                      </>
                    )}
                  </g>

                  {/* Centered subtle vs divider */}
                  <text
                    x={CARD_WIDTH / 2}
                    y="55"
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="7.5"
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    vs
                  </text>

                  {/* Blue Corner (Hong) Row */}
                  <g transform="translate(6, 56)">
                    <rect
                      width={CARD_WIDTH - 12}
                      height="26"
                      rx="7"
                      fill={p2IsWinner ? '#172554' : slotInfo.isP2Ready ? '#1e1b4b' : '#020617'}
                      fillOpacity={p2IsWinner ? 0.9 : slotInfo.isP2Ready ? 0.4 : 0.6}
                      stroke={p2IsWinner ? '#2563eb' : slotInfo.isP2Ready ? '#1e3a8a' : '#1e293b'}
                      strokeWidth={p2IsWinner ? 1.5 : 1}
                      strokeDasharray={!slotInfo.isP2Ready ? '3 2' : 'none'}
                    />
                    {/* Blue corner strip or muted strip if TBD */}
                    <rect 
                      x="0" 
                      y="0" 
                      width="4" 
                      height="26" 
                      rx="2" 
                      fill={slotInfo.isP2Ready ? '#3b82f6' : '#334155'} 
                    />
                    
                    {/* Athlete Name or TBD placeholder */}
                    <text
                      x="12"
                      y="17"
                      fill={p2IsWinner ? '#bfdbfe' : slotInfo.isP2Ready ? (isBye ? '#94a3b8' : '#e2e8f0') : '#64748b'}
                      fontSize="10"
                      fontWeight={p2IsWinner ? '800' : slotInfo.isP2Ready ? '600' : '500'}
                      fontFamily={slotInfo.isP2Ready ? 'sans-serif' : 'monospace'}
                      fontStyle={slotInfo.isP2Ready ? 'normal' : 'italic'}
                    >
                      {slotInfo.isP2Ready 
                        ? (slotInfo.p2DisplayName.length > 20 ? slotInfo.p2DisplayName.slice(0, 18) + '…' : slotInfo.p2DisplayName)
                        : 'TBD'}
                    </text>

                    {/* Winner Trophy Icon */}
                    {!initialDrawOnly && p2IsWinner && (
                      <text x={CARD_WIDTH - 24} y="17" fontSize="10">🏆</text>
                    )}

                    {/* Score Badge (only rendered if showScores is true and match is active/completed and ready) */}
                    {showScores && slotInfo.showScore && slotInfo.isP2Ready && (
                      <>
                        <rect
                          x={CARD_WIDTH - 36}
                          y="4"
                          width="20"
                          height="18"
                          rx="5"
                          fill={p2IsWinner ? '#2563eb' : '#0f172a'}
                        />
                        <text
                          x={CARD_WIDTH - 26}
                          y="16.5"
                          textAnchor="middle"
                          fill={p2IsWinner ? '#ffffff' : '#94a3b8'}
                          fontSize="9.5"
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {slotInfo.p2Score ?? 0}
                        </text>
                      </>
                    )}
                  </g>
                </g>
              );
            })}

            {/* Champion Showcase Box on the Far Right */}
            {(() => {
              if (sortedRounds.length === 0) return null;
              const finalsRoundName = sortedRounds[sortedRounds.length - 1];
              const finalsMatch = (matchesByRound[finalsRoundName] || [])[0];
              if (!finalsMatch) return null;

              const finalsPos = layoutNodes.find(n => n.match._id === finalsMatch._id);
              if (!finalsPos) return null;

              const isCompleted = !initialDrawOnly && finalsMatch.status === 'completed' && Boolean(finalsMatch.winnerId);
              const winnerName = isCompleted
                ? (finalsMatch.winnerId === finalsMatch.player1Id ? finalsMatch.player1Name : finalsMatch.player2Name)
                : 'TBD Champion';

              const champX = finalsPos.x + CARD_WIDTH + COL_GAP;
              const champY = finalsPos.y;

              return (
                <g transform={`translate(${champX}, ${champY})`}>
                  {/* Connector Line to Champion Box */}
                  <path
                    d={`M ${finalsPos.x + CARD_WIDTH - champX} ${CARD_HEIGHT / 2} H 0`}
                    fill="none"
                    stroke={isCompleted ? "#f59e0b" : "#334155"}
                    strokeWidth={isCompleted ? 3 : 1.5}
                    strokeDasharray={isCompleted ? "none" : "4 3"}
                  />

                  {/* Champion Box */}
                  <rect
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    rx="16"
                    fill={isCompleted ? "#18181b" : "#080d1a"}
                    stroke={isCompleted ? "#f59e0b" : "#1e293b"}
                    strokeWidth={isCompleted ? 2.5 : 1.5}
                    strokeDasharray={isCompleted ? "none" : "4 3"}
                    filter="url(#bracketShadow)"
                  />

                  <rect
                    x="1"
                    y="1"
                    width={CARD_WIDTH - 2}
                    height="22"
                    rx="14"
                    fill={isCompleted ? "#451a03" : "#020617"}
                  />

                  <text
                    x={CARD_WIDTH / 2}
                    y="15"
                    textAnchor="middle"
                    fill={isCompleted ? "#fbbf24" : "#64748b"}
                    fontSize="9.5"
                    fontWeight="900"
                    fontFamily="monospace"
                    letterSpacing="0.08em"
                  >
                    {isCompleted ? "👑 CHAMPION" : "🏆 TOURNAMENT CHAMPION"}
                  </text>

                  <g transform="translate(10, 32)">
                    <circle cx="18" cy="22" r="16" fill={isCompleted ? "#fbbf24" : "#1e293b"} fillOpacity={isCompleted ? 0.2 : 0.4} stroke={isCompleted ? "#f59e0b" : "#334155"} strokeWidth="1.5" />
                    <text x="18" y="27" textAnchor="middle" fontSize="16">🏆</text>

                    <text x="44" y="20" fill={isCompleted ? "#ffffff" : "#64748b"} fontSize="12" fontWeight="800" fontFamily={isCompleted ? "sans-serif" : "monospace"} fontStyle={isCompleted ? "normal" : "italic"}>
                      {winnerName.length > 18 ? winnerName.slice(0, 16) + '…' : winnerName}
                    </text>
                    <text x="44" y="33" fill={isCompleted ? '#fbbf24' : '#475569'} fontSize="9" fontWeight="700" fontFamily="monospace">
                      {isCompleted ? 'GOLD MEDALIST' : 'AWAITING FINAL RESULT'}
                    </text>
                  </g>
                </g>
              );
            })()}
          </g>
        </svg>

        {/* Selected Match Inspector Flyout */}
        {selectedMatch && (() => {
          const selectedNode = layoutNodes.find(n => n.match._id === selectedMatch._id);
          const selSlotInfo = getMatchSlotDisplay(selectedMatch, matches, selectedNode?.col ?? 0, initialDrawOnly, showScores);
          return (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 border border-slate-700 shadow-2xl text-white text-xs z-30 animate-fade-in">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="font-mono font-bold text-amber-400 text-[10px] uppercase">
                  {selectedMatch.round} • #{selectedMatch._id.slice(-6).toUpperCase()}
                </span>
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 rounded-lg bg-red-950/40 border border-red-900/40">
                  <span className={`font-bold truncate max-w-[180px] ${selSlotInfo.isP1Ready ? 'text-red-300' : 'text-slate-400 italic font-mono'}`}>
                    🔴 {selSlotInfo.p1DisplayName}
                  </span>
                  {showScores && selSlotInfo.showScore ? (
                    <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-red-600 text-white flex items-center gap-1" title="Rounds Won">
                      <span className="text-[9px] font-normal opacity-75">Rounds:</span>
                      {selSlotInfo.p1Score ?? 0}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-red-400 font-bold px-1.5 py-0.5 rounded bg-red-900/40">
                      CHUNG
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-blue-950/40 border border-blue-900/40">
                  <span className={`font-bold truncate max-w-[180px] ${selSlotInfo.isP2Ready ? 'text-blue-300' : 'text-slate-400 italic font-mono'}`}>
                    🔵 {selSlotInfo.p2DisplayName}
                  </span>
                  {showScores && selSlotInfo.showScore ? (
                    <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-blue-600 text-white flex items-center gap-1" title="Rounds Won">
                      <span className="text-[9px] font-normal opacity-75">Rounds:</span>
                      {selSlotInfo.p2Score ?? 0}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-blue-400 font-bold px-1.5 py-0.5 rounded bg-blue-900/40">
                      HONG
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
