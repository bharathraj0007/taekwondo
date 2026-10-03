import mongoose, { Schema } from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Configure Mongoose to disable infinite command buffering to prevent timeout hangs
mongoose.set('bufferCommands', false);

// Interfaces
export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  passwordHash?: string;
  role: 'player' | 'admin' | 'referee';
  otp?: string | null;
  otpExpiresAt?: string | null;
  isVerified?: boolean;
  otpAttempts?: number;
  otpRequestCount?: number;
  otpLastRequestedAt?: string | null;
  createdAt: string;
}

export interface Registration {
  _id: string;
  regId?: string;
  userId: string;
  eventId?: string;
  fullName: string;
  dob: string;
  gender: 'male' | 'female';
  ageCategory?: string;
  weightCategory: string;
  beltRank: string;
  coachName: string;
  aadharLastFour: string;
  phone?: string;
  email?: string;
  photoUrl: string;
  photoBase64?: string;
  pdfUrl: string;
  photoPublicId?: string;
  pdfPublicId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Match {
  _id: string;
  ageCategory?: string;
  weightCategory: string;
  gender: 'male' | 'female';
  round: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  winnerId: string | null;
  score: {
    player1: number;
    player2: number;
  };
  status: 'pending' | 'upcoming' | 'live' | 'completed';
  updatedBy: string;
  updatedAt: string;
  matchIndex?: number;
  nextMatchId?: string | null;
  nextMatchPlayerSlot?: 'player1' | 'player2' | null;
  eventId?: string;
}

export interface GalleryImage {
  _id: string;
  imageUrl: string;
  caption: string;
  uploadedBy: string;
  createdAt: string;
}

export interface EngagementLog {
  _id: string;
  userId: string | null;
  action: string;
  page: string;
  userAgent: string;
  createdAt: string;
}

export interface HealthServiceCheck {
  service: string;
  status: 'up' | 'down' | 'degraded';
  message: string;
  checkedAt: string;
}

export interface HealthLog {
  _id: string;
  status: 'healthy' | 'degraded' | 'down';
  services: HealthServiceCheck[];
  checkedAt: string;
}

export interface RecoveryLog {
  _id: string;
  timestamp: string;
  service: string;
  issue: string;
  action: string;
  outcome: 'resolved' | 'failed';
  details: string;
}

export interface Draw {
  _id: string;
  eventId: string;
  category: string;
  weightCategory: string;
  gender: string;
  status: 'draft' | 'finalized';
  finalizedAt?: string | Date | null;
  rounds?: any;
  matches?: any;
  createdAt: string;
}

export interface Standing {
  _id: string;
  position: '1st' | '2nd' | '3rd';
  playerId: string;
  fullName: string;
  registrationId: string;
  eventId: string;
  weightCategory: string;
  ageCategory: string;
  gender: 'male' | 'female';
  certificateUrl: string;
  certificatePublicId?: string;
  emailSent: boolean;
  emailSentAt?: string | null;
  emailError?: string | null;
  createdAt: string;
}

export interface Event {
  _id: string;
  name: string;
  date: string;
  venue: string;
  description?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  eventYear: number;
  registrationDeadline?: string;
  allowedCoachIds?: string[];
  createdAt: string;
}

export interface Coach {
  _id: string;
  name: string;
  createdAt: string;
}

export interface DynamicCategory {
  _id: string;
  name: string;
  minAge: number;
  maxAge: number;
  maleWeightClasses: string[];
  femaleWeightClasses: string[];
  eventId?: string;
  createdAt: string;
}

// MongoDB Mongoose Schemas
const userSchema = new Schema<User>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String, default: '' },
  password_hash: { type: String, default: '' },
  passwordHash: { type: String, default: '' },
  role: { type: String, enum: ['player', 'admin', 'referee'], default: 'player' },
  otp: { type: String, default: null },
  otpExpiresAt: { type: String, default: null },
  isVerified: { type: Boolean, default: false },
  otpAttempts: { type: Number, default: 0 },
  otpRequestCount: { type: Number, default: 0 },
  otpLastRequestedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

const registrationSchema = new Schema<Registration>({
  _id: { type: String, required: true },
  regId: { type: String, unique: true, index: true },
  userId: { type: String, required: true },
  eventId: { type: String, default: 'evt_autumn2026' },
  fullName: { type: String, required: true },
  dob: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  ageCategory: { type: String },
  weightCategory: { type: String, required: true },
  beltRank: { type: String, required: true },
  coachName: { type: String, default: '' },
  aadharLastFour: { type: String, default: '' },
  phone: { type: String, index: true },
  email: { type: String, index: true },
  photoUrl: { type: String, required: true },
  photoBase64: { type: String },
  pdfUrl: { type: String, default: '' },
  photoPublicId: { type: String, default: '' },
  pdfPublicId: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

const matchSchema = new Schema<Match>({
  _id: { type: String, required: true },
  ageCategory: { type: String, default: '' },
  weightCategory: { type: String, required: true },
  gender: { type: String, required: true },
  round: { type: String, required: true },
  player1Id: { type: String, default: 'pending_winner' },
  player2Id: { type: String, default: 'pending_winner' },
  player1Name: { type: String, default: 'TBD' },
  player2Name: { type: String, default: 'TBD' },
  winnerId: { type: String, default: null },
  score: {
    player1: { type: Number, default: 0 },
    player2: { type: Number, default: 0 }
  },
  status: { type: String, enum: ['pending', 'upcoming', 'live', 'completed'], default: 'upcoming' },
  updatedBy: { type: String, default: 'Admin' },
  updatedAt: { type: String, default: () => new Date().toISOString() },
  matchIndex: { type: Number, default: null },
  nextMatchId: { type: String, default: null },
  nextMatchPlayerSlot: { type: String, default: null },
  eventId: { type: String, default: null }
}, { _id: false });

const galleryImageSchema = new Schema<GalleryImage>({
  _id: { type: String, required: true },
  imageUrl: { type: String, required: true },
  caption: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

const engagementLogSchema = new Schema<EngagementLog>({
  _id: { type: String, required: true },
  userId: { type: String, default: null },
  action: { type: String, required: true },
  page: { type: String, required: true },
  userAgent: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

const healthLogSchema = new Schema<HealthLog>({
  _id: { type: String, required: true },
  status: { type: String, enum: ['healthy', 'degraded', 'down'], required: true },
  services: [{
    service: { type: String, required: true },
    status: { type: String, enum: ['up', 'down', 'degraded'], required: true },
    message: { type: String, required: true },
    checkedAt: { type: String, required: true }
  }],
  checkedAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

const recoveryLogSchema = new Schema<RecoveryLog>({
  _id: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
  service: { type: String, required: true },
  issue: { type: String, required: true },
  action: { type: String, required: true },
  outcome: { type: String, enum: ['resolved', 'failed'], required: true },
  details: { type: String, default: '' }
}, { _id: false });

const eventSchema = new Schema<Event>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  venue: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' },
  eventYear: { type: Number, required: true },
  registrationDeadline: { type: String, default: '' },
  allowedCoachIds: [{ type: String }],
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

const dynamicCategorySchema = new Schema<DynamicCategory>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  minAge: { type: Number, required: true },
  maxAge: { type: Number, required: true },
  maleWeightClasses: [{ type: String }],
  femaleWeightClasses: [{ type: String }],
  eventId: { type: String, default: null, index: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

const coachSchema = new Schema<Coach>({
  _id: { type: String, required: true },
  name: { type: String, required: true, unique: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

const drawSchema = new Schema<Draw>({
  _id: { type: String, required: true },
  eventId: { type: String, required: true },
  category: { type: String, required: true },
  weightCategory: { type: String, required: true },
  gender: { type: String, required: true },
  status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
  finalizedAt: { type: Schema.Types.Mixed, default: null },
  rounds: { type: Schema.Types.Mixed, default: null },
  matches: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

drawSchema.index({ eventId: 1, category: 1, weightCategory: 1, gender: 1 }, { unique: true });

const standingSchema = new Schema<Standing>({
  _id: { type: String, required: true },
  position: { type: String, enum: ['1st', '2nd', '3rd'], required: true },
  playerId: { type: String, required: true, index: true },
  fullName: { type: String, required: true },
  registrationId: { type: String, required: true, index: true },
  eventId: { type: String, required: true },
  weightCategory: { type: String, required: true },
  ageCategory: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  certificateUrl: { type: String, default: '' },
  certificatePublicId: { type: String, default: '' },
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: String, default: null },
  emailError: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

standingSchema.index({ eventId: 1, ageCategory: 1, weightCategory: 1, gender: 1, playerId: 1 }, { unique: true });

// Register Models
export const UserModel = mongoose.models.User || mongoose.model<User>('User', userSchema);
export const RegistrationModel = mongoose.models.Registration || mongoose.model<Registration>('Registration', registrationSchema);
export const MatchModel = mongoose.models.Match || mongoose.model<Match>('Match', matchSchema);
export const GalleryImageModel = mongoose.models.GalleryImage || mongoose.model<GalleryImage>('GalleryImage', galleryImageSchema);
export const EngagementLogModel = mongoose.models.EngagementLog || mongoose.model<EngagementLog>('EngagementLog', engagementLogSchema);
export const EventModel = mongoose.models.Event || mongoose.model<Event>('Event', eventSchema);
export const DynamicCategoryModel = mongoose.models.DynamicCategory || mongoose.model<DynamicCategory>('DynamicCategory', dynamicCategorySchema);
export const HealthLogModel = mongoose.models.HealthLog || mongoose.model<HealthLog>('HealthLog', healthLogSchema);
export const RecoveryLogModel = mongoose.models.RecoveryLog || mongoose.model<RecoveryLog>('RecoveryLog', recoveryLogSchema);
export const DrawModel = mongoose.models.Draw || mongoose.model<Draw>('Draw', drawSchema);
export const StandingModel = mongoose.models.Standing || mongoose.model<Standing>('Standing', standingSchema);
export const CoachModel = mongoose.models.Coach || mongoose.model<Coach>('Coach', coachSchema);

// Resilient Concurrent-Safe In-Memory Failover Engine
const memoryStore = {
  categories: [] as DynamicCategory[],
  events: [] as Event[],
  users: [] as User[],
  registrations: [] as Registration[],
  matches: [] as Match[],
  galleryImages: [] as GalleryImage[],
  engagementLogs: [] as EngagementLog[],
  healthLogs: [] as HealthLog[],
  recoveryLogs: [] as RecoveryLog[],
  draws: [] as Draw[],
  standings: [] as Standing[],
  coaches: [] as Coach[]
};

// Default dynamic categories
const defaultCategories: DynamicCategory[] = [
  {
    _id: "Sub-Junior",
    name: "Sub-Junior",
    minAge: 8,
    maxAge: 11,
    maleWeightClasses: [
      "U-18 kg", "U-21 kg", "U-23 kg", "U-25 kg", "U-27 kg", "U-29 kg", 
      "U-32 kg", "U-35 kg", "U-38 kg", "U-41 kg", "U-44 kg", "U-50 kg"
    ],
    femaleWeightClasses: [
      "U-16 kg", "U-18 kg", "U-20 kg", "U-22 kg", "U-24 kg", "U-26 kg", 
      "U-29 kg", "U-32 kg", "U-35 kg", "U-38 kg", "U-41 kg", "U-47 kg"
    ],
    createdAt: new Date().toISOString()
  },
  {
    _id: "Cadet",
    name: "Cadet",
    minAge: 12,
    maxAge: 14,
    maleWeightClasses: [
      "U-33 kg", "U-37 kg", "U-41 kg", "U-45 kg", "U-49 kg", "U-53 kg", 
      "U-57 kg", "U-61 kg", "U-65 kg", "+65 kg"
    ],
    femaleWeightClasses: [
      "U-29 kg", "U-33 kg", "U-37 kg", "U-41 kg", "U-44 kg", "U-47 kg", 
      "U-51 kg", "U-55 kg", "U-59 kg", "+59 kg"
    ],
    createdAt: new Date().toISOString()
  },
  {
    _id: "Junior",
    name: "Junior",
    minAge: 15,
    maxAge: 16,
    maleWeightClasses: [
      "U-45 kg", "U-48 kg", "U-51 kg", "U-55 kg", "U-59 kg", "U-63 kg", 
      "U-68 kg", "U-73 kg", "U-78 kg", "+78 kg"
    ],
    femaleWeightClasses: [
      "U-42 kg", "U-44 kg", "U-46 kg", "U-49 kg", "U-52 kg", "U-55 kg", 
      "U-59 kg", "U-63 kg", "U-68 kg", "+68 kg"
    ],
    createdAt: new Date().toISOString()
  },
  {
    _id: "Senior",
    name: "Senior",
    minAge: 17,
    maxAge: 32,
    maleWeightClasses: [
      "FIN WEIGHT (-54 Kg)", "FLY WEIGHT (-58 Kg)", "BANTAM WEIGHT (-63 Kg)", 
      "FEATHER WEIGHT (-68 Kg)", "LIGHT WEIGHT (-74 Kg)", "WELTER WEIGHT (-80 Kg)", 
      "MIDDLE WEIGHT (-87 Kg)", "HEAVY WEIGHT (+87 Kg)"
    ],
    femaleWeightClasses: [
      "FIN WEIGHT (-46 Kg)", "FLY WEIGHT (-49 Kg)", "BANTAM WEIGHT (-53 Kg)", 
      "FEATHER WEIGHT (-57 Kg)", "LIGHT WEIGHT (-62 Kg)", "WELTER WEIGHT (-67 Kg)", 
      "MIDDLE WEIGHT (-73 Kg)", "HEAVY WEIGHT (+73 Kg)"
    ],
    createdAt: new Date().toISOString()
  }
];

// Default events
const defaultEvents: Event[] = [
  {
    _id: "evt_autumn2026",
    name: "Autumn National Taekwondo Championship 2026",
    date: "2026-11-12",
    venue: "Indira Gandhi Indoor Stadium, New Delhi",
    description: "The premier national Taekwondo tournament bringing together elite martial artists from across the country.",
    status: "ongoing",
    eventYear: 2026,
    registrationDeadline: "2026-11-10T23:59:00.000Z",
    createdAt: new Date().toISOString()
  },
  {
    _id: "evt_sparring2026",
    name: "National Sparring Grand Prix 2026",
    date: "2026-12-05",
    venue: "Thyagaraj Sports Complex, New Delhi",
    description: "Elite national sparring tournament.",
    status: "upcoming",
    eventYear: 2026,
    registrationDeadline: "2026-12-03T23:59:00.000Z",
    createdAt: new Date().toISOString()
  },
  {
    _id: "evt_league2026",
    name: "Pro Taekwondo League 2026",
    date: "2026-10-20",
    venue: "Kanteerava Indoor Stadium, Bengaluru",
    description: "Professional martial arts league showcasing Olympic-style sparring.",
    status: "completed",
    eventYear: 2026,
    registrationDeadline: "2026-10-18T23:59:00.000Z",
    createdAt: new Date().toISOString()
  }
];

// Default admin and referee accounts (password: adminpassword)
const defaultUsers: User[] = [
  {
    _id: "usr_admin",
    name: "CombatFlow System Admin",
    email: "admin@combatflow.com",
    phone: "9999999999",
    password_hash: "$2b$10$E6FkymYAA80b32VYSijEeu3k6vdCuMOLeaPeSs2lieVryTVokvwjm",
    role: "admin",
    createdAt: new Date().toISOString()
  },
  {
    _id: "usr_admin_tkd",
    name: "Chief Grandmaster Kim",
    email: "admin@tkd.com",
    phone: "+1 (555) 019-2834",
    password_hash: "$2b$10$E6FkymYAA80b32VYSijEeu3k6vdCuMOLeaPeSs2lieVryTVokvwjm",
    role: "admin",
    createdAt: new Date().toISOString()
  },
  {
    _id: "usr_referee",
    name: "Master Referee Lee",
    email: "referee@combatflow.com",
    phone: "+1 (555) 987-6543",
    password_hash: "$2b$10$E6FkymYAA80b32VYSijEeu3k6vdCuMOLeaPeSs2lieVryTVokvwjm",
    role: "referee",
    createdAt: new Date().toISOString()
  },
  {
    _id: "usr_referee_tkd",
    name: "Official Tournament Referee",
    email: "referee@tkd.com",
    phone: "+1 (555) 987-6544",
    password_hash: "$2b$10$E6FkymYAA80b32VYSijEeu3k6vdCuMOLeaPeSs2lieVryTVokvwjm",
    role: "referee",
    createdAt: new Date().toISOString()
  }
];

const defaultCoaches: Coach[] = [
  { _id: "coa_govind", name: "Govind M", createdAt: new Date().toISOString() },
  { _id: "coa_krishna", name: "R Krishnamurthy", createdAt: new Date().toISOString() },
  { _id: "coa_satish", name: "Satish R", createdAt: new Date().toISOString() }
];

// Initialize in-memory store
function initializeStore() {
  memoryStore.categories = [...defaultCategories];
  memoryStore.events = [...defaultEvents];
  memoryStore.users = [...defaultUsers];
  memoryStore.coaches = [...defaultCoaches];
  console.log(`[Database Engine] In-Memory Store Initialized: ${memoryStore.users.length} default users, ${memoryStore.categories.length} categories, ${memoryStore.events.length} default events.`);
}

initializeStore();

// In-Memory store helper (No disk file write)
export function persistMemoryStore(_immediate = false) {
  // Pure in-memory operations - zero file disk access
}

// Full-featured filter engine supporting MongoDB operators ($in, $nin, $or, $and, $gt, $gte, $lt, $lte, $ne, $exists, $regex)
function matchesFilter(item: any, filter?: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  if (Array.isArray(filter.$or)) {
    return filter.$or.some((sub: any) => matchesFilter(item, sub));
  }
  if (Array.isArray(filter.$and)) {
    return filter.$and.every((sub: any) => matchesFilter(item, sub));
  }
  if (Array.isArray(filter.$nor)) {
    return !filter.$nor.some((sub: any) => matchesFilter(item, sub));
  }

  return Object.keys(filter).every(key => {
    if (key === '$or' || key === '$and' || key === '$nor') return true;
    const filterVal = filter[key];
    if (filterVal === undefined) return true;

    const itemVal = item[key];

    // If query value is an operator object
    if (filterVal && typeof filterVal === 'object' && !Array.isArray(filterVal) && !(filterVal instanceof RegExp) && !(filterVal instanceof Date)) {
      return Object.keys(filterVal).every(op => {
        const target = filterVal[op];
        if (op === '$in') {
          return Array.isArray(target) && target.some(t => String(t) === String(itemVal));
        }
        if (op === '$nin') {
          return Array.isArray(target) && !target.some(t => String(t) === String(itemVal));
        }
        if (op === '$ne') {
          return String(itemVal) !== String(target);
        }
        if (op === '$gt') {
          return itemVal > target;
        }
        if (op === '$gte') {
          return itemVal >= target;
        }
        if (op === '$lt') {
          return itemVal < target;
        }
        if (op === '$lte') {
          return itemVal <= target;
        }
        if (op === '$exists') {
          return target ? itemVal !== undefined : itemVal === undefined;
        }
        if (op === '$regex') {
          const reg = new RegExp(target, filterVal.$options || '');
          return reg.test(String(itemVal || ''));
        }
        return true;
      });
    }

    if (filterVal instanceof RegExp) {
      return filterVal.test(String(itemVal || ''));
    }

    if (filterVal === null) {
      return itemVal === null || itemVal === undefined;
    }

    return String(itemVal) === String(filterVal);
  });
}

// Connect to MongoDB Atlas if URI is provided
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, { dbName: 'taekwondo_db', serverSelectionTimeoutMS: 5000 })
    .then(async () => {
      const activeDbName = mongoose.connection.db?.databaseName || 'taekwondo_db';
      console.log(`=== Connected to MongoDB Atlas Successfully. Active Database: "${activeDbName}" ===`);
      await syncDataToMongo();
    })
    .catch(err => {
      console.warn('=== Notice: MongoDB Atlas Connection Failed. Operating on in-memory store ===', err);
    });
} else {
  console.log('=== Running with In-Memory Storage Engine & Mongoose Schema Validation ===');
}

async function syncDataToMongo() {
  try {
    const dbConnection = mongoose.connection;
    const dbName = dbConnection.db?.databaseName;

    // If the database is "taekwondo_db" and already has users, DO NOT sync/overwrite!
    if (dbName === 'taekwondo_db') {
      const existingUserCount = await UserModel.countDocuments();
      if (existingUserCount > 0) {
        console.log('[Mongo Sync] Detected existing production data inside "taekwondo_db". Skipping initial default sync to preserve live records.');
        return;
      }
    }

    console.log('[Mongo Migration] Initiating initial data seed synchronization to MongoDB Atlas...');

    // 1. Sync Users
    if (memoryStore.users.length > 0) {
      console.log(`[Mongo Migration] Checking & syncing ${memoryStore.users.length} users to MongoDB Atlas...`);
      for (const u of memoryStore.users) {
        await UserModel.updateOne({ _id: u._id }, { $set: u }, { upsert: true });
      }
    }

    // 2. Sync Categories
    if (memoryStore.categories.length > 0) {
      console.log(`[Mongo Migration] Checking & syncing ${memoryStore.categories.length} categories to MongoDB Atlas...`);
      for (const c of memoryStore.categories) {
        await DynamicCategoryModel.updateOne({ _id: c._id }, { $set: c }, { upsert: true });
      }
    }

    // 3. Sync Events
    if (memoryStore.events.length > 0) {
      console.log(`[Mongo Migration] Checking & syncing ${memoryStore.events.length} events to MongoDB Atlas...`);
      for (const e of memoryStore.events) {
        await EventModel.updateOne({ _id: e._id }, { $set: e }, { upsert: true });
      }
    }

    // 4. Sync Registrations
    if (memoryStore.registrations.length > 0) {
      console.log(`[Mongo Migration] Checking & syncing ${memoryStore.registrations.length} registrations to MongoDB Atlas...`);
      for (const r of memoryStore.registrations) {
        await RegistrationModel.updateOne({ _id: r._id }, { $set: r }, { upsert: true });
      }
    }

    // 5. Sync Matches
    if (memoryStore.matches.length > 0) {
      console.log(`[Mongo Migration] Checking & syncing ${memoryStore.matches.length} matches to MongoDB Atlas...`);
      for (const m of memoryStore.matches) {
        await MatchModel.updateOne({ _id: m._id }, { $set: m }, { upsert: true });
      }
    }

    // 6. Sync Gallery Images
    if (memoryStore.galleryImages.length > 0) {
      console.log(`[Mongo Migration] Checking & syncing ${memoryStore.galleryImages.length} gallery images...`);
      for (const g of memoryStore.galleryImages) {
        await GalleryImageModel.updateOne({ _id: g._id }, { $set: g }, { upsert: true });
      }
    }

    // 7. Sync Draws
    if (memoryStore.draws.length > 0) {
      console.log(`[Mongo Migration] Checking & syncing ${memoryStore.draws.length} draws to MongoDB Atlas...`);
      for (const d of memoryStore.draws) {
        await DrawModel.updateOne({ _id: d._id }, { $set: d }, { upsert: true });
      }
    }

    // 8. Sync Coaches
    if (memoryStore.coaches.length > 0) {
      console.log(`[Mongo Migration] Checking & syncing ${memoryStore.coaches.length} coaches to MongoDB Atlas...`);
      for (const c of memoryStore.coaches) {
        await CoachModel.updateOne({ _id: c._id }, { $set: c }, { upsert: true });
      }
    }

    console.log('=== MongoDB Atlas Data Migration & Sync Complete ===');
  } catch (err) {
    console.warn('[Mongo Sync Error] Critical error during MongoDB Atlas synchronization:', err);
  }
}

// Mongoose Database Adapter Class
class MongooseDatabase {
  public get useMongoose() {
    return !!(process.env.MONGODB_URI && mongoose.connection.readyState === 1);
  }

  get categories() {
    return {
      find: async (filter?: Partial<DynamicCategory>) => {
        if (this.useMongoose) {
          try {
            return await DynamicCategoryModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.categories.filter(item => matchesFilter(item, filter));
      },
      findOne: async (filter: Partial<DynamicCategory>) => {
        if (this.useMongoose) {
          try {
            return await DynamicCategoryModel.findOne(filter).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.categories.find(item => matchesFilter(item, filter)) || null;
      },
      create: async (cat: Omit<DynamicCategory, 'createdAt'>) => {
        if (this.useMongoose) {
          try {
            const doc = await DynamicCategoryModel.create({
              ...cat,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.categories.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item = { ...cat, createdAt: new Date().toISOString() };
        memoryStore.categories.push(item);
        persistMemoryStore();
        return item;
      },
      update: async (id: string, updates: Partial<Omit<DynamicCategory, '_id'>>) => {
        if (this.useMongoose) {
          try {
            const doc = await DynamicCategoryModel.findOneAndUpdate(
              { _id: id },
              { $set: updates },
              { new: true }
            );
            if (doc) {
              const obj = doc.toObject();
              const memIdx = memoryStore.categories.findIndex(x => x._id === id);
              if (memIdx !== -1) memoryStore.categories[memIdx] = obj;
              persistMemoryStore();
              return obj;
            }
          } catch (err) {
            console.warn('[Database Fallback] Update failed, writing to memory store');
          }
        }
        const item = memoryStore.categories.find(x => x._id === id);
        if (item) {
          Object.assign(item, updates);
          persistMemoryStore();
        }
        return item || null;
      },
      delete: async (id: string) => {
        if (this.useMongoose) {
          try {
            await DynamicCategoryModel.deleteOne({ _id: id });
          } catch (err) {
            console.warn('[Database Fallback] Delete failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.categories.length;
        memoryStore.categories = memoryStore.categories.filter(x => x._id !== id);
        persistMemoryStore();
        return memoryStore.categories.length < initialLen;
      }
    };
  }

  get events() {
    return {
      find: async (filter?: Partial<Event>) => {
        if (this.useMongoose) {
          try {
            return await EventModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.events.filter(item => matchesFilter(item, filter));
      },
      findOne: async (filter: Partial<Event>) => {
        if (this.useMongoose) {
          try {
            return await EventModel.findOne(filter).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.events.find(item => matchesFilter(item, filter)) || null;
      },
      create: async (evt: Omit<Event, '_id' | 'createdAt'> & { _id?: string }) => {
        const _id = evt._id || 'evt_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await EventModel.create({
              ...evt,
              _id,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.events.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item = { ...evt, _id, createdAt: new Date().toISOString() };
        memoryStore.events.push(item);
        persistMemoryStore();
        return item;
      },
      update: async (id: string, updates: Partial<Omit<Event, '_id'>>) => {
        if (this.useMongoose) {
          try {
            const doc = await EventModel.findOneAndUpdate(
              { _id: id },
              { $set: updates },
              { new: true }
            );
            if (doc) {
              const obj = doc.toObject();
              const memIdx = memoryStore.events.findIndex(x => x._id === id);
              if (memIdx !== -1) memoryStore.events[memIdx] = obj;
              persistMemoryStore();
              return obj;
            }
          } catch (err) {
            console.warn('[Database Fallback] Update failed, writing to memory store');
          }
        }
        const item = memoryStore.events.find(x => x._id === id);
        if (item) {
          Object.assign(item, updates);
          persistMemoryStore();
        }
        return item || null;
      },
      delete: async (id: string) => {
        if (this.useMongoose) {
          try {
            await EventModel.deleteOne({ _id: id });
          } catch (err) {
            console.warn('[Database Fallback] Delete failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.events.length;
        memoryStore.events = memoryStore.events.filter(x => x._id !== id);
        persistMemoryStore();
        return memoryStore.events.length < initialLen;
      }
    };
  }

  get users() {
    return {
      find: async (filter?: Partial<User>) => {
        if (this.useMongoose) {
          try {
            return await UserModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.users.filter(item => matchesFilter(item, filter));
      },
      findOne: async (filter: Partial<User>) => {
        if (this.useMongoose) {
          try {
            return await UserModel.findOne(filter).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.users.find(item => matchesFilter(item, filter)) || null;
      },
      create: async (user: Omit<User, '_id' | 'createdAt'>) => {
        const _id = 'usr_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await UserModel.create({
              ...user,
              _id,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.users.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item = { ...user, _id, createdAt: new Date().toISOString() };
        memoryStore.users.push(item);
        persistMemoryStore();
        return item;
      },
      update: async (id: string, updates: Partial<Omit<User, '_id'>>) => {
        if (this.useMongoose) {
          try {
            const doc = await UserModel.findOneAndUpdate(
              { _id: id },
              { $set: updates },
              { new: true }
            );
            if (doc) {
              const obj = doc.toObject();
              const memIdx = memoryStore.users.findIndex(x => x._id === id);
              if (memIdx !== -1) memoryStore.users[memIdx] = obj;
              persistMemoryStore();
              return obj;
            }
          } catch (err) {
            console.warn('[Database Fallback] Update failed, writing to memory store');
          }
        }
        const item = memoryStore.users.find(x => x._id === id);
        if (item) {
          Object.assign(item, updates);
          persistMemoryStore();
        }
        return item || null;
      },
      delete: async (id: string) => {
        if (this.useMongoose) {
          try {
            await UserModel.deleteOne({ _id: id });
          } catch (err) {
            console.warn('[Database Fallback] Delete failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.users.length;
        memoryStore.users = memoryStore.users.filter(x => x._id !== id);
        persistMemoryStore();
        return memoryStore.users.length < initialLen;
      }
    };
  }

  get registrations() {
    return {
      find: async (filter?: any) => {
        if (this.useMongoose) {
          try {
            return await RegistrationModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.registrations.filter(item => matchesFilter(item, filter));
      },
      findOne: async (filter: any) => {
        if (this.useMongoose) {
          try {
            return await RegistrationModel.findOne(filter).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.registrations.find(item => matchesFilter(item, filter)) || null;
      },
      create: async (reg: Omit<Registration, 'createdAt'> & { _id?: string }) => {
        const _id = reg._id || 'reg_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await RegistrationModel.create({
              ...reg,
              _id,
              regId: _id,
              photoBase64: reg.photoBase64 || reg.photoUrl,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.registrations.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item: Registration = {
          ...reg,
          _id,
          regId: _id,
          photoBase64: reg.photoBase64 || reg.photoUrl,
          createdAt: new Date().toISOString()
        };
        memoryStore.registrations.push(item);
        persistMemoryStore();
        return item;
      },
      update: async (id: string, updates: Partial<Omit<Registration, '_id'>>) => {
        if (this.useMongoose) {
          try {
            const doc = await RegistrationModel.findOneAndUpdate(
              { _id: id },
              { $set: updates },
              { new: true }
            );
            if (doc) {
              const obj = doc.toObject();
              const memIdx = memoryStore.registrations.findIndex(x => x._id === id);
              if (memIdx !== -1) memoryStore.registrations[memIdx] = obj;
              persistMemoryStore();
              return obj;
            }
          } catch (err) {
            console.warn('[Database Fallback] Update failed, writing to memory store');
          }
        }
        const item = memoryStore.registrations.find(x => x._id === id);
        if (item) {
          Object.assign(item, updates);
          persistMemoryStore();
        }
        return item || null;
      },
      delete: async (id: string) => {
        if (this.useMongoose) {
          try {
            await RegistrationModel.deleteMany({ $or: [{ _id: id }, { regId: id }] });
          } catch (err) {
            console.warn('[Database Fallback] Delete failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.registrations.length;
        memoryStore.registrations = memoryStore.registrations.filter(x => x._id !== id && x.regId !== id);
        persistMemoryStore();
        return memoryStore.registrations.length < initialLen;
      },
      deleteMany: async (filter: any) => {
        if (this.useMongoose) {
          try {
            const res = await RegistrationModel.deleteMany(filter);
            memoryStore.registrations = memoryStore.registrations.filter(x => !matchesFilter(x, filter));
            persistMemoryStore();
            return res;
          } catch (err) {
            console.warn('[Database Fallback] DeleteMany failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.registrations.length;
        memoryStore.registrations = memoryStore.registrations.filter(x => !matchesFilter(x, filter));
        persistMemoryStore();
        return { deletedCount: initialLen - memoryStore.registrations.length };
      }
    };
  }

  get matches() {
    return {
      find: async (filter?: any) => {
        if (this.useMongoose) {
          try {
            return await MatchModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.matches.filter(item => matchesFilter(item, filter));
      },
      findOne: async (filter: any) => {
        if (this.useMongoose) {
          try {
            return await MatchModel.findOne(filter).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.matches.find(item => matchesFilter(item, filter)) || null;
      },
      create: async (match: Omit<Match, '_id' | 'updatedAt'> & { _id?: string }) => {
        const _id = match._id || 'mat_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await MatchModel.create({
              ...match,
              _id,
              updatedAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.matches.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item: Match = { ...match, _id, updatedAt: new Date().toISOString() };
        memoryStore.matches.push(item);
        persistMemoryStore();
        return item;
      },
      update: async (id: string, updates: Partial<Omit<Match, '_id'>>) => {
        if (this.useMongoose) {
          try {
            const doc = await MatchModel.findOneAndUpdate(
              { _id: id },
              { $set: updates, updatedAt: new Date().toISOString() },
              { new: true }
            );
            if (doc) {
              const obj = doc.toObject();
              const memIdx = memoryStore.matches.findIndex(x => x._id === id);
              if (memIdx !== -1) memoryStore.matches[memIdx] = obj;
              persistMemoryStore();
              return obj;
            }
          } catch (err) {
            console.warn('[Database Fallback] Update failed, writing to memory store');
          }
        }
        const item = memoryStore.matches.find(x => x._id === id);
        if (item) {
          Object.assign(item, { ...updates, updatedAt: new Date().toISOString() });
          persistMemoryStore();
        }
        return item || null;
      },
      clear: async () => {
        if (this.useMongoose) {
          try {
            await MatchModel.deleteMany({});
          } catch (err) {
            console.warn('[Database Fallback] Clear failed, using memory store');
          }
        }
        memoryStore.matches = [];
        persistMemoryStore();
      },
      delete: async (id: string) => {
        if (this.useMongoose) {
          try {
            await MatchModel.deleteOne({ _id: id });
          } catch (err) {
            console.warn('[Database Fallback] Delete failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.matches.length;
        memoryStore.matches = memoryStore.matches.filter(x => x._id !== id);
        persistMemoryStore();
        return memoryStore.matches.length < initialLen;
      },
      deleteMany: async (filter: any) => {
        if (this.useMongoose) {
          try {
            const res = await MatchModel.deleteMany(filter);
            memoryStore.matches = memoryStore.matches.filter(x => !matchesFilter(x, filter));
            persistMemoryStore();
            return res;
          } catch (err) {
            console.warn('[Database Fallback] DeleteMany failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.matches.length;
        memoryStore.matches = memoryStore.matches.filter(x => !matchesFilter(x, filter));
        persistMemoryStore();
        return { deletedCount: initialLen - memoryStore.matches.length };
      }
    };
  }

  get galleryImages() {
    return {
      find: async (filter?: Partial<GalleryImage>) => {
        if (this.useMongoose) {
          try {
            return await GalleryImageModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.galleryImages.filter(item => matchesFilter(item, filter));
      },
      create: async (image: Omit<GalleryImage, '_id' | 'createdAt'>) => {
        const _id = 'gal_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await GalleryImageModel.create({
              ...image,
              _id,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.galleryImages.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item = { ...image, _id, createdAt: new Date().toISOString() };
        memoryStore.galleryImages.push(item);
        persistMemoryStore();
        return item;
      },
      delete: async (id: string) => {
        if (this.useMongoose) {
          try {
            await GalleryImageModel.deleteOne({ _id: id });
          } catch (err) {
            console.warn('[Database Fallback] Delete failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.galleryImages.length;
        memoryStore.galleryImages = memoryStore.galleryImages.filter(x => x._id !== id);
        persistMemoryStore();
        return memoryStore.galleryImages.length < initialLen;
      }
    };
  }

  get engagementLogs() {
    return {
      find: async (filter?: Partial<EngagementLog>) => {
        if (this.useMongoose) {
          try {
            return await EngagementLogModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.engagementLogs.filter(item => matchesFilter(item, filter));
      },
      create: async (log: Omit<EngagementLog, '_id' | 'createdAt'>) => {
        const _id = 'log_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await EngagementLogModel.create({
              ...log,
              _id,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.engagementLogs.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item = { ...log, _id, createdAt: new Date().toISOString() };
        memoryStore.engagementLogs.push(item);
        persistMemoryStore();
        return item;
      }
    };
  }

  get healthLogs() {
    return {
      find: async (filter?: any) => {
        if (this.useMongoose) {
          try {
            return await HealthLogModel.find(filter || {}).sort({ checkedAt: -1 }).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return [...memoryStore.healthLogs]
          .filter(item => matchesFilter(item, filter))
          .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
      },
      create: async (log: Omit<HealthLog, '_id' | 'checkedAt'>) => {
        const _id = 'hl_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await HealthLogModel.create({
              ...log,
              _id,
              checkedAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.healthLogs.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item: HealthLog = { ...log, _id, checkedAt: new Date().toISOString() };
        memoryStore.healthLogs.push(item);
        persistMemoryStore();
        return item;
      },
      deleteMany: async (filter: any) => {
        if (this.useMongoose) {
          try {
            await HealthLogModel.deleteMany(filter);
          } catch (err) {
            console.warn('[Database Fallback] DeleteMany failed, using memory store');
          }
        }
        memoryStore.healthLogs = memoryStore.healthLogs.filter(x => !matchesFilter(x, filter));
        persistMemoryStore();
        return { deletedCount: 1 };
      }
    };
  }

  get recoveryLogs() {
    return {
      find: async (filter?: any) => {
        if (this.useMongoose) {
          try {
            return await RecoveryLogModel.find(filter || {}).sort({ timestamp: -1 }).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return [...memoryStore.recoveryLogs]
          .filter(item => matchesFilter(item, filter))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      },
      create: async (log: Omit<RecoveryLog, '_id' | 'timestamp'>) => {
        const _id = 'rl_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await RecoveryLogModel.create({
              ...log,
              _id,
              timestamp: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.recoveryLogs.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item = { ...log, _id, timestamp: new Date().toISOString() };
        memoryStore.recoveryLogs.push(item);
        persistMemoryStore();
        return item;
      }
    };
  }

  get draws() {
    return {
      find: async (filter?: Partial<Draw>) => {
        if (this.useMongoose) {
          try {
            return await DrawModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.draws.filter(item => matchesFilter(item, filter));
      },
      findOne: async (filter: Partial<Draw>) => {
        if (this.useMongoose) {
          try {
            return await DrawModel.findOne(filter).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.draws.find(item => matchesFilter(item, filter)) || null;
      },
      create: async (draw: Omit<Draw, '_id' | 'createdAt'>) => {
        const _id = 'drw_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await DrawModel.create({
              ...draw,
              _id,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.draws.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item: Draw = { ...draw, _id, createdAt: new Date().toISOString() };
        memoryStore.draws.push(item);
        persistMemoryStore();
        return item;
      },
      update: async (id: string, updates: Partial<Omit<Draw, '_id'>>) => {
        if (this.useMongoose) {
          try {
            const doc = await DrawModel.findOneAndUpdate(
              { _id: id },
              { $set: updates },
              { new: true }
            );
            if (doc) {
              const obj = doc.toObject();
              const memIdx = memoryStore.draws.findIndex(x => x._id === id);
              if (memIdx !== -1) memoryStore.draws[memIdx] = obj;
              persistMemoryStore();
              return obj;
            }
          } catch (err) {
            console.warn('[Database Fallback] Update failed, writing to memory store');
          }
        }
        const item = memoryStore.draws.find(x => x._id === id);
        if (item) {
          Object.assign(item, updates);
          persistMemoryStore();
        }
        return item || null;
      },
      delete: async (id: string) => {
        if (this.useMongoose) {
          try {
            await DrawModel.deleteOne({ _id: id });
          } catch (err) {
            console.warn('[Database Fallback] Delete failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.draws.length;
        memoryStore.draws = memoryStore.draws.filter(x => x._id !== id);
        persistMemoryStore();
        return memoryStore.draws.length < initialLen;
      },
      deleteMany: async (filter: any) => {
        if (this.useMongoose) {
          try {
            const res = await DrawModel.deleteMany(filter);
            memoryStore.draws = memoryStore.draws.filter(x => !matchesFilter(x, filter));
            persistMemoryStore();
            return res;
          } catch (err) {
            console.warn('[Database Fallback] DeleteMany failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.draws.length;
        memoryStore.draws = memoryStore.draws.filter(x => !matchesFilter(x, filter));
        persistMemoryStore();
        return { deletedCount: initialLen - memoryStore.draws.length };
      }
    };
  }

  get standings() {
    return {
      find: async (filter?: Partial<Standing>) => {
        if (this.useMongoose) {
          try {
            return await StandingModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Standing find failed, using memory store');
          }
        }
        return memoryStore.standings.filter(item => matchesFilter(item, filter));
      },
      findOne: async (filter: Partial<Standing>) => {
        if (this.useMongoose) {
          try {
            return await StandingModel.findOne(filter).lean();
          } catch (err) {
            console.warn('[Database Fallback] Standing findOne failed, using memory store');
          }
        }
        return memoryStore.standings.find(item => matchesFilter(item, filter)) || null;
      },
      create: async (standing: Omit<Standing, '_id' | 'createdAt'>) => {
        const _id = 'std_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await StandingModel.create({
              ...standing,
              _id,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.standings.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Standing create failed, writing to memory store');
          }
        }
        const item: Standing = { ...standing, _id, createdAt: new Date().toISOString() };
        memoryStore.standings.push(item);
        persistMemoryStore();
        return item;
      },
      update: async (id: string, updates: Partial<Omit<Standing, '_id'>>) => {
        if (this.useMongoose) {
          try {
            const doc = await StandingModel.findOneAndUpdate(
              { _id: id },
              { $set: updates },
              { new: true }
            );
            if (doc) {
              const obj = doc.toObject();
              const memIdx = memoryStore.standings.findIndex(x => x._id === id);
              if (memIdx !== -1) memoryStore.standings[memIdx] = obj;
              persistMemoryStore();
              return obj;
            }
          } catch (err) {
            console.warn('[Database Fallback] Standing update failed, writing to memory store');
          }
        }
        const item = memoryStore.standings.find(x => x._id === id);
        if (item) {
          Object.assign(item, updates);
          persistMemoryStore();
        }
        return item || null;
      },
      deleteMany: async (filter: any) => {
        if (this.useMongoose) {
          try {
            const res = await StandingModel.deleteMany(filter);
            memoryStore.standings = memoryStore.standings.filter(x => !matchesFilter(x, filter));
            persistMemoryStore();
            return res;
          } catch (err) {
            console.warn('[Database Fallback] Standing deleteMany failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.standings.length;
        memoryStore.standings = memoryStore.standings.filter(x => !matchesFilter(x, filter));
        persistMemoryStore();
        return { deletedCount: initialLen - memoryStore.standings.length };
      }
    };
  }

  get coaches() {
    return {
      find: async (filter?: Partial<Coach>) => {
        if (this.useMongoose) {
          try {
            return await CoachModel.find(filter || {}).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.coaches.filter(item => matchesFilter(item, filter));
      },
      findOne: async (filter: Partial<Coach>) => {
        if (this.useMongoose) {
          try {
            return await CoachModel.findOne(filter).lean();
          } catch (err) {
            console.warn('[Database Fallback] Query failed, using memory store');
          }
        }
        return memoryStore.coaches.find(item => matchesFilter(item, filter)) || null;
      },
      create: async (coach: Omit<Coach, '_id' | 'createdAt'> & { _id?: string }) => {
        const _id = coach._id || 'coa_' + Math.random().toString(36).substring(2, 11);
        if (this.useMongoose) {
          try {
            const doc = await CoachModel.create({
              ...coach,
              _id,
              createdAt: new Date().toISOString()
            });
            const obj = doc.toObject();
            memoryStore.coaches.push(obj);
            persistMemoryStore();
            return obj;
          } catch (err) {
            console.warn('[Database Fallback] Create failed, writing to memory store');
          }
        }
        const item = { ...coach, _id, createdAt: new Date().toISOString() };
        memoryStore.coaches.push(item);
        persistMemoryStore();
        return item;
      },
      update: async (id: string, updates: Partial<Omit<Coach, '_id'>>) => {
        if (this.useMongoose) {
          try {
            const doc = await CoachModel.findOneAndUpdate(
              { _id: id },
              { $set: updates },
              { new: true }
            );
            if (doc) {
              const obj = doc.toObject();
              const memIdx = memoryStore.coaches.findIndex(x => x._id === id);
              if (memIdx !== -1) memoryStore.coaches[memIdx] = obj;
              persistMemoryStore();
              return obj;
            }
          } catch (err) {
            console.warn('[Database Fallback] Update failed, writing to memory store');
          }
        }
        const item = memoryStore.coaches.find(x => x._id === id);
        if (item) {
          Object.assign(item, updates);
          persistMemoryStore();
        }
        return item || null;
      },
      delete: async (id: string) => {
        if (this.useMongoose) {
          try {
            await CoachModel.deleteOne({ _id: id });
          } catch (err) {
            console.warn('[Database Fallback] Delete failed, writing to memory store');
          }
        }
        const initialLen = memoryStore.coaches.length;
        memoryStore.coaches = memoryStore.coaches.filter(x => x._id !== id);
        persistMemoryStore();
        return memoryStore.coaches.length < initialLen;
      }
    };
  }
}

export const db = new MongooseDatabase();
