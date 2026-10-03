import { buildKnockoutBracket } from "../server/utils/drawEngine";

async function testFix() {
  console.log("=== Testing Empty Category Bracket Generation Fix ===");
  
  const emptyRoster: any[] = [];
  const options = {
    eventId: "test_event",
    ageCategory: "Senior",
    gender: "male",
    weightCategory: "-68 kg",
    allowPlaceholders: true // Even with placeholders true, it should now return empty
  };

  const result = buildKnockoutBracket(emptyRoster, options);

  console.log("Result Matches Count:", result.matches.length);
  console.log("Bracket Participants Count:", result.bracketParticipantsCount);
  
  if (result.matches.length === 0) {
    console.log("✅ Success: No bracket generated for empty category.");
  } else {
    console.log("❌ Failure: Bracket still generated for empty category.");
  }
}

testFix();
