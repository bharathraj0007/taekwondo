import { db } from '../server/db';
import { getMatchingRegistrationsForCategory, buildKnockoutBracket } from '../server/utils/drawEngine';

async function runVerification() {
  console.log('================================================================');
  console.log('       TAEKWONDO TOURNAMENT KNOCKOUT DRAW FIX AUDIT & PROOF     ');
  console.log('================================================================\n');

  const allRegs = await db.registrations.find();
  const allEvents = await db.events.find();
  const targetEvent = allEvents[0] || { _id: 'evt_autumn2026', name: 'Autumn Championship' };

  console.log(`Database: "taekwondo_db" (Persistent MongoDB Schema Data Engine)`);
  console.log(`Total Registration Documents in DB: ${allRegs.length}`);
  console.log(`Target Event: [${targetEvent._id}] "${targetEvent.name}"\n`);

  // 1. REAL CATEGORIES AUDIT
  const testCategories = [
    {
      name: 'Category 1: Senior Male FEATHER WEIGHT (-68 Kg)',
      eventId: targetEvent._id,
      ageCategory: 'Senior',
      gender: 'male',
      weightCategory: 'FEATHER WEIGHT (-68 Kg)'
    },
    {
      name: 'Category 2: Junior Male -45 kg',
      eventId: targetEvent._id,
      ageCategory: 'Junior',
      gender: 'male',
      weightCategory: '-45 kg'
    },
    {
      name: 'Category 3: Cadet Male U-33 kg',
      eventId: targetEvent._id,
      ageCategory: 'Cadet',
      gender: 'male',
      weightCategory: 'U-33 kg'
    },
    {
      name: 'Category 4: Senior Female Featherweight (-57 Kg)',
      eventId: targetEvent._id,
      ageCategory: 'Senior',
      gender: 'female',
      weightCategory: 'FEATHER WEIGHT (-57 Kg)'
    }
  ];

  for (const cat of testCategories) {
    console.log(`----------------------------------------------------------------`);
    console.log(`AUDITING: ${cat.name}`);
    console.log(`----------------------------------------------------------------`);

    const { matched, audit } = getMatchingRegistrationsForCategory(allRegs, cat);

    console.log(`(a) Total Registration documents for this event: ${allRegs.filter(r => !r.eventId || r.eventId === cat.eventId).length}`);
    console.log(`(b) Matching Category Filter Count: ${matched.length}`);
    matched.forEach((r, idx) => {
      console.log(`    ${idx + 1}. [${r.regId || r._id}] "${r.fullName}" | Weight: "${r.weightCategory}" | Age: "${r.ageCategory || 'Senior'}" | Coach: "${r.coachName || 'NA'}"`);
    });

    const bracket = buildKnockoutBracket(matched, {
      eventId: cat.eventId,
      ageCategory: cat.ageCategory,
      gender: cat.gender,
      weightCategory: cat.weightCategory,
      allowPlaceholders: false,
      updatedBy: 'Audit System'
    });

    // Check leaf match athletes
    const firstRoundLevelMatches = bracket.matches.slice(Math.floor(bracket.matches.length / 2));
    const playersInBracket = new Set<string>();
    bracket.matches.forEach(m => {
      if (m.player1Id && !m.player1Id.startsWith('bye_') && !m.player1Id.startsWith('seed_placeholder') && m.player1Id !== 'pending_winner') {
        playersInBracket.add(m.player1Name);
      }
      if (m.player2Id && !m.player2Id.startsWith('bye_') && !m.player2Id.startsWith('seed_placeholder') && m.player2Id !== 'pending_winner') {
        playersInBracket.add(m.player2Name);
      }
    });

    console.log(`(c) Competitors in Generated Bracket: ${playersInBracket.size} / ${matched.length}`);
    console.log(`    Included in Bracket: ${Array.from(playersInBracket).join(', ')}`);
    console.log(`    Total Bouts Generated: ${bracket.matches.length} (Bracket Size: ${bracket.powerOfTwoSize}, BYEs: ${bracket.byesCount})`);
    console.log(`    Verification: ${matched.length === playersInBracket.size ? '✅ 100% INCLUDED (ZERO PLAYERS DROPPED)' : '❌ MISMATCH'}\n`);
  }

  // 2. ODD AND ARBITRARY NUMBER OF PLAYERS PROOF
  console.log(`================================================================`);
  console.log(`PROVING ARBITRARY & ODD PARTICIPANT COUNTS (1, 3, 5, 7, 13 athletes)`);
  console.log(`================================================================\n`);

  const countsToTest = [1, 3, 5, 7, 13];
  for (const n of countsToTest) {
    const mockAthletes = Array.from({ length: n }, (_, i) => ({
      _id: `reg_athlete_${i + 1}`,
      userId: `usr_athlete_${i + 1}`,
      fullName: `Athlete #${i + 1} (${['Dojang A', 'Dojang B', 'Dojang C', 'Dojang D'][i % 4]})`,
      coachName: ['Coach A', 'Coach B', 'Coach C', 'Coach D'][i % 4],
      weightCategory: '-68 kg',
      gender: 'male',
      ageCategory: 'Senior'
    }));

    const bracket = buildKnockoutBracket(mockAthletes, {
      eventId: 'evt_autumn2026',
      ageCategory: 'Senior',
      gender: 'male',
      weightCategory: 'FEATHER WEIGHT (-68 Kg)',
      allowPlaceholders: false,
      updatedBy: 'Audit System'
    });

    const uniqueBracketAthletes = new Set<string>();
    bracket.matches.forEach(m => {
      if (m.player1Id && !m.player1Id.startsWith('bye_') && !m.player1Id.startsWith('seed_placeholder') && m.player1Id !== 'pending_winner') {
        uniqueBracketAthletes.add(m.player1Name);
      }
      if (m.player2Id && !m.player2Id.startsWith('bye_') && !m.player2Id.startsWith('seed_placeholder') && m.player2Id !== 'pending_winner') {
        uniqueBracketAthletes.add(m.player2Name);
      }
    });

    console.log(`• Roster Count N = ${n}:`);
    console.log(`  - Bracket Power of 2 (P): ${bracket.powerOfTwoSize}`);
    console.log(`  - Total Matches: ${bracket.matches.length}`);
    console.log(`  - BYEs Distributed to Top Seeds: ${bracket.byesCount}`);
    console.log(`  - Real Athletes in Bracket: ${uniqueBracketAthletes.size} / ${n}`);
    console.log(`  - Result: ${uniqueBracketAthletes.size === n ? '✅ ALL PARTICIPANTS PRESERVED WITHOUT DROPPING' : '❌ FAILED'}\n`);
  }

  // 3. COMPLETE GENERATED BRACKET JSON OUTPUT
  console.log(`================================================================`);
  console.log(`REAL GENERATED BRACKET JSON FOR ODD CATEGORY (N = 3 Competitors)`);
  console.log(`================================================================\n`);

  const odd3Roster = [
    { _id: 'reg_mcgregor', userId: 'usr_player1', fullName: 'Connor McGregor', coachName: 'SBG Ireland', weightCategory: '-68 kg', gender: 'male', ageCategory: 'Senior' },
    { _id: 'reg_poirier', userId: 'usr_player2', fullName: 'Dustin Poirier', coachName: 'American Top Team', weightCategory: '-68 kg', gender: 'male', ageCategory: 'Senior' },
    { _id: 'reg_holloway', userId: 'usr_player5', fullName: 'Max Holloway', coachName: 'Hawaii Elite', weightCategory: '-68 kg', gender: 'male', ageCategory: 'Senior' }
  ];

  const generatedBracket = buildKnockoutBracket(odd3Roster, {
    eventId: targetEvent._id,
    ageCategory: 'Senior',
    gender: 'male',
    weightCategory: 'FEATHER WEIGHT (-68 Kg)',
    allowPlaceholders: false,
    updatedBy: 'Admin'
  });

  console.log(JSON.stringify(generatedBracket.matches, null, 2));
}

runVerification().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
