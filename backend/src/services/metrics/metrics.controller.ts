import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AuditLogRepository } from '../auditing/audit-log.repository';

const supportedMetricTypes = new Set(['heart_rate', 'hrv', 'sleep_duration', 'steps', 'activity', 'screen_time']);
const auditLogRepository = new AuditLogRepository();

type BiometricEntry = {
  metricType?: string;
  type?: string;
  value?: number;
  timestamp?: string;
  recordedAt?: string;
  source?: string;
};

type DeviceMetricPayload = {
  deviceId?: string;
  metricType?: string;
  timestamp?: string;
  value?: number;
  deviceType?: string;
  firmwareVersion?: string;
};

type NormalizedBiometricEntry =
  | { error: string }
  | { metricType: string; value: number; recordedAt: Date; source: string };

type ConsentInput = {
  metricType?: string;
  source?: string;
};

const normalizeBiometricEntry = (entry: BiometricEntry, fallbackSource?: string): NormalizedBiometricEntry => {
  const metricTypeRaw = entry.metricType ?? entry.type;
  const sourceRaw = entry.source ?? fallbackSource;
  const timestampRaw = entry.timestamp ?? entry.recordedAt;
  const metricType = typeof metricTypeRaw === 'string' ? metricTypeRaw.trim().toLowerCase() : '';
  const source = typeof sourceRaw === 'string' ? sourceRaw.trim() : '';
  const value = typeof entry.value === 'number' ? entry.value : Number(entry.value);
  const recordedAt = timestampRaw ? new Date(timestampRaw) : null;

  if (!metricType || !supportedMetricTypes.has(metricType)) {
    return { error: 'Unsupported metric type' };
  }
  if (!Number.isFinite(value)) {
    return { error: 'Metric value must be a number' };
  }
  if (!recordedAt || Number.isNaN(recordedAt.getTime())) {
    return { error: 'Valid timestamp is required' };
  }
  if (!source) {
    return { error: 'Source is required' };
  }

  return { metricType, value, recordedAt, source };
};

const normalizeConsentInput = (input: ConsentInput) => {
  const metricType = typeof input.metricType === 'string' ? input.metricType.trim().toLowerCase() : '';
  const source = typeof input.source === 'string' ? input.source.trim() : '';

  if (!metricType || !supportedMetricTypes.has(metricType)) {
    return { error: 'Unsupported metric type' };
  }
  if (!source) {
    return { error: 'Source is required' };
  }

  return { metricType, source };
};

const hasActiveConsent = async (userId: string, metricType: string, source: string) => {
  const consent = await prisma.biometricConsent.findFirst({
    where: {
      userId,
      metricType,
      source,
      revokedAt: null
    }
  });
  return Boolean(consent);
};

export const createMetric = async (req: AuthenticatedRequest, res: Response) => {
  const { type, value, source } = req.body as { type?: string; value?: number; source?: string };
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!type || value === undefined) {
    return res.status(400).json({ message: 'Type and value are required' });
  }

  if (typeof value !== 'number') {
    return res.status(400).json({ message: 'Value must be a number' });
  }

  try {
    if (supportedMetricTypes.has(type)) {
      const consentSource = typeof source === 'string' ? source.trim() : '';
      if (!consentSource) {
        return res.status(400).json({ message: 'Source is required' });
      }
      const consented = await hasActiveConsent(userId, type, consentSource);
      if (!consented) {
        return res.status(403).json({ message: 'Consent required for this metric source', metricType: type, source: consentSource });
      }
    }

    const newMetric = await prisma.metric.create({
      data: {
        userId,
        metricType: type,
        value,
        // recordedAt default now? Schema: recordedAt DateTime @map("recorded_at") - No default?
        // Let's check schema. Line 94: recordedAt DateTime @map("recorded_at").
        // No @default. So we must provide it.
        recordedAt: new Date()
      }
    });

    res.status(201).json(newMetric);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error creating metric', error: message });
  }
};

export const createBiometricUpload = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const normalized = normalizeBiometricEntry(req.body as BiometricEntry);
  if ('error' in normalized) {
    return res.status(400).json({ message: normalized.error });
  }

  try {
    const consented = await hasActiveConsent(userId, normalized.metricType, normalized.source);
    if (!consented) {
      return res.status(403).json({ message: 'Consent required for this metric source', metricType: normalized.metricType, source: normalized.source });
    }

    const metric = await prisma.metric.create({
      data: {
        userId,
        metricType: normalized.metricType,
        value: normalized.value,
        recordedAt: normalized.recordedAt
      }
    });

    res.status(201).json({ metric, source: normalized.source });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error ingesting biometric metric', error: message });
  }
};

export const createBiometricBatch = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const payload = req.body as { source?: string; entries?: BiometricEntry[]; metrics?: BiometricEntry[]; data?: BiometricEntry[] };
  const entries = payload.entries ?? payload.metrics ?? payload.data;
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ message: 'Entries are required' });
  }

  const errors: Array<{ index: number; message: string }> = [];
  const records: Array<{ userId: string; metricType: string; value: number; recordedAt: Date }> = [];
  const consentPairs = new Map<string, { metricType: string; source: string }>();
  entries.forEach((entry, index) => {
    const normalized = normalizeBiometricEntry(entry, payload.source);
    if ('error' in normalized) {
      errors.push({ index, message: normalized.error });
      return;
    }
    const consentKey = `${normalized.metricType}::${normalized.source}`;
    if (!consentPairs.has(consentKey)) {
      consentPairs.set(consentKey, { metricType: normalized.metricType, source: normalized.source });
    }
    records.push({
      userId,
      metricType: normalized.metricType,
      value: normalized.value,
      recordedAt: normalized.recordedAt
    });
  });

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Invalid biometric entries', errors });
  }

  try {
    const consentTargets = Array.from(consentPairs.values());
    if (consentTargets.length > 0) {
      const consentMatches = await prisma.biometricConsent.findMany({
        where: {
          userId,
          revokedAt: null,
          OR: consentTargets.map((target) => ({
            metricType: target.metricType,
            source: target.source
          }))
        }
      });

      const consentedKeys = new Set(consentMatches.map((consent) => `${consent.metricType}::${consent.source}`));
      const missing = consentTargets.filter((target) => !consentedKeys.has(`${target.metricType}::${target.source}`));
      if (missing.length > 0) {
        return res.status(403).json({ message: 'Consent required for one or more metric sources', missing });
      }
    }

    const result = await prisma.metric.createMany({ data: records });
    res.status(201).json({ count: result.count });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error ingesting biometric batch', error: message });
  }
};

export const createDeviceBiometric = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const payload = req.body as DeviceMetricPayload;
  const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : '';
  const metricType = typeof payload.metricType === 'string' ? payload.metricType.trim().toLowerCase() : '';
  const deviceType = typeof payload.deviceType === 'string' ? payload.deviceType.trim() : '';
  const firmwareVersion = typeof payload.firmwareVersion === 'string' ? payload.firmwareVersion.trim() : undefined;
  const value = typeof payload.value === 'number' ? payload.value : Number(payload.value);
  const recordedAt = payload.timestamp ? new Date(payload.timestamp) : null;

  if (!deviceId) {
    return res.status(400).json({ message: 'Device ID is required' });
  }
  if (!metricType || !supportedMetricTypes.has(metricType)) {
    return res.status(400).json({ message: 'Unsupported metric type' });
  }
  if (!Number.isFinite(value)) {
    return res.status(400).json({ message: 'Metric value must be a number' });
  }
  if (!recordedAt || Number.isNaN(recordedAt.getTime())) {
    return res.status(400).json({ message: 'Valid timestamp is required' });
  }
  if (!deviceType) {
    return res.status(400).json({ message: 'Device type is required' });
  }

  try {
    const consented = await hasActiveConsent(userId, metricType, deviceId);
    if (!consented) {
      return res.status(403).json({ message: 'Consent required for this device source', metricType, source: deviceId });
    }

    const metric = await prisma.metric.create({
      data: {
        userId,
        metricType,
        value,
        recordedAt
      }
    });

    await auditLogRepository.create({
      entityType: 'Metric',
      entityId: metric.id,
      eventType: 'DeviceMetricIngested',
      metadata: {
        userId,
        deviceId,
        deviceType,
        firmwareVersion: firmwareVersion || null,
        metricType,
        recordedAt: recordedAt.toISOString()
      } as Prisma.InputJsonValue
    });

    res.status(201).json({ metricId: metric.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error ingesting device metric', error: message });
  }
};

export const listBiometricConsents = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const consents = await prisma.biometricConsent.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' }
    });
    res.status(200).json({ consents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error loading consents', error: message });
  }
};

export const grantBiometricConsent = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const normalized = normalizeConsentInput(req.body as ConsentInput);
  if ('error' in normalized) {
    return res.status(400).json({ message: normalized.error });
  }

  try {
    const existing = await prisma.biometricConsent.findFirst({
      where: {
        userId,
        metricType: normalized.metricType,
        source: normalized.source,
        revokedAt: null
      }
    });

    if (existing) {
      return res.status(200).json({ consent: existing });
    }

    const consent = await prisma.biometricConsent.create({
      data: {
        userId,
        metricType: normalized.metricType,
        source: normalized.source
      }
    });

    await auditLogRepository.create({
      entityType: 'BiometricConsent',
      entityId: consent.id,
      eventType: 'ConsentGranted',
      metadata: {
        userId,
        metricType: consent.metricType,
        source: consent.source,
        grantedAt: consent.grantedAt.toISOString()
      } as Prisma.InputJsonValue
    });

    res.status(201).json({ consent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error granting consent', error: message });
  }
};

export const revokeBiometricConsent = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const consentId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!consentId) {
    return res.status(400).json({ message: 'Consent ID is required' });
  }

  try {
    const consent = await prisma.biometricConsent.findFirst({
      where: { id: consentId, userId }
    });

    if (!consent) {
      return res.status(404).json({ message: 'Consent not found' });
    }

    if (consent.revokedAt) {
      return res.status(200).json({ consent });
    }

    const revoked = await prisma.biometricConsent.update({
      where: { id: consent.id },
      data: { revokedAt: new Date() }
    });

    await auditLogRepository.create({
      entityType: 'BiometricConsent',
      entityId: revoked.id,
      eventType: 'ConsentRevoked',
      metadata: {
        userId,
        metricType: revoked.metricType,
        source: revoked.source,
        revokedAt: revoked.revokedAt?.toISOString() ?? null
      } as Prisma.InputJsonValue
    });

    res.status(200).json({ consent: revoked });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error revoking consent', error: message });
  }
};

export const getMetricsByUserId = async (userId: string) => {
  return prisma.metric.findMany({
    where: { userId }
  });
};
