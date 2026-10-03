import { Response, Router } from 'express';
import { db, Registration, Match, EngagementLog, User } from '../db';
import { authenticateJWT, AuthenticatedRequest, requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/analytics (Admin only)
router.get('/', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await db.users.find();
    const registrations = await db.registrations.find();
    const matches = await db.matches.find();
    const galleryImages = await db.galleryImages.find();
    const logs = await db.engagementLogs.find();

    // 1. Core counters
    const stats = {
      totalUsers: users.length,
      totalRegistrations: registrations.length,
      totalMatches: matches.length,
      totalPhotos: galleryImages.length,
      totalInteractions: logs.length,
    };

    // 2. Registrations breakdown by gender
    const registrationsByGender = {
      male: registrations.filter((r: Registration) => r.gender === 'male').length,
      female: registrations.filter((r: Registration) => r.gender === 'female').length,
    };

    // 3. Registrations breakdown by weight division
    const registrationsByWeight: Record<string, number> = {};
    registrations.forEach((r: Registration) => {
      registrationsByWeight[r.weightCategory] = (registrationsByWeight[r.weightCategory] || 0) + 1;
    });

    // 4. Matches status breakdown
    const matchesByStatus = {
      pending: matches.filter((m: Match) => m.status === 'pending').length,
      live: matches.filter((m: Match) => m.status === 'live').length,
      completed: matches.filter((m: Match) => m.status === 'completed').length,
    };

    // 5. Engagement actions breakdown
    const logsByAction: Record<string, number> = {};
    logs.forEach((l: EngagementLog) => {
      logsByAction[l.action] = (logsByAction[l.action] || 0) + 1;
    });

    // 6. Popular pages
    const logsByPage: Record<string, number> = {};
    logs.forEach((l: EngagementLog) => {
      logsByPage[l.page] = (logsByPage[l.page] || 0) + 1;
    });

    // 7. Recent activity logs
    const recentActivity = [...logs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15)
      .map(log => {
        const u = users.find((usr: User) => usr._id === log.userId);
        return {
          ...log,
          userName: u ? u.name : 'Guest User',
          userEmail: u ? u.email : 'Anonymous',
        };
      });

    // 8. Device / User Agent breakdown (Mobile vs Desktop vs Other)
    let mobileCount = 0;
    let desktopCount = 0;
    let otherCount = 0;
    logs.forEach((l: EngagementLog) => {
      const ua = l.userAgent.toLowerCase();
      if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        mobileCount++;
      } else if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari')) {
        desktopCount++;
      } else {
        otherCount++;
      }
    });

    const userAgents = {
      mobile: mobileCount,
      desktop: desktopCount,
      other: otherCount,
    };

    res.json({
      stats,
      registrationsByGender,
      registrationsByWeight,
      matchesByStatus,
      logsByAction,
      logsByPage,
      recentActivity,
      userAgents,
    });
  } catch (error: any) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Server error generating system analytics' });
  }
});

// POST /api/analytics/track - Publicly record client interactions
router.post('/track', async (req, res) => {
  try {
    const { action, page, userId } = req.body;
    if (!action || !page) {
       res.status(400).json({ error: 'Action and page fields are required' });
       return;
    }

    await db.engagementLogs.create({
      userId: userId || null,
      action,
      page,
      userAgent: req.headers['user-agent'] || 'Unknown',
    });

    res.sendStatus(204);
  } catch (error) {
    console.error('Failed to log analytics metric:', error);
    res.sendStatus(500);
  }
});

export default router;
