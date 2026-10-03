import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateJWT, AuthenticatedRequest, requireAdmin } from '../middleware/auth';
import { processCategoryCertificates } from '../services/certificateService';

const router = Router();

// GET /api/certificates/status - Get standings/certificates for a category (Admin only)
router.get('/status', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId, category, weightCategory, gender } = req.query;

    if (!eventId || !category || !weightCategory || !gender) {
      res.status(400).json({ error: 'All parameters (eventId, category, weightCategory, gender) are required.' });
      return;
    }

    const normGender = String(gender).trim().toLowerCase();
    const standings = await db.standings.find({
      eventId: String(eventId),
      ageCategory: String(category),
      weightCategory: String(weightCategory),
      gender: normGender as 'male' | 'female'
    });

    res.json(standings);
  } catch (error: any) {
    console.error('Error fetching certificates status:', error);
    res.status(500).json({ error: 'Server error fetching certificates status' });
  }
});

// POST /api/certificates/generate - Manually trigger certificate generation & sending (Admin only)
router.post('/generate', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId, category, weightCategory, gender, forceResend } = req.body;

    if (!eventId || !category || !weightCategory || !gender) {
      res.status(400).json({ error: 'All fields (eventId, category, weightCategory, gender) are required.' });
      return;
    }

    const normGender = String(gender).trim().toLowerCase();
    const result = await processCategoryCertificates(
      String(eventId),
      String(category),
      String(weightCategory),
      normGender as any,
      !!forceResend
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error triggering manual certificate generation:', error);
    res.status(500).json({ error: 'Server error generating certificates' });
  }
});

// POST /api/certificates/resend/:standingId - Resend certificate for a single player (Admin only)
router.post('/resend/:standingId', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { standingId } = req.params;
    const standing = await db.standings.findOne({ _id: standingId });

    if (!standing) {
      res.status(404).json({ error: 'Standing record not found' });
      return;
    }

    const event = await db.events.findOne({ _id: standing.eventId });
    const eventName = event ? event.name : 'CombatFlow National Championship 2026';
    const eventDate = event
      ? new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const reg = await db.registrations.findOne({ userId: standing.playerId, eventId: standing.eventId });
    const userDoc = await db.users.findOne({ _id: standing.playerId });
    const email = reg?.email || userDoc?.email;
    const fullName = standing.fullName || reg?.fullName || userDoc?.name || 'Athlete';

    if (!email) {
      res.status(400).json({ error: 'No registered email found for this player.' });
      return;
    }

    const categoryLabel = `${standing.ageCategory} ${standing.gender === 'male' ? 'Male' : 'Female'} ${standing.weightCategory}`;

    // 1. Generate certificate PDF
    const { generateCertificatePdf } = await import('../services/certificateService');
    const pdfBuffer = await generateCertificatePdf(
      eventName,
      fullName,
      standing.position,
      categoryLabel,
      eventDate
    );

    // 2. Upload to Cloudinary (optional refresh)
    let certificateUrl = standing.certificateUrl;
    let certificatePublicId = standing.certificatePublicId;
    try {
      const { uploadToCloudinary } = await import('../utils/cloudinary');
      const folder = `certificates/${standing.eventId}/${reg?._id || reg?.regId || standing.playerId}`;
      const uploadRes = await uploadToCloudinary(pdfBuffer, folder, 'certificate', 'raw');
      certificateUrl = uploadRes.secure_url;
      certificatePublicId = uploadRes.public_id;
    } catch (uploadErr) {
      console.error('Cloudinary update failed during manual resend:', uploadErr);
    }

    // 3. Email certificate
    const { sendCertificateEmail } = await import('../utils/mailer');
    const mailRes = await sendCertificateEmail(
      email,
      fullName,
      standing.position === '1st' ? 'Gold (1st)' : standing.position === '2nd' ? 'Silver (2nd)' : 'Bronze (3rd)',
      eventName,
      categoryLabel,
      pdfBuffer,
      `CombatFlow_Certificate_${fullName.replace(/\s+/g, '_')}.pdf`
    );

    if (mailRes.success) {
      const updated = await db.standings.update(standingId, {
        certificateUrl,
        certificatePublicId,
        emailSent: true,
        emailSentAt: new Date().toISOString(),
        emailError: null
      });
      res.json({ success: true, message: `Successfully resent certificate to ${fullName} (${email}).`, standing: updated });
    } else {
      const errorMsg = mailRes.error || 'SMTP delivery failed';
      const updated = await db.standings.update(standingId, {
        emailSent: false,
        emailError: errorMsg
      });
      res.status(500).json({ error: `SMTP certificate resend failed: ${errorMsg}`, standing: updated });
    }
  } catch (error: any) {
    console.error('Error resending player certificate:', error);
    res.status(500).json({ error: 'Server error resending certificate' });
  }
});

// GET /api/certificates/my-certificates - Get certificates earned by the authenticated player (Player dashboard)
router.get('/my-certificates', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    
    // Find standings won by this player ID
    const standings = await db.standings.find({ playerId: userId });
    
    // Filter to ensure certificates are actually generated
    const earnedCertificates = standings.filter(s => s.certificateUrl);
    
    res.json(earnedCertificates);
  } catch (error: any) {
    console.error('Error retrieving player certificates:', error);
    res.status(500).json({ error: 'Server error retrieving certificates' });
  }
});

export default router;
