// Dynamic Taekwondo Age and Weight Categories for Server-side Validation
// Structure: { ageCategory: { gender: { weightClass: [min, max] } } }

export interface WeightInterval {
  min: number;
  max: number | null;
}

export const EVENT_DATE = new Date('2026-10-15'); // Event date for precise age calculation

export const CATEGORY_STRUCTURE: Record<string, Record<string, Record<string, [number, number | null]>>> = {
  "Sub-Junior": {
    "male": {
      "-20 kg": [0, 20],
      "-23 kg": [20, 23],
      "-26 kg": [23, 26],
      "-29 kg": [26, 29],
      "-32 kg": [29, 32],
      "-35 kg": [32, 35],
      "-38 kg": [35, 38],
      "+38 kg": [38, null]
    },
    "female": {
      "-18 kg": [0, 18],
      "-20 kg": [18, 20],
      "-22 kg": [20, 22],
      "-25 kg": [22, 25],
      "-28 kg": [25, 28],
      "-31 kg": [28, 31],
      "-34 kg": [31, 34],
      "+34 kg": [34, null]
    }
  },
  "Cadet": {
    "male": {
      "-33 kg": [0, 33],
      "-37 kg": [33, 37],
      "-41 kg": [37, 41],
      "-45 kg": [41, 45],
      "-49 kg": [45, 49],
      "-53 kg": [49, 53],
      "-57 kg": [53, 57],
      "-61 kg": [57, 61],
      "-65 kg": [61, 65],
      "+65 kg": [65, null]
    },
    "female": {
      "-29 kg": [0, 29],
      "-33 kg": [29, 33],
      "-37 kg": [33, 37],
      "-41 kg": [37, 41],
      "-44 kg": [41, 44],
      "-47 kg": [44, 47],
      "-51 kg": [47, 51],
      "-55 kg": [51, 55],
      "-59 kg": [55, 59],
      "+59 kg": [59, null]
    }
  },
  "Junior": {
    "male": {
      "-45 kg": [0, 45],
      "-48 kg": [45, 48],
      "-51 kg": [48, 51],
      "-55 kg": [51, 55],
      "-59 kg": [55, 59],
      "-63 kg": [59, 63],
      "-68 kg": [63, 68],
      "-73 kg": [68, 73],
      "-78 kg": [73, 78],
      "+78 kg": [78, null]
    },
    "female": {
      "-42 kg": [0, 42],
      "-44 kg": [42, 44],
      "-46 kg": [44, 46],
      "-49 kg": [46, 49],
      "-52 kg": [49, 52],
      "-55 kg": [52, 55],
      "-59 kg": [55, 59],
      "-63 kg": [59, 63],
      "-68 kg": [63, 68],
      "+68 kg": [68, null]
    }
  },
  "Senior": {
    "male": {
      "-54 kg": [0, 54],
      "-58 kg": [54, 58],
      "-63 kg": [58, 63],
      "-68 kg": [63, 68],
      "-74 kg": [68, 74],
      "-80 kg": [74, 80],
      "-87 kg": [80, 87],
      "+87 kg": [87, null]
    },
    "female": {
      "-46 kg": [0, 46],
      "-49 kg": [46, 49],
      "-53 kg": [49, 53],
      "-57 kg": [53, 57],
      "-62 kg": [57, 62],
      "-67 kg": [62, 67],
      "-73 kg": [67, 73],
      "+73 kg": [73, null]
    }
  }
};

/**
 * Calculates a person's age as of the official event date (October 15, 2026).
 */
export const calculateAgeOnEvent = (dobString: string): number => {
  if (!dobString) return 0;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return 0;

  let age = EVENT_DATE.getFullYear() - birthDate.getFullYear();
  const m = EVENT_DATE.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && EVENT_DATE.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Classifies competitor age category according to strict cutoff rules.
 */
export const determineAgeCategory = (age: number): string | null => {
  if (age < 8) return null; // Too young
  if (age >= 8 && age < 12) return "Sub-Junior";
  if (age >= 12 && age < 15) return "Cadet";
  if (age >= 15 && age < 17) return "Junior";
  if (age >= 17 && age <= 32) return "Senior";
  return null; // Too old / out of range
};

/**
 * Resolves the age category with support for the 2009 birth year overlap.
 * Competitors born in 2009 (turning 17 in 2026) are eligible for both Junior and Senior categories.
 */
export const getAgeCategory = (dobString: string, preferredDivision?: string): string | null => {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;

  const birthYear = birthDate.getFullYear();
  if (birthYear === 2009) {
    if (preferredDivision === 'Junior' || preferredDivision === 'Senior') {
      return preferredDivision;
    }
    return 'Junior';
  }

  const age = calculateAgeOnEvent(dobString);
  return determineAgeCategory(age);
};
