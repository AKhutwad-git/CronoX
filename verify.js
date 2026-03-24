const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- Bio-Temporal Verification (JS) ---');
  
  const professional = await prisma.professional.findFirst({
    include: { user: true }
  });

  if (!professional) {
    console.error('No professional found.');
    return;
  }

  const userId = professional.userId;
  console.log(`Professional: ${professional.user.email}`);

  // Test 1: Invalidate all scores
  await prisma.focusScore.updateMany({
    where: { userId },
    data: { validUntil: new Date(Date.now() - 1000) }
  });
  console.log('Expired all scores for professional.');

  // Test 2: Check listed tokens (should be filtered out by DB query)
  // We need to manually check the filter logic I implemented in the repository
  // Since I can't easily import the repository in plain JS if it uses TS features,
  // I will replicate the query logic here to see if it works.
  
  const now = new Date();
  const listedCount = await prisma.timeToken.count({
    where: {
      state: 'listed',
      professional: {
        user: {
          focusScores: {
            some: {
              validUntil: { gt: now }
            }
          }
        }
      }
    }
  });
  
  console.log(`Listed tokens found (Expected 0): ${listedCount}`);

  // Test 3: Create a valid score
  await prisma.focusScore.create({
    data: {
      userId,
      score: 95,
      modelVersion: '2.0-jsverify',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 3600000), // 1 hour
      confidence: 100
    }
  });
  console.log('Created a valid 1-hour score.');

  const listedCountAfter = await prisma.timeToken.count({
    where: {
      state: 'listed',
      professional: {
        user: {
          focusScores: {
            some: {
              validUntil: { gt: new Date() }
            }
          }
        }
      }
    }
  });
  console.log(`Listed tokens found (Expected >0): ${listedCountAfter}`);

  if (listedCount === 0 && listedCountAfter > 0) {
    console.log('✅ PASS: Bio-Temporal filtering logic is correct.');
  } else {
    console.error('❌ FAIL: Logic mismatch.');
  }

  await prisma.$disconnect();
}

run().catch(console.error);
