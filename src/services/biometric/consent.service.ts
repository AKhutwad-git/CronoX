import prisma from '../../lib/prisma';

/**
 * Consent Service
 * 
 * Manages biometric data consent — validates which metric types
 * a user has authorized for processing. Consent is enforced at
 * every stage of the biometric pipeline.
 */

export interface ConsentRecord {
  metricType: string;
  source: string;
  status: 'Active' | 'Revoked';
}

/**
 * Parse a consent CSV string into structured records.
 * Expected columns: metric_type, device_id (or source), status
 */
export function parseConsentCsv(csvContent: string): ConsentRecord[] {
  const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const metricCol = headers.findIndex(h => ['metric_type', 'metrictype', 'type'].includes(h));
  const sourceCol = headers.findIndex(h => ['device_id', 'deviceid', 'source', 'source_id'].includes(h));
  const statusCol = headers.findIndex(h => ['status', 'consent_status'].includes(h));

  if (metricCol === -1 || statusCol === -1) return [];

  const records: ConsentRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const metricType = values[metricCol]?.toLowerCase() ?? '';
    const source = sourceCol !== -1 ? (values[sourceCol] ?? '') : '';
    const rawStatus = values[statusCol]?.toLowerCase() ?? '';

    if (!metricType) continue;

    const status: ConsentRecord['status'] =
      rawStatus === 'active' || rawStatus === 'granted' || rawStatus === 'yes'
        ? 'Active'
        : 'Revoked';

    records.push({ metricType, source, status });
  }

  return records;
}

/**
 * Get all actively consented metric types for a user.
 */
export async function getConsentedMetricTypes(userId: string): Promise<string[]> {
  const consents = await prisma.biometricConsent.findMany({
    where: { userId, revokedAt: null },
    select: { metricType: true }
  });

  return [...new Set(consents.map(c => c.metricType))];
}

/**
 * Check if a specific metric type is consented for a user.
 */
export async function isMetricConsented(
  userId: string,
  metricType: string,
  source?: string
): Promise<boolean> {
  const where: Record<string, unknown> = {
    userId,
    metricType,
    revokedAt: null
  };
  if (source) where.source = source;

  const consent = await prisma.biometricConsent.findFirst({ where });
  return Boolean(consent);
}

/**
 * Filter an array of metric types to only those the user has consented to.
 */
export async function filterConsentedMetrics(
  userId: string,
  metricTypes: string[]
): Promise<string[]> {
  const consented = await getConsentedMetricTypes(userId);
  const consentedSet = new Set(consented);
  return metricTypes.filter(mt => consentedSet.has(mt));
}

/**
 * Process a consent CSV: grant new consents and revoke removed ones in the database.
 */
export async function syncConsentsFromCsv(
  userId: string,
  csvContent: string
): Promise<{ granted: number; revoked: number }> {
  const records = parseConsentCsv(csvContent);
  let granted = 0;
  let revoked = 0;

  for (const record of records) {
    if (record.status === 'Active') {
      const existing = await prisma.biometricConsent.findFirst({
        where: { userId, metricType: record.metricType, source: record.source, revokedAt: null }
      });
      if (!existing) {
        await prisma.biometricConsent.create({
          data: { userId, metricType: record.metricType, source: record.source }
        });
        granted++;
      }
    } else {
      const active = await prisma.biometricConsent.findFirst({
        where: { userId, metricType: record.metricType, source: record.source, revokedAt: null }
      });
      if (active) {
        await prisma.biometricConsent.update({
          where: { id: active.id },
          data: { revokedAt: new Date() }
        });
        revoked++;
      }
    }
  }

  return { granted, revoked };
}
