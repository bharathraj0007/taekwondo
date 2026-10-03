import { Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import PDFDocument from 'pdfkit';
import { db } from '../db';
import { authenticateJWT, AuthenticatedRequest, requireAdmin } from '../middleware/auth';
import { calculateAgeOnEvent, determineAgeCategory, getAgeCategory, CATEGORY_STRUCTURE } from '../utils/categories';
import { uploadToCloudinary } from '../utils/cloudinary';

const router = Router();

// Configure Multer memory storage
const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
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

/**
 * Calculates initials for a coach's name and handles duplicate initials from different coaches.
 * Returns the final prefix string (e.g. "GM", "GM2", "RKN").
 */
export const generateCoachPrefix = (coachName: string, registrations: any[]): string => {
  const normalizedTarget = (coachName || 'NA').trim().replace(/\s+/g, ' ');
  const words = normalizedTarget.split(' ').filter(Boolean);
  let baseInitials = words.map((w: string) => w[0]?.toUpperCase()).filter(Boolean).join('');
  if (!baseInitials) baseInitials = 'NA';

  // Find unique coach names that produce the same base initials, sorted by their earliest registration
  const coachFirstRegTime: Record<string, number> = {};

  registrations.forEach(r => {
    const rCoach = (r.coachName || r.clubName || 'NA').trim().replace(/\s+/g, ' ');
    const rWords = rCoach.split(' ').filter(Boolean);
    let rBase = rWords.map((w: string) => w[0]?.toUpperCase()).filter(Boolean).join('');
    if (!rBase) rBase = 'NA';

    if (rBase === baseInitials) {
      const time = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      if (coachFirstRegTime[rCoach] === undefined || time < coachFirstRegTime[rCoach]) {
        coachFirstRegTime[rCoach] = time;
      }
    }
  });

  // Include current target coach
  if (coachFirstRegTime[normalizedTarget] === undefined) {
    coachFirstRegTime[normalizedTarget] = Date.now();
  }

  const sortedUniqueCoaches = Object.keys(coachFirstRegTime).sort((a, b) => coachFirstRegTime[a] - coachFirstRegTime[b]);
  const index = sortedUniqueCoaches.indexOf(normalizedTarget);

  if (sortedUniqueCoaches.length > 1) {
    return `${baseInitials}${index + 1}`;
  }
  return baseInitials;
};

/**
 * Calculates the sequential counter of athletes registered under this specific coach.
 */
export const getCoachSequenceNumber = (coachName: string, registrations: any[]): number => {
  const normalizedTarget = (coachName || 'NA').trim().toLowerCase().replace(/\s+/g, ' ');
  const count = registrations.filter(r => {
    const rCoach = (r.coachName || r.clubName || 'NA').trim().toLowerCase().replace(/\s+/g, ' ');
    return rCoach === normalizedTarget;
  }).length;
  return count + 1;
};

/**
 * Compiles a PDFKit stream into a single Buffer in memory.
 */
const generatePdfBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
  });
};

/**
 * Generates official competitor registration slip PDF in memory as a Buffer.
 */
export const generateRegistrationPdfBuffer = async (id: string, reg: any, photoBuffer: Buffer | null): Promise<Buffer> => {
  const doc = new PDFDocument({ 
    size: 'A4',
    margins: { top: 50, left: 50, right: 50, bottom: 50 } 
  });

  // Border
  doc.rect(20, 20, 555, 802).lineWidth(2).strokeColor('#1e293b').stroke();
  doc.rect(25, 25, 545, 792).lineWidth(0.5).strokeColor('#64748b').stroke();

  // Graphic circle
  doc.save();
  doc.translate(297, 70);
  doc.scale(0.8);
  doc.circle(0, 0, 25).fillColor('#e11d48').fill(); // Red
  doc.circle(0, 0, 25).lineWidth(1.5).strokeColor('#2563eb').stroke(); // Blue border
  doc.restore();

  doc.moveDown(4);
  
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#0f172a').text('TAEKWONDO CHAMPIONSHIP', { align: 'center' });
  doc.font('Helvetica').fontSize(12).fillColor('#64748b').text('OFFICIAL COMPETITOR REGISTRATION SLIP', { align: 'center', characterSpacing: 1.5 });
  
  doc.moveDown(2);
  
  // Competitor Profile Table Header
  doc.rect(50, 180, 495, 25).fillColor('#1e293b').fill();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('COMPETITOR PROFILE', 60, 187);

  // Profile Details Grid helper
  const drawGridRow = (label: string, value: string, y: number) => {
    doc.rect(50, y, 130, 22).fillColor('#f1f5f9').fill();
    doc.rect(50, y, 395, 22).strokeColor('#cbd5e1').stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text(label, 60, y + 7);
    doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(value, 190, y + 6);
  };

  drawGridRow('Registration ID', id, 205);
  drawGridRow('Full Name', reg.fullName || '', 227);
  drawGridRow('Date of Birth', reg.dob || '', 249);
  drawGridRow('Gender', (reg.gender || '').toUpperCase(), 271);
  drawGridRow('Age Division', reg.ageCategory || '', 293);
  drawGridRow('Weight Division', reg.weightCategory || '', 315);
  drawGridRow('Belt Grade', reg.beltRank || '', 337);
  drawGridRow('Coach Name', reg.coachName || '', 359);
  drawGridRow('Aadhar (Last 4 Digits)', 'xxxx xxxx ' + (reg.aadharLastFour || '0000'), 381);
  drawGridRow('Registered Athlete Email', reg.email || '', 403);

  // Draw Photo Box frame on the right side
  doc.rect(455, 205, 90, 110).lineWidth(1).strokeColor('#cbd5e1').stroke();
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
  doc.text('ATHLETE PHOTO', 455, 255, { width: 90, align: 'center' });

  // Render the player's real live uploaded profile photo inside the generated PDF
  if (photoBuffer) {
    try {
      doc.image(photoBuffer, 458, 208, { width: 84, height: 104 });
    } catch (imgErr) {
      console.error('Error drawing photo buffer on PDF:', imgErr);
    }
  }

  doc.moveDown(11);

  // Rules & Gear requirements
  doc.rect(50, 430, 495, 22).fillColor('#f8fafc').fill();
  doc.rect(50, 430, 495, 22).strokeColor('#cbd5e1').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('MANDATORY EQUIPMENT & CHECKLIST', 60, 437);

  const checklistY = 460;
  doc.font('Helvetica').fontSize(9).fillColor('#475569');
  doc.text('• Approved headgear matching the corner colour (Red/Blue).', 60, checklistY);
  doc.text('• Full WT-approved Taekwondo Dobok (Uniform) in clean condition.', 60, checklistY + 15);
  doc.text('• Trunk protector (Hogu), groin guard, forearm and shin guards.', 60, checklistY + 30);
  doc.text('• Personal mouthguard (mandatory) and sensory socks (if electronic system is used).', 60, checklistY + 45);
  doc.text('• Valid photo identification (e.g., passport or birth certificate) at weigh-in.', 60, checklistY + 60);

  // Terms and disclaimer
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b');
  doc.text(
    'Liability Disclaimer: By presenting this registration copy at weigh-in, the athlete and their respective head coach/club verify that the competitor is in peak physical condition and possesses valid medical insurance. The organizing committee and hosts are not liable for any injuries or damages sustained during competition.',
    50, 540, { width: 495, align: 'justify' }
  );

  // Signatures
  doc.moveTo(50, 680).lineTo(200, 680).lineWidth(1).strokeColor('#94a3b8').stroke();
  doc.moveTo(345, 680).lineTo(495, 680).lineWidth(1).strokeColor('#94a3b8').stroke();
  
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
  doc.text("Athlete's Signature", 50, 688, { width: 150, align: 'center' });
  doc.text("Head Coach Signature / Stamp", 345, 688, { width: 150, align: 'center' });

  // Footer note
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
  doc.text(`Generated on ${new Date().toLocaleString()} · System powered by CombatFlow`, 50, 770, { align: 'center' });

  doc.end();

  return generatePdfBuffer(doc);
};

// POST /api/registrations - Create registration with Cloudinary Upload
router.post('/', authenticateJWT as any, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error processing photo file.' });
    }
    next();
  });
}, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fullName, dob, gender, weightCategory, beltRank, coachName, aadharLastFour, eventId } = req.body;

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

    // Check registration deadline
    const targetEventId = eventId || 'evt_autumn2026';
    const event = await db.events.findOne({ _id: targetEventId });
    if (event && event.registrationDeadline) {
      const deadline = new Date(event.registrationDeadline);
      if (new Date() > deadline) {
        res.status(403).json({
          error: `Registration closed for this event as of ${new Date(event.registrationDeadline).toLocaleString()}`
        });
        return;
      }
    }

    // Calculate age on event and determine age category
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

    // Check if user already registered
    const existingReg = await db.registrations.findOne({ userId: req.user._id });
    if (existingReg) {
       res.status(400).json({ error: 'You have already registered for this event.' });
       return;
    }

    // Verify email and phone number are not already registered under another account
    const athleteEmail = req.user.email || '';
    const athletePhone = req.user.phone || '';

    if (athleteEmail) {
      const duplicateEmailReg = await db.registrations.findOne({ email: athleteEmail });
      if (duplicateEmailReg && duplicateEmailReg.userId !== req.user._id) {
         res.status(400).json({ error: `An athlete registration with email ${athleteEmail} already exists.` });
         return;
      }
    }

    if (athletePhone) {
      const duplicatePhoneReg = await db.registrations.findOne({ phone: athletePhone });
      if (duplicatePhoneReg && duplicatePhoneReg.userId !== req.user._id) {
         res.status(400).json({ error: `An athlete registration with phone number ${athletePhone} already exists.` });
         return;
      }
    }

    // Fetch all existing registrations to calculate sequence
    const allRegistrations = await db.registrations.find();
    const coachPrefix = generateCoachPrefix(coachName, allRegistrations);
    const sequenceNum = getCoachSequenceNumber(coachName, allRegistrations);
    const zeroPaddedSeq = String(sequenceNum).padStart(3, '0');
    
    // Deterministic ID / RegID
    const regId = `${coachPrefix}_${zeroPaddedSeq}`;

    // 1. Upload player photo directly from memory buffer to Cloudinary
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

    // 2. Generate PDF slip buffer & upload to Cloudinary as raw file
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
        email: req.user!.email || ''
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
      // Fallback: we won't block registration if PDF storage has issues
    }

    // 3. Save registration record in MongoDB via our adaptor
    const registration = await db.registrations.create({
      _id: regId,
      regId,
      userId: req.user!._id,
      eventId: eventId || 'evt_autumn2026',
      fullName,
      dob,
      gender,
      ageCategory,
      weightCategory,
      beltRank,
      coachName,
      aadharLastFour,
      phone: req.user!.phone || '',
      email: req.user!.email || '',
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
      page: '/register',
      userAgent: req.headers['user-agent'] || 'Unknown'
    });

    res.status(201).json({
      message: 'Registration successful!',
      registration,
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during competitor registration' });
  }
});

// GET /api/registrations/download/:id (Secure Dynamic On-The-Fly PDF Generator)
// Support both standard and required :id/download formats
router.get(['/download/:id', '/:id/download'], async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const reg = await db.registrations.findOne({ _id: id });
    if (!reg) {
      res.status(404).json({ error: 'Registration record not found' });
      return;
    }

    // Fetch the competitor's photo from Cloudinary in real-time to render inside the PDF
    let photoBuffer: Buffer | null = null;
    if (reg.photoUrl && reg.photoUrl.startsWith('http')) {
      try {
        const photoRes = await fetch(reg.photoUrl);
        if (photoRes.ok) {
          const ab = await photoRes.arrayBuffer();
          photoBuffer = Buffer.from(ab);
        }
      } catch (photoErr) {
        console.error('Error fetching competitor photo for on-the-fly PDF:', photoErr);
      }
    }

    // Dynamic On-The-Fly Generation
    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 50, left: 50, right: 50, bottom: 50 } 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CombatFlow_Registration_${id}.pdf"`);

    doc.pipe(res);

    // Border
    doc.rect(20, 20, 555, 802).lineWidth(2).strokeColor('#1e293b').stroke();
    doc.rect(25, 25, 545, 792).lineWidth(0.5).strokeColor('#64748b').stroke();

    // Graphic circle
    doc.save();
    doc.translate(297, 70);
    doc.scale(0.8);
    doc.circle(0, 0, 25).fillColor('#e11d48').fill(); // Red
    doc.circle(0, 0, 25).lineWidth(1.5).strokeColor('#2563eb').stroke(); // Blue border
    doc.restore();

    doc.moveDown(4);
    
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#0f172a').text('TAEKWONDO CHAMPIONSHIP', { align: 'center' });
    doc.font('Helvetica').fontSize(12).fillColor('#64748b').text('OFFICIAL COMPETITOR REGISTRATION SLIP', { align: 'center', characterSpacing: 1.5 });
    
    doc.moveDown(2);
    
    // Competitor Profile Table Header
    doc.rect(50, 180, 495, 25).fillColor('#1e293b').fill();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('COMPETITOR PROFILE', 60, 187);

    // Profile Details Grid helper
    const drawGridRow = (label: string, value: string, y: number) => {
      doc.rect(50, y, 130, 22).fillColor('#f1f5f9').fill();
      doc.rect(50, y, 395, 22).strokeColor('#cbd5e1').stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text(label, 60, y + 7);
      doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(value, 190, y + 6);
    };

    drawGridRow('Registration ID', id, 205);
    drawGridRow('Full Name', reg.fullName || '', 227);
    drawGridRow('Date of Birth', reg.dob || '', 249);
    drawGridRow('Gender', (reg.gender || '').toUpperCase(), 271);
    drawGridRow('Age Division', reg.ageCategory || '', 293);
    drawGridRow('Weight Division', reg.weightCategory || '', 315);
    drawGridRow('Belt Grade', reg.beltRank || '', 337);
    drawGridRow('Coach Name', reg.coachName || '', 359);
    drawGridRow('Aadhar (Last 4 Digits)', 'xxxx xxxx ' + (reg.aadharLastFour || '0000'), 381);
    drawGridRow('Registered Athlete Email', reg.email || '', 403);

    // Draw Photo Box frame on the right side
    doc.rect(455, 205, 90, 110).lineWidth(1).strokeColor('#cbd5e1').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
    doc.text('ATHLETE PHOTO', 455, 255, { width: 90, align: 'center' });

    // Render the player's real live uploaded profile photo inside the on-the-fly generated PDF
    if (photoBuffer) {
      try {
        doc.image(photoBuffer, 458, 208, { width: 84, height: 104 });
      } catch (imgErr) {
        console.error('Error drawing photo buffer on dynamic PDF:', imgErr);
      }
    }

    doc.moveDown(11);

    // Rules & Gear requirements
    doc.rect(50, 430, 495, 22).fillColor('#f8fafc').fill();
    doc.rect(50, 430, 495, 22).strokeColor('#cbd5e1').stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('MANDATORY EQUIPMENT & CHECKLIST', 60, 437);

    const checklistY = 460;
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text('• Approved headgear matching the corner colour (Red/Blue).', 60, checklistY);
    doc.text('• Full WT-approved Taekwondo Dobok (Uniform) in clean condition.', 60, checklistY + 15);
    doc.text('• Trunk protector (Hogu), groin guard, forearm and shin guards.', 60, checklistY + 30);
    doc.text('• Personal mouthguard (mandatory) and sensory socks (if electronic system is used).', 60, checklistY + 45);
    doc.text('• Valid photo identification (e.g., passport or birth certificate) at weigh-in.', 60, checklistY + 60);

    // Terms and disclaimer
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b');
    doc.text(
      'Liability Disclaimer: By presenting this registration copy at weigh-in, the athlete and their respective head coach/club verify that the competitor is in peak physical condition and possesses valid medical insurance. The organizing committee and hosts are not liable for any injuries or damages sustained during competition.',
      50, 540, { width: 495, align: 'justify' }
    );

    // Signatures
    doc.moveTo(50, 680).lineTo(200, 680).lineWidth(1).strokeColor('#94a3b8').stroke();
    doc.moveTo(345, 680).lineTo(495, 680).lineWidth(1).strokeColor('#94a3b8').stroke();
    
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
    doc.text("Athlete's Signature", 50, 688, { width: 150, align: 'center' });
    doc.text("Head Coach Signature / Stamp", 345, 688, { width: 150, align: 'center' });

    // Footer note
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
    doc.text(`Generated on ${new Date().toLocaleString()} · System powered by CombatFlow`, 50, 770, { align: 'center' });

    doc.end();
  } catch (error: any) {
    console.error('Error serving download:', error);
    res.status(500).json({ error: 'Server error retrieving registration slip.' });
  }
});

// GET /api/registrations (Admin / User context retrieval)
router.get('/', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
       res.status(401).json({ error: 'Unauthorized' });
       return;
    }

    // Log engagement metric
    await db.engagementLogs.create({
      userId: req.user._id,
      action: 'view_registrations',
      page: req.user.role === 'admin' ? '/admin' : '/dashboard',
      userAgent: req.headers['user-agent'] || 'Unknown'
    });

    if (req.user.role === 'admin') {
      const regs = await db.registrations.find();
      res.json(regs);
    } else {
      const regs = await db.registrations.find({ userId: req.user._id });
      res.json(regs);
    }
  } catch (error: any) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Server error fetching registrations' });
  }
});

// PUT /api/registrations/:id (Admin only - edit registration details)
router.put('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, dob, gender, beltRank, coachName, aadharLastFour, weightCategory, status } = req.body;

    const existing = await db.registrations.findOne({ _id: id });
    if (!existing) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    let ageCategory = existing.ageCategory;
    if (dob) {
      ageCategory = getAgeCategory(dob) || existing.ageCategory;
    }

    const updated = await db.registrations.update(id, {
      fullName: fullName ?? existing.fullName,
      dob: dob ?? existing.dob,
      gender: gender ?? existing.gender,
      beltRank: beltRank ?? existing.beltRank,
      coachName: coachName ?? existing.coachName,
      aadharLastFour: aadharLastFour ?? existing.aadharLastFour,
      weightCategory: weightCategory ?? existing.weightCategory,
      status: status ?? existing.status,
      ageCategory
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating registration:', error);
    res.status(500).json({ error: 'Server error updating registration' });
  }
});

// DELETE /api/registrations/:id (Admin only)
router.delete('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Look up the registration by _id or regId
    const reg = await db.registrations.findOne({
      $or: [{ _id: id }, { regId: id }]
    });

    if (!reg) {
       res.status(404).json({ error: `Registration with ID ${id} not found.` });
       return;
    }

    // Try Cloudinary destroy safely without blocking or throwing unhandled errors
    try {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        const { cloudinary } = await import('../utils/cloudinary');
        const photoPublicId = reg.photoPublicId || `players/${id}/photo_${id}`;
        await cloudinary.uploader.destroy(photoPublicId, { resource_type: 'image' }).catch(() => {});
        const pdfPublicId = reg.pdfPublicId || `slips/${id}/pdf_${id}`;
        await cloudinary.uploader.destroy(pdfPublicId, { resource_type: 'raw' }).catch(() => {});
      }
    } catch (cErr) {
      console.warn('[Admin Delete] Non-fatal Cloudinary cleanup warning:', cErr);
    }

    // Clean up related matches
    if (reg.userId || reg._id) {
      await db.matches.deleteMany({
        $or: [
          { player1Id: reg.userId },
          { player2Id: reg.userId },
          { player1Id: reg._id },
          { player2Id: reg._id },
          { player1Name: reg.fullName },
          { player2Name: reg.fullName }
        ]
      });
    }

    // Delete registration document from database by _id and regId
    await db.registrations.delete(reg._id);
    if (reg.regId && reg.regId !== reg._id) {
      await db.registrations.delete(reg.regId);
    }

    // Write an audit log entry
    await db.engagementLogs.create({
      userId: req.user!._id,
      action: 'registration_delete',
      page: `/admin/delete/${id}`,
      userAgent: `AUDIT: [DELETED athlete: "${reg.fullName}" | regId: "${reg.regId || id}"]. Performed by administrator "${req.user!.name}"`
    });

    res.json({ 
      message: `Competitor "${reg.fullName}" (${id}) successfully deleted.`,
      deletedRegId: id
    });
  } catch (error: any) {
    console.error('Registration delete error:', error);
    res.status(500).json({ error: 'Server error during competitor deletion' });
  }
});

export default router;
