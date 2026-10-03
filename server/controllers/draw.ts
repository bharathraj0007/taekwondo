import { Request, Response, Router } from 'express';
import { db } from '../db';
import { authenticateJWT, AuthenticatedRequest, requireAdmin } from '../middleware/auth';
import { isWeightCategoryMatch, getMatchingRegistrationsForCategory } from '../utils/drawEngine';

export default function initDrawRouter(io: any) {
  const router = Router();

  const findMatchingDraw = async (eventId: string, category: string, weightCategory: string, gender: string) => {
    const normGender = String(gender).trim().toLowerCase();
    const normCategory = String(category).trim().toLowerCase();

    const draws = await db.draws.find({ eventId });
    return draws.find((d: any) => {
      if ((d.gender || '').toLowerCase() !== normGender) return false;
      if ((d.category || '').toLowerCase() !== normCategory) return false;
      return isWeightCategoryMatch(d.weightCategory || '', weightCategory);
    });
  };

  // POST /api/draws/finalize - Finalize a bracket draw with validation safeguard
  router.post('/finalize', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId, category, weightCategory, gender, bypassValidation } = req.body;

      if (!eventId || !category || !weightCategory || !gender) {
        res.status(400).json({ error: 'All fields (eventId, category, weightCategory, gender) are required.' });
        return;
      }

      const normGender = String(gender).trim().toLowerCase();
      const normCategory = String(category).trim();

      // 1. Fetch matching registrations
      const allRegs = await db.registrations.find();
      const { matched: matchingAthletes } = getMatchingRegistrationsForCategory(allRegs, {
        eventId,
        ageCategory: normCategory,
        gender: normGender,
        weightCategory
      });

      if (matchingAthletes.length === 0) {
        res.status(400).json({
          error: `Cannot finalize draw — no approved athletes registered in this category.`
        });
        return;
      }

      // 2. Fetch matches for this draw
      const allMatches = await db.matches.find();
      const divisionMatches = allMatches.filter((m: any) => {
        if (m.eventId && m.eventId !== eventId) return false;
        if ((m.gender || '').toLowerCase() !== normGender) return false;
        if ((m.ageCategory || 'Senior').toLowerCase() !== normCategory.toLowerCase()) return false;
        return isWeightCategoryMatch(m.weightCategory || '', weightCategory);
      });

      // Find real player names in bracket
      const bracketPlayerNames = new Set<string>();
      const bracketPlayerIds = new Set<string>();
      divisionMatches.forEach((m: any) => {
        if (m.player1Name && !m.player1Name.includes('BYE') && !m.player1Name.startsWith('Winner of') && !m.player1Name.includes('TBD') && !m.player1Name.includes('Seed #')) {
          bracketPlayerNames.add(m.player1Name);
          if (m.player1Id) bracketPlayerIds.add(m.player1Id);
        }
        if (m.player2Name && !m.player2Name.includes('BYE') && !m.player2Name.startsWith('Winner of') && !m.player2Name.includes('TBD') && !m.player2Name.includes('Seed #')) {
          bracketPlayerNames.add(m.player2Name);
          if (m.player2Id) bracketPlayerIds.add(m.player2Id);
        }
      });

      // Safeguard: Check if bracket has all registered athletes
      const missingAthletes = matchingAthletes.filter(
        a => !bracketPlayerNames.has(a.fullName) && !bracketPlayerIds.has(a.userId || a._id)
      );

      if (missingAthletes.length > 0 && !bypassValidation && divisionMatches.length > 0) {
        const missingNames = missingAthletes.map(a => a.fullName).join(', ');
        res.status(400).json({
          error: `Cannot finalize draw: ${missingAthletes.length} registered player(s) are missing from the bracket (${missingNames}). Please click 'Regenerate Draw' to include all registered competitors before publishing.`,
          missingAthletes: missingAthletes.map(a => ({ id: a.regId || a._id, fullName: a.fullName, coach: a.coachName })),
          registeredCount: matchingAthletes.length,
          bracketCount: bracketPlayerNames.size
        });
        return;
      }

      let draw = await findMatchingDraw(eventId, category, weightCategory, gender);

      if (draw) {
        draw = await db.draws.update(draw._id, {
          status: 'finalized',
          finalizedAt: new Date().toISOString()
        });
      } else {
        draw = await db.draws.create({
          eventId,
          category,
          weightCategory,
          gender: normGender,
          status: 'finalized',
          finalizedAt: new Date().toISOString()
        });
      }

      // Automatically generate and email certificates to 1st, 2nd, and 3rd place players in this category
      let certificatesResult: any = null;
      try {
        const { processCategoryCertificates } = await import('../services/certificateService');
        certificatesResult = await processCategoryCertificates(eventId, category, weightCategory, normGender as any, false);
        console.log(`[AUTO CERTIFICATES FINALIZE] Finished:`, certificatesResult);
      } catch (certErr: any) {
        console.error(`[AUTO CERTIFICATES FINALIZE ERROR] Non-blocking failure:`, certErr);
      }

      // Real-time notification to spectator clients
      const roomName = `${weightCategory}-${gender}`.toLowerCase().replace(/\s+/g, '_');
      console.log(`[REALTIME DRAW FINALIZE] Event: "${eventId}", Category: "${category}", Weight: "${weightCategory}". Emitting to room: "${roomName}" & globally.`);
      io.to(roomName).emit('draw_status_updated', { eventId, category, weightCategory, gender: normGender, status: 'finalized', draw });
      io.emit('global_draw_update', { eventId, category, weightCategory, gender: normGender, status: 'finalized', draw });

      res.json({
        message: 'Tournament bracket draw finalized and published successfully.',
        draw,
        registeredCount: matchingAthletes.length,
        bracketCount: bracketPlayerNames.size,
        certificates: certificatesResult
      });
    } catch (error: any) {
      console.error('Error finalising draw:', error);
      res.status(500).json({ error: 'Server error finalizing tournament bracket' });
    }
  });

  // POST /api/draws/unlock - Unlock a finalized draw
  router.post('/unlock', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId, category, weightCategory, gender } = req.body;

      if (!eventId || !category || !weightCategory || !gender) {
        res.status(400).json({ error: 'All fields (eventId, category, weightCategory, gender) are required.' });
        return;
      }

      const normGender = String(gender).trim().toLowerCase();
      const draw = await findMatchingDraw(eventId, category, weightCategory, gender);

      if (!draw) {
        res.status(404).json({ error: 'Draw bracket record not found.' });
        return;
      }

      const updatedDraw = await db.draws.update(draw._id, {
        status: 'draft',
        finalizedAt: null
      });

      // Real-time notification
      const roomName = `${weightCategory}-${gender}`.toLowerCase().replace(/\s+/g, '_');
      console.log(`[REALTIME DRAW UNLOCK] Event: "${eventId}", Category: "${category}", Weight: "${weightCategory}". Emitting to room: "${roomName}" & globally.`);
      io.to(roomName).emit('draw_status_updated', { eventId, category, weightCategory, gender: normGender, status: 'draft', draw: updatedDraw });
      io.emit('global_draw_update', { eventId, category, weightCategory, gender: normGender, status: 'draft', draw: updatedDraw });

      res.json({
        message: 'Tournament bracket draw unlocked and reset to draft state.',
        draw: updatedDraw
      });
    } catch (error: any) {
      console.error('Error unlocking draw:', error);
      res.status(500).json({ error: 'Server error unlocking tournament bracket' });
    }
  });

  // POST /api/draws/republish - Explicitly republish a draw after editing
  router.post('/republish', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId, category, weightCategory, gender } = req.body;

      if (!eventId || !category || !weightCategory || !gender) {
        res.status(400).json({ error: 'All fields (eventId, category, weightCategory, gender) are required.' });
        return;
      }

      const normGender = String(gender).trim().toLowerCase();

      // Check matching registrations to prevent republishing empty draw
      const allRegs = await db.registrations.find();
      const { matched: matchingAthletes } = getMatchingRegistrationsForCategory(allRegs, {
        eventId,
        ageCategory: category,
        gender: normGender,
        weightCategory
      });

      if (matchingAthletes.length === 0) {
        res.status(400).json({
          error: `Cannot republish draw — no approved athletes registered in this category.`
        });
        return;
      }

      let draw = await findMatchingDraw(eventId, category, weightCategory, gender);

      const now = new Date().toISOString();
      if (draw) {
        draw = await db.draws.update(draw._id, {
          status: 'finalized',
          finalizedAt: now
        });
      } else {
        draw = await db.draws.create({
          eventId,
          category,
          weightCategory,
          gender: normGender,
          status: 'finalized',
          finalizedAt: now
        });
      }

      // Real-time broadcast
      const roomName = `${weightCategory}-${gender}`.toLowerCase().replace(/\s+/g, '_');
      console.log(`[REALTIME DRAW REPUBLISH] Event: "${eventId}", Category: "${category}", Weight: "${weightCategory}". Emitting to room: "${roomName}" & globally.`);
      io.to(roomName).emit('draw_status_updated', { eventId, category, weightCategory, gender: normGender, status: 'finalized', draw, republished: true });
      io.emit('global_draw_update', { eventId, category, weightCategory, gender: normGender, status: 'finalized', draw, republished: true });
      io.to(roomName).emit('bracket_generated', { weightCategory, gender: normGender });

      res.json({
        message: 'Tournament bracket draw republished successfully with latest updates.',
        draw
      });
    } catch (error: any) {
      console.error('Error republishing draw:', error);
      res.status(500).json({ error: 'Server error republishing tournament bracket' });
    }
  });

  // GET /api/draws/status - Get bracket draw status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const { eventId, category, weightCategory, gender } = req.query;

      if (!eventId || !category || !weightCategory || !gender) {
        res.status(400).json({ error: 'All filter parameters are required.' });
        return;
      }

      const draw = await findMatchingDraw(eventId as string, category as string, weightCategory as string, gender as string);

      res.json({
        status: draw ? draw.status : 'draft',
        draw: draw || null
      });
    } catch (error: any) {
      console.error('Error fetching draw status:', error);
      res.status(500).json({ error: 'Server error retrieving bracket status' });
    }
  });

  return router;
}
