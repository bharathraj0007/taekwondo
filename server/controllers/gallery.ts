import { Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { authenticateJWT, AuthenticatedRequest, requireAdmin } from '../middleware/auth';

const router = Router();

// Ensure uploads folder exists
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = 'gallery_' + Math.random().toString(36).substring(2, 11);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter (images only)
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);

    if (extName && mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Only standard images are allowed (JPEG, PNG, WEBP, GIF)'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET /api/gallery - Public access to event photo grid
router.get('/', async (req, res) => {
  try {
    const images = await db.galleryImages.find();
    
    // Log engagement
    await db.engagementLogs.create({
      userId: null,
      action: 'view_gallery',
      page: '/gallery',
      userAgent: req.headers['user-agent'] || 'Unknown'
    });

    res.json(images);
  } catch (error: any) {
    console.error('Error fetching gallery images:', error);
    res.status(500).json({ error: 'Server error fetching photo gallery' });
  }
});

// POST /api/gallery/upload - Admin upload of images
router.post('/upload', authenticateJWT as any, requireAdmin as any, (req: AuthenticatedRequest, res: Response) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
       res.status(400).json({ error: err.message || 'Error uploading file' });
       return;
    }

    try {
      if (!req.file) {
         res.status(400).json({ error: 'No image file provided' });
         return;
      }

      const { caption } = req.body;
      const imageUrl = `/uploads/${req.file.filename}`;

      const galleryItem = await db.galleryImages.create({
        imageUrl,
        caption: caption || 'Taekwondo Event Photo',
        uploadedBy: req.user!.name,
      });

      res.status(201).json({
        message: 'Photo uploaded and added to public gallery successfully!',
        image: galleryItem,
      });
    } catch (error: any) {
      console.error('Gallery database save error:', error);
      res.status(500).json({ error: 'Server error saving gallery metadata' });
    }
  });
});

// DELETE /api/gallery/:id - Admin delete photo
router.delete('/:id', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const items = await db.galleryImages.find();
    const item = items.find((g: any) => g._id === id);
    if (!item) {
       res.status(404).json({ error: 'Gallery photo not found' });
       return;
    }

    // Delete image file
    const filename = path.basename(item.imageUrl);
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (fErr) {
        console.error('Failed to delete file', filePath, fErr);
      }
    }

    await db.galleryImages.delete(id);
    res.json({ message: 'Gallery photo deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting gallery photo:', error);
    res.status(500).json({ error: 'Server error deleting gallery photo' });
  }
});

export default router;
