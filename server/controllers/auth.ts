import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { authenticateJWT, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sendOTP, resetTransporter, sendTestEmail } from '../utils/mailer';

const getJWTSecret = () => process.env.JWT_SECRET || 'fallback_default_jwt_secret_must_be_long_and_secure';
const router = Router();

/**
 * 1. POST /api/auth/signup/send-otp
 * Rate Limit: max 3 requests per 15 minutes.
 */
router.post('/signup/send-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if user already exists and is fully verified/registered
    let user = await db.users.findOne({ email: trimmedEmail });
    if (user && user.isVerified && (user.password_hash || user.passwordHash)) {
      res.status(400).json({ error: 'Email already registered. Please sign in.' });
      return;
    }

    // Rate-limiting check: max 3 requests per 15 minutes
    const now = new Date();
    if (user && user.otpLastRequestedAt) {
      const lastRequested = new Date(user.otpLastRequestedAt);
      const diffMs = now.getTime() - lastRequested.getTime();
      const fifteenMinutesMs = 15 * 60 * 1000;

      if (diffMs < fifteenMinutesMs) {
        if ((user.otpRequestCount || 0) >= 3) {
          res.status(429).json({
            error: 'Too many OTP requests. Please wait 15 minutes before trying again.'
          });
          return;
        }
      } else {
        // More than 15 minutes have passed, reset request count
        await db.users.update(user._id, { otpRequestCount: 0 });
        user.otpRequestCount = 0;
      }
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now

    // Send the OTP via mailer utility (runs on Gmail/Resend according to context)
    const result = await sendOTP(trimmedEmail, otp);
    if (!result.success) {
      res.status(500).json({
        error: `Failed to send verification email: ${result.error || 'SMTP misconfigured'}`
      });
      return;
    }

    const requestCount = user ? (user.otpRequestCount || 0) + 1 : 1;

    const updates = {
      otp,
      otpExpiresAt,
      isVerified: false,
      otpAttempts: 0,
      otpRequestCount: requestCount,
      otpLastRequestedAt: now.toISOString(),
      role: 'player' as const
    };

    if (user) {
      // Update existing unverified/partial user record
      await db.users.update(user._id, updates);
    } else {
      // Create a temporary unverified user record
      await db.users.create({
        name: trimmedEmail.split('@')[0],
        email: trimmedEmail,
        phone: '',
        password_hash: '',
        passwordHash: '',
        ...updates
      });
    }

    res.json({
      message: 'Verification code sent successfully!',
      previewUrl: result.previewUrl,
      otpCode: result.wasFallback ? otp : undefined, // Returned for sandbox testing
    });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Server error while sending verification code' });
  }
});

/**
 * 2. POST /api/auth/signup/verify-otp
 * Verifies the 6-digit OTP. Max 5 attempts allowed before expiration.
 */
router.post('/signup/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({ error: 'Email and verification code are required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const user = await db.users.findOne({ email: trimmedEmail });
    if (!user) {
      res.status(400).json({ error: 'No verification request found for this email. Please request a new code.' });
      return;
    }

    // Check expiration
    if (!user.otpExpiresAt || Date.now() > new Date(user.otpExpiresAt).getTime()) {
      res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      return;
    }

    // Check max attempts (5)
    const currentAttempts = user.otpAttempts || 0;
    if (currentAttempts >= 5) {
      res.status(400).json({ error: 'Maximum verification attempts exceeded. Please request a new code.' });
      return;
    }

    // Increment attempt counter
    await db.users.update(user._id, { otpAttempts: currentAttempts + 1 });

    if (user.otp !== cleanCode) {
      res.status(400).json({ error: 'Invalid verification code. Please check your inbox and try again.' });
      return;
    }

    // Success - mark user as verified
    await db.users.update(user._id, {
      isVerified: true,
      otpAttempts: 0,
      otp: null,
      otpExpiresAt: null
    });

    res.json({
      message: 'Email verified successfully!',
      verified: true
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Server error while verifying code' });
  }
});

/**
 * 3. POST /api/auth/signup/set-password
 * Complete registration after verification. Sets password and profile fields.
 */
router.post('/signup/set-password', async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await db.users.findOne({ email: trimmedEmail });

    if (!user || !user.isVerified) {
      res.status(400).json({ error: 'Email has not been verified yet. Please verify your email first.' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const updatedUser = await db.users.update(user._id, {
      name: (name || trimmedEmail.split('@')[0]).trim(),
      phone: (phone || '').trim(),
      password_hash: passwordHash,
      passwordHash: passwordHash
    });

    if (!updatedUser) {
      res.status(500).json({ error: 'Failed to update password' });
      return;
    }

    // Generate JWT
    const token = jwt.sign({ id: updatedUser._id, role: updatedUser.role }, getJWTSecret(), {
      expiresIn: '7d',
    });

    // Set secure httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'none'
    });

    res.status(201).json({
      success: true,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role as 'admin' | 'player' | 'referee',
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Server error during password registration' });
  }
});

// Unified sign-in handler for all roles
const handleSignIn = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await db.users.findOne({ email: trimmedEmail });
    if (!user) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    const activeHash = user.passwordHash || user.password_hash;
    if (!activeHash) {
      res.status(400).json({ error: 'This email is registered but has no password set. Please complete verification.' });
      return;
    }

    // Support both exact match and trimmed match (common for manually created staff accounts)
    const isMatch = bcrypt.compareSync(password, activeHash) || bcrypt.compareSync(password.trim(), activeHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ id: user._id, role: user.role }, getJWTSecret(), {
      expiresIn: '7d',
    });

    // Set secure httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'none'
    });

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role as 'admin' | 'player' | 'referee',
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

router.post('/signin', handleSignIn);
router.post('/login', handleSignIn);

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// Alias for legacy send-otp
router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const trimmedEmail = email.trim().toLowerCase();
    
    // Check if user already exists
    const existingUser = await db.users.findOne({ email: trimmedEmail });
    if (existingUser && existingUser.isVerified && (existingUser.passwordHash || existingUser.password_hash)) {
       return res.status(400).json({ error: 'Email already registered' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await sendOTP(trimmedEmail, otp);
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }

    const now = new Date();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const updates = {
      otp,
      otpExpiresAt,
      isVerified: false,
      otpAttempts: 0,
      otpLastRequestedAt: now.toISOString(),
    };

    if (existingUser) {
      await db.users.update(existingUser._id, updates);
    } else {
      await db.users.create({
        name: trimmedEmail.split('@')[0],
        email: trimmedEmail,
        phone: '',
        password_hash: '',
        passwordHash: '',
        role: 'player',
        ...updates
      });
    }

    return res.json({
      message: 'Verification code sent successfully!',
      previewUrl: result.previewUrl,
      otpCode: result.wasFallback ? otp : undefined,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Alias for legacy verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    const trimmedEmail = email.trim().toLowerCase();
    const user = await db.users.findOne({ email: trimmedEmail });
    if (!user || user.otp !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    await db.users.update(user._id, { isVerified: true });
    return res.json({ message: 'Email verified successfully!', verified: true });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Alias for legacy signup complete
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const trimmedEmail = email.trim().toLowerCase();
    const user = await db.users.findOne({ email: trimmedEmail });
    if (!user || !user.isVerified) {
      return res.status(400).json({ error: 'Please verify email with OTP first' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const updatedUser = await db.users.update(user._id, {
      name: name || trimmedEmail.split('@')[0],
      phone: phone || '',
      password_hash: hash,
      passwordHash: hash
    });
    const token = jwt.sign({ id: updatedUser._id, role: updatedUser.role }, getJWTSecret(), {
      expiresIn: '7d',
    });
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'none'
    });
    return res.status(201).json({
      success: true,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticateJWT as any, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role as 'admin' | 'player' | 'referee',
      createdAt: req.user.createdAt,
    },
  });
});

/**
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, phone, password } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const updates: any = {
      name,
      phone: phone || '',
    };

    if (password && password.trim() !== '') {
      const hash = bcrypt.hashSync(password, 10);
      updates.password_hash = hash;
      updates.passwordHash = hash;
    }

    const updatedUser = await db.users.update(req.user._id, updates);
    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: 'Profile updated successfully!',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role as 'admin' | 'player' | 'referee',
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error during profile update' });
  }
});

// Helper to write SMTP configs to the .env file
function saveEnvConfig(config: Record<string, string>) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  const lines = envContent.split('\n');
  const updatedLines = [...lines];
  
  for (const [key, value] of Object.entries(config)) {
    let keyFound = false;
    for (let i = 0; i < updatedLines.length; i++) {
      const line = updatedLines[i].trim();
      if (line.startsWith(`${key}=`) || line.startsWith(`# ${key}=`)) {
        updatedLines[i] = `${key}="${value.replace(/"/g, '\\"')}"`;
        keyFound = true;
        break;
      }
    }
    if (!keyFound) {
      updatedLines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    }
  }
  
  fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf-8');
}

/**
 * GET /api/auth/smtp (Admin only)
 */
router.get('/smtp', authenticateJWT as any, requireAdmin as any, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT || '587',
    user: process.env.SMTP_USER || '',
    from: process.env.SMTP_FROM || '"CombatFlow Taekwondo" <no-reply@combatflow.com>',
    hasPassword: !!process.env.SMTP_PASS,
  });
});

/**
 * POST /api/auth/smtp (Admin only)
 */
router.post('/smtp', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host, port, user, pass, from } = req.body;

    if (!host || !port || !user) {
      res.status(400).json({ error: 'SMTP Host, Port, and User are required' });
      return;
    }

    const updates: Record<string, string> = {
      SMTP_HOST: host.trim(),
      SMTP_PORT: port.toString().trim(),
      SMTP_USER: user.trim(),
      SMTP_FROM: from ? from.trim() : '"CombatFlow Taekwondo" <no-reply@combatflow.com>',
    };

    if (pass !== undefined && pass !== '') {
      updates.SMTP_PASS = pass;
    }

    saveEnvConfig(updates);

    for (const [key, value] of Object.entries(updates)) {
      process.env[key] = value;
    }

    resetTransporter();

    res.json({
      message: 'SMTP settings updated successfully!',
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        from: process.env.SMTP_FROM,
        hasPassword: !!process.env.SMTP_PASS,
      }
    });
  } catch (error: any) {
    console.error('Error saving SMTP config:', error);
    res.status(500).json({ error: 'Failed to save SMTP configuration' });
  }
});

/**
 * POST /api/auth/smtp/test (Admin only)
 */
router.post('/smtp/test', authenticateJWT as any, requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { testEmail } = req.body;

    if (!testEmail) {
      res.status(400).json({ error: 'Test destination email address is required' });
      return;
    }

    const result = await sendTestEmail(testEmail.trim());

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Failed to send test email.' });
      return;
    }

    if (result.wasFallback) {
      res.json({
        message: `No custom SMTP is configured. Successfully simulated sending using Ethereal Test Mailer!`,
        previewUrl: result.previewUrl,
        wasFallback: true
      });
      return;
    }

    res.json({ message: `Test email sent successfully to ${testEmail}!` });
  } catch (error: any) {
    console.error('SMTP testing endpoint error:', error);
    res.status(500).json({ error: error.message || 'Server error during SMTP verification test.' });
  }
});

export default router;
