export interface BracketMatchLike {
  _id: string;
  round?: string;
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

export interface SlotDisplayInfo {
  isP1Ready: boolean;
  p1DisplayName: string;
  isP2Ready: boolean;
  p2DisplayName: string;
  isP1Winner: boolean;
  isP2Winner: boolean;
  showScore: boolean;
  p1Score: number | null;
  p2Score: number | null;
  p1RoundsWon: number;
  p2RoundsWon: number;
  isBothEmpty: boolean;
}

/**
 * Calculates the number of rounds won by player 1 and player 2 in Taekwondo Best-of-3 format.
 * Prevents displaying raw point totals and guarantees accurate rounds-won tracking.
 */
export function calculateRoundsWon(match: BracketMatchLike | null | undefined): { player1: number; player2: number } {
  if (!match) return { player1: 0, player2: 0 };

  // 1. Explicit roundsWon field
  if ((match as any).roundsWon) {
    return {
      player1: Number((match as any).roundsWon.player1) || 0,
      player2: Number((match as any).roundsWon.player2) || 0
    };
  }

  // 2. Round-by-round score tallies
  if (Array.isArray((match as any).roundScores) && (match as any).roundScores.length > 0) {
    let p1Wins = 0;
    let p2Wins = 0;
    (match as any).roundScores.forEach((r: any) => {
      const p1 = Number(r.p1 ?? r.player1 ?? 0);
      const p2 = Number(r.p2 ?? r.player2 ?? 0);
      if (p1 > p2) p1Wins++;
      else if (p2 > p1) p2Wins++;
    });
    return { player1: p1Wins, player2: p2Wins };
  }

  const rawP1 = match.score?.player1 ?? 0;
  const rawP2 = match.score?.player2 ?? 0;

  // 3. If values already represent rounds won (0, 1, 2, 3)
  if (rawP1 <= 3 && rawP2 <= 3 && (rawP1 > 0 || rawP2 > 0)) {
    return { player1: rawP1, player2: rawP2 };
  }

  // 4. If match is completed with winnerId
  if (match.status === 'completed' && match.winnerId) {
    if (match.winnerId === match.player1Id) {
      const loserRounds = rawP2 > rawP1 / 2 ? 1 : 0;
      return { player1: 2, player2: loserRounds };
    } else if (match.winnerId === match.player2Id) {
      const loserRounds = rawP1 > rawP2 / 2 ? 1 : 0;
      return { player1: loserRounds, player2: 2 };
    }
  }

  // 5. If live match with active round points
  if (match.status === 'live') {
    if (rawP1 > rawP2) return { player1: 1, player2: 0 };
    if (rawP2 > rawP1) return { player1: 0, player2: 1 };
  }

  return { player1: 0, player2: 0 };
}

/**
 * Computes tree depth from Final (root) and column index for each match in a knockout bracket.
 * colIdx = 0 corresponds to Round 1 (the initial stage of the tournament).
 * colIdx = totalRounds - 1 corresponds to the Championship Final.
 */
export function calculateBracketDepths<T extends BracketMatchLike>(matches: T[]): {
  depthFromFinalMap: Map<string, number>;
  colIdxMap: Map<string, number>;
  totalRounds: number;
} {
  const matchMap = new Map<string, T>();
  matches.forEach(m => matchMap.set(m._id, m));

  const depthFromFinalMap = new Map<string, number>();
  const getDepthFromFinal = (m: T, visited = new Set<string>()): number => {
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
  const colIdxMap = new Map<string, number>();

  matches.forEach(m => {
    const depth = depthFromFinalMap.get(m._id) ?? 0;
    const colIdx = totalRounds - 1 - depth;
    colIdxMap.set(m._id, colIdx);
  });

  return { depthFromFinalMap, colIdxMap, totalRounds };
}

/**
 * Strips competitor names, scores, and winner fields for all rounds beyond Round 1 (colIdx > 0).
 * Preserves the exact bracket structure, match IDs, tree hierarchy, and connector links
 * while ensuring that subsequent rounds (Quarterfinals, Semifinals, Finals) permanently render
 * as clean empty "TBD vs TBD" placeholder slots for the official Initial Draw sheet.
 * Scores are also stripped so they are never displayed in the Draw / Bracket view.
 */
export function sanitizeMatchesForInitialDraw<T extends BracketMatchLike>(matches: T[]): T[] {
  if (!matches || matches.length === 0) return [];

  const { colIdxMap } = calculateBracketDepths(matches);

  return matches.map(m => {
    const colIdx = colIdxMap.get(m._id) ?? 0;
    if (colIdx === 0) {
      // Round 1: First stage preserves competitor names, but scores are stripped for Draw / Bracket view
      return { 
        ...m,
        score: { player1: 0, player2: 0 }
      };
    }

    // Every round after Round 1: Permanently blanked out to empty placeholder state
    return {
      ...m,
      player1Id: 'pending_winner',
      player2Id: 'pending_winner',
      player1Name: 'TBD',
      player2Name: 'TBD',
      winnerId: null,
      score: { player1: 0, player2: 0 },
      status: 'upcoming' as const
    };
  });
}

/**
 * Determines whether each player slot in a match should show real competitor data
 * or an empty placeholder ("TBD" / blank slot).
 *
 * Rules:
 * - When initialDrawOnly is true: ONLY Round 1 (colIdx === 0) shows competitor data.
 *   All rounds after Round 1 are permanently empty TBD placeholders.
 * - When showScores is false or initialDrawOnly is true: Player scores are NEVER displayed.
 * - In live/admin mode (initialDrawOnly === false):
 *   Round 1 shows real data. Subsequent rounds render TBD until the feeding child
 *   match in the prior round is completed and has a verified winner.
 */
export function getMatchSlotDisplay<T extends BracketMatchLike>(
  match: T,
  allMatches: T[],
  colIdx: number,
  initialDrawOnly: boolean = false,
  showScores: boolean = !initialDrawOnly
): SlotDisplayInfo {
  // If initialDrawOnly mode is active, strictly enforce blank placeholders for rounds > 1
  if (initialDrawOnly && colIdx > 0) {
    return {
      isP1Ready: false,
      p1DisplayName: 'TBD',
      isP2Ready: false,
      p2DisplayName: 'TBD',
      isP1Winner: false,
      isP2Winner: false,
      showScore: false,
      p1Score: null,
      p2Score: null,
      p1RoundsWon: 0,
      p2RoundsWon: 0,
      isBothEmpty: true
    };
  }

  // Find child matches in the previous round that feed into this match
  const children = allMatches.filter(c => c.nextMatchId === match._id);

  let child1: T | undefined = children.find(c => c.nextMatchPlayerSlot === 'player1');
  let child2: T | undefined = children.find(c => c.nextMatchPlayerSlot === 'player2');

  // If nextMatchPlayerSlot was not explicitly stored on children, sort by matchIndex
  if (!child1 && !child2 && children.length > 0) {
    const sortedChildren = [...children].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
    child1 = sortedChildren[0];
    child2 = sortedChildren[1];
  }

  let isP1Ready = false;
  let p1DisplayName = 'TBD';

  let isP2Ready = false;
  let p2DisplayName = 'TBD';

  if (colIdx === 0) {
    // Round 1: first stage always displays real competitor names
    isP1Ready = true;
    p1DisplayName = match.player1Name || 'TBD';

    isP2Ready = true;
    p2DisplayName = match.player2Name || 'TBD';
  } else {
    // Subsequent rounds (Round 2, Quarterfinals, Semifinals, Final)
    // Slot 1 (Red Corner / Chung)
    if (child1) {
      if (child1.status === 'completed' && child1.winnerId) {
        isP1Ready = true;
        p1DisplayName = child1.winnerId === child1.player1Id ? child1.player1Name : child1.player2Name;
      } else {
        isP1Ready = false;
        p1DisplayName = 'TBD';
      }
    } else if (match.status === 'live' || match.status === 'completed') {
      isP1Ready = true;
      p1DisplayName = match.player1Name || 'TBD';
    } else if (
      match.player1Name &&
      !match.player1Name.startsWith('Winner of') &&
      match.player1Name !== 'TBD' &&
      match.player1Name !== 'pending_winner'
    ) {
      isP1Ready = true;
      p1DisplayName = match.player1Name;
    } else {
      isP1Ready = false;
      p1DisplayName = 'TBD';
    }

    // Slot 2 (Blue Corner / Hong)
    if (child2) {
      if (child2.status === 'completed' && child2.winnerId) {
        isP2Ready = true;
        p2DisplayName = child2.winnerId === child2.player1Id ? child2.player1Name : child2.player2Name;
      } else {
        isP2Ready = false;
        p2DisplayName = 'TBD';
      }
    } else if (match.status === 'live' || match.status === 'completed') {
      isP2Ready = true;
      p2DisplayName = match.player2Name || 'TBD';
    } else if (
      match.player2Name &&
      !match.player2Name.startsWith('Winner of') &&
      match.player2Name !== 'TBD' &&
      match.player2Name !== 'pending_winner'
    ) {
      isP2Ready = true;
      p2DisplayName = match.player2Name;
    } else {
      isP2Ready = false;
      p2DisplayName = 'TBD';
    }
  }

  // Sanitize internal placeholder text so it never leaks to the UI
  if (p1DisplayName.startsWith('Winner of') || p1DisplayName === 'pending_winner') {
    p1DisplayName = 'TBD';
    isP1Ready = false;
  }
  if (p2DisplayName.startsWith('Winner of') || p2DisplayName === 'pending_winner') {
    p2DisplayName = 'TBD';
    isP2Ready = false;
  }

  const isMatchActiveOrDone = match.status === 'live' || match.status === 'completed';
  const canShowScore = Boolean(showScores && !initialDrawOnly && isMatchActiveOrDone);
  const roundsWon = calculateRoundsWon(match);

  const isP1Winner = Boolean(
    !initialDrawOnly &&
    isMatchActiveOrDone &&
    match.status === 'completed' &&
    match.winnerId &&
    (match.winnerId === match.player1Id || (isP1Ready && child1 && child1.winnerId === match.winnerId))
  );

  const isP2Winner = Boolean(
    !initialDrawOnly &&
    isMatchActiveOrDone &&
    match.status === 'completed' &&
    match.winnerId &&
    (match.winnerId === match.player2Id || (isP2Ready && child2 && child2.winnerId === match.winnerId))
  );

  return {
    isP1Ready,
    p1DisplayName,
    isP2Ready,
    p2DisplayName,
    isP1Winner,
    isP2Winner,
    showScore: canShowScore,
    p1Score: canShowScore ? roundsWon.player1 : null,
    p2Score: canShowScore ? roundsWon.player2 : null,
    p1RoundsWon: roundsWon.player1,
    p2RoundsWon: roundsWon.player2,
    isBothEmpty: !isP1Ready && !isP2Ready
  };
}

import { jsPDF } from 'jspdf';

/**
 * Downloads the current SVG bracket canvas to a standalone SVG file.
 */
export function exportBracketSvg(svgElement: SVGSVGElement | null, filename: string): void {
  if (!svgElement) return;

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Measure and reset transform so exported SVG is centered and un-zoomed
  const liveRoot = (svgElement.querySelector('g[data-bracket-root="true"]') || svgElement.querySelector('g')) as SVGGElement | null;
  if (liveRoot) {
    try {
      const bbox = liveRoot.getBBox();
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        const totalW = Math.ceil(bbox.x + bbox.width) + 80;
        const totalH = Math.ceil(bbox.y + bbox.height) + 80;
        clone.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
        clone.setAttribute('width', String(totalW));
        clone.setAttribute('height', String(totalH));
      }
    } catch {
      // fallback to current dimensions
    }
  }

  const cloneRoot = clone.querySelector('g[data-bracket-root="true"]') || clone.querySelector('g');
  if (cloneRoot) {
    cloneRoot.setAttribute('transform', 'translate(0, 0) scale(1)');
  }

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clone);

  if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface BracketPdfExportOptions {
  title?: string;
  subtitle?: string;
  eventName?: string;
  category?: string;
  weightCategory?: string;
  gender?: string;
  bounds?: { width: number; height: number };
}

/**
 * Converts the D3 bracket SVG tree into a high-resolution, print-ready PDF document.
 * Resets camera zoom/pan to capture the full elimination tree with official tournament metadata.
 */
export async function exportBracketPdf(
  svgElement: SVGSVGElement | null,
  filename: string,
  options?: BracketPdfExportOptions
): Promise<boolean> {
  if (!svgElement) return false;

  try {
    // 1. Locate root <g> container on live DOM element to measure natural bounds
    const liveRoot = (svgElement.querySelector('g[data-bracket-root="true"]') ||
                      svgElement.querySelector('g')) as SVGGElement | null;

    let width = 1400;
    let height = 800;

    if (liveRoot) {
      try {
        const bbox = liveRoot.getBBox();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          width = Math.ceil(bbox.x + bbox.width) + 80;
          height = Math.ceil(bbox.y + bbox.height) + 80;
        }
      } catch (e) {
        console.warn('Could not read live SVG bbox:', e);
      }
    }

    if (options?.bounds) {
      if ((options.bounds.width + 80) > width) width = options.bounds.width + 80;
      if ((options.bounds.height + 80) > height) height = options.bounds.height + 80;
    }

    // 2. Clone SVG to safely manipulate dimensions and reset zoom transform without affecting live DOM
    const clone = svgElement.cloneNode(true) as SVGSVGElement;

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Reset zoom transform on cloned root group to baseline 1:1 scale
    const cloneRoot = clone.querySelector('g[data-bracket-root="true"]') || clone.querySelector('g');
    if (cloneRoot) {
      cloneRoot.setAttribute('transform', 'translate(0, 0) scale(1)');
    }

    // Remove any filter attributes that might fail during canvas rasterization
    clone.querySelectorAll('[filter]').forEach(el => el.removeAttribute('filter'));

    // Insert dark tournament background rect inside SVG so transparent areas render properly
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', String(width));
    bgRect.setAttribute('height', String(height));
    bgRect.setAttribute('fill', '#020617');
    clone.insertBefore(bgRect, clone.firstChild);

    // 3. Serialize SVG to XML string
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clone);

    if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // 4. Render image to an HTML5 canvas at 2x resolution for high print quality
    const imgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => {
        // Fallback: try blob URL if data URI had any issues
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          img.src = blobUrl;
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        fallbackImg.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Failed to load SVG into image for PDF generation'));
        };
        fallbackImg.src = blobUrl;
      };
      img.src = imgDataUri;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Fill background on canvas
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imgData = canvas.toDataURL('image/png', 0.95);

    // 5. Page dimensions: landscape orientation with adequate margins
    const docWidth = Math.max(842, width * 0.75 + 60);
    const docHeight = Math.max(595, height * 0.75 + 105);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: [docWidth, docHeight]
    });

    // Dark tournament background for the whole PDF page
    pdf.setFillColor(10, 15, 29);
    pdf.rect(0, 0, docWidth, docHeight, 'F');

    // Header banner
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, docWidth, 65, 'F');

    // Header accent bar (rose-600)
    pdf.setFillColor(225, 29, 72);
    pdf.rect(0, 63, docWidth, 2, 'F');

    // Header Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(255, 255, 255);
    const mainTitle = options?.title || options?.eventName || 'Tournament Elimination Bracket';
    pdf.text(mainTitle, 30, 28);

    // Header Subtitle / Scope details
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(148, 163, 184); // slate-400
    const subtitleParts = [
      options?.category ? `Division: ${options.category}` : null,
      options?.gender ? `Pool: ${options.gender.toUpperCase()}` : null,
      options?.weightCategory ? `Weight: ${options.weightCategory}` : null,
      'CombatFlow Official Tournament Draw Sheet'
    ].filter(Boolean).join('   |   ');
    pdf.text(subtitleParts, 30, 48);

    // Right-aligned header metadata
    pdf.setFontSize(9);
    pdf.setTextColor(203, 213, 225);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    pdf.text(`Published: ${dateStr}`, docWidth - 30, 38, { align: 'right' });

    // Place the D3 tree image onto the page with margins
    const topMargin = 75;
    const bottomMargin = 45;
    const availWidth = docWidth - 60;
    const availHeight = docHeight - topMargin - bottomMargin;

    const imgRatio = width / height;
    const availRatio = availWidth / availHeight;
    let renderW = availWidth;
    let renderH = availHeight;

    if (imgRatio > availRatio) {
      renderW = availWidth;
      renderH = availWidth / imgRatio;
    } else {
      renderH = availHeight;
      renderW = availHeight * imgRatio;
    }

    const posX = 30 + (availWidth - renderW) / 2;
    const posY = topMargin + (availHeight - renderH) / 2;

    pdf.addImage(imgData, 'PNG', posX, posY, renderW, renderH, undefined, 'FAST');

    // 6. Watermark across the page in light grey font for professional branding
    pdf.saveGraphicsState();
    try {
      if ((pdf as any).GState) {
        const gState = new (pdf as any).GState({ opacity: 0.12 });
        (pdf as any).setGState(gState);
      }
    } catch {
      // fallback
    }
    pdf.setFont('helvetica', 'bold');
    const watermarkSize = Math.min(Math.max(Math.round(docWidth / 16), 36), 56);
    pdf.setFontSize(watermarkSize);
    pdf.setTextColor(203, 213, 225); // light grey semi-transparent font
    const watermarkText = 'OFFICIAL TOURNAMENT BRACKET';

    // Center diagonal watermark across the bracket page
    const centerX = docWidth / 2;
    const centerY = topMargin + availHeight / 2;
    pdf.text(watermarkText, centerX, centerY, {
      align: 'center',
      baseline: 'middle',
      angle: 25
    });
    pdf.restoreGraphicsState();

    // 7. Bottom Descriptive Legend Bar in PDF Document (Rendered via crisp vectors and ASCII fonts)
    const pdfLegendY = docHeight - 34;
    const legendBarHeight = 20;
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(30, pdfLegendY - 6, docWidth - 60, legendBarHeight, 'F');
    pdf.setDrawColor(51, 65, 85); // slate-700
    pdf.rect(30, pdfLegendY - 6, docWidth - 60, legendBarHeight, 'D');

    let currentX = 38;
    const legendCenterY = pdfLegendY + 6;

    // "LEGEND:" Tag
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(56, 189, 248); // sky-400
    pdf.text('LEGEND:', currentX, legendCenterY);
    currentX += pdf.getTextWidth('LEGEND:') + 12;

    // Separator helper
    const drawDotSep = (x: number) => {
      pdf.setFillColor(71, 85, 105);
      pdf.circle(x, legendCenterY - 2.5, 1.2, 'F');
      return x + 10;
    };

    // Item 1: Chung (Red)
    pdf.setFillColor(239, 68, 68); // red-500
    pdf.circle(currentX + 3, legendCenterY - 2.5, 3, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(254, 202, 202); // red-200
    pdf.text('Chung (Red Corner)', currentX + 8, legendCenterY);
    currentX += 8 + pdf.getTextWidth('Chung (Red Corner)') + 8;
    currentX = drawDotSep(currentX);

    // Item 2: Hong (Blue)
    pdf.setFillColor(59, 130, 246); // blue-500
    pdf.circle(currentX + 3, legendCenterY - 2.5, 3, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(191, 219, 254); // blue-200
    pdf.text('Hong (Blue Corner)', currentX + 8, legendCenterY);
    currentX += 8 + pdf.getTextWidth('Hong (Blue Corner)') + 8;
    currentX = drawDotSep(currentX);

    // Item 3: [Winner]
    pdf.setFillColor(245, 158, 11); // amber-500
    pdf.circle(currentX + 3, legendCenterY - 2.5, 3, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(253, 230, 138); // amber-200
    pdf.text('[Winner] Advances', currentX + 8, legendCenterY);
    currentX += 8 + pdf.getTextWidth('[Winner] Advances') + 8;
    currentX = drawDotSep(currentX);

    // Item 4: [TBD]
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text('[TBD]', currentX, legendCenterY);
    const tbdW = pdf.getTextWidth('[TBD]');
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(203, 213, 225);
    pdf.text(' Awaiting prior bout', currentX + tbdW, legendCenterY);
    currentX += tbdW + pdf.getTextWidth(' Awaiting prior bout') + 8;
    currentX = drawDotSep(currentX);

    // Item 5: [LIVE]
    pdf.setFillColor(239, 68, 68);
    pdf.circle(currentX + 3, legendCenterY - 2.5, 2.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(252, 165, 165);
    pdf.text('[LIVE] Active Ring', currentX + 8, legendCenterY);
    currentX += 8 + pdf.getTextWidth('[LIVE] Active Ring') + 8;
    currentX = drawDotSep(currentX);

    // Item 6: [FINAL]
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(52, 211, 153); // emerald-400
    pdf.text('[FINAL]', currentX, legendCenterY);
    const finalW = pdf.getTextWidth('[FINAL]');
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(203, 213, 225);
    pdf.text(' Official Result', currentX + finalW, legendCenterY);

    // Footer
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text('World Taekwondo Knockout Draw Tree  |  Generated via CombatFlow Tournament Engine', 30, docHeight - 8);
    pdf.text('Page 1 of 1', docWidth - 30, docHeight - 8, { align: 'right' });

    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
    return true;
  } catch (error) {
    console.error('Error generating bracket PDF:', error);
    return false;
  }
}
