import { db } from '../server/db';
import { calculateAgeOnEvent, getAgeCategory } from '../server/utils/categories';

// Normalization function matching both sides
export const normalizeWeightString = (w: string): string => {
  if (!w) return '';
  return w
    .toLowerCase()
    .trim()
    .replace(/^(male|female)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*kg/gi, 'kg');
};

// Advanced Weight Category Matcher
export const isWeightCategoryMatch = (regWeight: string, targetWeight: string): boolean => {
  if (!regWeight || !targetWeight) return false;
  
  const w1 = normalizeWeightString(regWeight);
  const w2 = normalizeWeightString(targetWeight);

  if (w1 === w2) return true;

  // Stripped keys: remove "u-", "under", "-", "(", ")", "weight", etc.
  const cleanKey = (s: string) => s
    .replace(/(fin|fly|bantam|feather|light|welter|middle|heavy)\s*weight/gi, '')
    .replace(/[()]/g, '')
    .replace(/^(u-|under\s*|-|\+)/i, '')
    .replace(/\s+/g, '')
    .replace(/kg/gi, '');

  const k1 = cleanKey(w1);
  const k2 = cleanKey(w2);
  if (k1 === k2 && k1.length > 0) return true;

  // Weight class name tokens (e.g. "feather", "fly", "welter", "bantam", "fin", "middle", "heavy")
  const classes = ['fin', 'fly', 'bantam', 'feather', 'light', 'welter', 'middle', 'heavy'];
  for (const c of classes) {
    if (w1.includes(c) && w2.includes(c)) {
      return true;
    }
  }

  // Number extraction: compare upper limit / main number
  const n1 = (w1.match(/\d+/g) || []).map(Number);
  const n2 = (w2.match(/\d+/g) || []).map(Number);

  if (n1.length > 0 && n2.length > 0) {
    // If exact numbers array matches
    if (n1.join('-') === n2.join('-')) return true;
    // Compare max bound (e.g. 58-68 kg vs -68 kg -> max is 68 in both)
    const max1 = Math.max(...n1);
    const max2 = Math.max(...n2);
    if (max1 === max2) return true;
  }

  return false;
};

// Age Category Resolver
export const resolveAgeCategory = (r: any): string => {
  if (r.ageCategory && r.ageCategory.trim()) {
    const raw = r.ageCategory.trim().toLowerCase();
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

async function testMatch() {
  const regs = await db.registrations.find();
  console.log(`Total registrations: ${regs.length}`);

  // Test category 1: Senior Male Featherweight (68kg)
  const cat1Target = {
    eventId: 'evt_autumn2026',
    ageCategory: 'Senior',
    gender: 'male',
    weightCategory: 'FEATHER WEIGHT (-68 Kg)'
  };

  const matching1 = regs.filter(r => {
    const gMatch = (r.gender || '').toLowerCase() === cat1Target.gender.toLowerCase();
    const aMatch = resolveAgeCategory(r).toLowerCase() === cat1Target.ageCategory.toLowerCase();
    const wMatch = isWeightCategoryMatch(r.weightCategory, cat1Target.weightCategory);
    return gMatch && aMatch && wMatch;
  });

  console.log(`\nCategory 1: Senior Male FEATHER WEIGHT (-68 Kg):`);
  console.log(`Matching registrations (${matching1.length}):`);
  matching1.forEach(r => console.log(` - ${r._id}: ${r.fullName} (${r.weightCategory})`));

  // Test category 2: Junior Male -45 kg
  const cat2Target = {
    eventId: 'evt_autumn2026',
    ageCategory: 'Junior',
    gender: 'male',
    weightCategory: '-45 kg'
  };

  const matching2 = regs.filter(r => {
    const gMatch = (r.gender || '').toLowerCase() === cat2Target.gender.toLowerCase();
    const aMatch = resolveAgeCategory(r).toLowerCase() === cat2Target.ageCategory.toLowerCase();
    const wMatch = isWeightCategoryMatch(r.weightCategory, cat2Target.weightCategory);
    return gMatch && aMatch && wMatch;
  });

  console.log(`\nCategory 2: Junior Male -45 kg:`);
  console.log(`Matching registrations (${matching2.length}):`);
  matching2.forEach(r => console.log(` - ${r._id}: ${r.fullName} (${r.weightCategory})`));

  // Test category 3: Cadet Male U-33 kg
  const cat3Target = {
    eventId: 'evt_autumn2026',
    ageCategory: 'Cadet',
    gender: 'male',
    weightCategory: 'U-33 kg'
  };

  const matching3 = regs.filter(r => {
    const gMatch = (r.gender || '').toLowerCase() === cat3Target.gender.toLowerCase();
    const aMatch = resolveAgeCategory(r).toLowerCase() === cat3Target.ageCategory.toLowerCase();
    const wMatch = isWeightCategoryMatch(r.weightCategory, cat3Target.weightCategory);
    return gMatch && aMatch && wMatch;
  });

  console.log(`\nCategory 3: Cadet Male U-33 kg:`);
  console.log(`Matching registrations (${matching3.length}):`);
  matching3.forEach(r => console.log(` - ${r._id}: ${r.fullName} (${r.weightCategory})`));
}

testMatch().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
