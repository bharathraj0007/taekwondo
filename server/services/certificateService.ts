import PDFDocument from 'pdfkit';
import { db, Standing } from '../db';
import { uploadToCloudinary } from '../utils/cloudinary';
import { sendCertificateEmail } from '../utils/mailer';
import { isWeightCategoryMatch } from '../utils/drawEngine';

/**
 * Compiles a PDFKit stream into a single Buffer in memory.
 */
export const generatePdfBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
  });
};

/**
 * Generates a clean, landscape-oriented PDF certificate using pdfkit.
 */
export async function generateCertificatePdf(
  eventName: string,
  playerName: string,
  placement: '1st' | '2nd' | '3rd',
  categoryName: string,
  dateStr: string
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 40, bottom: 40, left: 40, right: 40 }
  });

  const width = 841.89; // landscape A4 width
  const height = 595.28; // landscape A4 height

  // 1. Draw outer dark border
  doc.rect(20, 20, width - 40, height - 40)
     .lineWidth(8)
     .strokeColor('#2b2721')
     .stroke();

  // 2. Draw red inner double border
  doc.rect(32, 32, width - 64, height - 64)
     .lineWidth(2)
     .strokeColor('#dc2626')
     .stroke();

  // 3. CombatFlow branding header
  doc.fillColor('#dc2626')
     .font('Helvetica-Bold')
     .fontSize(22)
     .text('COMBATFLOW CHAMPIONSHIPS', 0, 70, { align: 'center', width: width });

  doc.fillColor('#2b2721')
     .font('Helvetica')
     .fontSize(10)
     .text('OFFICIAL CERTIFICATE OF ACHIEVEMENT', 0, 98, { align: 'center', width: width, characterSpacing: 1.5 });

  // 4. Headline
  doc.fillColor('#1e293b')
     .font('Helvetica-Bold')
     .fontSize(38)
     .text('CERTIFICATE OF STANDING', 0, 140, { align: 'center', width: width });

  doc.fillColor('#475569')
     .font('Helvetica-Oblique')
     .fontSize(14)
     .text('This is proudly awarded to', 0, 200, { align: 'center', width: width });

  // 5. Player name (large and uppercase)
  doc.fillColor('#dc2626')
     .font('Helvetica-Bold')
     .fontSize(32)
     .text(playerName.toUpperCase(), 0, 235, { align: 'center', width: width });

  doc.moveTo(180, 275)
     .lineTo(width - 180, 275)
     .lineWidth(1)
     .strokeColor('#cbd5e1')
     .stroke();

  doc.fillColor('#475569')
     .font('Helvetica-Oblique')
     .fontSize(14)
     .text('for securing the', 0, 295, { align: 'center', width: width });

  // 6. Placement medal accents
  let medalColor = '#ca8a04'; // Gold
  let placementLabel = '1st Place (Gold Medalist)';
  if (placement === '2nd') {
    medalColor = '#4b5563'; // Silver
    placementLabel = '2nd Place (Silver Medalist)';
  } else if (placement === '3rd') {
    medalColor = '#b45309'; // Bronze
    placementLabel = '3rd Place (Bronze Medalist)';
  }

  doc.fillColor(medalColor)
     .font('Helvetica-Bold')
     .fontSize(28)
     .text(placementLabel.toUpperCase(), 0, 325, { align: 'center', width: width });

  // 7. Division details and event
  doc.fillColor('#475569')
     .font('Helvetica')
     .fontSize(14)
     .text(`in the ${categoryName} division`, 0, 375, { align: 'center', width: width });

  doc.fillColor('#1e293b')
     .font('Helvetica-Bold')
     .fontSize(16)
     .text(eventName, 0, 410, { align: 'center', width: width });

  doc.fillColor('#64748b')
     .font('Helvetica')
     .fontSize(11)
     .text(`Date of Finalization: ${dateStr}`, 0, 450, { align: 'center', width: width });

  // 8. Signatures
  doc.moveTo(80, 520).lineTo(240, 520).lineWidth(1).strokeColor('#cbd5e1').stroke();
  doc.moveTo(width - 240, 520).lineTo(width - 80, 520).lineWidth(1).strokeColor('#cbd5e1').stroke();

  doc.fillColor('#475569')
     .font('Helvetica-Bold')
     .fontSize(10);
  doc.text('Tournament Director', 80, 528, { width: 160, align: 'center' });
  doc.text('CombatFlow Technical Jury', width - 240, 528, { width: 160, align: 'center' });

  doc.end();

  return generatePdfBuffer(doc);
}

/**
 * Automatically computes placements for a division from completed matches and processes certificates.
 * Awards Bronze (3rd) to both semifinal losers.
 */
export async function processCategoryCertificates(
  eventId: string,
  ageCategory: string,
  weightCategory: string,
  gender: 'male' | 'female',
  forceResend: boolean = false
): Promise<{
  success: boolean;
  message: string;
  processedCount: number;
  details: { name: string; position: string; email: string; status: string; error?: string }[];
}> {
  const normGender = String(gender).trim().toLowerCase();
  const normAge = String(ageCategory).trim();
  const normWeight = String(weightCategory).trim();

  const details: any[] = [];
  let processedCount = 0;

  try {
    // 1. Fetch active event
    const event = await db.events.findOne({ _id: eventId });
    const eventName = event ? event.name : 'CombatFlow National Championship 2026';
    const eventDate = event
      ? new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // 2. Query division matches
    const allMatches = await db.matches.find({ eventId });
    const divisionMatches = allMatches.filter((m: any) => {
      if ((m.gender || '').toLowerCase() !== normGender) return false;
      if ((m.ageCategory || 'Senior').toLowerCase() !== normAge.toLowerCase()) return false;
      return isWeightCategoryMatch(m.weightCategory || '', normWeight);
    });

    if (divisionMatches.length === 0) {
      return { success: false, message: 'No matches found for this category division.', processedCount: 0, details };
    }

    // 3. Find the Finals match
    const finalsMatch = divisionMatches.find((m: any) => m.round === 'Finals' || m.round === 'Final');
    if (!finalsMatch) {
      return { success: false, message: 'Bracket Finals match not generated yet.', processedCount: 0, details };
    }

    if (finalsMatch.status !== 'completed' || !finalsMatch.winnerId) {
      return { success: false, message: 'Division Finals match is not completed yet.', processedCount: 0, details };
    }

    // 4. Resolve 1st and 2nd placements
    const firstPlaceId = finalsMatch.winnerId;
    const secondPlaceId = finalsMatch.winnerId === finalsMatch.player1Id ? finalsMatch.player2Id : finalsMatch.player1Id;

    // 5. Resolve 3rd placements (losers of both completed Semifinals matches)
    const semifinalMatches = divisionMatches.filter((m: any) => m.round === 'Semifinals' || m.round === 'Semifinal');
    const thirdPlaceIds: string[] = [];

    semifinalMatches.forEach((m: any) => {
      if (m.status === 'completed' && m.winnerId) {
        const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
        if (loserId && !loserId.startsWith('bye_') && loserId !== 'pending_winner') {
          thirdPlaceIds.push(loserId);
        }
      }
    });

    const placements = [
      { playerId: firstPlaceId, position: '1st' as const },
      { playerId: secondPlaceId, position: '2nd' as const },
      ...thirdPlaceIds.map(id => ({ playerId: id, position: '3rd' as const }))
    ].filter(p => p.playerId && !p.playerId.startsWith('bye_') && p.playerId !== 'pending_winner');

    // 6. Loop and process certificates per standing
    for (const p of placements) {
      try {
        const reg = await db.registrations.findOne({ userId: p.playerId, eventId });
        const userDoc = await db.users.findOne({ _id: p.playerId });
        const email = reg?.email || userDoc?.email || '';
        const fullName = reg?.fullName || userDoc?.name || 'Athlete';

        const categoryLabel = `${normAge} ${gender === 'male' ? 'Male' : 'Female'} ${normWeight}`;
        const existing = await db.standings.findOne({
          eventId,
          ageCategory: normAge,
          weightCategory: normWeight,
          gender: normGender as 'male' | 'female',
          playerId: p.playerId
        });

        // Prevention of duplicate sends unless explicit forceResend
        if (existing && existing.emailSent && !forceResend) {
          details.push({
            name: fullName,
            position: p.position,
            email,
            status: 'Skipped (Already sent)'
          });
          continue;
        }

        // Generate certificate PDF in memory
        const pdfBuffer = await generateCertificatePdf(
          eventName,
          fullName,
          p.position,
          categoryLabel,
          eventDate
        );

        // Upload certificate raw file to Cloudinary
        let certificateUrl = existing?.certificateUrl || '';
        let certificatePublicId = existing?.certificatePublicId || '';

        try {
          const folder = `certificates/${eventId}/${reg?._id || reg?.regId || p.playerId}`;
          const uploadRes = await uploadToCloudinary(pdfBuffer, folder, 'certificate', 'raw');
          certificateUrl = uploadRes.secure_url;
          certificatePublicId = uploadRes.public_id;
        } catch (uploadErr: any) {
          console.error(`Cloudinary upload failed for ${fullName}:`, uploadErr);
          // Do not fail the whole loop, fallback/continue with local log
        }

        // Upsert standing record
        let standingId = existing?._id;
        if (existing) {
          await db.standings.update(existing._id, {
            certificateUrl,
            certificatePublicId,
            fullName
          });
        } else {
          const doc = await db.standings.create({
            position: p.position,
            playerId: p.playerId,
            fullName,
            registrationId: reg?._id || reg?.regId || p.playerId,
            eventId,
            weightCategory: normWeight,
            ageCategory: normAge,
            gender: normGender as 'male' | 'female',
            certificateUrl,
            certificatePublicId,
            emailSent: false
          });
          standingId = doc._id;
        }

        // Email certificate
        if (email) {
          const mailRes = await sendCertificateEmail(
            email,
            fullName,
            p.position === '1st' ? 'Gold (1st)' : p.position === '2nd' ? 'Silver (2nd)' : 'Bronze (3rd)',
            eventName,
            categoryLabel,
            pdfBuffer,
            `CombatFlow_Certificate_${fullName.replace(/\s+/g, '_')}.pdf`
          );

          if (mailRes.success) {
            await db.standings.update(standingId!, {
              emailSent: true,
              emailSentAt: new Date().toISOString(),
              emailError: null
            });
            details.push({ name: fullName, position: p.position, email, status: 'Sent' });
            processedCount++;
          } else {
            const errorMsg = mailRes.error || 'SMTP delivery failure';
            await db.standings.update(standingId!, {
              emailSent: false,
              emailError: errorMsg
            });

            // Log degraded health service status
            await db.healthLogs.create({
              status: 'degraded',
              services: [{
                service: 'Certificate Service',
                status: 'degraded',
                message: `SMTP Certificate failure for ${fullName} (${p.playerId}) in category ${categoryLabel}: ${errorMsg}`,
                checkedAt: new Date().toISOString()
              }]
            }).catch(() => {});

            details.push({ name: fullName, position: p.position, email, status: 'Failed (Email)', error: errorMsg });
          }
        } else {
          const errorMsg = 'No email address registered for player';
          await db.standings.update(standingId!, {
            emailSent: false,
            emailError: errorMsg
          });
          details.push({ name: fullName, position: p.position, email: 'N/A', status: 'Failed (No Email)', error: errorMsg });
        }

      } catch (playerErr: any) {
        console.error(`Error processing placement certificate for player ${p.playerId}:`, playerErr);
        details.push({
          name: p.playerId,
          position: p.position,
          email: 'N/A',
          status: 'Failed (System Error)',
          error: playerErr.message || String(playerErr)
        });
      }
    }

    return {
      success: true,
      message: `Completed processing certificates for ${normAge} ${normGender} ${normWeight}.`,
      processedCount,
      details
    };

  } catch (error: any) {
    console.error('Placements and certificate pipeline error:', error);
    return {
      success: false,
      message: `System error during placement certificate processing: ${error.message || String(error)}`,
      processedCount: 0,
      details
    };
  }
}
