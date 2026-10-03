import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;
let testAccount: any = null;
let isFallback = false;

async function setupEthereal() {
  console.log('No SMTP config found or custom SMTP failed. Creating an Ethereal test mailer account...');
  try {
    testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    isFallback = true;
    console.log('Ethereal SMTP test account generated: ', testAccount.user);
  } catch (err) {
    console.error('Failed to create Ethereal test account, falling back to mock mailer:', err);
    // Fallback: Mock transporter that logs to console
    transporter = {
      sendMail: async (options: any) => {
        console.log('--- MOCK EMAIL SENT ---');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body:\n${options.text}`);
        console.log('-----------------------');
        return { messageId: 'mock_id_' + Math.random().toString(36).substring(2, 9) };
      }
    } as any;
    isFallback = true;
  }
}

async function getTransporter(forceRefresh = false) {
  if (transporter && !forceRefresh) return transporter;

  // Prefer dedicated Google Mail/Gmail SMTP credentials for Player OTPs
  let googleUser = process.env.GOOGLE_SMTP_USER;
  let googlePass = process.env.GOOGLE_SMTP_PASS;

  if (googleUser && googlePass) {
    googleUser = googleUser.trim().replace(/['"]/g, '');
    googlePass = googlePass.trim().replace(/['"]/g, '');

    // Clean Google App Passwords (spaces stripped, exactly 16 letters lowercase)
    const cleanedPass = googlePass.replace(/\s+/g, '');
    if (cleanedPass.length === 16 && /^[a-z]+$/i.test(cleanedPass)) {
      googlePass = cleanedPass.toLowerCase();
    }

    console.log(`SMTP [Player OTP]: Initializing dedicated Google Mail transporter for: ${googleUser}`);
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: googleUser,
        pass: googlePass,
      },
    });
    isFallback = false;
    return transporter;
  }

  let host = process.env.SMTP_HOST;
  if (host) {
    host = host.trim();
    if (host.startsWith('"') && host.endsWith('"')) host = host.slice(1, -1);
    if (host.startsWith("'") && host.endsWith("'")) host = host.slice(1, -1);
  }

  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT.replace(/['"]/g, '').trim(), 10) : 587;

  let user = process.env.SMTP_USER;
  if (user) {
    user = user.trim();
    if (user.startsWith('"') && user.endsWith('"')) user = user.slice(1, -1);
    if (user.startsWith("'") && user.endsWith("'")) user = user.slice(1, -1);
  }

  let pass = process.env.SMTP_PASS;
  if (pass) {
    pass = pass.trim();
    if (pass.startsWith('"') && pass.endsWith('"')) pass = pass.slice(1, -1);
    if (pass.startsWith("'") && pass.endsWith("'")) pass = pass.slice(1, -1);
  }

  // Clean Google App Passwords (spaces stripped, exactly 16 letters lowercase)
  if (pass && (host?.includes('gmail') || host?.includes('google') || user?.includes('gmail'))) {
    const cleanedPass = pass.replace(/\s+/g, '');
    if (cleanedPass.length === 16 && /^[a-z]+$/i.test(cleanedPass)) {
      console.log('SMTP: Detected 16-character Google App Password format. Normalizing by stripping spaces.');
      pass = cleanedPass.toLowerCase();
    }
  }

  if (host && user && pass) {
    console.log(`SMTP: Initializing configured SMTP settings for mailer: ${user} @ ${host}`);
    
    const transportConfig: any = {
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    };

    if (host.toLowerCase().includes('gmail') || host.toLowerCase().includes('google') || user.toLowerCase().includes('gmail')) {
      console.log('SMTP: Using specialized "gmail" service adapter for maximum compatibility.');
      transportConfig.service = 'gmail';
      transportConfig.auth = { user, pass };
    } else {
      transportConfig.host = host;
      transportConfig.port = port;
      transportConfig.secure = port === 465;
      transportConfig.auth = { user, pass };
      transportConfig.tls = {
        rejectUnauthorized: false
      };
    }

    transporter = nodemailer.createTransport(transportConfig);
    isFallback = false;
  } else {
    await setupEthereal();
  }

  return transporter;
}

export async function sendOTP(email: string, otp: string) {
  try {
    let client = await getTransporter();
    if (!client) {
      throw new Error('Mailer transporter failed to initialize');
    }

    // Dynamic resolution of the "from" sender address
    let fromAddress = process.env.GOOGLE_SMTP_FROM || process.env.GOOGLE_SMTP_USER || process.env.SMTP_FROM || '"CombatFlow Taekwondo" <no-reply@combatflow.com>';
    if (fromAddress) {
      fromAddress = fromAddress.trim();
      if (fromAddress.startsWith('"') && fromAddress.endsWith('"')) fromAddress = fromAddress.slice(1, -1);
      if (fromAddress.startsWith("'") && fromAddress.endsWith("'")) fromAddress = fromAddress.slice(1, -1);
      fromAddress = fromAddress.replace(/\\"/g, '"');
    }

    // Gmail requires authenticated email as the sender inside <...>
    const activeGoogleUser = process.env.GOOGLE_SMTP_USER?.trim().replace(/['"]/g, '');
    if (activeGoogleUser && !fromAddress.includes(activeGoogleUser)) {
      fromAddress = `"CombatFlow Taekwondo" <${activeGoogleUser}>`;
    }
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 24px; font-weight: 800; color: #dc2626; letter-spacing: -0.025em;">CombatFlow Taekwondo</span>
        </div>
        <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px; text-align: center;">Verify Your Email Address</h2>
        <p style="color: #475569; font-size: 15px; line-height: 24px; margin-bottom: 24px;">
          Thank you for registering. To complete your signup and create your account, please enter the following 6-digit verification code:
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 14px 28px; font-size: 28px; font-weight: 800; letter-spacing: 0.25em; color: #0f172a;">
            ${otp}
          </div>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 20px; margin-bottom: 24px; text-align: center;">
          This verification code is valid for <strong>5 minutes</strong>. If you did not request this, please delete this email.
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          CombatFlow Taekwondo © 2026. All rights reserved.
        </p>
      </div>
    `;

    const textContent = `Welcome to CombatFlow Taekwondo!\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 5 minutes. If you did not request this code, please ignore this email.`;

    let info;
    try {
      info = await client.sendMail({
        from: fromAddress,
        to: email,
        subject: 'CombatFlow Taekwondo - Email Verification Code',
        text: textContent,
        html: htmlContent,
      });
    } catch (sendErr: any) {
      console.error('SMTP Error: Custom mailer failed to send OTP:', sendErr.message || sendErr);
      // If SMTP is explicitly configured, DO NOT fallback to Ethereal. Bubble up the error.
      if (!isFallback) {
        throw sendErr;
      } else {
        // Only if we were already in Ethereal fallback due to missing credentials, try Ethereal setup again or throw
        throw sendErr;
      }
    }

    let previewUrl: string | undefined;
    if (testAccount && isFallback) {
      previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      console.log(`Ethereal Email sent successfully. Preview URL: ${previewUrl}`);
    }

    return { success: true, previewUrl, wasFallback: isFallback };
  } catch (err: any) {
    console.error('Error in sendOTP mailer helper:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export function resetTransporter() {
  transporter = null;
  testAccount = null;
  isFallback = false;
}

export async function sendTestEmail(email: string) {
  try {
    let client = await getTransporter();
    if (!client) {
      throw new Error('Mailer transporter failed to initialize');
    }

    // Dynamic resolution of the "from" sender address
    let fromAddress = process.env.GOOGLE_SMTP_FROM || process.env.GOOGLE_SMTP_USER || process.env.SMTP_FROM || '"CombatFlow Taekwondo" <no-reply@combatflow.com>';
    if (fromAddress) {
      fromAddress = fromAddress.trim();
      if (fromAddress.startsWith('"') && fromAddress.endsWith('"')) fromAddress = fromAddress.slice(1, -1);
      if (fromAddress.startsWith("'") && fromAddress.endsWith("'")) fromAddress = fromAddress.slice(1, -1);
      fromAddress = fromAddress.replace(/\\"/g, '"');
    }

    // Gmail requires authenticated email as the sender inside <...>
    const activeGoogleUser = process.env.GOOGLE_SMTP_USER?.trim().replace(/['"]/g, '');
    if (activeGoogleUser && !fromAddress.includes(activeGoogleUser)) {
      fromAddress = `"CombatFlow Taekwondo" <${activeGoogleUser}>`;
    }
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 24px; font-weight: 800; color: #dc2626; letter-spacing: -0.025em;">CombatFlow Taekwondo</span>
        </div>
        <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px; text-align: center;">SMTP Configuration Active</h2>
        <p style="color: #475569; font-size: 15px; line-height: 24px; margin-bottom: 24px; text-align: center;">
          Congratulations! This test email confirms that your SMTP configuration is connected and working correctly.
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          CombatFlow Taekwondo © 2026. All rights reserved.
        </p>
      </div>
    `;

    const textContent = `Hello!\n\nThis is a test email confirming that your SMTP settings for CombatFlow Taekwondo have been configured and are working successfully.\n\nTime of test: ${new Date().toISOString()}`;

    let info;
    try {
      info = await client.sendMail({
        from: fromAddress,
        to: email,
        subject: 'CombatFlow Taekwondo - SMTP Configuration Test',
        text: textContent,
        html: htmlContent,
      });
    } catch (sendErr: any) {
      console.error('SMTP Error: Custom SMTP test email failed:', sendErr.message || sendErr);
      // DO NOT fallback to Ethereal when SMTP is configured. Let the user see their error.
      throw sendErr;
    }

    let previewUrl: string | undefined;
    if (testAccount && isFallback) {
      previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    }

    return { 
      success: true, 
      previewUrl, 
      wasFallback: isFallback,
    };
  } catch (err: any) {
    console.error('SMTP test error:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sends an email with an attached PDF certificate.
 */
export async function sendCertificateEmail(
  email: string,
  playerName: string,
  placementLabel: string,
  eventName: string,
  categoryName: string,
  pdfBuffer: Buffer,
  pdfFileName: string
): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    const client = await getTransporter();
    if (!client) {
      throw new Error('Mailer transporter failed to initialize');
    }

    // Dynamic resolution of the "from" sender address
    let fromAddress = process.env.GOOGLE_SMTP_FROM || process.env.GOOGLE_SMTP_USER || process.env.SMTP_FROM || '"CombatFlow Taekwondo" <no-reply@combatflow.com>';
    if (fromAddress) {
      fromAddress = fromAddress.trim();
      if (fromAddress.startsWith('"') && fromAddress.endsWith('"')) fromAddress = fromAddress.slice(1, -1);
      if (fromAddress.startsWith("'") && fromAddress.endsWith("'")) fromAddress = fromAddress.slice(1, -1);
      fromAddress = fromAddress.replace(/\\"/g, '"');
    }

    // Gmail requires authenticated email as the sender inside <...>
    const activeGoogleUser = process.env.GOOGLE_SMTP_USER?.trim().replace(/['"]/g, '');
    if (activeGoogleUser && !fromAddress.includes(activeGoogleUser)) {
      fromAddress = `"CombatFlow Taekwondo" <${activeGoogleUser}>`;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #cbd5e1; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 24px; font-weight: 800; color: #dc2626; letter-spacing: -0.025em;">CombatFlow Taekwondo</span>
        </div>
        <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px; text-align: center;">Championship Certificate Issued</h2>
        <p style="color: #334155; font-size: 15px; line-height: 24px; margin-bottom: 12px;">
          Dear <strong>${playerName}</strong>,
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 24px; margin-bottom: 16px;">
          Congratulations! You have secured the <strong>${placementLabel}</strong> standing in the <strong>${categoryName}</strong> division at the <strong>${eventName}</strong>.
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 24px; margin-bottom: 24px;">
          Your official certificate of achievement has been generated and is attached to this email as a PDF. You can also view and download your certificates at any time directly from your competitor profile dashboard on CombatFlow.
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 16px; font-weight: bold; padding: 12px 24px; background-color: #fef3c7; border: 1.5px solid #f59e0b; border-radius: 8px; color: #78350f; display: inline-block;">
            🏅 Standing: ${placementLabel}
          </span>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          CombatFlow Taekwondo © 2026. All rights reserved.
        </p>
      </div>
    `;

    const textContent = `Dear ${playerName},\n\nCongratulations! You have secured the ${placementLabel} position in the ${categoryName} division at the ${eventName}.\n\nYour official certificate of achievement has been generated and is attached to this email.\n\nBest regards,\nCombatFlow Taekwondo Team`;

    const info = await client.sendMail({
      from: fromAddress,
      to: email,
      subject: `CombatFlow Championship Certificate - ${placementLabel} - ${playerName}`,
      text: textContent,
      html: htmlContent,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    let previewUrl: string | undefined;
    if (testAccount && isFallback) {
      previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    }

    return { success: true, previewUrl };
  } catch (err: any) {
    console.error('Error in sendCertificateEmail mailer helper:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export interface TournamentInquiryData {
  _id?: string;
  fullName: string;
  email: string;
  phone?: string;
  organization?: string;
  tournamentName?: string;
  athleteCount?: number | string;
  message: string;
  createdAt?: string;
}

/**
 * Send Complete Tournament Inquiry to the Admin/Owner Email
 * Target: bharathrajgowdajb007@gmail.com
 */
export async function sendTournamentInquiryEmail(
  inquiry: TournamentInquiryData
): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  const TARGET_ADMIN_EMAIL = 'bharathrajgowdajb007@gmail.com';
  
  try {
    const client = await getTransporter();
    if (!client) {
      throw new Error('Mailer transporter failed to initialize');
    }

    // Dynamic resolution of the "from" sender address
    let fromAddress = process.env.GOOGLE_SMTP_FROM || process.env.GOOGLE_SMTP_USER || process.env.SMTP_FROM || '"CombatFlow Inquiries" <no-reply@combatflow.com>';
    if (fromAddress) {
      fromAddress = fromAddress.trim();
      if (fromAddress.startsWith('"') && fromAddress.endsWith('"')) fromAddress = fromAddress.slice(1, -1);
      if (fromAddress.startsWith("'") && fromAddress.endsWith("'")) fromAddress = fromAddress.slice(1, -1);
      fromAddress = fromAddress.replace(/\\"/g, '"');
    }

    const activeGoogleUser = process.env.GOOGLE_SMTP_USER?.trim().replace(/['"]/g, '');
    if (activeGoogleUser && !fromAddress.includes(activeGoogleUser)) {
      fromAddress = `"CombatFlow Inquiries" <${activeGoogleUser}>`;
    }

    const submittedDate = inquiry.createdAt ? new Date(inquiry.createdAt).toUTCString() : new Date().toUTCString();
    const tournamentDisplay = inquiry.tournamentName ? inquiry.tournamentName : 'New Tournament Inquiry';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f4ed; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2d9cc; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background-color: #dc2626; color: #ffffff; padding: 24px 32px; }
          .badge { display: inline-block; background-color: rgba(255,255,255,0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px; }
          .title { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
          .content { padding: 32px; }
          .summary-card { background-color: #faf7f2; border: 1px solid #eadecb; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ede4d5; font-size: 14px; }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
          .value { color: #0f172a; font-weight: 700; text-align: right; }
          .message-box { background-color: #f8fafc; border-left: 4px solid #dc2626; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 28px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; }
          .cta-btn { display: inline-block; background-color: #dc2626; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
          .footer { padding: 20px 32px; background-color: #f1ebd8; border-top: 1px solid #e2d9cc; font-size: 12px; color: #78716c; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">🥋 TOURNAMENT INQUIRY DESK</span>
            <h1 class="title">${tournamentDisplay}</h1>
          </div>
          <div class="content">
            <p style="margin-top: 0; font-size: 15px; color: #334155; line-height: 1.5;">
              A new tournament organizer has submitted an inquiry through the <strong>CombatFlow</strong> homepage.
            </p>

            <div class="summary-card">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Full Name</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right;">${inquiry.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Email Address</td>
                  <td style="padding: 6px 0; color: #dc2626; font-size: 14px; font-weight: 700; text-align: right;"><a href="mailto:${inquiry.email}" style="color: #dc2626; text-decoration: none;">${inquiry.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Phone Number</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right;">${inquiry.phone || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Club / Organization</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right;">${inquiry.organization || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Tournament Name</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right;">${inquiry.tournamentName || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Expected Athletes</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right;">${inquiry.athleteCount ? String(inquiry.athleteCount) + ' athletes' : 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Submitted At</td>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 500; text-align: right;">${submittedDate}</td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom: 8px;">
              <strong style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">Inquiry Message:</strong>
            </div>
            <div class="message-box">
              ${inquiry.message || 'No additional message provided.'}
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="mailto:${inquiry.email}?subject=Re:%20CombatFlow%20Tournament%20Inquiry%20-%20${encodeURIComponent(inquiry.tournamentName || 'Your Tournament')}" class="cta-btn">
                Reply to ${inquiry.fullName} →
              </a>
            </div>
          </div>
          <div class="footer">
            CombatFlow Tournament OS • Direct Inquiries Delivery to bharathrajgowdajb007@gmail.com
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
🥋 NEW COMBATFLOW TOURNAMENT INQUIRY

Full Name: ${inquiry.fullName}
Email: ${inquiry.email}
Phone: ${inquiry.phone || 'Not provided'}
Organization/Club: ${inquiry.organization || 'Not specified'}
Tournament Name: ${inquiry.tournamentName || 'Not specified'}
Number of Athletes: ${inquiry.athleteCount || 'Not specified'}
Submitted At: ${submittedDate}

Message:
${inquiry.message}

---
Reply directly to ${inquiry.email}
    `.trim();

    console.log(`[Mailer] Dispatching complete tournament inquiry for "${inquiry.fullName}" to ${TARGET_ADMIN_EMAIL}...`);

    const info = await client.sendMail({
      from: fromAddress,
      to: TARGET_ADMIN_EMAIL,
      replyTo: inquiry.email,
      subject: `🥋 New Tournament Inquiry: ${inquiry.tournamentName || inquiry.organization || inquiry.fullName} (${inquiry.fullName})`,
      text: textContent,
      html: htmlContent,
    });

    let previewUrl: string | undefined;
    if (testAccount && isFallback) {
      previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      console.log(`[Mailer] Ethereal Inquiry Email Preview URL: ${previewUrl}`);
    }

    console.log(`[Mailer] Tournament inquiry email sent successfully to ${TARGET_ADMIN_EMAIL}. Message ID: ${info.messageId}`);
    return { success: true, previewUrl };
  } catch (err: any) {
    console.error('Error in sendTournamentInquiryEmail mailer helper:', err);
    return { success: false, error: err.message || String(err) };
  }
}


