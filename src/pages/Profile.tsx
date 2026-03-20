import { useCallback, useEffect, useState } from 'react';
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
  revokeBiometricConsent
} from '@/lib/api';
import { Mail, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';

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

  const devicePayloadExample = `{
  "deviceId": "ble-001",
  "deviceType": "gadgetbridge",
  "firmwareVersion": "1.2.3",
  "metricType": "heart_rate",
  "timestamp": "2026-01-30T10:15:00Z",
  "value": 72
}`;

  const profileStorageKey = 'cronox.profile';

  const readLocalProfile = () => {
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
  };

  const writeLocalProfile = (data: { fullName: string; bio: string; availabilitySummary: string }) => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(data));
    } catch {
      return;
    }
  };

  useEffect(() => {
    const localProfile = readLocalProfile();
    setFullName(localProfile.fullName);
    setBio(localProfile.bio);
    setAvailabilitySummary(localProfile.availabilitySummary);
  }, []);

  useEffect(() => {
    if (role !== 'professional') {
      setProfessional(null);
      return;
    }
    let isMounted = true;
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const data = await getProfessionalMe();
        if (!isMounted) {
          return;
        }
        const profile = data as ProfessionalProfile;
        setProfessional(profile);
        setSkillsInput((profile.skills ?? []).join(', '));
        setCertificationsInput((profile.certifications ?? []).join(', '));
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to load profile.';
        toast({
          title: 'Unable to load profile',
          description: message,
          variant: 'destructive',
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [role, toast]);

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
          <p className="text-muted-foreground">Manage your account details and preferences.</p>
        </motion.div>

        <motion.div className="card-elevated p-6 mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
