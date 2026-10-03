import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import os from 'os';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { db, HealthServiceCheck, HealthLog, RecoveryLog } from '../db';
import dotenv from 'dotenv';
import { exec } from 'child_process';

dotenv.config();

// SMTP configurations (Prefer dedicated Resend configurations for health alerts, fallback to standard SMTP)
const RESEND_SMTP_HOST = process.env.RESEND_SMTP_HOST || process.env.SMTP_HOST || 'smtp.resend.com';
const RESEND_SMTP_PORT = parseInt(process.env.RESEND_SMTP_PORT || process.env.SMTP_PORT || '465', 10);
const RESEND_SMTP_USER = process.env.RESEND_SMTP_USER || process.env.SMTP_USER || 'resend';
const RESEND_SMTP_PASS = process.env.RESEND_SMTP_PASS || process.env.SMTP_PASS || '';
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || '';
const CRON_SCHEDULE = process.env.HEALTH_CHECK_CRON || '0 */3 * * *'; // Default: ~8 checks in 24h

// Keep track of last alert timestamps to prevent spamming (re-alert at most every 3 hours per service)
const lastAlertTimes: Record<string, number> = {};
const ALERT_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Setup SMTP Transporter for Resend Health Alerts
 */
const getTransporter = () => {
  if (!RESEND_SMTP_HOST || !RESEND_SMTP_USER || !RESEND_SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: RESEND_SMTP_HOST.trim().replace(/['"]/g, ''),
    port: RESEND_SMTP_PORT,
    secure: RESEND_SMTP_PORT === 465,
    auth: {
      user: RESEND_SMTP_USER.trim().replace(/['"]/g, ''),
      pass: RESEND_SMTP_PASS.trim().replace(/['"]/g, ''),
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * Send Email Alert
 */
export const sendEmailAlert = async (subject: string, htmlContent: string) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[Health Check] SMTP mailer is not configured. Alert skipped:', subject);
    return;
  }

  try {
    // Construct syntactically correct from address to prevent 501 Bad Sender syntax errors (e.g. if USER is 'resend')
    let fromAddress = process.env.RESEND_SMTP_FROM || process.env.SMTP_FROM || '';
    if (fromAddress) {
      fromAddress = fromAddress.trim().replace(/['"]/g, '').replace(/\\"/g, '"');
    }

    if (!fromAddress) {
      const activeUser = RESEND_SMTP_USER.trim().replace(/['"]/g, '');
      if (activeUser && activeUser.includes('@')) {
        fromAddress = `"CombatFlow Health Guard" <${activeUser}>`;
      } else {
        fromAddress = `"CombatFlow Health Guard" <onboarding@resend.dev>`;
      }
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to: ALERT_EMAIL_TO.trim().replace(/['"]/g, ''),
      subject,
      html: htmlContent,
    });
    console.log('[Health Check] SMTP Alert email sent successfully:', info.messageId);
  } catch (err: any) {
    console.error('[Health Check] Failed to send SMTP alert email:', err.message || err);
  }
};

/**
 * Formats bytes to MB/GB for logging
 */
const formatMB = (bytes: number) => {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

/**
 * Gets disk space details (platform-agnostic fallback)
 */
const checkDiskSpace = (): Promise<string> => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      resolve('Disk check skipped on Windows');
      return;
    }
    exec('df -h / | tail -1', (err, stdout) => {
      if (err || !stdout) {
        resolve('Free space: Indeterminate (Disk read failure)');
      } else {
        const parts = stdout.trim().split(/\s+/);
        const total = parts[1] || 'Unknown';
        const used = parts[2] || 'Unknown';
        const free = parts[3] || 'Unknown';
        const pct = parts[4] || 'Unknown';
        resolve(`Free: ${free} / Total: ${total} (Used: ${pct})`);
      }
    });
  });
};

/**
 * Executes a comprehensive health check on all core services
 */
export const runComprehensiveHealthCheck = async (isManual = false): Promise<HealthLog> => {
  console.log('[Health Check] Initiating comprehensive diagnostics...');
  const checkedAt = new Date().toISOString();
  const checks: HealthServiceCheck[] = [];

  // 1. Check MongoDB Connection
  const dbStart = Date.now();
  let dbStatus: 'up' | 'down' | 'degraded' = 'up';
  let dbMsg = 'Connected and responsive';
  try {
    if (!process.env.MONGODB_URI) {
      dbStatus = 'up';
      dbMsg = 'Operating on In-Memory Storage Engine (No external MongoDB Atlas URI provided)';
    } else if (mongoose.connection.readyState !== 1) {
      if (mongoose.connection.readyState === 2) {
        dbStatus = 'up';
        dbMsg = 'Database connection is currently initializing...';
      } else {
        dbStatus = 'down';
        dbMsg = 'Mongoose connection state is disconnected';
      }
    } else {
      // Run a quick ping command
      await mongoose.connection.db!.admin().ping();
      const dbElapsed = Date.now() - dbStart;
      dbMsg = `Connected (Ping: ${dbElapsed}ms)`;
    }
  } catch (err: any) {
    dbStatus = 'down';
    dbMsg = `MongoDB connection failed: ${err.message || err}`;
  }
  checks.push({
    service: 'MongoDB Database',
    status: dbStatus,
    message: dbMsg,
    checkedAt,
  });

  // 2. Check Cloudinary Connectivity
  const cloudStart = Date.now();
  let cloudStatus: 'up' | 'down' | 'degraded' = 'up';
  let cloudMsg = 'Configuration valid and API reachable';
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      cloudStatus = 'degraded';
      cloudMsg = 'Credentials missing in environment variables';
    } else {
      // Perform a minimal, real API resource query
      await cloudinary.api.resources({ max_results: 1 });
      const cloudElapsed = Date.now() - cloudStart;
      cloudMsg = `Reachable (API roundtrip: ${cloudElapsed}ms)`;
    }
  } catch (err: any) {
    // Check if it's a credentials error (401/403) which needs human attention, or a timeout
    if (err.http_code === 401 || err.http_code === 403) {
      cloudStatus = 'degraded';
      cloudMsg = `Cloudinary authentication failed (Check API credentials): ${err.message || err}`;
    } else {
      cloudStatus = 'down';
      cloudMsg = `Cloudinary API unresponsive: ${err.message || err}`;
    }
  }
  checks.push({
    service: 'Cloudinary CDN Storage',
    status: cloudStatus,
    message: cloudMsg,
    checkedAt,
  });

  // 3. Check System Resources (Uptime, Memory)
  const systemUptime = process.uptime();
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const memoryPct = (memUsage.rss / totalMem) * 100;
  
  let sysStatus: 'up' | 'down' | 'degraded' = 'up';
  let sysMsg = `Uptime: ${(systemUptime / 3600).toFixed(2)} hrs. Memory: ${formatMB(memUsage.rss)} (${memoryPct.toFixed(1)}% of total)`;
  
  if (memoryPct > 90) {
    sysStatus = 'degraded';
    sysMsg += ' - WARNING: Memory usage exceeds 90%';
  }
  checks.push({
    service: 'Server Host System',
    status: sysStatus,
    message: sysMsg,
    checkedAt,
  });

  // 4. Check Disk Space
  const diskDetails = await checkDiskSpace();
  checks.push({
    service: 'Disk Space Allocation',
    status: 'up',
    message: diskDetails,
    checkedAt,
  });

  // 5. Check API Route / DB Performance (Fetch 1 registration record)
  const apiStart = Date.now();
  let apiStatus: 'up' | 'down' | 'degraded' = 'up';
  let apiMsg = 'Performance nominal';
  try {
    const { RegistrationModel } = await import('../db');
    await RegistrationModel.findOne().lean();
    const apiElapsed = Date.now() - apiStart;
    apiMsg = `Query resolved in ${apiElapsed}ms`;
    if (apiElapsed > 5000) {
      apiStatus = 'degraded';
      apiMsg += ' - WARNING: Database query latency exceeds 5 seconds';
    } else if (apiElapsed > 1500) {
      apiStatus = 'degraded';
      apiMsg += ' - WARNING: Database query latency is elevated (>1.5s)';
    }
  } catch (err: any) {
    apiStatus = 'down';
    apiMsg = `Performance failure: ${err.message || err}`;
  }
  checks.push({
    service: 'API Latency Diagnostic',
    status: apiStatus,
    message: apiMsg,
    checkedAt,
  });

  // Compile final HealthLog
  const isHealthy = checks.every(c => c.status === 'up');
  const isDown = checks.some(c => c.status === 'down');
  const overallStatus = isDown ? 'down' : (isHealthy ? 'healthy' : 'degraded');

  const healthLogResult: Omit<HealthLog, '_id'> = {
    status: overallStatus,
    services: checks,
    checkedAt,
  };

  // Store in database
  let savedLog: HealthLog;
  try {
    savedLog = await db.healthLogs.create(healthLogResult);
  } catch (err) {
    console.error('[Health Check] Failed to save health log in DB:', err);
    savedLog = { _id: 'hl_temp_' + Date.now(), ...healthLogResult } as HealthLog;
  }

  // Handle Failure Triggering Alerts and Self-Recovery Actions
  for (const c of checks) {
    if (c.status === 'down' || c.status === 'degraded') {
      // Trigger instant self-recovery
      await handleSelfRecovery(c.service, c.message);

      // Trigger email alert with spam prevention
      const now = Date.now();
      const lastAlert = lastAlertTimes[c.service] || 0;
      if (now - lastAlert > ALERT_COOLDOWN_MS) {
        lastAlertTimes[c.service] = now;
        await sendEmailAlert(
          `🔴 ALERT: [${c.service}] is currently ${c.status.toUpperCase()}`,
          `<h3>CombatFlow Health Guard Alert</h3>
           <p><strong>Service:</strong> ${c.service}</p>
           <p><strong>Status:</strong> <span style="color: red; font-weight: bold;">${c.status.toUpperCase()}</span></p>
           <p><strong>Diagnostic Error:</strong> ${c.message}</p>
           <p><strong>Checked At:</strong> ${checkedAt}</p>
           <hr/>
           <p><a href="https://ais-dev-chfavylkk3ymesdwf3hz6i-52142162052.asia-southeast1.run.app/admin" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Admin Control Status Panel</a></p>
          `
        );
      }
    }
  }

  return savedLog;
};

/**
 * Handle Auto-Recovery Actions for safe, isolated failures
 */
const handleSelfRecovery = async (serviceName: string, issueMessage: string) => {
  console.log(`[Self Recovery] Analyzing failure for service: ${serviceName}...`);

  // 1. MongoDB Dropped Connection Connection Recovery
  if (serviceName === 'MongoDB Database' && (mongoose.connection.readyState as unknown as number) !== 1) {
    if (!process.env.MONGODB_URI) {
      console.log('[Self Recovery] Skipped MongoDB recovery because application is running on the in-memory engine.');
      return;
    }
    console.log('[Self Recovery] Initiating MongoDB exponential backoff reconnection...');
    const backoffs = [5000, 15000, 45000]; // Retries: 5s, 15s, 45s
    let success = false;

    for (let i = 0; i < backoffs.length; i++) {
      console.log(`[Self Recovery] Reconnect attempt ${i + 1}/${backoffs.length} in ${backoffs[i] / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, backoffs[i]));

      try {
        if ((mongoose.connection.readyState as unknown as number) === 1) {
          success = true;
          break;
        }
        if ((mongoose.connection.readyState as unknown as number) === 2) {
          // Connection already in progress by Mongoose initial boot, wait 3 more seconds
          await new Promise(resolve => setTimeout(resolve, 3000));
          if ((mongoose.connection.readyState as unknown as number) === 1) {
            success = true;
            break;
          }
        }
        await mongoose.connect(process.env.MONGODB_URI || '');
        if ((mongoose.connection.readyState as unknown as number) === 1) {
          success = true;
          break;
        }
      } catch (err) {
        console.error(`[Self Recovery] Reconnect attempt ${i + 1} failed.`);
      }
    }

    if (success) {
      console.log('[Self Recovery] MongoDB reconnection successful!');
      await db.recoveryLogs.create({
        service: 'MongoDB Database',
        issue: issueMessage,
        action: 'Reconnected using exponential backoff retry pool',
        outcome: 'resolved',
        details: 'Database connection successfully recovered and healthy.',
      });

      // Send a lighter auto-resolved email
      await sendEmailAlert(
        `🟢 RESOLVED: MongoDB reconnected automatically`,
        `<h3>Self-Recovery Successful</h3>
         <p>The <strong>MongoDB Database</strong> connection dropped but was successfully re-established by the auto-recovery agent.</p>
         <p><strong>Action Taken:</strong> Exponential backoff connection retries.</p>
         <p><strong>Outcome:</strong> <span style="color: green; font-weight: bold;">Auto-Resolved</span></p>`
      );
    } else {
      console.error('[Self Recovery] MongoDB reconnection pool failed completely after all backoffs.');
      await db.recoveryLogs.create({
        service: 'MongoDB Database',
        issue: issueMessage,
        action: 'Exponential backoff connection retries',
        outcome: 'failed',
        details: 'Reconnection attempts exhausted without success. Manual inspection required.',
      });
    }
    return;
  }

  // 2. Memory Usage GC triggers
  if (serviceName === 'Server Host System' && issueMessage.includes('Memory usage exceeds 90%')) {
    console.log('[Self Recovery] Elevated memory detected. Checking for exposed garbage collection (GC)...');
    if (global.gc) {
      try {
        global.gc();
        console.log('[Self Recovery] Garbage collection triggered successfully.');
        await db.recoveryLogs.create({
          service: 'Server Host System',
          issue: issueMessage,
          action: 'Triggered global.gc()',
          outcome: 'resolved',
          details: 'Forced garbage collector scan completed successfully.',
        });
      } catch (gcErr) {
        console.error('[Self Recovery] Failed to run exposed gc:', gcErr);
      }
    } else {
      console.warn('[Self Recovery] Garbage collection --expose-gc is not enabled on host Node process.');
      await db.recoveryLogs.create({
        service: 'Server Host System',
        issue: issueMessage,
        action: 'Inspect node process parameters',
        outcome: 'failed',
        details: 'Cannot run garbage collector without --expose-gc flag. Escalated to administrator.',
      });
    }
    return;
  }

  // 3. Route Slow query diagnostics
  if (serviceName === 'API Latency Diagnostic' && issueMessage.includes('latency')) {
    console.log('[Self Recovery] Elevated DB/API latency detected. Logging full environment state...');
    // We explicitly DO NOT restart the server for slow queries as it degrades user service
    await db.recoveryLogs.create({
      service: 'API Latency Diagnostic',
      issue: issueMessage,
      action: 'Log slow query diagnostic details',
      outcome: 'resolved',
      details: `CPU count: ${os.cpus().length} | Load average: ${os.loadavg().map(v => v.toFixed(2)).join(', ')} | System free memory: ${formatMB(os.freemem())}`,
    });
  }
};

/**
 * Prune health check log logs older than 30 days
 */
export const pruneOldHealthLogs = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = await db.healthLogs.deleteMany({ checkedAt: { $lt: thirtyDaysAgo } });
    console.log(`[Health Guard] Auto-pruning completed. Cleared obsolete health log logs.`);
  } catch (err) {
    console.error('[Health Guard] Pruning obsolete logs failed:', err);
  }
};

/**
 * Sends a lighter Daily Summary of diagnostics
 */
export const sendDailyHealthSummary = async () => {
  console.log('[Health Summary] Compiling 24h diagnostic history report...');
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const logs = await db.healthLogs.find({ checkedAt: { $gt: oneDayAgo } });

    if (logs.length === 0) {
      console.warn('[Health Summary] No diagnostic logs found to summarize for the past 24 hours.');
      return;
    }

    const totalChecks = logs.length;
    const unhealthyChecks = logs.filter((l: any) => l.status !== 'healthy').length;
    const healthyPct = (((totalChecks - unhealthyChecks) / totalChecks) * 100).toFixed(1);

    await sendEmailAlert(
      `📊 CombatFlow Daily Status Report: ${healthyPct}% Healthy`,
      `<h3>CombatFlow 24-Hour System Diagnostics Summary</h3>
       <p><strong>Total Scans Conducted:</strong> ${totalChecks}</p>
       <p><strong>Overall Availability Score:</strong> <span style="font-weight: bold; color: ${unhealthyChecks > 0 ? '#b45309' : 'green'}">${healthyPct}% Operational</span></p>
       <p><strong>Unhealthy / Degraded occurrences:</strong> ${unhealthyChecks}</p>
       <hr/>
       <h4>Recent Diagnostic Events:</h4>
       <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%; border-color: #cbd5e1;">
         <thead>
           <tr style="background-color: #f1f5f9;">
             <th>Timestamp</th>
             <th>Overall Status</th>
             <th>Services Logged</th>
           </tr>
         </thead>
         <tbody>
           ${logs.slice(0, 10).map((l: any) => `
             <tr>
               <td>${new Date(l.checkedAt).toLocaleString()}</td>
               <td style="color: ${l.status === 'healthy' ? 'green' : 'red'}; font-weight: bold;">${l.status.toUpperCase()}</td>
               <td>${l.services.map((s: any) => `${s.service} (${s.status.toUpperCase()})`).join(', ')}</td>
             </tr>
           `).join('')}
         </tbody>
       </table>
       <p><a href="https://ais-dev-chfavylkk3ymesdwf3hz6i-52142162052.asia-southeast1.run.app/admin" style="display: inline-block; background-color: #1e293b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">Open Status Dashboard</a></p>
      `
    );
  } catch (err) {
    console.error('[Health Summary] Failed to compile or transmit daily health summary:', err);
  }
};

/**
 * Start Scheduled Diagnostic Engine (Cron Scheduler)
 */
export const startHealthMonitoringService = () => {
  console.log(`[Health Guard] Scheduled scanning initialized. Interval pattern: "${CRON_SCHEDULE}"`);

  // 1. Core Service Monitor Cron
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await runComprehensiveHealthCheck();
      await pruneOldHealthLogs();
    } catch (err) {
      console.error('[Health Guard] Diagnostic cron cycle raised an exception:', err);
    }
  });

  // 2. Daily Summary Email Alert Cron (Every morning at 8:00 AM)
  cron.schedule('0 8 * * *', async () => {
    try {
      await sendDailyHealthSummary();
    } catch (err) {
      console.error('[Health Guard] Daily summary cycle raised an exception:', err);
    }
  });
};
