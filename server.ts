import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Validate and load/generate JWT_SECRET (resilient fallback for zero-downtime environments)
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.warn('\n================================================================================');
  console.warn('WARNING: process.env.JWT_SECRET is missing or too short (< 32 characters).');
  console.warn('To avoid server crash and maintain high security, a single-use cryptographically');
  console.warn('strong 256-bit fallback key has been generated for this server session.');
  console.warn('Note: Server restarts will invalidate existing active user sessions.');
  console.warn('To persist sessions, set a permanent 32+ character JWT_SECRET in your environment.');
  console.warn('================================================================================\n');

  jwtSecret = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = jwtSecret;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, origin || true),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

const PORT = parseInt(process.env.PORT || '3000', 10);

// Parsers & Cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global API request logger for debugging
app.use('/api', (req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

// Uploads folder is no longer served statically as files now reside securely on Cloudinary CDN.

// Socket.io real-time connection routing
io.on('connection', (socket) => {
  console.log(`Socket connection initialized: ${socket.id}`);

  // Competitor/Viewer subscribes to real-time updates for a category + gender room
  socket.on('join_room', (data: { weightCategory: string; gender: string }) => {
    if (data && data.weightCategory && data.gender) {
      const roomName = `${data.weightCategory}-${data.gender}`.toLowerCase().replace(/\s+/g, '_');
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room: ${roomName}`);
    }
  });

  socket.on('leave_room', (data: { weightCategory: string; gender: string }) => {
    if (data && data.weightCategory && data.gender) {
      const roomName = `${data.weightCategory}-${data.gender}`.toLowerCase().replace(/\s+/g, '_');
      socket.leave(roomName);
      console.log(`Socket ${socket.id} left room: ${roomName}`);
    }
  });

  // Echo general messages or system status updates
  socket.on('disconnect', () => {
    console.log(`Socket connection terminated: ${socket.id}`);
  });
});

// Import controllers
import authRouter from './server/controllers/auth';
import registrationRouter from './server/controllers/registration';
import initMatchRouter from './server/controllers/match';
import galleryRouter from './server/controllers/gallery';
import analyticsRouter from './server/controllers/analytics';
import eventsRouter from './server/controllers/events';
import categoryRouter from './server/controllers/category';
import healthRouter from './server/controllers/health';
import initDrawRouter from './server/controllers/draw';
import initRefereeRouter from './server/controllers/referee';
import certificateRouter from './server/controllers/certificate';
import coachRouter from './server/controllers/coach';
import { startHealthMonitoringService } from './server/services/healthCheck';
import { sendTournamentInquiryEmail } from './server/utils/mailer';

// Start background health monitoring and automated recovery cron scheduler
startHealthMonitoringService();

// Bind API routes
app.use('/api/auth', authRouter);
app.use('/api/registrations', registrationRouter);
app.use('/api/matches', initMatchRouter(io));
app.use('/api/gallery', galleryRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/admin/health', healthRouter);
app.use('/api/draws', initDrawRouter(io));
app.use('/api/referee', initRefereeRouter(io));
app.use('/api/certificates', certificateRouter);
app.use('/api/coaches', coachRouter);

// POST /api/inquiries - Handle tournament organizer inquiries and email admin
app.post('/api/inquiries', async (req, res) => {
  try {
    const { fullName, email, phone, organization, tournamentName, athleteCount, message } = req.body;
    if (!fullName || !email) {
      res.status(400).json({ error: 'Full name and email address are required.' });
      return;
    }
    const newInquiry = {
      _id: 'inq_' + Date.now().toString(36),
      fullName: String(fullName).trim(),
      email: String(email).trim(),
      phone: String(phone || '').trim(),
      organization: String(organization || '').trim(),
      tournamentName: String(tournamentName || '').trim(),
      athleteCount: athleteCount ? Number(athleteCount) || 0 : undefined,
      message: String(message || '').trim(),
      createdAt: new Date().toISOString()
    };

    // Send complete inquiry to bharathrajgowdajb007@gmail.com
    let emailStatus: { success: boolean; previewUrl?: string; error?: string } = { success: false };
    try {
      emailStatus = await sendTournamentInquiryEmail(newInquiry);
      console.log(`[API /api/inquiries] Email dispatch result for ${newInquiry.email}:`, emailStatus);
    } catch (mailErr) {
      console.error('[API /api/inquiries] Error dispatching email to bharathrajgowdajb007@gmail.com:', mailErr);
    }

    res.status(201).json({
      success: true,
      inquiry: newInquiry,
      emailSent: emailStatus.success,
      previewUrl: emailStatus.previewUrl
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process tournament inquiry.' });
  }
});

// Set up server-side Vite client server integration (MERN)
const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(__dirname, 'dist'));

if (!isProd) {
  // Development Mode using Vite Dev Server
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    appType: 'custom',
  });

  app.use(vite.middlewares);

  app.get('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  // Production Mode serving pre-built assets
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist/index.html'));
  });
}

// Start full-stack web application server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`=== MERN Taekwondo Event Management Server Active ===`);
  console.log(`Running in ${isProd ? 'production' : 'development'} mode`);
  console.log(`Hosting Address: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
