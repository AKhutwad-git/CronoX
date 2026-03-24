type MetricType = 'heart_rate' | 'hrv' | 'sleep_duration' | 'steps';

export type CanonicalMetric = {
  metricType: MetricType;
  value: number;
  recordedAt: Date;
  source: string;
  unit: string;
};

type NormalizationResult = { error: string } | CanonicalMetric;

const supportedMetricTypes: MetricType[] = ['heart_rate', 'hrv', 'sleep_duration', 'steps'];

const normalizeMetricType = (raw: unknown): MetricType | null => {
  if (typeof raw !== 'string') {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  return supportedMetricTypes.includes(normalized as MetricType) ? (normalized as MetricType) : null;
};

const normalizeTimestamp = (raw: unknown) => {
  if (!raw) {
    return null;
  }
  const timestamp = typeof raw === 'string' ? raw : String(raw);
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const normalizeSource = (raw: unknown, fallbackSource?: string) => {
  const source = typeof raw === 'string' ? raw.trim() : '';
  if (source) {
    return source;
  }
  return fallbackSource?.trim() || '';
};

const normalizeValue = (metricType: MetricType, rawValue: unknown, rawUnit: unknown): { value: number; unit: string } | null => {
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(value)) {
    return null;
  }
  const unit = typeof rawUnit === 'string' ? rawUnit.trim().toLowerCase() : '';

  if (metricType === 'heart_rate') {
    const normalizedUnit = unit || 'bpm';
    if (['bpm', 'beats_per_minute', 'beats/min'].includes(normalizedUnit)) {
      return { value, unit: 'bpm' };
    }
    return null;
  }

  if (metricType === 'hrv') {
    const normalizedUnit = unit || 'ms';
    if (['ms', 'millisecond', 'milliseconds'].includes(normalizedUnit)) {
      return { value, unit: 'ms' };
    }
    if (['s', 'sec', 'second', 'seconds'].includes(normalizedUnit)) {
      return { value: value * 1000, unit: 'ms' };
    }
    return null;
  }

  if (metricType === 'sleep_duration') {
    const normalizedUnit = unit || 'minutes';
    if (['min', 'minute', 'minutes'].includes(normalizedUnit)) {
      return { value, unit: 'minutes' };
    }
    if (['h', 'hr', 'hour', 'hours'].includes(normalizedUnit)) {
      return { value: value * 60, unit: 'minutes' };
    }
    if (['s', 'sec', 'second', 'seconds'].includes(normalizedUnit)) {
      return { value: value / 60, unit: 'minutes' };
    }
    return null;
  }

  if (metricType === 'steps') {
    const normalizedUnit = unit || 'count';
    if (normalizedUnit === 'count' || normalizedUnit === 'steps') {
      return { value, unit: 'count' };
    }
    return null;
  }

  return null;
};

export const normalizeMetricPayload = (
  payload: Record<string, unknown>,
  fallbackSource?: string
): NormalizationResult => {
  const metricType = normalizeMetricType(payload.metricType ?? payload.metric_type ?? payload.type);
  if (!metricType) {
    return { error: 'Unsupported metric type' };
  }

  const source = normalizeSource(payload.source ?? payload.source_id ?? payload.sourceId ?? payload.deviceId, fallbackSource);
  if (!source) {
    return { error: 'Source is required' };
  }

  const recordedAt = normalizeTimestamp(payload.timestamp ?? payload.recorded_at ?? payload.recordedAt ?? payload.time);
  if (!recordedAt) {
    return { error: 'Valid timestamp is required' };
  }

  const valueResult = normalizeValue(metricType, payload.value ?? payload.rawValue ?? payload.raw_value, payload.unit ?? payload.unitCode);
  if (!valueResult) {
    return { error: 'Metric value or unit is invalid' };
  }

  return {
    metricType,
    value: valueResult.value,
    recordedAt,
    source,
    unit: valueResult.unit
  };
};

export const getSupportedMetricTypes = () => supportedMetricTypes.slice();
