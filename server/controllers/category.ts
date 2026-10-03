import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateJWT, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/categories - List categories (optionally scoped by ?eventId=)
router.get('/', async (req, res) => {
  try {
    const { eventId } = req.query;

    if (eventId && typeof eventId === 'string') {
      const allCategories = await db.categories.find();
      const eventScoped = allCategories.filter(c => c.eventId === eventId);
      
      if (eventScoped.length > 0) {
        return res.json(eventScoped);
      }
      
      // Fallback: If this event does not have customized categories yet, return global templates
      const globalDefaults = allCategories.filter(c => !c.eventId);
      return res.json(globalDefaults);
    }

    const list = await db.categories.find();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve categories.' });
  }
});

// POST /api/categories - Create or Update a category (Admin only)
router.post('/', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { _id, name, minAge, maxAge, maleWeightClasses, femaleWeightClasses, eventId } = req.body;
    
    if (!name || minAge === undefined || maxAge === undefined || !maleWeightClasses || !femaleWeightClasses) {
      res.status(400).json({ error: 'All fields are required (name, minAge, maxAge, maleWeightClasses, femaleWeightClasses).' });
      return;
    }

    const cleanName = name.trim();
    const cleanEventId = eventId ? String(eventId).trim() : undefined;
    const catId = _id || (cleanEventId ? `${cleanEventId}_${cleanName.replace(/\s+/g, '-')}` : cleanName.replace(/\s+/g, '-'));

    // Check if exists
    const existing = await db.categories.findOne({ _id: catId });
    if (existing) {
      // Update
      const updated = await db.categories.update(catId, {
        name: cleanName,
        minAge: parseInt(minAge, 10),
        maxAge: parseInt(maxAge, 10),
        maleWeightClasses: Array.isArray(maleWeightClasses) ? maleWeightClasses : [],
        femaleWeightClasses: Array.isArray(femaleWeightClasses) ? femaleWeightClasses : [],
        eventId: cleanEventId
      });
      res.json(updated);
      return;
    }

    // Create
    const newCat = await db.categories.create({
      _id: catId,
      name: cleanName,
      minAge: parseInt(minAge, 10),
      maxAge: parseInt(maxAge, 10),
      maleWeightClasses: Array.isArray(maleWeightClasses) ? maleWeightClasses : [],
      femaleWeightClasses: Array.isArray(femaleWeightClasses) ? femaleWeightClasses : [],
      eventId: cleanEventId
    });

    res.status(201).json(newCat);
  } catch (error) {
    console.error('Error creating dynamic category:', error);
    res.status(500).json({ error: 'Failed to save category.' });
  }
});

// POST /api/categories/clone - Copy categories from another event or global templates to target event (Admin only)
router.post('/clone', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetEventId, sourceEventId } = req.body;

    if (!targetEventId) {
      res.status(400).json({ error: 'targetEventId is required.' });
      return;
    }

    const allCategories = await db.categories.find();
    let sourceCategories: typeof allCategories = [];

    if (sourceEventId) {
      sourceCategories = allCategories.filter(c => c.eventId === sourceEventId);
    }
    
    // If no source categories found from specified source event, use global templates
    if (sourceCategories.length === 0) {
      sourceCategories = allCategories.filter(c => !c.eventId);
    }

    // Remove existing categories for target event first
    const existingTargetCats = allCategories.filter(c => c.eventId === targetEventId);
    for (const c of existingTargetCats) {
      await db.categories.delete(c._id);
    }

    // Create independent clones
    const cloned = [];
    for (const sc of sourceCategories) {
      const cleanName = sc.name.trim();
      const newId = `${targetEventId}_${cleanName.replace(/\s+/g, '-')}_${Math.random().toString(36).substring(2, 6)}`;
      const newDoc = await db.categories.create({
        _id: newId,
        name: cleanName,
        minAge: sc.minAge,
        maxAge: sc.maxAge,
        maleWeightClasses: [...sc.maleWeightClasses],
        femaleWeightClasses: [...sc.femaleWeightClasses],
        eventId: targetEventId
      });
      cloned.push(newDoc);
    }

    res.status(201).json({ message: `Successfully cloned ${cloned.length} categories for event ${targetEventId}.`, categories: cloned });
  } catch (error) {
    console.error('Error cloning categories:', error);
    res.status(500).json({ error: 'Failed to clone categories.' });
  }
});

// DELETE /api/categories/:id - Delete a category (Admin only)
router.delete('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await db.categories.delete(id);
    if (!success) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    res.json({ message: 'Category deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

export default router;
