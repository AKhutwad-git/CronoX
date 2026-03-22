import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { useToast } from '@/hooks/use-toast';
import {
  apiRequest,
  getProfessionalMe,
  updateProfessionalProfile,
  getBiometricConsents,
  grantBiometricConsent,
  revokeBiometricConsent,
  getFocusScore,
  computeFocusScore,
  getMetrics
} from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Mail, Briefcase, CheckCircle, AlertCircle, Brain, Heart, Moon, Activity, TrendingUp, Zap } from 'lucide-react';

type ProfessionalProfile = {
  id: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  skills?: string[];
  certifications?: string[];
  user?: {
    email?: string;
    role?: string;
  };
};

type HealthMetricEntry = {
  metricType: 'heart_rate' | 'hrv' | 'sleep_duration' | 'steps';
  value: number;
  timestamp: string;
  source: string;
};

type BiometricConsent = {
  id: string;
  metricType: HealthMetricEntry['metricType'];
  source: string;
  grantedAt: string;
  revokedAt?: string | null;
};

type FocusScoreBreakdown = {
  hrvScore: number | null;
  heartRateStability: number | null;
  sleepRecovery: number | null;
  activityBalance: number | null;
  behavioralFocus: number | null;
};

type FocusScoreData = {
  score: number;
  confidence: number;
  breakdown: FocusScoreBreakdown;
  modelVersion: string;
  contributingFactors: string[];
  validFrom: string;
  validUntil: string;
};

type TrendPoint = {
  score: number;
  computedAt: string;
};

type Metric = {
  id: string;
  metricType: string;
  value: number | string;
  recordedAt: string;
  sourceDevice?: string | null;
};

const Profile = () => {
  const { role, token } = useRole();
  const { toast } = useToast();
  const [professional, setProfessional] = useState<ProfessionalProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [availabilitySummary, setAvailabilitySummary] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [certificationsInput, setCertificationsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [healthSource, setHealthSource] = useState('');
  const [healthFile, setHealthFile] = useState<File | null>(null);
  const [healthEntries, setHealthEntries] = useState<HealthMetricEntry[]>([]);
  const [healthParseError, setHealthParseError] = useState<string | null>(null);
  const [isParsingHealth, setIsParsingHealth] = useState(false);
  const [isUploadingHealth, setIsUploadingHealth] = useState(false);
  const [consents, setConsents] = useState<BiometricConsent[]>([]);
  const [consentMetricType, setConsentMetricType] = useState<HealthMetricEntry['metricType']>('heart_rate');
  const [consentSource, setConsentSource] = useState('');
  const [isLoadingConsents, setIsLoadingConsents] = useState(false);
  const [isGrantingConsent, setIsGrantingConsent] = useState(false);
  const [revokingConsentId, setRevokingConsentId] = useState<string | null>(null);
  const [focusScoreData, setFocusScoreData] = useState<FocusScoreData | null>(null);
  const [focusTrend, setFocusTrend] = useState<TrendPoint[]>([]);
  const [isComputingScore, setIsComputingScore] = useState(false);

  const chartConfig = {
    value: {
      label: "Value",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  const devicePayloadExample = `{
  "deviceId": "ble-001",
  "deviceType": "gadgetbridge",
  "firmwareVersion": "1.2.3",
  "metricType": "heart_rate",
  "timestamp": "2026-01-30T10:15:00Z",
  "value": 72
}`;

  const userId = useMemo(() => {
    if (!token) {
      return null;
    }
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }
    try {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload =
        payloadBase64.length % 4 === 0 ? payloadBase64 : payloadBase64.padEnd(payloadBase64.length + (4 - (payloadBase64.length % 4)), '=');
      const payload = JSON.parse(atob(paddedPayload)) as { userId?: string; sub?: string; id?: string };
      return payload.userId ?? payload.sub ?? payload.id ?? null;
    } catch {
      return null;
    }
  }, [token]);

  const profileStorageKey = useMemo(
    () => (userId ? `cronox.profile.${userId}` : 'cronox.profile.anonymous'),
    [userId],
  );

  const { data: metrics = [], isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['metrics', userId],
    queryFn: async () => {
      const response = await getMetrics();
      return Array.isArray(response) ? (response as Metric[]) : [];
    },
    enabled: Boolean(token && userId),
    refetchInterval: 30000,
  });

  const {
    data: focusScoreResponse,
    isLoading: isLoadingFocusScore,
    refetch: refetchFocusScore,
  } = useQuery({
    queryKey: ['focusScore', userId],
    queryFn: async () => {
      const response = await getFocusScore();
      return response as { focusScore: FocusScoreData | null; trend: TrendPoint[] };
    },
    enabled: Boolean(token && userId),
    refetchInterval: 30000,
  });

  const {
    data: professionalProfile,
    isLoading: isLoadingProfile,
    error: profileLoadError,
  } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const response = await getProfessionalMe();
      return response as ProfessionalProfile;
    },
    enabled: role === 'professional' && Boolean(token && userId),
    refetchInterval: 30000,
  });

  const readLocalProfile = useCallback(() => {
    if (typeof localStorage === 'undefined') {
      return { fullName: '', bio: '', availabilitySummary: '' };
    }
    try {
      const raw = localStorage.getItem(profileStorageKey);
      if (!raw) {
        return { fullName: '', bio: '', availabilitySummary: '' };
      }
      const parsed = JSON.parse(raw) as {
        fullName?: string;
        bio?: string;
        availabilitySummary?: string;
      };
      return {
        fullName: parsed.fullName ?? '',
        bio: parsed.bio ?? '',
        availabilitySummary: parsed.availabilitySummary ?? '',
      };
    } catch {
      return { fullName: '', bio: '', availabilitySummary: '' };
    }
  }, [profileStorageKey]);

  const writeLocalProfile = useCallback((data: { fullName: string; bio: string; availabilitySummary: string }) => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(data));
    } catch {
      return;
    }
  }, [profileStorageKey]);

  useEffect(() => {
    const localProfile = readLocalProfile();
    setFullName(localProfile.fullName);
    setBio(localProfile.bio);
    setAvailabilitySummary(localProfile.availabilitySummary);
  }, [readLocalProfile]);

  useEffect(() => {
    if (role !== 'professional') {
      setProfessional(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(isLoadingProfile);
  }, [role, isLoadingProfile]);

  useEffect(() => {
    if (!professionalProfile) {
      return;
    }
    setProfessional(professionalProfile);
    setSkillsInput((professionalProfile.skills ?? []).join(', '));
    setCertificationsInput((professionalProfile.certifications ?? []).join(', '));
  }, [professionalProfile]);

  useEffect(() => {
    if (!profileLoadError) {
      return;
    }
    const message = profileLoadError instanceof Error ? profileLoadError.message : 'Unable to load profile.';
    toast({
      title: 'Unable to load profile',
      description: message,
      variant: 'destructive',
    });
  }, [profileLoadError, toast]);

  const loadConsents = useCallback(async () => {
    if (!token) {
      setConsents([]);
      return;
    }
    try {
      setIsLoadingConsents(true);
      const response = await getBiometricConsents();
      const nextConsents = (response as { consents?: BiometricConsent[] }).consents ?? [];
      setConsents(nextConsents);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load consents.';
      toast({
        title: 'Consent load failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingConsents(false);
    }
  }, [token, toast]);

  useEffect(() => {
    if (!token) {
      setConsents([]);
      return;
    }
    void loadConsents();
  }, [token, loadConsents]);

  useEffect(() => {
    if (!token) {
      setFocusScoreData(null);
      setFocusTrend([]);
      return;
    }
    if (!focusScoreResponse) {
      return;
    }
    setFocusScoreData(focusScoreResponse.focusScore ?? null);
    setFocusTrend(focusScoreResponse.trend ?? []);
  }, [token, focusScoreResponse]);

  const handleComputeScore = async () => {
    if (!token || isComputingScore) return;
    try {
      setIsComputingScore(true);
      const response = await computeFocusScore() as { focusScore: FocusScoreData };
      setFocusScoreData(response.focusScore ?? null);
      toast({ title: 'Focus Score computed', description: `Score: ${response.focusScore?.score ?? 'N/A'}` });
      await refetchFocusScore();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to compute score.';
      toast({ title: 'Computation failed', description: message, variant: 'destructive' });
    } finally {
      setIsComputingScore(false);
    }
  };

  // Helper functions for UI
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-emerald-500/20 to-emerald-500/5';
    if (score >= 60) return 'from-blue-500/20 to-blue-500/5';
    if (score >= 40) return 'from-amber-500/20 to-amber-500/5';
    return 'from-red-500/20 to-red-500/5';
  };

  const getHrvStatus = (hrvScore: number | null) => {
    if (hrvScore === null) return { label: 'No data', color: 'text-muted-foreground' };
    if (hrvScore >= 70) return { label: 'Optimal', color: 'text-emerald-400' };
    if (hrvScore >= 40) return { label: 'Moderate', color: 'text-amber-400' };
    return { label: 'Low', color: 'text-red-400' };
  };

  const getPriceBoost = (score: number) => {
    const multiplier = 1 + score / 150;
    return Math.round((multiplier - 1) * 100);
  };

  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!focusScoreData?.validUntil) {
      setCountdown(null);
      return;
    }
    const timer = setInterval(() => {
      const expiry = new Date(focusScoreData.validUntil).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;
      if (diff <= 0) {
        setCountdown('Expired');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(`${mins}m ${secs}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [focusScoreData?.validUntil]);

  const normalizedMetrics = useMemo(
    () =>
      metrics
        .map((metric) => ({
          id: metric.id,
          metricType: metric.metricType,
          recordedAt: metric.recordedAt,
          value: Number(metric.value),
          sourceDevice: metric.sourceDevice ?? null,
        }))
        .filter((metric) => Number.isFinite(metric.value) && !Number.isNaN(new Date(metric.recordedAt).getTime())),
    [metrics],
  );

  const vitalsChartData = useMemo(
    () =>
      normalizedMetrics
        .filter((metric) => ['hrv', 'heart_rate'].includes(metric.metricType))
        .map((metric) => ({
          recordedAt: metric.recordedAt,
          value: metric.value,
        })),
    [normalizedMetrics],
  );

  const activityChartData = useMemo(
    () =>
      normalizedMetrics
        .filter((metric) => ['steps', 'sleep_duration'].includes(metric.metricType))
        .map((metric) => ({
          recordedAt: metric.recordedAt,
          value: metric.value,
        })),
    [normalizedMetrics],
  );

  const hasMetricsHistory = normalizedMetrics.length > 0;

  const parsedSkills = skillsInput
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

  const onboardingItems = [
    { label: 'Full name added', done: fullName.trim().length > 0 },
    { label: 'Bio completed', done: bio.trim().length > 0 },
    { label: 'Skills added', done: parsedSkills.length > 0 },
    { label: 'Availability summary added', done: availabilitySummary.trim().length > 0 },
  ];

  const isOnboardingComplete = onboardingItems.every((item) => item.done);

  const handleSave = async () => {
    if (role !== 'professional') {
      toast({
        title: 'Professional account required',
        description: 'Only professionals can update skills and certifications.',
        variant: 'destructive',
      });
      return;
    }
    if (!token) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to update your profile.',
        variant: 'destructive',
      });
      return;
    }
    if (isSaving) {
      return;
    }
    try {
      setIsSaving(true);
      writeLocalProfile({
        fullName: fullName.trim(),
        bio: bio.trim(),
        availabilitySummary: availabilitySummary.trim(),
      });
      const certifications = certificationsInput
        .split(',')
        .map((certification) => certification.trim())
        .filter(Boolean);
      const updated = await updateProfessionalProfile({ skills: parsedSkills, certifications });
      setProfessional((current) => ({
        ...(current ?? {}),
        ...(updated as ProfessionalProfile),
        skills: parsedSkills,
        certifications,
      }));
      toast({
        title: 'Profile updated',
        description: 'Your professional profile has been saved.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to update profile.';
      toast({
        title: 'Update failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantConsent = async () => {
    if (!token) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to manage consent.',
        variant: 'destructive',
      });
      return;
    }
    if (isGrantingConsent) {
      return;
    }
    const source = consentSource.trim();
    if (!source) {
      toast({
        title: 'Source required',
        description: 'Add a source identifier to grant consent.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsGrantingConsent(true);
      const response = await grantBiometricConsent({ metricType: consentMetricType, source });
      const consent = (response as { consent?: BiometricConsent }).consent;
      if (consent) {
        setConsents((current) => [consent, ...current.filter((item) => item.id !== consent.id)]);
      }
      setConsentSource('');
      toast({
        title: 'Consent granted',
        description: 'Biometric consent is now active.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to grant consent.';
      toast({
        title: 'Consent failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGrantingConsent(false);
    }
  };

  const handleRevokeConsent = async (consentId: string) => {
    if (!token) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to manage consent.',
        variant: 'destructive',
      });
      return;
    }
    if (revokingConsentId) {
      return;
    }
    try {
      setRevokingConsentId(consentId);
      const response = await revokeBiometricConsent(consentId);
      const consent = (response as { consent?: BiometricConsent }).consent;
      if (consent) {
        setConsents((current) => current.map((item) => (item.id === consent.id ? consent : item)));
      }
      toast({
        title: 'Consent revoked',
        description: 'Biometric consent has been revoked.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to revoke consent.';
      toast({
        title: 'Revoke failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setRevokingConsentId(null);
    }
  };

  const splitCsvLine = (line: string) =>
    line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, ""));

  const normalizeMetricEntry = (raw: Record<string, unknown>, sourceFallback: string) => {
    const metricTypeRaw = raw.metrictype ?? raw.metricType ?? raw.metric_type ?? raw.type;
    const valueRaw = raw.value;
    const timestampRaw = raw.timestamp ?? raw.recorded_at ?? raw.recordedAt ?? raw.time;
    const sourceRaw = raw.source ?? raw.source_id ?? raw.sourceId ?? sourceFallback;

    const metricType = typeof metricTypeRaw === 'string' ? metricTypeRaw.trim().toLowerCase() : '';
    const supported = ['heart_rate', 'hrv', 'sleep_duration', 'steps'];
    if (!supported.includes(metricType)) {
      return { error: `Unsupported metric type: ${metricType || 'unknown'}` };
    }

    const value = typeof valueRaw === 'number' ? valueRaw : Number(valueRaw);
    if (!Number.isFinite(value)) {
      return { error: 'Metric value must be a number' };
    }

    const timestamp = typeof timestampRaw === 'string' ? timestampRaw : timestampRaw ? String(timestampRaw) : '';
    if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) {
      return { error: 'Valid timestamp is required' };
    }

    const source = typeof sourceRaw === 'string' ? sourceRaw.trim() : '';
    if (!source) {
      return { error: 'Source is required' };
    }

    return {
      entry: {
        metricType: metricType as HealthMetricEntry['metricType'],
        value,
        timestamp,
        source
      }
    };
  };

  const parseJsonContent = (content: string, sourceFallback: string) => {
    const parsed = JSON.parse(content);
    const entries = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.entries)
        ? parsed.entries
        : Array.isArray(parsed?.metrics)
          ? parsed.metrics
          : Array.isArray(parsed?.data)
            ? parsed.data
            : [];

    if (!Array.isArray(entries) || entries.length === 0) {
      return { error: 'No entries found in JSON payload.' };
    }

    const normalized: HealthMetricEntry[] = [];
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') {
        return { error: 'JSON entries must be objects.' };
      }
      const result = normalizeMetricEntry(raw as Record<string, unknown>, sourceFallback);
      if ('error' in result) {
        return { error: result.error };
      }
      normalized.push(result.entry);
    }
    return { entries: normalized };
  };

  const parseCsvContent = (content: string, sourceFallback: string) => {
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      return { error: 'CSV must include headers and at least one row.' };
    }
    const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
    const normalized: HealthMetricEntry[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const values = splitCsvLine(lines[i]);
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? '';
      });
      const result = normalizeMetricEntry(record, sourceFallback);
      if ('error' in result) {
        return { error: `Row ${i}: ${result.error}` };
      }
      normalized.push(result.entry);
    }
    return { entries: normalized };
  };

  const handleHealthFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setHealthFile(file);
    setHealthEntries([]);
    setHealthParseError(null);
  };

  const handleParseHealthFile = async () => {
    if (!healthFile) {
      setHealthParseError('Select a JSON or CSV file to continue.');
      return;
    }
    if (!healthSource.trim()) {
      setHealthParseError('Provide a source identifier before parsing.');
      return;
    }
    try {
      setIsParsingHealth(true);
      setHealthParseError(null);
      const content = await healthFile.text();
      const lowerName = healthFile.name.toLowerCase();
      const result =
        lowerName.endsWith('.json')
          ? parseJsonContent(content, healthSource.trim())
          : lowerName.endsWith('.csv')
            ? parseCsvContent(content, healthSource.trim())
            : (() => {
                try {
                  return parseJsonContent(content, healthSource.trim());
                } catch {
                  return parseCsvContent(content, healthSource.trim());
                }
              })();

      if ('error' in result) {
        setHealthEntries([]);
        setHealthParseError(result.error);
        return;
      }
      setHealthEntries(result.entries);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to parse file.';
      setHealthParseError(message);
    } finally {
      setIsParsingHealth(false);
    }
  };

  const handleConfirmIngestion = async () => {
    if (!token) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to upload health data.',
        variant: 'destructive',
      });
      return;
    }
    if (healthEntries.length === 0 || isUploadingHealth) {
      return;
    }
    try {
      setIsUploadingHealth(true);
      await apiRequest('/biometrics/batch', {
        method: 'POST',
        body: JSON.stringify({ entries: healthEntries, source: healthSource.trim() }),
      });
      toast({
        title: 'Health data uploaded',
        description: `Ingested ${healthEntries.length} metrics.`,
      });
      setHealthEntries([]);
      setHealthFile(null);
    } catch (error: unknown) {
      const apiError = error as import('../lib/api').ApiRequestError;
      if (apiError.status === 403 && apiError.data && typeof apiError.data === 'object') {
        const errorData = apiError.data as { message?: string; missing?: Array<{ metricType: string; source: string }> };
        if (errorData.missing && Array.isArray(errorData.missing)) {
          const missingConsents = errorData.missing.map(pair => `${pair.metricType} from ${pair.source}`).join(', ');
          toast({
            title: 'Upload failed - Missing Consent',
            description: `Please grant consent for: ${missingConsents}`,
            variant: 'destructive',
          });
        } else {
          const message = errorData.message || 'Consent required for this metric source';
          toast({
            title: 'Upload failed',
            description: message,
            variant: 'destructive',
          });
        }
      } else {
        const message = error instanceof Error ? error.message : 'Unable to upload health data.';
        toast({
          title: 'Upload failed',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsUploadingHealth(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="section-container py-8 lg:py-12 max-w-3xl">
        <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Profile</h1>
          <p className="text-muted-foreground">Manage your account details, biometric insights, and performance.</p>
        </motion.div>

        {/* ──── PROFILE INFO (NOW AT TOP) ──── */}
        <motion.div className="card-elevated p-6 mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-cronox-secondary flex items-center justify-center text-primary-foreground text-2xl font-bold">U</div>
            <div>
              <p className="font-semibold text-foreground">{fullName || 'Your Name'}</p>
              <p className="text-sm text-muted-foreground capitalize">{role} Account</p>
              {role === 'professional' && professional?.verificationStatus === 'verified' && (
                <div className="mt-2">
                  <TrustBadge type="verified" size="sm" />
                </div>
              )}
              {role === 'professional' && professional?.verificationStatus && professional?.verificationStatus !== 'verified' && (
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {professional.verificationStatus.replace('_', ' ')}
                </p>
              )}
            </div>
          </div>
          
          <div className="grid gap-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1.5 h-12"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Mail size={14} />
                <span>{professional?.user?.email || 'Email will appear after sign in'}</span>
              </div>
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Share a short bio about your expertise"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="mt-1.5 min-h-[120px]"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="availabilitySummary">Availability Summary</Label>
              <Input
                id="availabilitySummary"
                placeholder="e.g., Weekdays 9am - 5pm UTC"
                value={availabilitySummary}
                onChange={(event) => setAvailabilitySummary(event.target.value)}
                className="mt-1.5 h-12"
                disabled={isLoading}
              />
            </div>
          </div>
        </motion.div>

        {/* ──── FOCUS SCORE CARD ──── */}
        {token && (
          <motion.div
            className={`card-elevated p-6 mb-6 bg-gradient-to-br ${focusScoreData ? getScoreGradient(focusScoreData.score) : 'from-muted/30 to-muted/10'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Brain size={20} className="text-primary" />
                <h2 className="font-display text-lg font-semibold text-foreground">Focus Score</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {focusScoreData ? `v${focusScoreData.modelVersion}` : 'AI Model'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleComputeScore}
                  disabled={isComputingScore}
                  className="h-7 px-3 text-xs"
                >
                  {isComputingScore ? 'Computing...' : 'Refresh'}
                </Button>
              </div>
            </div>

            {isLoadingFocusScore && !focusScoreData ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Loading focus data...</div>
            ) : focusScoreData ? (
              <div className="grid gap-5 md:grid-cols-3">
                {/* Score gauge */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-28 h-28">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                      <motion.circle
                        cx="50" cy="50" r="42" fill="none"
                        strokeWidth="6" strokeLinecap="round"
                        className={getScoreColor(focusScoreData.score)}
                        stroke="currentColor"
                        strokeDasharray={`${(focusScoreData.score / 100) * 264} 264`}
                        initial={{ strokeDasharray: '0 264' }}
                        animate={{ strokeDasharray: `${(focusScoreData.score / 100) * 264} 264` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-bold ${getScoreColor(focusScoreData.score)}`}>
                        {focusScoreData.score}
                      </span>
                      <span className="text-[10px] text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground mt-2">Live Score</span>
                </div>

                {/* Trend sparkline */}
                <div className="flex flex-col justify-center">
                  <span className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <TrendingUp size={12} /> 24h Trend
                  </span>
                  {focusTrend.length > 1 ? (
                    <div className="flex items-end gap-0.5 h-12">
                      {focusTrend.slice(-20).map((point, i) => (
                        <div
                          key={`trend-${i}`}
                          className={`flex-1 rounded-sm min-w-[3px] transition-all ${getScoreColor(point.score).replace('text-', 'bg-')}`}
                          style={{ height: `${Math.max(4, (point.score / 100) * 48)}px` }}
                          title={`Score: ${point.score} at ${new Date(point.computedAt).toLocaleTimeString()}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not enough data yet</span>
                  )}
                </div>

                {/* Confidence */}
                <div className="flex flex-col justify-center items-center">
                  <span className="text-xs font-medium text-muted-foreground mb-2">Confidence</span>
                  <div className="text-2xl font-bold text-foreground">{focusScoreData.confidence}%</div>
                  <div className="mt-1 flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground">
                      {focusScoreData.confidence >= 80 ? 'High signal coverage' :
                       focusScoreData.confidence >= 60 ? 'Moderate coverage' : 'Limited signals'}
                    </span>
                    <Badge variant="outline" className={`mt-2 text-[10px] h-5 ${countdown === 'Expired' ? 'text-red-400 border-red-400' : 'text-primary border-primary'}`}>
                      {countdown === 'Expired' ? 'Expired' : `Valid for next: ${countdown || '--'}`}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No focus score computed yet.</p>
                <Button variant="outline" size="sm" onClick={handleComputeScore} disabled={isComputingScore}>
                  {isComputingScore ? 'Computing...' : 'Compute Focus Score'}
                </Button>
              </div>
            )}
          </motion.div>
        )}


        {/* ──── TOKEN VALUE IMPACT ──── */}
        {token && focusScoreData && (
          <motion.div
            className="card-elevated p-6 mb-6 border-l-4 border-l-primary/60"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-400" />
                <h2 className="font-display text-lg font-semibold text-foreground">Token Value Impact</h2>
              </div>
              <Badge variant="secondary" className="text-xs">
                Live
              </Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Based on your current focus score, your time is valued at{' '}
              <span className={`font-bold text-base ${getScoreColor(focusScoreData.score)}`}>
                +{getPriceBoost(focusScoreData.score)}%
              </span>{' '}
              today.
            </p>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, getPriceBoost(focusScoreData.score) * 1.5)}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        <motion.div className="mb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
        </motion.div>

        {role === 'professional' && (
          <motion.div className="card-elevated p-6 mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-foreground">Onboarding Status</h2>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                isOnboardingComplete ? 'bg-status-available/10 text-status-available' : 'bg-destructive/10 text-destructive'
              }`}>
                {isOnboardingComplete ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {isOnboardingComplete ? 'Ready to list' : 'Action needed'}
              </div>
            </div>
            <div className="grid gap-3">
              {onboardingItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    item.done ? 'bg-status-available/20' : 'bg-muted'
                  }`}>
                    {item.done ? (
                      <CheckCircle className="text-status-available" size={12} />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {role === 'professional' && (
          <motion.div className="card-elevated p-6 mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-2 mb-4">
              <Briefcase size={18} className="text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold text-foreground">Professional Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="skills">Skills</Label>
                <Input
                  id="skills"
                  placeholder="e.g., Strategy, Leadership, Growth"
                  value={skillsInput}
                  onChange={(event) => setSkillsInput(event.target.value)}
                  className="mt-1.5 h-12"
                  disabled={isLoading}
                />
                {professional?.skills && professional.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {professional.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="certifications">Certifications</Label>
                <Input
                  id="certifications"
                  placeholder="e.g., PMP, CFA, Six Sigma"
                  value={certificationsInput}
                  onChange={(event) => setCertificationsInput(event.target.value)}
                  className="mt-1.5 h-12"
                  disabled={isLoading}
                />
                {professional?.certifications && professional.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {professional.certifications.map((certification) => (
                      <Badge key={certification} variant="secondary">
                        {certification}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        <motion.div className="card-elevated p-6 mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Health Data</h2>
            <Badge variant="outline">Open formats only</Badge>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="healthSource">Source Identifier</Label>
              <Input
                id="healthSource"
                placeholder="e.g., Garmin export, CSV from app"
                value={healthSource}
                onChange={(event) => setHealthSource(event.target.value)}
                className="mt-1.5 h-12"
              />
            </div>
            <div>
              <Label htmlFor="healthFile">Upload JSON or CSV</Label>
              <Input
                id="healthFile"
                type="file"
                accept=".json,.csv"
                onChange={handleHealthFileChange}
                className="mt-1.5 h-12"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleParseHealthFile} disabled={isParsingHealth}>
                {isParsingHealth ? 'Parsing...' : 'Parse file'}
              </Button>
              <Button onClick={handleConfirmIngestion} disabled={healthEntries.length === 0 || isUploadingHealth}>
                {isUploadingHealth ? 'Uploading...' : 'Confirm ingestion'}
              </Button>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground mb-2">Device bridge payload</p>
              <p className="text-xs text-muted-foreground mb-3">POST /api/biometrics/device</p>
              <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs text-muted-foreground">
                {devicePayloadExample}
              </pre>
            </div>
            {healthParseError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {healthParseError}
              </div>
            ) : null}
            {healthEntries.length > 0 ? (
              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-foreground">Provenance preview</span>
                  <span className="text-xs text-muted-foreground">{healthEntries.length} entries</span>
                </div>
                <div className="grid gap-2">
                  {healthEntries.slice(0, 5).map((entry, index) => (
                    <div key={`${entry.metricType}-${entry.timestamp}-${index}`} className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="secondary">{entry.metricType}</Badge>
                      <span>{entry.value}</span>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      <Badge variant="outline">{entry.source}</Badge>
                    </div>
                  ))}
                </div>
                {healthEntries.length > 5 ? (
                  <div className="mt-3 text-xs text-muted-foreground">Showing first 5 entries.</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </motion.div>

        <motion.div className="card-elevated p-6 mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Consent &amp; Provenance</h2>
            <Badge variant="outline">Required</Badge>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Metric Type</Label>
                <Select value={consentMetricType} onValueChange={(value) => setConsentMetricType(value as HealthMetricEntry['metricType'])}>
                  <SelectTrigger className="mt-1.5 h-12">
                    <SelectValue placeholder="Select metric type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heart_rate">Heart rate</SelectItem>
                    <SelectItem value="hrv">HRV</SelectItem>
                    <SelectItem value="sleep_duration">Sleep duration</SelectItem>
                    <SelectItem value="steps">Steps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="consentSource">Source Identifier</Label>
                <Input
                  id="consentSource"
                  placeholder="e.g., Garmin export, ble-001"
                  value={consentSource}
                  onChange={(event) => setConsentSource(event.target.value)}
                  className="mt-1.5 h-12"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGrantConsent} disabled={isGrantingConsent}>
                {isGrantingConsent ? 'Granting...' : 'Grant consent'}
              </Button>
              <Button variant="outline" onClick={loadConsents} disabled={isLoadingConsents}>
                {isLoadingConsents ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-foreground">Consent registry</span>
                <span className="text-xs text-muted-foreground">{consents.length} total</span>
              </div>
              {consents.length === 0 ? (
                <div className="text-xs text-muted-foreground">No consents recorded yet.</div>
              ) : (
                <div className="grid gap-3">
                  {consents.map((consent) => (
                    <div key={consent.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs">
                      <Badge variant="secondary">{consent.metricType}</Badge>
                      <Badge variant="outline">{consent.source}</Badge>
                      <Badge variant={consent.revokedAt ? 'outline' : 'secondary'}>
                        {consent.revokedAt ? 'Revoked' : 'Active'}
                      </Badge>
                      <span className="text-muted-foreground">
                        Granted {new Date(consent.grantedAt).toLocaleString()}
                      </span>
                      {consent.revokedAt ? (
                        <span className="text-muted-foreground">
                          Revoked {new Date(consent.revokedAt).toLocaleString()}
                        </span>
                      ) : null}
                      <Button
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleRevokeConsent(consent.id)}
                        disabled={Boolean(revokingConsentId)}
                      >
                        {revokingConsentId === consent.id ? 'Revoking...' : 'Revoke'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <Button
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={handleSave}
          disabled={role === 'professional' ? isSaving || isLoading : true}
        >
          {role === 'professional' ? (isSaving ? 'Saving...' : 'Save Changes') : 'Save Changes'}
        </Button>

        {token && (
          <div className="space-y-6 mt-12 pt-12 border-t border-border/50">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Performance Analytics</h2>
              <p className="text-sm text-muted-foreground mb-6">Real-time biometric signals and historical trends.</p>
            </motion.div>

            {!hasMetricsHistory ? (
              <motion.div
                className="card-elevated p-10 text-center text-muted-foreground"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {isLoadingMetrics ? 'Loading metrics...' : 'No historical data available.'}
              </motion.div>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <motion.div
                    className="card-elevated p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Heart size={18} className="text-red-400" />
                      <h3 className="font-display font-semibold">Vitals Trend</h3>
                    </div>
                    <div className="h-[250px] w-full">
                      <ChartContainer config={chartConfig}>
                        <AreaChart data={vitalsChartData}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted)/0.3)" />
                          <XAxis
                            dataKey="recordedAt"
                            tickFormatter={(str) => new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={10}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="hsl(var(--primary))"
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ChartContainer>
                    </div>
                  </motion.div>

                  <motion.div
                    className="card-elevated p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Activity size={18} className="text-emerald-400" />
                      <h3 className="font-display font-semibold">Activity & Rest</h3>
                    </div>
                    <div className="h-[250px] w-full">
                      <ChartContainer config={chartConfig}>
                        <BarChart data={activityChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted)/0.3)" />
                          <XAxis
                            dataKey="recordedAt"
                            tickFormatter={(str) => new Date(str).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={10}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  className="card-elevated overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="p-6 border-b border-border/50 bg-muted/30">
                    <h3 className="font-display font-semibold flex items-center gap-2">
                      <TrendingUp size={18} className="text-blue-400" />
                      Metrics History
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border/40">
                        <tr>
                          <th className="px-6 py-3">Timestamp</th>
                          <th className="px-6 py-3">Metric</th>
                          <th className="px-6 py-3">Value</th>
                          <th className="px-6 py-3">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {[...normalizedMetrics].reverse().slice(0, 50).map((metric) => (
                          <tr key={metric.id} className="hover:bg-muted/10 transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap text-muted-foreground font-mono text-xs">
                              {new Date(metric.recordedAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <Badge variant="outline" className="capitalize text-[10px] h-5">
                                {metric.metricType.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap font-semibold">{metric.value}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-xs text-muted-foreground">
                              {metric.sourceDevice || 'Unknown'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {normalizedMetrics.length > 50 && (
                    <div className="p-4 bg-muted/20 text-center text-xs text-muted-foreground border-t border-border/30">
                      Showing latest 50 entries
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
