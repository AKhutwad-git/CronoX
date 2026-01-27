-- Create Enums
CREATE TYPE "UserRole" AS ENUM ('buyer', 'professional', 'admin');
CREATE TYPE "ProfessionalStatus" AS ENUM ('active', 'suspended');
CREATE TYPE "TokenState" AS ENUM ('drafted', 'listed', 'purchased', 'consumed', 'cancelled');
CREATE TYPE "BookingStatus" AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE "SessionStatus" AS ENUM ('pending', 'active', 'completed', 'failed');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'settled', 'failed');

-- Create Users Table
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index for User Email
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Create Professionals Table
CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_rate" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "ProfessionalStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index for Professional User ID
CREATE UNIQUE INDEX "Professional_user_id_key" ON "Professional"("user_id");

-- Add ForeignKey for Professional -> User
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Metrics Table
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- Add ForeignKey for Metric -> User
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Index for Metric
CREATE INDEX "Metric_user_id_recorded_at_idx" ON "Metric"("user_id", "recorded_at");

-- Create FocusScore Table
CREATE TABLE "FocusScore" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,
    "model_version" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusScore_pkey" PRIMARY KEY ("id")
);

-- Add ForeignKey for FocusScore -> User
ALTER TABLE "FocusScore" ADD CONSTRAINT "FocusScore_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create TimeToken Table
CREATE TABLE "TimeToken" (
    "id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "state" "TokenState" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeToken_pkey" PRIMARY KEY ("id")
);

-- Add ForeignKeys for TimeToken
ALTER TABLE "TimeToken" ADD CONSTRAINT "TimeToken_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeToken" ADD CONSTRAINT "TimeToken_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create Index for TimeToken
CREATE INDEX "TimeToken_state_idx" ON "TimeToken"("state");

-- Create MarketplaceOrder Table
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "price_paid" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index for Order Token
CREATE UNIQUE INDEX "MarketplaceOrder_token_id_key" ON "MarketplaceOrder"("token_id");

-- Add ForeignKeys for MarketplaceOrder
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "TimeToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Booking Table
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index for Booking Token
CREATE UNIQUE INDEX "Booking_token_id_key" ON "Booking"("token_id");

-- Add ForeignKeys for Booking
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "TimeToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Session Table
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index for Session Booking
CREATE UNIQUE INDEX "Session_booking_id_key" ON "Session"("booking_id");

-- Add ForeignKeys for Session
ALTER TABLE "Session" ADD CONSTRAINT "Session_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Payment Table
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "erp_invoice_ref" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index for Payment Session
CREATE UNIQUE INDEX "Payment_session_id_key" ON "Payment"("session_id");

-- Add ForeignKeys for Payment
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create AuditLog Table
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Create Index for AuditLog
CREATE INDEX "AuditLog_entity_type_entity_id_idx" ON "AuditLog"("entity_type", "entity_id");
