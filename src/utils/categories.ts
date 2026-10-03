// Dynamic Taekwondo Age and Weight Categories for Tournament Registration
// Structure: { ageCategory: { gender: { weightClass: [min, max] } } }

export interface WeightInterval {
  min: number;
  max: number | null;
}

export const EVENT_DATE = new Date('2026-10-15'); // Event date for precise age calculation

export const CATEGORY_STRUCTURE: Record<string, Record<string, Record<string, [number, number | null]>>> = {
  "Sub-Junior": {
    "male": {
      "U-18 kg": [0, 18],
      "U-21 kg": [18, 21],
      "U-23 kg": [21, 23],
      "U-25 kg": [23, 25],
      "U-27 kg": [25, 27],
      "U-29 kg": [27, 29],
      "U-32 kg": [29, 32],
      "U-35 kg": [32, 35],
      "U-38 kg": [35, 38],
      "U-41 kg": [38, 41],
      "U-44 kg": [41, 44],
      "U-50 kg": [44, 50]
    },
    "female": {
      "U-16 kg": [0, 16],
      "U-18 kg": [16, 18],
      "U-20 kg": [18, 20],
      "U-22 kg": [20, 22],
      "U-24 kg": [22, 24],
      "U-26 kg": [24, 26],
      "U-29 kg": [26, 29],
      "U-32 kg": [29, 32],
      "U-35 kg": [32, 35],
      "U-38 kg": [35, 38],
      "U-41 kg": [38, 41],
      "U-47 kg": [41, 47]
    }
  },
  "Cadet": {
    "male": {
      "U-33 kg": [0, 33],
      "U-37 kg": [33, 37],
      "U-41 kg": [37, 41],
      "U-45 kg": [41, 45],
      "U-49 kg": [45, 49],
      "U-53 kg": [49, 53],
      "U-57 kg": [53, 57],
      "U-61 kg": [57, 61],
      "U-65 kg": [61, 65],
      "+65 kg": [65, null]
    },
    "female": {
      "U-29 kg": [0, 29],
      "U-33 kg": [29, 33],
      "U-37 kg": [33, 37],
      "U-41 kg": [37, 41],
      "U-44 kg": [41, 44],
      "U-47 kg": [44, 47],
      "U-51 kg": [47, 51],
      "U-55 kg": [51, 55],
      "U-59 kg": [55, 59],
      "+59 kg": [59, null]
    }
  },
  "Junior": {
    "male": {
      "U-45 kg": [0, 45],
      "U-48 kg": [45, 48],
      "U-51 kg": [48, 51],
      "U-55 kg": [51, 55],
      "U-59 kg": [55, 59],
      "U-63 kg": [59, 63],
      "U-68 kg": [63, 68],
      "U-73 kg": [68, 73],
      "U-78 kg": [73, 78],
      "+78 kg": [78, null]
    },
    "female": {
      "U-42 kg": [0, 42],
      "U-44 kg": [42, 44],
      "U-46 kg": [44, 46],
      "U-49 kg": [46, 49],
      "U-52 kg": [49, 52],
      "U-55 kg": [52, 55],
      "U-59 kg": [55, 59],
      "U-63 kg": [59, 63],
      "U-68 kg": [63, 68],
      "+68 kg": [68, null]
    }
  },
  "Senior": {
    "male": {
      "FIN WEIGHT (-54 Kg)": [0, 54],
      "FLY WEIGHT (-58 Kg)": [54, 58],
      "BANTAM WEIGHT (-63 Kg)": [58, 63],
      "FEATHER WEIGHT (-68 Kg)": [63, 68],
      "LIGHT WEIGHT (-74 Kg)": [68, 74],
      "WELTER WEIGHT (-80 Kg)": [74, 80],
      "MIDDLE WEIGHT (-87 Kg)": [80, 87],
      "HEAVY WEIGHT (+87 Kg)": [87, null]
    },
    "female": {
      "FIN WEIGHT (-46 Kg)": [0, 46],
      "FLY WEIGHT (-49 Kg)": [46, 49],
      "BANTAM WEIGHT (-53 Kg)": [49, 53],
      "FEATHER WEIGHT (-57 Kg)": [53, 57],
      "LIGHT WEIGHT (-62 Kg)": [57, 62],
      "WELTER WEIGHT (-67 Kg)": [62, 67],
      "MIDDLE WEIGHT (-73 Kg)": [67, 73],
      "HEAVY WEIGHT (+73 Kg)": [73, null]
    }
  }
};

/**
 * Calculates a person's age as of the official event date (October 15, 2026).
 * Standard WT rules count based on exact age on event date or calendar year.
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
 * Turning exactly 17 years old on or before the event date assigns them to "Senior" to avoid overlaps.
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
