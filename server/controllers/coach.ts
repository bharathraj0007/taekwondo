import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateJWT, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/coaches - List all coaches
router.get('/', async (req, res) => {
  try {
    const list = await db.coaches.find();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve coaches.' });
  }
});

// POST /api/coaches - Create a coach
router.post('/', async (req, res) => {
  try {
    const { name, eventId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Coach name is required.' });
      return;
    }

    const normName = String(name).trim();
    // Case-insensitive duplicate check
    const existingList = await db.coaches.find();
    const duplicate = existingList.find(c => c.name.toLowerCase() === normName.toLowerCase());

    let coachRecord = duplicate;
    if (!coachRecord) {
      coachRecord = await db.coaches.create({ name: normName });
    }

    // If eventId is provided, also add the coach to that event's allowedCoachIds
    if (eventId) {
      const event = await db.events.findOne({ _id: eventId });
      if (event) {
        const allowed = event.allowedCoachIds || [];
        if (!allowed.includes(coachRecord._id)) {
          await db.events.update(eventId, {
            allowedCoachIds: [...allowed, coachRecord._id]
          });
        }
      }
    }

    res.status(201).json(coachRecord);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add coach.' });
  }
});

// PUT /api/coaches/:id - Update a coach's name (Admin only)
router.put('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Coach name is required.' });
      return;
    }

    const normName = String(name).trim();
    const existing = await db.coaches.findOne({ _id: id });
    if (!existing) {
      res.status(404).json({ error: 'Coach not found.' });
      return;
    }

    // Case-insensitive duplicate check for other coaches
    const existingList = await db.coaches.find();
    const duplicate = existingList.find(c => c._id !== id && c.name.toLowerCase() === normName.toLowerCase());
    if (duplicate) {
      res.status(400).json({ error: 'A coach with this name already exists.' });
      return;
    }

    const updated = await db.coaches.update(id, { name: normName });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update coach.' });
  }
});

// DELETE /api/coaches/:id - Delete a coach (Admin only)
router.delete('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const coach = await db.coaches.findOne({ _id: id });
    if (!coach) {
      res.status(404).json({ error: 'Coach not found.' });
      return;
    }

    // Also remove from all events' allowedCoachIds
    const events = await db.events.find();
    for (const e of events) {
      if (e.allowedCoachIds && e.allowedCoachIds.includes(id)) {
        await db.events.update(e._id, {
          allowedCoachIds: e.allowedCoachIds.filter(cid => cid !== id)
        });
      }
    }

    const success = await db.coaches.delete(id);
    if (!success) {
      res.status(500).json({ error: 'Failed to delete coach.' });
      return;
    }

    res.json({ message: 'Coach successfully deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete coach.' });
  }
});

export default router;
