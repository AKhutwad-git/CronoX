-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'pending_schedule';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "meeting_link" TEXT,
ALTER COLUMN "scheduled_at" DROP NOT NULL;
