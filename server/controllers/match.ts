import { Response, Router } from 'express';
import { db, Match } from '../db';
import { authenticateJWT, AuthenticatedRequest, requireAdmin, requireRefereeOrAdmin } from '../middleware/auth';
import {
  getMatchingRegistrationsForCategory,
  buildKnockoutBracket,
  isWeightCategoryMatch,
  resolveAgeCategory
} from '../utils/drawEngine';

export default function initMatchRouter(io: any) {
  const router = Router();

  // GET /api/matches - Retrieve all matches (public)
  router.get('/', async (req, res) => {
    try {
      const { weightCategory, gender, eventId, ageCategory } = req.query;

      let matches = await db.matches.find();

      if (eventId) {
        matches = matches.filter((m: any) => m.eventId === eventId);
      }
      if (gender) {
        const normGender = String(gender).trim().toLowerCase();
        matches = matches.filter((m: any) => (m.gender || '').toLowerCase() === normGender);
      }
      if (ageCategory) {
        const normAge = String(ageCategory).trim().toLowerCase();
        matches = matches.filter((m: any) => (m.ageCategory || 'Senior').toLowerCase() === normAge);
      }
      if (weightCategory) {
        matches = matches.filter((m: any) => isWeightCategoryMatch(m.weightCategory, String(weightCategory)));
      }

      // Log engagement
      await db.engagementLogs.create({
        userId: null,
        action: 'view_matches',
        page: '/live',
        userAgent: req.headers['user-agent'] || 'Unknown'
      });

      res.json(matches);
    } catch (error: any) {
      console.error('Error fetching matches:', error);
      res.status(500).json({ error: 'Server error fetching matches' });
    }
  });

  // GET /api/matches/category-stats - Comparison between registrations and bracket participants
  router.get('/category-stats', async (req, res) => {
    try {
      const { eventId, category, weightCategory, gender } = req.query;

      if (!weightCategory || !gender) {
        res.status(400).json({ error: 'weightCategory and gender are required parameters.' });
        return;
      }

      const allRegs = await db.registrations.find();
      const matchCriteria = {
        eventId: eventId ? String(eventId) : undefined,
        ageCategory: category ? String(category) : 'Senior',
        gender: String(gender),
        weightCategory: String(weightCategory)
      };

      const { matched, audit } = getMatchingRegistrationsForCategory(allRegs, matchCriteria);

      // Find current matches in DB for this category
      const allMatches = await db.matches.find();
      const currentMatches = allMatches.filter((m: any) => {
        if (matchCriteria.eventId && m.eventId && m.eventId !== matchCriteria.eventId) return false;
        if ((m.gender || '').toLowerCase() !== matchCriteria.gender.toLowerCase()) return false;
        if ((m.ageCategory || 'Senior').toLowerCase() !== matchCriteria.ageCategory.toLowerCase()) return false;
        return isWeightCategoryMatch(m.weightCategory, matchCriteria.weightCategory);
      });

      // Find unique real players in leaf round matches
      const bracketPlayerNames = new Set<string>();
      currentMatches.forEach((m: any) => {
        if (m.player1Name && !m.player1Name.includes('BYE') && !m.player1Name.startsWith('Winner of') && !m.player1Name.includes('TBD') && !m.player1Name.includes('Seed #')) {
          bracketPlayerNames.add(m.player1Name);
        }
        if (m.player2Name && !m.player2Name.includes('BYE') && !m.player2Name.startsWith('Winner of') && !m.player2Name.includes('TBD') && !m.player2Name.includes('Seed #')) {
          bracketPlayerNames.add(m.player2Name);
        }
      });

      // Check for missing players
      const missingPlayers = matched.filter(r => !bracketPlayerNames.has(r.fullName));

      res.json({
        registeredCount: matched.length,
        bracketCount: bracketPlayerNames.size,
        isSynced: matched.length === bracketPlayerNames.size || currentMatches.length === 0,
        registeredAthletes: matched.map((r: any) => ({
          id: r.regId || r._id,
          fullName: r.fullName,
          coach: r.coachName || r.clubName || 'Independent',
          weight: r.weightCategory,
          inBracket: bracketPlayerNames.has(r.fullName)
        })),
        missingAthletes: missingPlayers.map((r: any) => ({
          id: r.regId || r._id,
          fullName: r.fullName,
          coach: r.coachName || r.clubName || 'Independent',
          weight: r.weightCategory
        })),
        totalMatches: currentMatches.length,
        audit
      });
    } catch (error: any) {
      console.error('Error fetching category stats:', error);
      res.status(500).json({ error: 'Server error retrieving category statistics' });
    }
  });

  // POST /api/matches/generate - Auto-generate knockout draw for a specific category
  router.post('/generate', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { weightCategory, gender, ageCategory, eventId, allowPlaceholders, bracketSize } = req.body;

      if (!weightCategory || !gender) {
        res.status(400).json({ error: 'Weight category and gender are required' });
        return;
      }

      const normWeight = String(weightCategory).trim();
      const normGender = String(gender).trim().toLowerCase();
      const normAge = String(ageCategory || 'Senior').trim();

      // Resolve target event ID
      let targetEventId = eventId;
      if (!targetEventId) {
        const events = await db.events.find();
        targetEventId = events[0]?._id || 'evt_autumn2026';
      }

      // Check if bracket draw is finalized - if so, block generation unless unlocked
      const allDraws = await db.draws.find({ eventId: targetEventId });
      const existingDraw = allDraws.find((d: any) => {
        if ((d.gender || '').toLowerCase() !== normGender) return false;
        if ((d.category || '').toLowerCase() !== normAge.toLowerCase()) return false;
        return isWeightCategoryMatch(d.weightCategory || '', normWeight);
      });

      if (existingDraw && existingDraw.status === 'finalized') {
        res.status(403).json({
          error: 'This tournament draw is currently finalized and locked. Please unlock it to draft mode before regenerating the bracket tree.'
        });
        return;
      }

      // 1. Find all registered players for this category & gender with robust matching
      const allRegs = await db.registrations.find({});
      const { matched: matchingParticipants, audit } = getMatchingRegistrationsForCategory(allRegs, {
        eventId: targetEventId,
        ageCategory: normAge,
        gender: normGender,
        weightCategory: normWeight
      });

      console.log(`[BRACKET GENERATE] Event: "${targetEventId}", ${normAge} ${normGender} ${normWeight}. Found ${matchingParticipants.length} matching athlete registrations.`);

      // Allow placeholders preference
      const shouldAllowPlaceholders = allowPlaceholders !== false;

      // Handle 0 registered participants - Block generation for empty categories
      if (matchingParticipants.length === 0) {
        res.status(400).json({
          error: `Cannot generate draw — no athletes registered in this category (${normAge} ${normGender} ${normWeight}).`,
          foundCount: 0
        });
        return;
      }

      // 2. Build the full knockout bracket tree
      const requestedSize = bracketSize ? parseInt(bracketSize, 10) : undefined;
      const bracketResult = buildKnockoutBracket(matchingParticipants, {
        eventId: targetEventId,
        ageCategory: normAge,
        gender: normGender,
        weightCategory: normWeight,
        targetBracketSize: requestedSize,
        allowPlaceholders: shouldAllowPlaceholders,
        updatedBy: req.user!.name
      });

      const { matches: newMatches, bracketParticipantsCount, byesCount, powerOfTwoSize } = bracketResult;

      // 3. SAFEGUARD: Validate that every matched athlete is in the bracket
      if (matchingParticipants.length > 0) {
        const bracketPlayerIds = new Set<string>();
        newMatches.forEach(m => {
          if (m.player1Id && !m.player1Id.startsWith('bye_') && !m.player1Id.startsWith('seed_placeholder') && m.player1Id !== 'pending_winner') {
            bracketPlayerIds.add(m.player1Id);
          }
          if (m.player2Id && !m.player2Id.startsWith('bye_') && !m.player2Id.startsWith('seed_placeholder') && m.player2Id !== 'pending_winner') {
            bracketPlayerIds.add(m.player2Id);
          }
        });

        const missing = matchingParticipants.filter(p => !bracketPlayerIds.has(p.userId || p._id));
        if (missing.length > 0) {
          const missingNames = missing.map(p => p.fullName).join(', ');
          console.error(`[BRACKET SAFEGUARD FAILURE] Missing athletes in generated bracket: ${missingNames}`);
          res.status(500).json({
            error: `Bracket generation safeguard failure: ${missing.length} registered athlete(s) were missing from the generated bracket: ${missingNames}`,
            missingAthletes: missing
          });
          return;
        }
      }

      // 4. Delete existing matches for this category and event
      const allExistingMatches = await db.matches.find({});
      const matchesToDelete = allExistingMatches
        .filter((m: any) => {
          const matchEvent = m.eventId || 'evt_autumn2026';
          if (matchEvent !== targetEventId) return false;
          if ((m.gender || '').toLowerCase() !== normGender) return false;
          if ((m.ageCategory || 'Senior').toLowerCase() !== normAge.toLowerCase()) return false;
          return isWeightCategoryMatch(m.weightCategory || '', normWeight);
        })
        .map((m: any) => m._id);

      if (matchesToDelete.length > 0) {
        await db.matches.deleteMany({ _id: { $in: matchesToDelete } });
      }

      // 5. Save all created matches to the database
      const savedMatches: Match[] = [];
      for (const m of newMatches) {
        const saved = await db.matches.create(m);
        savedMatches.push(saved);
      }

      // 6. Update or create draw record in 'draft' state
      let drawRecord = existingDraw;
      if (drawRecord) {
        drawRecord = await db.draws.update(drawRecord._id, {
          status: 'draft',
          finalizedAt: null
        });
      } else {
        drawRecord = await db.draws.create({
          eventId: targetEventId,
          category: normAge,
          weightCategory: normWeight,
          gender: normGender,
          status: 'draft',
          finalizedAt: null
        });
      }

      // 7. Real-time broadcast
      const roomName = `${normWeight}-${normGender}`.toLowerCase().replace(/\s+/g, '_');
      console.log(`[BRACKET GENERATED] Event: "${targetEventId}", ${normAge} ${normGender} ${normWeight}. Saved ${savedMatches.length} bouts (Participants: ${bracketParticipantsCount}, Byes: ${byesCount}, Bracket Size: ${powerOfTwoSize}).`);

      io.to(roomName).emit('bracket_generated', {
        weightCategory: normWeight,
        gender: normGender,
        eventId: targetEventId,
        matches: savedMatches
      });
      io.to(roomName).emit('draw_status_updated', {
        eventId: targetEventId,
        category: normAge,
        weightCategory: normWeight,
        gender: normGender,
        status: 'draft',
        draw: drawRecord
      });
      io.emit('global_draw_update', {
        eventId: targetEventId,
        category: normAge,
        weightCategory: normWeight,
        gender: normGender,
        status: 'draft',
        draw: drawRecord
      });

      res.status(201).json({
        message: `Knockout tournament bracket successfully generated with ${savedMatches.length} bouts (${bracketParticipantsCount} athletes, ${byesCount} BYEs)!`,
        matches: savedMatches,
        draw: drawRecord,
        registeredCount: matchingParticipants.length,
        bracketParticipantsCount,
        byesCount,
        bracketSize: powerOfTwoSize,
        audit: {
          ...audit,
          registeredCount: matchingParticipants.length,
          bracketCount: bracketParticipantsCount,
          byesCount
        }
      });
    } catch (error: any) {
      console.error('Bracket generation error:', error);
      res.status(500).json({ error: 'Server error generating tournament bracket' });
    }
  });

  // POST /api/matches - Manually add/create a custom match
  router.post('/', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { weightCategory, gender, round, player1Id, player2Id, player1Name, player2Name, eventId, ageCategory } = req.body;

      if (!weightCategory || !gender || !round || !player1Name || !player2Name) {
        res.status(400).json({ error: 'Please fill in all match setup fields' });
        return;
      }

      const targetEventId = eventId || 'evt_autumn2026';
      const targetAge = ageCategory || 'Senior';

      // Check if bracket draw is finalized
      const allDraws = await db.draws.find({ eventId: targetEventId });
      const draw = allDraws.find((d: any) => {
        if ((d.gender || '').toLowerCase() !== String(gender).toLowerCase()) return false;
        if ((d.category || '').toLowerCase() !== String(targetAge).toLowerCase()) return false;
        return isWeightCategoryMatch(d.weightCategory, weightCategory);
      });

      if (draw && draw.status === 'finalized') {
        res.status(403).json({ error: 'This tournament bracket is finalized and is read-only. Please unlock it from the admin console first.' });
        return;
      }

      const match = await db.matches.create({
        weightCategory,
        gender,
        round,
        ageCategory: targetAge,
        eventId: targetEventId,
        player1Id: player1Id || 'manual_player_1',
        player2Id: player2Id || 'manual_player_2',
        player1Name,
        player2Name,
        winnerId: null,
        score: { player1: 0, player2: 0 },
        status: 'pending',
        updatedBy: req.user!.name,
      });

      io.emit('match_created', match);

      res.status(201).json({
        message: 'Custom match created successfully!',
        match
      });
    } catch (error: any) {
      console.error('Manual match creation error:', error);
      res.status(500).json({ error: 'Server error creating match' });
    }
  });

  // PUT /api/matches/:id - Update score and status of a match (Admin/Referee)
  router.put('/:id', authenticateJWT as any, requireRefereeOrAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { score, status, winnerId } = req.body;

      const existingMatch = await db.matches.findOne({ _id: id });
      if (!existingMatch) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }

      // Check if bracket draw is finalized
      const allDraws = await db.draws.find({ eventId: existingMatch.eventId || 'evt_autumn2026' });
      const draw = allDraws.find((d: any) => {
        if ((d.gender || '').toLowerCase() !== (existingMatch.gender || '').toLowerCase()) return false;
        if ((d.category || '').toLowerCase() !== (existingMatch.ageCategory || 'Senior').toLowerCase()) return false;
        return isWeightCategoryMatch(d.weightCategory, existingMatch.weightCategory);
      });

      const hasStructuralEdits =
        req.body.player1Name !== undefined ||
        req.body.player2Name !== undefined ||
        req.body.player1Id !== undefined ||
        req.body.player2Id !== undefined ||
        req.body.round !== undefined ||
        req.body.gender !== undefined ||
        req.body.weightCategory !== undefined;

      // Only restrict structural edits for non-admins (e.g. referees who should only score)
      if (draw && draw.status === 'finalized' && hasStructuralEdits && req.user!.role !== 'admin') {
        res.status(403).json({ error: 'This draw is finalized and is read-only for non-admin referees. Please request an administrator to modify bracket pairings.' });
        return;
      }

      const updates: any = {};
      if (score !== undefined) {
        updates.score = score;
      }
      if (status !== undefined) {
        updates.status = status;
      }
      if (winnerId !== undefined) {
        updates.winnerId = winnerId;
      }
      if (req.body.player1Name !== undefined) {
        updates.player1Name = req.body.player1Name;
      }
      if (req.body.player2Name !== undefined) {
        updates.player2Name = req.body.player2Name;
      }
      if (req.body.player1Id !== undefined) {
        updates.player1Id = req.body.player1Id;
      }
      if (req.body.player2Id !== undefined) {
        updates.player2Id = req.body.player2Id;
      }
      if (req.body.round !== undefined) {
        updates.round = req.body.round;
      }
      if (req.body.gender !== undefined) {
        updates.gender = req.body.gender;
      }
      if (req.body.weightCategory !== undefined) {
        updates.weightCategory = req.body.weightCategory;
      }
      updates.updatedBy = req.user!.name;

      // Determine winner details if completing
      let finalWinnerId = updates.winnerId || existingMatch.winnerId;
      let finalWinnerName = '';

      if (updates.status === 'completed' || existingMatch.status === 'completed') {
        const s1 = score !== undefined ? score.player1 : existingMatch.score.player1;
        const s2 = score !== undefined ? score.player2 : existingMatch.score.player2;

        if (!finalWinnerId) {
          if (s1 > s2) {
            finalWinnerId = existingMatch.player1Id;
          } else if (s2 > s1) {
            finalWinnerId = existingMatch.player2Id;
          }
        }

        if (finalWinnerId) {
          if (finalWinnerId === existingMatch.player1Id) {
            finalWinnerName = updates.player1Name !== undefined ? updates.player1Name : existingMatch.player1Name;
          } else if (finalWinnerId === existingMatch.player2Id) {
            finalWinnerName = updates.player2Name !== undefined ? updates.player2Name : existingMatch.player2Name;
          }
        }

        updates.winnerId = finalWinnerId;
      }

      const updatedMatch = await db.matches.update(id, updates);

      if (!updatedMatch) {
        res.status(500).json({ error: 'Failed to update match' });
        return;
      }

      // If completed and has a parent match, automatically advance the winner
      if (updatedMatch.status === 'completed' && finalWinnerId && updatedMatch.nextMatchId && updatedMatch.nextMatchPlayerSlot) {
        const nextMatchId = updatedMatch.nextMatchId;
        const slot = updatedMatch.nextMatchPlayerSlot;

        const nextMatch = await db.matches.findOne({ _id: nextMatchId });
        if (nextMatch) {
          const nextMatchUpdates: any = {};
          if (slot === 'player1') {
            nextMatchUpdates.player1Id = finalWinnerId;
            nextMatchUpdates.player1Name = finalWinnerName || 'Winner';
          } else if (slot === 'player2') {
            nextMatchUpdates.player2Id = finalWinnerId;
            nextMatchUpdates.player2Name = finalWinnerName || 'Winner';
          }
          const savedNextMatch = await db.matches.update(nextMatchId, nextMatchUpdates);
          if (savedNextMatch) {
            io.emit('global_match_update', savedNextMatch);
          }
        }
      }

      // Broadcast update
      const roomName = `${updatedMatch.weightCategory}-${updatedMatch.gender}`.toLowerCase().replace(/\s+/g, '_');
      io.to(roomName).emit('match_score_updated', updatedMatch);
      io.to(roomName).emit('match_updated', updatedMatch);
      if (updatedMatch.status === 'completed') {
        io.to(roomName).emit('match_completed', updatedMatch);
        io.emit('match_completed', updatedMatch);
      }
      io.emit('global_match_update', updatedMatch);
      io.to(roomName).emit('draw_status_updated', {
        eventId: updatedMatch.eventId,
        category: updatedMatch.ageCategory,
        weightCategory: updatedMatch.weightCategory,
        gender: updatedMatch.gender,
        status: draw ? draw.status : 'draft',
        draw
      });
      io.emit('global_draw_update', {
        eventId: updatedMatch.eventId,
        category: updatedMatch.ageCategory,
        weightCategory: updatedMatch.weightCategory,
        gender: updatedMatch.gender,
        status: draw ? draw.status : 'draft',
        draw
      });

      res.json({
        message: 'Match updated successfully',
        match: updatedMatch,
      });
    } catch (error: any) {
      console.error('Match score update error:', error);
      res.status(500).json({ error: 'Server error updating match scores' });
    }
  });

  // POST /api/matches/clear-all - Reset/clear all matches (Admin only)
  router.post('/clear-all', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await db.matches.clear();
      io.emit('matches_cleared');
      res.json({ message: 'All match records and brackets cleared successfully' });
    } catch (error: any) {
      console.error('Error clearing matches:', error);
      res.status(500).json({ error: 'Server error resetting tournament data' });
    }
  });

  // DELETE /api/matches/:id - Delete an individual match (Admin only)
  router.delete('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingMatch = await db.matches.findOne({ _id: id });
      if (existingMatch) {
        const allDraws = await db.draws.find({ eventId: existingMatch.eventId || 'evt_autumn2026' });
        const draw = allDraws.find((d: any) => {
          if ((d.gender || '').toLowerCase() !== (existingMatch.gender || '').toLowerCase()) return false;
          if ((d.category || '').toLowerCase() !== (existingMatch.ageCategory || 'Senior').toLowerCase()) return false;
          return isWeightCategoryMatch(d.weightCategory, existingMatch.weightCategory);
        });

        if (draw && draw.status === 'finalized') {
          res.status(403).json({ error: 'Cannot delete matches of a finalized tournament draw. Please unlock it from the admin console first.' });
          return;
        }
      }

      const success = await db.matches.delete(id);
      if (!success) {
        res.status(404).json({ error: 'Match not found.' });
        return;
      }
      io.emit('match_deleted', { _id: id });
      res.json({ message: 'Match successfully deleted.' });
    } catch (error: any) {
      console.error('Match deletion error:', error);
      res.status(500).json({ error: 'Server error deleting match' });
    }
  });

  return router;
}
