import { Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { db } from '../db';
import { authenticateJWT, AuthenticatedRequest, requireAdmin, requireRefereeOrAdmin } from '../middleware/auth';
import { isWeightCategoryMatch } from '../utils/drawEngine';

const getJWTSecret = () => process.env.JWT_SECRET || 'fallback_default_jwt_secret_must_be_long_and_secure';

export default function initRefereeRouter(io: SocketIOServer) {
  const router = Router();

  console.log('[Referee Controller] Initializing officiating routes...');

  /**
   * 0. Health Check / Test Route
   */
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Referee API is active' });
  });

  /**
   * 1. Dedicated Referee Login
   * POST /api/referee/login
   */
  router.post('/login', async (req, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await db.users.findOne({ email: normalizedEmail });

      if (!user) {
        res.status(401).json({ error: 'Invalid referee credentials.' });
        return;
      }

      // Security check: Referees and Admins only
      if (user.role === 'player') {
        res.status(403).json({
          error: 'Player accounts are not permitted to access the referee officiating portal. Please contact the tournament director.',
        });
        return;
      }

      const hashToCompare = user.password_hash || user.passwordHash;
      if (!hashToCompare) {
        res.status(401).json({ error: 'Account credentials not properly configured. Please contact the administrator.' });
        return;
      }

      const isMatch = bcrypt.compareSync(password, hashToCompare) || bcrypt.compareSync(password.trim(), hashToCompare);
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      // Generate secure referee token
      const token = jwt.sign(
        {
          id: user._id,
          role: user.role,
          name: user.name,
          email: user.email,
        },
        getJWTSecret(),
        { expiresIn: '12h' }
      );

      // Set httpOnly cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        maxAge: 12 * 60 * 60 * 1000,
        sameSite: 'none'
      });

      // Audit log login
      await db.engagementLogs.create({
        userId: user._id,
        action: 'referee_login',
        page: '/referee/login',
        userAgent: `REFEREE AUTH: Official "${user.name}" (${user.email}) logged into officiating console.`,
      });

      res.json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || '',
        },
      });
    } catch (error: any) {
      console.error('Referee login error:', error);
      res.status(500).json({ error: 'Server error during referee authentication.' });
    }
  });

  /**
   * 2. Referee Tournament Events
   * GET /api/referee/events
   */
  router.get('/events', authenticateJWT as any, requireRefereeOrAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const events = await db.events.find();
      res.json(events);
    } catch (error: any) {
      console.error('Referee events error:', error);
      res.status(500).json({ error: 'Failed to retrieve tournament events.' });
    }
  });

  /**
   * 3. Matches Available for Officiating
   * GET /api/referee/matches
   */
  router.get('/matches', authenticateJWT as any, requireRefereeOrAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId, weightCategory, gender, status } = req.query;

      // 1. Fetch all draws and matches
      const allDraws = await db.draws.find();
      const finalizedDraws = allDraws.filter((d: any) => d.status === 'finalized');
      const allMatches = await db.matches.find();

      if (allMatches.length === 0) {
        res.json({
          finalizedDrawsCount: finalizedDraws.length,
          categoriesCount: 0,
          matches: [],
          message: 'No tournament matches are currently scheduled for officiating.',
        });
        return;
      }

      // 2. Filter matches
      const eligibleMatches = allMatches.filter((m: any) => {
        // Query filters if supplied
        if (eventId && eventId !== 'all' && m.eventId && m.eventId !== eventId) return false;
        if (gender && gender !== 'all' && String(m.gender).toLowerCase() !== String(gender).toLowerCase()) return false;
        if (weightCategory && weightCategory !== 'all' && !isWeightCategoryMatch(m.weightCategory, String(weightCategory))) return false;
        if (status && status !== 'all' && m.status !== status) return false;

        return true;
      });

      // Enhance matches with metadata
      const enrichedMatches = eligibleMatches.map((m: any) => {
        const matchingDraw = allDraws.find((d: any) =>
          isWeightCategoryMatch(m.weightCategory, d.weightCategory) &&
          (!m.gender || !d.gender || String(d.gender).toLowerCase() === String(m.gender).toLowerCase())
        );

        return {
          ...m,
          drawId: matchingDraw?._id,
          finalizedAt: matchingDraw?.finalizedAt,
          isFinalized: matchingDraw ? matchingDraw.status === 'finalized' : true,
        };
      });

      res.json({
        finalizedDrawsCount: finalizedDraws.length,
        totalMatches: enrichedMatches.length,
        matches: enrichedMatches,
      });
    } catch (error: any) {
      console.error('Referee matches error:', error);
      res.status(500).json({ error: 'Failed to retrieve officiating matches.' });
    }
  });

  /**
   * 4. Single Match Details for Tablet Scorepad
   * GET /api/referee/match/:matchId
   */
  router.get('/match/:matchId', authenticateJWT as any, requireRefereeOrAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { matchId } = req.params;
      const match = await db.matches.findOne({ _id: matchId });

      if (!match) {
        res.status(404).json({ error: `Match with ID ${matchId} not found.` });
        return;
      }

      const allDraws = await db.draws.find();
      const matchingDraw = allDraws.find((d: any) =>
        isWeightCategoryMatch(match.weightCategory, d.weightCategory) &&
        (!match.gender || !d.gender || String(d.gender).toLowerCase() === String(match.gender).toLowerCase())
      );

      res.json({
        match,
        draw: matchingDraw || null,
        isFinalized: matchingDraw ? matchingDraw.status === 'finalized' : true,
      });
    } catch (error: any) {
      console.error('Referee single match fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch match details.' });
    }
  });

  /**
   * 5. Live Score & Penalty State Update
   * POST /api/referee/match/:matchId/score
   */
  router.post('/match/:matchId/score', authenticateJWT as any, requireRefereeOrAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { matchId } = req.params;
      const { score, round, boutRound, status, penalties, roundScores, roundsWon } = req.body;

      const existingMatch = await db.matches.findOne({ _id: matchId });
      if (!existingMatch) {
        res.status(404).json({ error: 'Match not found.' });
        return;
      }

      // If match was already completed and referee tries to edit
      if (existingMatch.status === 'completed' && req.user!.role !== 'admin') {
        res.status(403).json({
          error: 'This match result is locked. Only an administrator can override finalized match results.',
        });
        return;
      }

      const updates: any = {
        updatedBy: req.user!.name,
        updatedAt: new Date().toISOString(),
      };

      if (score !== undefined) updates.score = score;
      if (boutRound !== undefined) updates.boutRound = boutRound;
      if (roundScores !== undefined) updates.roundScores = roundScores;
      if (roundsWon !== undefined) updates.roundsWon = roundsWon;
      if (penalties !== undefined) updates.penalties = penalties;
      if (status !== undefined) updates.status = status;

      // Only update bracket round if explicitly not a bout period
      if (round !== undefined && !['Round 1', 'Round 2', 'Round 3', 'Golden Pt', 'Golden Point', '1', '2', '3'].includes(round)) {
        updates.round = round;
      } else if (round !== undefined) {
        updates.boutRound = round;
      }

      const updated = await db.matches.update(matchId, updates);

      // Emit real-time socket events for spectator and admin views
      const roomName = `${updated.weightCategory}-${updated.gender}`.toLowerCase().replace(/\s+/g, '_');
      io.to(roomName).emit('match_score_updated', updated);
      io.to(roomName).emit('match_updated', updated);
      io.emit('global_match_update', updated);

      res.json({ match: updated });
    } catch (error: any) {
      console.error('Referee live score error:', error);
      res.status(500).json({ error: 'Failed to update live match score.' });
    }
  });

  /**
   * 6. Submit Final Score & Lock Result
   * POST /api/referee/match/:matchId/submit
   */
  router.post('/match/:matchId/submit', authenticateJWT as any, requireRefereeOrAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { matchId } = req.params;
      const { winnerId, winnerName, score, roundScores, roundsWon, penalties, finalRound, decisionMethod } = req.body;

      const existingMatch = await db.matches.findOne({ _id: matchId });
      if (!existingMatch) {
        res.status(404).json({ error: 'Match not found.' });
        return;
      }

      // Security check: If already completed and user is referee, block override
      if (existingMatch.status === 'completed' && req.user!.role !== 'admin') {
        res.status(403).json({
          error: 'This match result is officially locked and submitted. Only an administrator can override finalized match records.',
        });
        return;
      }

      if (!winnerId) {
        res.status(400).json({ error: 'Winner must be selected before submitting final score.' });
        return;
      }

      // Resolve final winner name
      let resolvedWinnerName = winnerName;
      if (!resolvedWinnerName) {
        if (winnerId === existingMatch.player1Id) {
          resolvedWinnerName = existingMatch.player1Name;
        } else if (winnerId === existingMatch.player2Id) {
          resolvedWinnerName = existingMatch.player2Name;
        }
      }

      // Preserve bracket round if finalRound was just a bout number
      let preservedBracketRound = existingMatch.round;
      if (finalRound && !['Round 1', 'Round 2', 'Round 3', 'Golden Pt', 'Golden Point', '1', '2', '3'].includes(finalRound)) {
        preservedBracketRound = finalRound;
      }

      const matchUpdates: any = {
        status: 'completed',
        winnerId,
        score: score || existingMatch.score,
        round: preservedBracketRound,
        updatedBy: req.user!.name,
        updatedAt: new Date().toISOString(),
      };

      if (penalties) matchUpdates.penalties = penalties;
      if (roundScores) matchUpdates.roundScores = roundScores;
      if (roundsWon) matchUpdates.roundsWon = roundsWon;
      if (decisionMethod) matchUpdates.decisionMethod = decisionMethod;

      const updatedMatch = await db.matches.update(matchId, matchUpdates);

      // Advance winner in the knockout bracket if next match exists
      let advancedNextMatch: any = null;
      if (updatedMatch.nextMatchId && updatedMatch.nextMatchPlayerSlot) {
        const nextMatchId = updatedMatch.nextMatchId;
        const slot = updatedMatch.nextMatchPlayerSlot;

        const nextMatch = await db.matches.findOne({ _id: nextMatchId });
        if (nextMatch) {
          const nextUpdates: any = {
            updatedBy: `Automated Progression (${req.user!.name})`,
            updatedAt: new Date().toISOString(),
          };
          if (slot === 'player1') {
            nextUpdates.player1Id = winnerId;
            nextUpdates.player1Name = resolvedWinnerName || 'Winner';
          } else if (slot === 'player2') {
            nextUpdates.player2Id = winnerId;
            nextUpdates.player2Name = resolvedWinnerName || 'Winner';
          }

          advancedNextMatch = await db.matches.update(nextMatchId, nextUpdates);
          if (advancedNextMatch) {
            io.emit('global_match_update', advancedNextMatch);
          }
        }
      }

      // Security & Compliance Audit Log
      await db.engagementLogs.create({
        userId: req.user!._id,
        action: 'referee_score_submission',
        page: `/referee/match/${matchId}`,
        userAgent: `REFEREE SCORE SUBMISSION: Match "${matchId}" (${existingMatch.player1Name} vs ${existingMatch.player2Name}) completed. Winner: "${resolvedWinnerName}" [${winnerId}]. Final Score: ${matchUpdates.score.player1} - ${matchUpdates.score.player2}. Officiating Referee: "${req.user!.name}"`,
      });

      // Real-time broadcasts
      const roomName = `${updatedMatch.weightCategory}-${updatedMatch.gender}`.toLowerCase().replace(/\s+/g, '_');
      io.to(roomName).emit('match_score_updated', updatedMatch);
      io.to(roomName).emit('match_updated', updatedMatch);
      io.to(roomName).emit('match_completed', updatedMatch);
      io.emit('global_match_update', updatedMatch);
      io.emit('match_completed', updatedMatch);

      res.json({
        message: 'Match result officially submitted, locked, and bracket advanced successfully.',
        match: updatedMatch,
        advancedNextMatch,
      });
    } catch (error: any) {
      console.error('Referee submit final score error:', error);
      res.status(500).json({ error: 'Server error while submitting match score.' });
    }
  });

  /**
   * 7. Admin: List All Referees
   * GET /api/referee/admin/list
   */
  router.get('/admin/list', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await db.users.find({ role: 'referee' });
      const sanitized = users.map((u: any) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        role: u.role,
        createdAt: u.createdAt,
      }));
      res.json(sanitized);
    } catch (error: any) {
      console.error('Admin referee list error:', error);
      res.status(500).json({ error: 'Failed to retrieve referee roster.' });
    }
  });

  /**
   * 8. Admin: Create Referee Account
   * POST /api/referee/admin/create
   */
  router.post('/admin/create', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, email, password, phone } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({ error: 'Name, email, and temporary password are required.' });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      const existing = await db.users.findOne({ email: normalizedEmail });
      if (existing) {
        res.status(400).json({ error: `An account with email "${normalizedEmail}" already exists.` });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password.trim(), salt);

      const newReferee = await db.users.create({
        name: name.trim(),
        email: normalizedEmail,
        phone: phone ? phone.trim() : '',
        password_hash,
        passwordHash: password_hash,
        role: 'referee',
      });

      // Audit Log
      await db.engagementLogs.create({
        userId: req.user!._id,
        action: 'admin_create_referee',
        page: '/admin',
        userAgent: `STAFF PROVISIONING: Administrator "${req.user!.name}" created referee account for "${name}" (${normalizedEmail}).`,
      });

      res.status(201).json({
        message: `Referee account for "${name}" created successfully.`,
        referee: {
          _id: newReferee._id,
          name: newReferee.name,
          email: newReferee.email,
          phone: newReferee.phone,
          role: newReferee.role,
          createdAt: newReferee.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Admin create referee error:', error);
      res.status(500).json({ error: 'Failed to create referee account.' });
    }
  });

  /**
   * 9. Admin: Delete Referee Account
   * DELETE /api/referee/admin/:id
   */
  router.delete('/admin/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const user = await db.users.findOne({ _id: id });
      if (!user) {
        res.status(404).json({ error: 'Referee account not found.' });
        return;
      }

      if (user.role !== 'referee') {
        res.status(400).json({ error: 'Only referee accounts can be deleted via this endpoint.' });
        return;
      }

      await db.users.update(id, { role: 'player' }); // Or delete from database
      // Delete user
      const deleted = await (db.users as any).delete ? await (db.users as any).delete(id) : true;

      // Audit Log
      await db.engagementLogs.create({
        userId: req.user!._id,
        action: 'admin_delete_referee',
        page: '/admin',
        userAgent: `STAFF REMOVAL: Administrator "${req.user!.name}" deleted referee account "${user.name}" (${user.email}).`,
      });

      res.json({ message: `Referee account for "${user.name}" deleted successfully.` });
    } catch (error: any) {
      console.error('Admin delete referee error:', error);
      res.status(500).json({ error: 'Failed to delete referee account.' });
    }
  });

  /**
   * 10. Admin: Reset Referee Temporary Password
   * PUT /api/referee/admin/:id/reset-password
   */
  router.put('/admin/:id/reset-password', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters long.' });
        return;
      }

      const user = await db.users.findOne({ _id: id });
      if (!user) {
        res.status(404).json({ error: 'Referee account not found.' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(newPassword.trim(), salt);

      await db.users.update(id, {
        password_hash,
        passwordHash: password_hash,
      });

      // Audit Log
      await db.engagementLogs.create({
        userId: req.user!._id,
        action: 'admin_reset_referee_pwd',
        page: '/admin',
        userAgent: `STAFF SECURITY: Administrator "${req.user!.name}" updated credentials for referee "${user.name}".`,
      });

      res.json({ message: `Password for referee "${user.name}" updated successfully.` });
    } catch (error: any) {
      console.error('Admin reset referee password error:', error);
      res.status(500).json({ error: 'Failed to reset referee password.' });
    }
  });

  return router;
}
