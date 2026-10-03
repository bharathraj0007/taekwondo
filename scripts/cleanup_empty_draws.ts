import { db } from "../server/db";
import { getMatchingRegistrationsForCategory, isWeightCategoryMatch } from "../server/utils/drawEngine";

async function runCleanup() {
  console.log("=== CombatFlow Tournament Data Cleanup Engine ===");
  console.log("Searching for phantom draws with zero registered athletes...\n");

  try {
    const draws = await db.draws.find();
    const registrations = await db.registrations.find();
    const matches = await db.matches.find();

    const phantomDraws = [];

    for (const draw of draws) {
      const { matched } = getMatchingRegistrationsForCategory(registrations, {
        eventId: draw.eventId,
        ageCategory: draw.category,
        gender: draw.gender,
        weightCategory: draw.weightCategory
      });

      if (matched.length === 0) {
        // Find matches associated with this specific phantom draw
        const drawMatches = matches.filter((m: any) => 
          m.eventId === draw.eventId && 
          (m.gender || "").toLowerCase() === (draw.gender || "").toLowerCase() &&
          (m.ageCategory || "Senior").toLowerCase() === (draw.category || "").toLowerCase() &&
          isWeightCategoryMatch(m.weightCategory, draw.weightCategory)
        );

        phantomDraws.push({
          drawId: draw._id,
          category: draw.category,
          weight: draw.weightCategory,
          gender: draw.gender,
          matchesFound: drawMatches.length,
          matchIds: drawMatches.map((m: any) => m._id)
        });
      }
    }

    if (phantomDraws.length === 0) {
      console.log("✅ Success: No phantom draws found. The database is clean.");
      process.exit(0);
    }

    console.log(`⚠️ Found ${phantomDraws.length} phantom draws to be removed:`);
    phantomDraws.forEach((pd, idx) => {
      console.log(`${idx + 1}. [ID: ${pd.drawId}] ${pd.category} ${pd.gender} ${pd.weight} (${pd.matchesFound} empty matches)`);
    });

    console.log("\n[ACTION REQUIRED] Please confirm if you want to proceed with deletion of these records.");
    
    // Check for "force" argument to perform actual deletion
    const forceDelete = process.argv.includes("--force");
    if (forceDelete) {
      console.log("\n🚀 Deletion sequence initiated (--force detected)...");
      for (const pd of phantomDraws) {
        // Delete the draw
        await (db.draws as any).delete(pd.drawId);
        
        // Delete associated matches
        if (pd.matchIds.length > 0) {
          await db.matches.deleteMany({ _id: { $in: pd.matchIds } });
        }
        console.log(`🗑️ Removed draw ${pd.drawId} and ${pd.matchIds.length} matches.`);
      }
      console.log("\n✨ Cleanup complete. All phantom records purged.");
    } else {
      console.log("\n💡 Dry run complete. To perform actual deletion, run this script with the --force flag.");
    }

    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ Critical failure during cleanup scan:", err.message || err);
    process.exit(1);
  }
}

runCleanup();
