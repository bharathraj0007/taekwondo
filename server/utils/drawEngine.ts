import { getAgeCategory } from './categories';
import { Registration, Match } from '../db';

/**
 * Normalizes weight string by trimming, lowering case, removing prefixes/suffixes
 */
export const normalizeWeightString = (w: string): string => {
  if (!w) return '';
  return String(w)
    .toLowerCase()
    .trim()
    .replace(/^(male|female)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*kg/gi, 'kg');
};

/**
 * Robust Weight Category Matcher handling:
 * - exact case-insensitive matches
 * - format differences: "U-33 kg", "-33 kg", "-33kg", "Under 33 kg"
 * - Senior naming: "Male Featherweight (58kg - 68kg)" vs "FEATHER WEIGHT (-68 Kg)"
 * - Plus categories: "+87 Kg", "+87kg", "Over 87kg"
 */
export const isWeightCategoryMatch = (regWeight: string, targetWeight: string): boolean => {
  if (!regWeight || !targetWeight) return false;

  const w1 = normalizeWeightString(regWeight);
  const w2 = normalizeWeightString(targetWeight);

  if (w1 === w2) return true;

  // Clean keys: strip non-alphanumerics except numbers and plus
  const cleanKey = (s: string) => s
    .replace(/(fin|fly|bantam|feather|light|welter|middle|heavy)\s*weight/gi, '')
    .replace(/[()]/g, '')
    .replace(/^(u-|under\s*|-)/i, '')
    .replace(/\s+/g, '')
    .replace(/kg/gi, '');

  const k1 = cleanKey(w1);
  const k2 = cleanKey(w2);
  if (k1 === k2 && k1.length > 0) return true;

  // Weight class name keyword matching
  const classes = ['fin', 'fly', 'bantam', 'feather', 'light', 'welter', 'middle', 'heavy'];
  for (const c of classes) {
    if (w1.includes(c) && w2.includes(c)) {
      return true;
    }
  }

  // Number comparison
  const n1 = (w1.match(/\d+/g) || []).map(Number);
  const n2 = (w2.match(/\d+/g) || []).map(Number);

  if (n1.length > 0 && n2.length > 0) {
    if (n1.join('-') === n2.join('-')) return true;
    // Compare max boundary weight
    const max1 = Math.max(...n1);
    const max2 = Math.max(...n2);
    if (max1 === max2) return true;
  }

  return false;
};

/**
 * Resolves or computes the age category from registration document
 */
export const resolveAgeCategory = (r: any): string => {
  if (r.ageCategory && String(r.ageCategory).trim()) {
    const raw = String(r.ageCategory).trim().toLowerCase();
    if (raw.includes('sub')) return 'Sub-Junior';
    if (raw.includes('cadet')) return 'Cadet';
    if (raw.includes('junior')) return 'Junior';
    if (raw.includes('senior')) return 'Senior';
  }
  if (r.dob) {
    const derived = getAgeCategory(r.dob);
    if (derived) return derived;
  }
  return 'Senior';
};

/**
 * Filters registrations for an event category without dropping valid competitors.
 * Matches on: eventId (or unassigned/all if matching event), gender, ageCategory, and weightCategory.
 */
export const getMatchingRegistrationsForCategory = (
  allRegistrations: Registration[],
  criteria: {
    eventId?: string;
    ageCategory?: string;
    gender: string;
    weightCategory: string;
  }
): {
  matched: Registration[];
  allEligibleCount: number;
  audit: {
    totalChecked: number;
    included: { id: string; name: string; coach: string; weight: string; age: string }[];
    excluded: { id: string; name: string; reason: string }[];
  };
} => {
  const normGender = String(criteria.gender || '').trim().toLowerCase();
  const normAge = String(criteria.ageCategory || 'Senior').trim().toLowerCase();
  const targetWeight = criteria.weightCategory;
  const targetEventId = criteria.eventId;

  const included: any[] = [];
  const excluded: any[] = [];

  const matched = allRegistrations.filter((r: any) => {
    const rId = r.regId || r._id;
    const rName = r.fullName || 'Unknown Athlete';

    // 1. Status check: Only approved registrations are included (restrict to Approved only)
    if (r.status !== 'approved') {
      excluded.push({ id: rId, name: rName, reason: `Registration status is not approved (${r.status || 'pending'})` });
      return false;
    }

    // 2. Gender check (normalized case-insensitive)
    const rGender = String(r.gender || '').trim().toLowerCase();
    if (rGender !== normGender) {
      excluded.push({ id: rId, name: rName, reason: `Gender mismatch (${rGender} vs ${normGender})` });
      return false;
    }

    // 3. Age category check
    const rAgeCat = resolveAgeCategory(r).toLowerCase();
    if (rAgeCat !== normAge) {
      excluded.push({ id: rId, name: rName, reason: `Age category mismatch (${rAgeCat} vs ${normAge})` });
      return false;
    }

    // 4. Weight category check
    const rWeight = r.weightCategory || '';
    if (!isWeightCategoryMatch(rWeight, targetWeight)) {
      excluded.push({ id: rId, name: rName, reason: `Weight category mismatch ("${rWeight}" vs "${targetWeight}")` });
      return false;
    }

    // 5. Event filter: if eventId is provided, include athletes registered for this event or with unassigned eventId
    if (targetEventId && r.eventId && r.eventId !== targetEventId) {
      excluded.push({ id: rId, name: rName, reason: `Registered for a different event (${r.eventId})` });
      return false;
    }

    included.push({
      id: rId,
      name: rName,
      coach: r.coachName || r.clubName || 'Independent',
      weight: r.weightCategory,
      age: resolveAgeCategory(r)
    });

    return true;
  });

  return {
    matched,
    allEligibleCount: matched.length,
    audit: {
      totalChecked: allRegistrations.length,
      included,
      excluded
    }
  };
};

/**
 * Standard tournament bracket seed order generation for P slots
 */
export const getSeedOrder = (numSlots: number): number[] => {
  if (numSlots <= 1) return [1];
  const rounds = Math.log2(numSlots) - 1;
  let pls = [1, 2];
  for (let i = 0; i < rounds; i++) {
    const next: number[] = [];
    const length = pls.length * 2 + 1;
    for (const seed of pls) {
      next.push(seed);
      next.push(length - seed);
    }
    pls = next;
  }
  return pls;
};

/**
 * Generates round names from finals up to first round
 */
export const getRoundLabel = (size: number): string => {
  if (size === 2) return 'Finals';
  if (size === 4) return 'Semifinals';
  if (size === 8) return 'Quarterfinals';
  if (size === 16) return 'Round of 16';
  if (size === 32) return 'Round of 32';
  if (size === 64) return 'Round of 64';
  return `Round of ${size}`;
};

/**
 * Distributes competitors to minimize same-team / same-coach clashes in Round 1
 */
export const separateTeamsAndSeed = (participants: any[], P: number): any[] => {
  // Group by team/coach
  const teamMap = new Map<string, any[]>();
  participants.forEach(p => {
    const team = (p.coachName || p.clubName || 'independent').trim().toLowerCase();
    if (!teamMap.has(team)) teamMap.set(team, []);
    teamMap.get(team)!.push(p);
  });

  // Interleave teams across top & bottom halves
  const topHalf: any[] = [];
  const bottomHalf: any[] = [];

  let toggle = true;
  for (const [, members] of teamMap.entries()) {
    // Shuffle members within the same team
    const shuffledMembers = [...members].sort(() => Math.random() - 0.5);
    shuffledMembers.forEach(m => {
      if (toggle) {
        topHalf.push(m);
      } else {
        bottomHalf.push(m);
      }
      toggle = !toggle;
    });
  }

  // Combine top and bottom half
  return [...topHalf, ...bottomHalf];
};

/**
 * Full tournament bracket tree generator
 */
export const buildKnockoutBracket = (
  rawParticipants: any[],
  options: {
    eventId: string;
    ageCategory: string;
    gender: string;
    weightCategory: string;
    targetBracketSize?: number;
    allowPlaceholders?: boolean;
    updatedBy?: string;
  }
): {
  matches: Match[];
  bracketParticipantsCount: number;
  byesCount: number;
  powerOfTwoSize: number;
} => {
  const { eventId, ageCategory, gender, weightCategory, targetBracketSize, allowPlaceholders, updatedBy } = options;
  let participants = [...rawParticipants];
  const realCount = participants.length;

  // Case 0: No participants
  if (realCount === 0) {
    return { matches: [], bracketParticipantsCount: 0, byesCount: 0, powerOfTwoSize: 0 };
  }

  // Case 1: Single player category -> Instant Finals walkover winner
  if (participants.length === 1 && !allowPlaceholders) {
    const p1 = participants[0];
    const matchId = 'mat_' + Math.random().toString(36).substring(2, 11);
    const singleMatch: Match = {
      _id: matchId,
      eventId,
      ageCategory,
      gender: gender as 'male' | 'female',
      weightCategory,
      round: 'Finals',
      player1Id: p1.userId || p1._id,
      player2Id: 'bye_placeholder',
      player1Name: p1.fullName,
      player2Name: 'BYE (Automatic Walkover)',
      winnerId: p1.userId || p1._id,
      score: { player1: 1, player2: 0 },
      status: 'completed',
      updatedBy: updatedBy || 'System',
      updatedAt: new Date().toISOString(),
      matchIndex: 0,
      nextMatchId: null,
      nextMatchPlayerSlot: null
    };

    return {
      matches: [singleMatch],
      bracketParticipantsCount: 1,
      byesCount: 1,
      powerOfTwoSize: 2
    };
  }

  // Determine power of 2 size P
  const N = participants.length;
  let P = 2;
  while (P < N) {
    P *= 2;
  }
  if (targetBracketSize && targetBracketSize > P) {
    P = targetBracketSize;
  }

  // Separate teams and seed
  const seededParticipants = separateTeamsAndSeed(participants, P);

  // Generate standard tournament seed ordering for size P
  const seedOrder = getSeedOrder(P);

  // Generate round sizes from Finals (2) down to first round (P)
  const roundSizes: number[] = [];
  let size = 2;
  while (size <= P) {
    roundSizes.push(size);
    size *= 2;
  }

  // Build bracket tree levels (level 0 = Finals, level max = First Round)
  const createdMatchesByLevel: any[][] = [];
  const totalRounds = roundSizes.length;

  for (let level = 0; level < totalRounds; level++) {
    const roundSize = roundSizes[level];
    const numMatches = roundSize / 2;
    const roundNumber = totalRounds - level; // 1 for First Round, totalRounds for Finals

    let roundLabel = `Round ${roundNumber}`;
    if (roundNumber === totalRounds) {
      roundLabel = 'Finals';
    } else if (roundNumber === 1) {
      roundLabel = 'Round 1';
    } else if (roundNumber === totalRounds - 1 && totalRounds > 2) {
      roundLabel = 'Semifinals';
    } else if (roundNumber === totalRounds - 2 && totalRounds > 3) {
      roundLabel = 'Quarterfinals';
    }

    createdMatchesByLevel[level] = [];

    for (let idx = 0; idx < numMatches; idx++) {
      const matchId = 'mat_' + Math.random().toString(36).substring(2, 11);

      let nextMatchId: string | null = null;
      let nextMatchPlayerSlot: 'player1' | 'player2' | null = null;

      if (level > 0) {
        const parentIdx = Math.floor(idx / 2);
        const parentMatch = createdMatchesByLevel[level - 1][parentIdx];
        if (parentMatch) {
          nextMatchId = parentMatch._id;
          nextMatchPlayerSlot = idx % 2 === 0 ? 'player1' : 'player2';
        }
      }

      const matchData: any = {
        _id: matchId,
        ageCategory,
        weightCategory,
        gender,
        round: roundLabel,
        roundNumber,
        player1Id: 'pending_winner',
        player2Id: 'pending_winner',
        player1Name: level > 0 ? `Winner of Match #${2 * idx + 1}` : 'TBD',
        player2Name: level > 0 ? `Winner of Match #${2 * idx + 2}` : 'TBD',
        winnerId: null,
        score: { player1: 0, player2: 0 },
        status: 'upcoming',
        updatedBy: updatedBy || 'System',
        updatedAt: new Date().toISOString(),
        matchIndex: idx,
        nextMatchId,
        nextMatchPlayerSlot,
        eventId
      };

      createdMatchesByLevel[level].push(matchData);
    }
  }

  // Populate first round matches with seeds and assign BYEs
  const firstRoundLevel = roundSizes.length - 1;
  const firstRoundMatches = createdMatchesByLevel[firstRoundLevel];
  const numFirstRoundMatches = firstRoundMatches.length;
  let byesAssigned = 0;

  for (let idx = 0; idx < numFirstRoundMatches; idx++) {
    const match = firstRoundMatches[idx];
    const seed1 = seedOrder[idx * 2];
    const seed2 = seedOrder[idx * 2 + 1];

    // Seed 1 is slot 1 (Red Corner / Chung)
    if (seed1 <= N) {
      const p1 = seededParticipants[seed1 - 1];
      match.player1Id = p1.userId || p1._id;
      match.player1Name = p1.fullName;
    } else {
      match.player1Id = 'bye_placeholder';
      match.player1Name = 'BYE (Automatic Walkover)';
      byesAssigned++;
    }

    // Seed 2 is slot 2 (Blue Corner / Hong)
    if (seed2 <= N) {
      const p2 = seededParticipants[seed2 - 1];
      match.player2Id = p2.userId || p2._id;
      match.player2Name = p2.fullName;
    } else {
      match.player2Id = 'bye_placeholder';
      match.player2Name = 'BYE (Automatic Walkover)';
      byesAssigned++;
    }

    // Handle Walkover / BYE victory
    if (match.player1Id !== 'bye_placeholder' && match.player2Id === 'bye_placeholder') {
      match.winnerId = match.player1Id;
      match.status = 'completed';
      match.score = { player1: 1, player2: 0 };
    } else if (match.player1Id === 'bye_placeholder' && match.player2Id !== 'bye_placeholder') {
      match.winnerId = match.player2Id;
      match.status = 'completed';
      match.score = { player1: 0, player2: 1 };
    } else if (match.player1Id === 'bye_placeholder' && match.player2Id === 'bye_placeholder') {
      match.winnerId = 'bye_placeholder';
      match.status = 'completed';
      match.score = { player1: 0, player2: 0 };
    }
  }

  // Propagate all BYE winners upward to parent matches
  for (let level = firstRoundLevel; level > 0; level--) {
    const matchesInLevel = createdMatchesByLevel[level];
    for (const m of matchesInLevel) {
      if (m.status === 'completed' && m.winnerId && m.winnerId !== 'pending_winner') {
        const nextId = m.nextMatchId;
        const slot = m.nextMatchPlayerSlot;
        if (nextId && slot) {
          const parentLevelMatches = createdMatchesByLevel[level - 1];
          const parentM = parentLevelMatches.find((pm: any) => pm._id === nextId);
          if (parentM) {
            const winnerName = m.winnerId === m.player1Id ? m.player1Name : m.player2Name;
            if (slot === 'player1') {
              parentM.player1Id = m.winnerId;
              parentM.player1Name = winnerName;
            } else {
              parentM.player2Id = m.winnerId;
              parentM.player2Name = winnerName;
            }

            // If both slots in parent are now resolved and one is a BYE, advance further
            if (parentM.player1Id === 'bye_placeholder' && parentM.player2Id !== 'bye_placeholder' && parentM.player2Id !== 'pending_winner') {
              parentM.winnerId = parentM.player2Id;
              parentM.status = 'completed';
              parentM.score = { player1: 0, player2: 1 };
            } else if (parentM.player2Id === 'bye_placeholder' && parentM.player1Id !== 'bye_placeholder' && parentM.player1Id !== 'pending_winner') {
              parentM.winnerId = parentM.player1Id;
              parentM.status = 'completed';
              parentM.score = { player1: 1, player2: 0 };
            }
          }
        }
      }
    }
  }

  // Flatten all levels
  const allMatches: Match[] = [];
  for (let level = 0; level < createdMatchesByLevel.length; level++) {
    for (const m of createdMatchesByLevel[level]) {
      allMatches.push(m);
    }
  }

  return {
    matches: allMatches,
    bracketParticipantsCount: N,
    byesCount: byesAssigned,
    powerOfTwoSize: P
  };
};
