import prisma from '../../lib/prisma';
import { isMetricConsented } from './consent.service';
import { AuditLogRepository } from '../auditing/audit-log.repository';
import { Prisma } from '@prisma/client';

const auditLogRepository = new AuditLogRepository();

/**
 * Biometric Ingestion Service
 * 
 * Parses CSV biometric uploads, normalizes data, validates consent,
 * and stores metrics in the database with full audit trail.
 */

export interface NormalizedBiometric {
  userId: string;
  metricType: string;
  value: number;
  recordedAt: Date;
  sourceDevice: string;
}

export interface IngestionResult {
  ingested: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

const SUPPORTED_METRICS = new Set(['heart_rate', 'hrv', 'sleep_duration', 'steps']);

/**
 * Parse a biometric CSV into normalized records.
 * Expected columns: metric_type, device_id, timestamp, value
 */
export function parseBiometricCsv(
  csvContent: string,
  userId: string
): { records: NormalizedBiometric[]; errors: Array<{ row: number; message: string }> } {
  const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { records: [], errors: [{ row: 0, message: 'CSV must have headers and at least one data row' }] };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const metricCol = headers.findIndex(h => ['metric_type', 'metrictype', 'type'].includes(h));
  const deviceCol = headers.findIndex(h => ['device_id', 'deviceid', 'source_device', 'source'].includes(h));
  const tsCol = headers.findIndex(h => ['timestamp', 'recorded_at', 'time', 'date'].includes(h));
  const valCol = headers.findIndex(h => ['value', 'raw_value', 'measurement'].includes(h));

  if (metricCol === -1 || valCol === -1 || tsCol === -1) {
    return { records: [], errors: [{ row: 0, message: 'Missing required columns: metric_type, value, timestamp' }] };
  }

  const records: NormalizedBiometric[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

    const metricType = values[metricCol]?.toLowerCase() ?? '';
    if (!SUPPORTED_METRICS.has(metricType)) {
      errors.push({ row: i, message: `Unsupported metric type: ${metricType}` });
      continue;
    }

    const value = Number(values[valCol]);
    if (!Number.isFinite(value)) {
      errors.push({ row: i, message: 'Invalid numeric value' });
      continue;
    }

    const tsRaw = values[tsCol] ?? '';
    if (!tsRaw) {
      errors.push({ row: i, message: 'Missing timestamp — strict bio-temporal rule enforced' });
      continue;
    }

    const recordedAt = new Date(tsRaw);
    if (Number.isNaN(recordedAt.getTime())) {
      errors.push({ row: i, message: 'Invalid timestamp format' });
      continue;
    }

    const sourceDevice = deviceCol !== -1 ? (values[deviceCol] ?? 'unknown') : 'unknown';

    records.push({ userId, metricType, value, recordedAt, sourceDevice });
  }

  return { records, errors };
}

/**
 * Ingest an array of normalized biometric records.
 * Validates consent for each metric type before storing.
 */
export async function ingestBiometrics(
  userId: string,
  records: NormalizedBiometric[]
): Promise<IngestionResult> {
  let ingested = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  // Pre-check consent per unique metric+device pair
  const consentCache = new Map<string, boolean>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const cacheKey = `${record.metricType}::${record.sourceDevice}`;

    if (!consentCache.has(cacheKey)) {
      const consented = await isMetricConsented(userId, record.metricType, record.sourceDevice);
      consentCache.set(cacheKey, consented);
    }

    if (!consentCache.get(cacheKey)) {
      skipped++;
      errors.push({ row: i, message: `No consent for ${record.metricType} from ${record.sourceDevice}` });
      continue;
    }

    try {
      const metric = await prisma.metric.create({
        data: {
          userId: record.userId,
          metricType: record.metricType,
          value: record.value,
          recordedAt: record.recordedAt,
          sourceDevice: record.sourceDevice
        }
      });

      await auditLogRepository.create({
        entityType: 'Metric',
        entityId: metric.id,
        eventType: 'BiometricIngested',
        metadata: {
          userId,
          metricType: record.metricType,
          sourceDevice: record.sourceDevice,
          recordedAt: record.recordedAt.toISOString()
        } as Prisma.InputJsonValue
      });

      ingested++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Storage error';
      errors.push({ row: i, message });
    }
  }

  return { ingested, skipped, errors };
}

/**
 * Full pipeline: parse CSV → validate consent → ingest.
 */
export async function ingestFromCsv(
  userId: string,
  csvContent: string
): Promise<IngestionResult> {
  const { records, errors: parseErrors } = parseBiometricCsv(csvContent, userId);

  if (records.length === 0) {
    return { ingested: 0, skipped: 0, errors: parseErrors };
  }

  const result = await ingestBiometrics(userId, records);

  // 🔄 Bio-Temporal Rule: Invalidate previous score and create new 1hr window on new data
  if (result.ingested > 0) {
    try {
      const { 
        calculateAndStoreFocusScore, 
        getLatestFocusScore 
      } = await import('../../services/metrics/focus-score.service');

      // Explicitly expire previous scores for this user by setting validUntil to NOW
      await prisma.focusScore.updateMany({
        where: { 
          userId,
          validUntil: { gt: new Date() }
        },
        data: {
          validUntil: new Date()
        }
      });

      // Compute fresh score (automatically sets new 1-hour window)
      await calculateAndStoreFocusScore(userId);

      await auditLogRepository.create({
        entityType: 'FocusScore',
        entityId: userId,
        eventType: 'FocusScoreInvalidated',
        metadata: { reason: 'New biometric data ingested', recordsAdded: result.ingested } as Prisma.InputJsonValue
      });
    } catch (err) {
      console.error('[biometric-ingestion] Failed to recompute focus score:', err);
    }
  }

  return {
    ingested: result.ingested,
    skipped: result.skipped,
    errors: [...parseErrors, ...result.errors]
  };
}
