import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, User } from '../db';

const getJWTSecret = () => process.env.JWT_SECRET || 'fallback_default_jwt_secret_must_be_long_and_secure';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token: string | undefined = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  jwt.verify(token, getJWTSecret(), async (err, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired session' });
      return;
    }
    
    try {
      const user = await db.users.findOne({ _id: decoded.id });
      if (!user) {
        res.status(404).json({ error: 'User associated with session not found' });
        return;
      }

      req.user = user;
      next();
    } catch (dbErr) {
      res.status(500).json({ error: 'Server authentication database error' });
    }
  });
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }
  if (req.user.role !== 'admin') {
     res.status(403).json({ error: 'Admin access required' });
     return;
  }
  next();
}

export function requireRefereeOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }
  if (req.user.role !== 'admin' && req.user.role !== 'referee') {
     res.status(403).json({ error: 'Referee or Admin access required' });
     return;
  }
  next();
}
