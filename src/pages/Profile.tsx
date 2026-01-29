import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { useToast } from '@/hooks/use-toast';
import { getProfessionalMe, updateProfessionalProfile } from '@/lib/api';
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
