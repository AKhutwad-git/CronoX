-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'bio_engine';

-- AlterTable
ALTER TABLE "FocusScore" ADD COLUMN     "breakdown" JSONB,
ADD COLUMN     "confidence" DECIMAL(65,30),
ADD COLUMN     "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "valid_until" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "confidence" DECIMAL(65,30),
ADD COLUMN     "source_device" TEXT;

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "availability_summary" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "full_name" TEXT;
