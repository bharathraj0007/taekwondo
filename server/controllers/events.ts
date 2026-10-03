import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateJWT, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/events - List all events
router.get('/', async (req, res) => {
  try {
    const list = await db.events.find();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve events' });
  }
});

// POST /api/events - Create new event (Admin)
router.post('/', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, date, venue, status, eventYear, registrationDeadline, allowedCoachIds, copyCategoriesFromEventId } = req.body;
    if (!name || !date || !venue || !status || !eventYear) {
      res.status(400).json({ error: 'All fields are required (name, date, venue, status, eventYear).' });
      return;
    }
    const newEvent = await db.events.create({
      name,
      date,
      venue,
      status,
      eventYear: parseInt(eventYear, 10) || 2026,
      registrationDeadline: registrationDeadline || '',
      allowedCoachIds: Array.isArray(allowedCoachIds) ? allowedCoachIds : undefined
    });

    // Automatically clone independent categories for this new event from template/source event
    try {
      const allCategories = await db.categories.find();
      let sourceCategories = copyCategoriesFromEventId ? allCategories.filter(c => c.eventId === copyCategoriesFromEventId) : [];
      if (sourceCategories.length === 0) {
        sourceCategories = allCategories.filter(c => !c.eventId);
      }
      for (const sc of sourceCategories) {
        await db.categories.create({
          _id: `${newEvent._id}_${sc.name.trim().replace(/\s+/g, '-')}_${Math.random().toString(36).substring(2, 6)}`,
          name: sc.name,
          minAge: sc.minAge,
          maxAge: sc.maxAge,
          maleWeightClasses: [...sc.maleWeightClasses],
          femaleWeightClasses: [...sc.femaleWeightClasses],
          eventId: newEvent._id
        });
      }
    } catch (catCloneErr) {
      console.warn('Notice: Failed to clone initial categories for new event:', catCloneErr);
    }

    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

// PUT /api/events/:id - Update event (Admin)
router.put('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, date, venue, status, eventYear, registrationDeadline, allowedCoachIds } = req.body;
    
    const existing = await db.events.findOne({ _id: id });
    if (!existing) {
      res.status(404).json({ error: 'Event not found.' });
      return;
    }

    const updated = await db.events.update(id, {
      name: name ?? existing.name,
      date: date ?? existing.date,
      venue: venue ?? existing.venue,
      status: status ?? existing.status,
      eventYear: eventYear !== undefined ? parseInt(eventYear, 10) : existing.eventYear,
      registrationDeadline: registrationDeadline !== undefined ? registrationDeadline : existing.registrationDeadline,
      allowedCoachIds: allowedCoachIds !== undefined ? allowedCoachIds : existing.allowedCoachIds
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event.' });
  }
});

// DELETE /api/events/:id - Delete event (Admin)
import multer from 'multer';
import path from 'path';
import { calculateAgeOnEvent, getAgeCategory, CATEGORY_STRUCTURE } from '../utils/categories';
import { uploadToCloudinary } from '../utils/cloudinary';
import { generateCoachPrefix, getCoachSequenceNumber, generateRegistrationPdfBuffer } from './registration';
import { isWeightCategoryMatch, resolveAgeCategory } from '../utils/drawEngine';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    if (extName && mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed.'));
    }
  }
});

// POST /api/events/:eventId/register - Register a player for a specific event
router.post('/:eventId/register', authenticateJWT as any, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error processing photo file.' });
    }
    next();
  });
}, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const { fullName, dob, gender, weightCategory, beltRank, coachName, aadharLastFour } = req.body;

    if (!fullName || !dob || !gender || !weightCategory || !beltRank || !coachName || !aadharLastFour) {
      res.status(400).json({ error: 'All fields are required.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Competitor photo file upload is required.' });
      return;
    }

    if (!/^\d{4}$/.test(aadharLastFour)) {
      res.status(400).json({ error: 'Aadhar must be exactly 4 numeric digits.' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify event exists
    const event = await db.events.findOne({ _id: eventId });
    if (!event) {
      res.status(404).json({ error: 'Target event not found.' });
      return;
    }

    // Check registration deadline
    if (event.registrationDeadline) {
      const deadline = new Date(event.registrationDeadline);
      if (new Date() > deadline) {
        res.status(403).json({
          error: `Registration closed for this event as of ${new Date(event.registrationDeadline).toLocaleString()}`
        });
        return;
      }
    }

    // Enforce one registration per player per event
    const existingReg = await db.registrations.findOne({ userId: req.user._id, eventId });
    if (existingReg) {
      res.status(400).json({ error: 'You are already registered for this event.' });
      return;
    }

    // Calculate age and category
    const age = calculateAgeOnEvent(dob);
    const birthYear = new Date(dob).getFullYear();
    let preferredDivision: string | undefined = undefined;
    
    if (birthYear === 2009) {
      const juniorClasses = CATEGORY_STRUCTURE["Junior"]?.[gender] || {};
      const seniorClasses = CATEGORY_STRUCTURE["Senior"]?.[gender] || {};
      if (weightCategory in juniorClasses) {
        preferredDivision = "Junior";
      } else if (weightCategory in seniorClasses) {
        preferredDivision = "Senior";
      }
    }

    const ageCategory = getAgeCategory(dob, preferredDivision);
    if (!ageCategory) {
      res.status(400).json({ error: `Competitor age (${age} years) is outside the valid range of 8 to 32 years.` });
      return;
    }

    // Validate email & phone duplicate across registrations for same event
    const athleteEmail = req.user.email || '';
    if (athleteEmail) {
      const dupEmail = await db.registrations.findOne({ email: athleteEmail, eventId });
      if (dupEmail && dupEmail.userId !== req.user._id) {
        res.status(400).json({ error: `An athlete registration with email ${athleteEmail} already exists for this event.` });
        return;
      }
    }

    // Fetch registrations to determine unique bracket ID sequences
    const allRegistrations = await db.registrations.find();
    const coachPrefix = generateCoachPrefix(coachName, allRegistrations);
    const sequenceNum = getCoachSequenceNumber(coachName, allRegistrations);
    const zeroPaddedSeq = String(sequenceNum).padStart(3, '0');
    
    const regId = `${coachPrefix}_${zeroPaddedSeq}`;

    // 1. Upload photo to Cloudinary
    let photoUrl = '';
    let photoPublicId = '';
    try {
      const uploadRes = await uploadToCloudinary(
        req.file.buffer,
        `players/${regId}`,
        `photo_${regId}`,
        'image'
      );
      photoUrl = uploadRes.secure_url;
      photoPublicId = uploadRes.public_id;
    } catch (cErr: any) {
      console.error('Failed to upload player photo to Cloudinary:', cErr);
      res.status(500).json({ error: 'Failed to upload player photo to cloud storage.' });
      return;
    }

    // 2. Generate PDF slip buffer and upload to Cloudinary
    let pdfUrl = '';
    let pdfPublicId = '';
    try {
      const mockRegTemp = {
        fullName,
        dob,
        gender,
        ageCategory,
        weightCategory,
        beltRank,
        coachName,
        aadharLastFour,
        email: req.user.email || ''
      };
      const pdfBuffer = await generateRegistrationPdfBuffer(regId, mockRegTemp, req.file.buffer);
      const pdfUploadRes = await uploadToCloudinary(
        pdfBuffer,
        `slips/${regId}`,
        `pdf_${regId}`,
        'raw'
      );
      pdfUrl = pdfUploadRes.secure_url;
      pdfPublicId = pdfUploadRes.public_id;
    } catch (pdfErr: any) {
      console.error('Failed to generate/upload registration PDF to Cloudinary:', pdfErr);
    }

    // 3. Save Registration
    const registration = await db.registrations.create({
      _id: regId,
      regId,
      userId: req.user._id,
      eventId,
      fullName,
      dob,
      gender,
      ageCategory,
      weightCategory,
      beltRank,
      coachName,
      aadharLastFour,
      phone: req.user.phone || '',
      email: req.user.email || '',
      photoUrl,
      photoPublicId,
      pdfUrl,
      pdfPublicId,
      status: 'approved',
    });

    // Log engagement metric
    await db.engagementLogs.create({
      userId: req.user._id,
      action: 'registration_submit',
      page: `/events/${eventId}/register`,
      userAgent: req.headers['user-agent'] || 'Unknown'
    });

    res.status(201).json({
      message: 'Registration successful!',
      registration,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'You are already registered for this event.' });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during competitor registration' });
  }
});

router.delete('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await db.events.delete(id);
    if (!success) {
      res.status(404).json({ error: 'Event not found.' });
      return;
    }
    res.json({ message: 'Event successfully deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event.' });
  }
});

// GET /api/events/:eventId/draw/:category - Player-facing, read-only draw view (returns only if finalized)
router.get('/:eventId/draw/:category', async (req, res) => {
  try {
    const { eventId, category } = req.params;
    const { weightCategory, gender, preview } = req.query;

    console.log(`[API DRAW REQUEST] Event: "${eventId}", Division: "${category}", Weight: "${weightCategory}", Gender: "${gender}", Preview: "${preview || 'false'}"`);

    if (!weightCategory || !gender) {
      console.warn('[API DRAW WARNING] Missing weightCategory or gender query parameters.');
      res.status(400).json({ error: 'Weight category and gender are required query parameters.' });
      return;
    }

    const normWeight = String(weightCategory).trim();
    const normGender = String(gender).trim().toLowerCase();
    const normCategory = String(category).trim().toLowerCase();

    // Look for draws matching this event, category, gender and weight
    const allDraws = await db.draws.find({ eventId });
    const matchingDraws = allDraws.filter((d: any) => {
      if ((d.gender || '').toLowerCase() !== normGender) return false;
      if ((d.category || '').toLowerCase() !== normCategory) return false;
      return isWeightCategoryMatch(d.weightCategory || '', normWeight);
    });

    const finalizedDraw = matchingDraws.find((d: any) => d.status === 'finalized');
    const draftDraw = matchingDraws.find((d: any) => d.status === 'draft');
    const draw = finalizedDraw || draftDraw || null;

    // Fetch corresponding matches for this division and event
    const allMatches = await db.matches.find({});
    const matches = allMatches.filter((m: any) => {
      const matchGender = (m.gender || '').toLowerCase();
      if (matchGender !== normGender) return false;

      const matchEventId = m.eventId || 'evt_autumn2026';
      if (matchEventId !== eventId) return false;

      const matchCategory = (m.ageCategory || 'Senior').toLowerCase();
      if (matchCategory !== normCategory) return false;

      return isWeightCategoryMatch(m.weightCategory || '', normWeight);
    });

    if (!finalizedDraw) {
      console.log(`[API DRAW RESPONSE] No finalized draw found for Event: "${eventId}", Division: "${category}", Weight: "${normWeight}". Found ${matches.length} draft matches.`);
      
      // If preview mode is requested or if draft exists, return draft status along with matches for preview/admin verification
      res.json({
        status: 'draft',
        message: 'Draw not published yet',
        draw: draftDraw || null,
        matches: (preview === 'true' || Boolean(draftDraw)) ? matches : []
      });
      return;
    }

    console.log(`[API DRAW RESPONSE] Successfully retrieved finalized draw sheet "${finalizedDraw._id}" with ${matches.length} matches.`);

    res.json({
      status: 'finalized',
      draw: finalizedDraw,
      matches
    });
  } catch (error: any) {
    console.error('Error fetching player-facing draw:', error);
    res.status(500).json({ error: 'Server error retrieving tournament draw bracket' });
  }
});

export default router;
