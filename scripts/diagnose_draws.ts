import { db } from '../server/db';

async function diagnose() {
  const events = await db.events.find();
  const regs = await db.registrations.find();
  const categories = await db.categories.find();
  const matches = await db.matches.find();
  const draws = await db.draws.find();

  console.log('=== TOURNAMENT DIAGNOSTIC AUDIT ===');
  console.log(`Total Events: ${events.length}`);
  console.log(`Total Registrations: ${regs.length}`);
  console.log(`Total Existing Matches: ${matches.length}`);
  console.log(`Total Existing Draws: ${draws.length}`);

  events.forEach(e => {
    console.log(`\nEvent [${e._id}] ${e.name} (Year: ${e.eventYear}, Status: ${e.status})`);
    const eventRegs = regs.filter(r => r.eventId === e._id);
    console.log(`  - Total Registrations explicitly with eventId=${e._id}: ${eventRegs.length}`);
  });

  const regsWithoutEvent = regs.filter(r => !r.eventId);
  console.log(`\nRegistrations without eventId: ${regsWithoutEvent.length}`);

  // Group registrations by (eventId, ageCategory, gender, weightCategory)
  console.log('\n--- REGISTRATIONS BY CATEGORY & EVENT ---');
  const catMap = new Map<string, any[]>();
  for (const r of regs) {
    const key = `${r.eventId || 'NO_EVENT'} | ${r.ageCategory || 'Senior'} | ${r.gender} | ${r.weightCategory}`;
    if (!catMap.has(key)) catMap.set(key, []);
    catMap.get(key)!.push(r);
  }

  for (const [key, list] of catMap.entries()) {
    console.log(`Category: [${key}] -> ${list.length} athlete(s):`);
    list.forEach(r => {
      console.log(`   - RegID: ${r.regId || r._id} | Name: "${r.fullName}" | Coach/Club: "${r.coachName || 'NA'}" | Status: ${r.status} | Weight: "${r.weightCategory}" | AgeCat: "${r.ageCategory}"`);
    });
  }
}

diagnose().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
