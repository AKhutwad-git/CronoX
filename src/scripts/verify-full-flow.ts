/**
 * CronoX V2 - Operational Verification Script
 * 
 * This script simulates the End-to-End flow requested to confirm backend operations.
 * It uses the actual Repositories (which rely on Prisma) to strictly verify Persistence + Logic.
 * 
 * Usage: npx ts-node src/scripts/verify-full-flow.ts
 * 
 * Flow:
 * 1. Register Users (Buyer, Professional)
 * 2. Mint Token (Professional)
 * 3. List Token (Professional)
 * 4. Purchase Token (Buyer) -> Transactional
 * 5. Book Session (Buyer)
 * 6. Complete Session (Professional) -> Transactional + Payment Gen
 * 7. Verification: Check Database for all records.
 */

import { UserRepository } from '../services/users/user.repository';
import { TimeTokenRepository } from '../services/marketplace/time-token.repository';
import { MarketplaceOrderRepository } from '../services/marketplace/marketplace-order.repository';
import { BookingRepository } from '../services/scheduling/booking.repository';
import { SessionRepository } from '../services/scheduling/session.repository';
import { PaymentRepository } from '../services/payments/payment.repository';
import { ProfessionalRepository } from '../services/users/professional.repository';

const userRepo = new UserRepository();
const proRepo = new ProfessionalRepository();
const tokenRepo = new TimeTokenRepository();
const orderRepo = new MarketplaceOrderRepository();
const bookingRepo = new BookingRepository();
const sessionRepo = new SessionRepository();
const paymentRepo = new PaymentRepository();

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

const hasErrorCode = (error: unknown): error is { code?: string } =>
    typeof error === 'object' && error !== null;

async function run() {
    console.log('--- STARTING VERIFICATION ---');

    try {
        // 1. Setup Users
        const buyerEmail = `buyer_${Date.now()}@test.com`;
        const proEmail = `pro_${Date.now()}@test.com`;

        const buyer = await userRepo.createWithValidation({ email: buyerEmail, password: 'password123', role: 'buyer' });
        const proUser = await userRepo.createWithValidation({ email: proEmail, password: 'password123', role: 'professional' });
        // Removed title, fixed baseRate
        const proProfile = await proRepo.createWithValidation({ userId: proUser.id, baseRate: 100 });

        console.log('✅ Users Created');

        // 2. Mint Token
        const token = await tokenRepo.createWithValidation({
            professionalId: proProfile.id,
            duration: 60,
            price: 50,
            state: 'drafted'
        });
        console.log('✅ Token Minted:', token.id);

        // 3. List Token
        await tokenRepo.updateState(token.id, 'listed');
        console.log('✅ Token Listed');

        // 4. Purchase Token (Transactional)
        const order = await orderRepo.createWithValidation({
            timeTokenId: token.id,
            buyerId: buyer.id,
            pricePaid: 50,
            currency: 'USD'
        });
        console.log('✅ Token Purchased (Order ID):', order.id);

        // Verify Token State
        const checkToken = await tokenRepo.findById(token.id);
        if (checkToken?.state !== 'purchased' || checkToken.ownerId !== buyer.id) {
            throw new Error('❌ Token state mismatch after purchase!');
        }
        console.log('✅ Token State Verified');

        // 5. Book Session
        // Use createWithValidation from updated BookingRepo
        const booking = await bookingRepo.createWithValidation({
            timeTokenId: token.id,
            buyerId: buyer.id,
            professionalId: proProfile.id,
            scheduledAt: new Date(Date.now() + 3600000)
        });
        console.log('✅ Booking Created:', booking.id);

        // 6. Create Session 
        const session = await sessionRepo.createWithValidation({
            bookingId: booking.id,
            professionalId: proProfile.id,
            startTime: new Date(),
            endTime: new Date(Date.now() + 3600000),
            status: 'pending'
        });
        console.log('✅ Session Created:', session.id);

        // 7. Complete Session (Transactional w/ Payment)
        const completedSession = await sessionRepo.completeSession(session.id);
        console.log('✅ Session Completed');

        // 8. Verify Payment
        const payment = await paymentRepo.findBySessionId(session.id);
        if (!payment) throw new Error('❌ Payment not generated!');
        // Cast Decimal to Number
        if (Number(payment.amount) !== 50 || payment.status !== 'pending') throw new Error(`❌ Payment data incorrect. Amount: ${payment.amount}, Status: ${payment.status}`);

        console.log('✅ Payment Verified:', payment.id);

        console.log('--- VERIFICATION SUCCESSFUL ---');

    } catch (e: unknown) {
        console.error('❌ VERIFICATION FAILED:', getErrorMessage(e));
        if (hasErrorCode(e) && e.code === 'ENOTFOUND') {
            console.error('Note: Use this script to verify runtime logic once DNS is resolved.');
        }
        process.exit(1);
    }
}

// Check if running directly
if (require.main === module) {
    run();
}
