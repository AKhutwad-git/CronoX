import prisma from './lib/prisma';
import { TimeTokenRepository } from './services/marketplace/time-token.repository';

/**
 * Bio-Temporal HARD FILTER Verification Script
 * 
 * Validates that tokens are automatically shown/hidden based on 
 * the professional's current FocusScore validity window.
 */
async function runVerification() {
  console.log('🚀 [Verification] Starting Bio-Temporal Validation...');

  // 1. Find a professional
  const professional = await prisma.professional.findFirst({
    include: { user: true }
  });

  if (!professional) {
    console.error('❌ [Verification] No professional found in DB. Please sign up first.');
    return;
  }

  const userId = professional.userId;
  console.log(`👤 [Verification] Professional: ${professional.user.email} (ID: ${userId})`);

  // 2. Clear existing scores to start clean
  await prisma.focusScore.deleteMany({ where: { userId } });
  console.log('🧹 [Verification] Stale focus scores cleared.');

  const repo = new TimeTokenRepository();
  const searchParams = { page: 1, pageSize: 10 };

  // 3. SEED: Ensure at least one LISTED token exists for this professional
  const existingToken = await prisma.timeToken.findFirst({
    where: { professionalId: professional.id, state: 'listed' }
  });
  
  if (!existingToken) {
    console.log('📦 [Verification] No listed token found. Creating one...');
    await prisma.timeToken.create({
      data: {
        professionalId: professional.id,
        title: 'Verifiable Session',
        durationMinutes: 30,
        price: 99,
        state: 'listed',
        currency: 'INR'
      }
    });
  }

  // 4. Verify: No valid score = Hidden from marketplace
  let listed = await repo.findListedCardsWithFilters(searchParams);
  let isVisible = listed.items.some(item => item.professionalId === professional.id);
  console.log(`📡 [Verification] Marketplace visibility (No Score): ${isVisible ? 'VISIBLE (FAIL)' : 'HIDDEN (PASS)'}`);

  // 5. Ingest/Create a VALID score (1 hour window)
  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 30 * 1000);
  
  await prisma.focusScore.create({
    data: {
      userId,
      score: 88,
      modelVersion: '2.0-verified',
      validFrom: now,
      validUntil: validUntil,
      confidence: 100
    }
  });
  console.log(`✅ [Verification] Valid FocusScore created. Expires at: ${validUntil.toISOString()}`);

  // 6. Verify: Valid score = Visible in marketplace
  listed = await repo.findListedCardsWithFilters(searchParams);
  isVisible = listed.items.some(item => item.professionalId === professional.id);
  console.log(`📡 [Verification] Marketplace visibility (Valid Score): ${isVisible ? 'VISIBLE (PASS)' : 'HIDDEN (FAIL)'}`);

  // 7. Manual Expiry
  await prisma.focusScore.updateMany({
    where: { userId },
    data: { validUntil: new Date(now.getTime() - 1000) }
  });
  console.log('⏳ [Verification] Score manually EXPIRED.');

  // 8. Verify: Expired score = Hidden from marketplace
  listed = await repo.findListedCardsWithFilters(searchParams);
  const isNowHidden = !listed.items.some(item => item.professionalId === professional.id);
  console.log(`📡 [Verification] Marketplace visibility (Expired): ${isNowHidden ? 'HIDDEN (PASS)' : 'VISIBLE (FAIL)'}`);

  if (isVisible && isNowHidden) {
    console.log('🎉 [Verification] SUCCESS: Bio-Temporal Hard Filter is working perfectly!');
  } else {
    console.error('❌ [Verification] FAILURE: Bio-Temporal logic did not behave as expected.');
  }

  await prisma.$disconnect();
}

runVerification().catch(err => {
  console.error('❌ [Verification] Critical error:', err);
  process.exit(1);
});
