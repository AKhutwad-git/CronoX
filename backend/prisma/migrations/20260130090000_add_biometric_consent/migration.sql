CREATE TABLE "BiometricConsent" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BiometricConsent_user_id_metric_type_source_idx" ON "BiometricConsent"("user_id", "metric_type", "source");

ALTER TABLE "BiometricConsent" ADD CONSTRAINT "BiometricConsent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
