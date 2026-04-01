import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/contexts/RoleContext';
import { apiRequest, getProfessionalMe, getWeeklyAvailability, updateWeeklyAvailability } from '@/lib/api';
import { 
  Clock, 
  Calendar, 
  CheckCircle, 
  ArrowLeft, 
  Info,
  Sparkles
} from 'lucide-react';

const durations = [
  { value: 15, label: '15 min', desc: 'Quick consultation' },
  { value: 30, label: '30 min', desc: 'Standard session' },
  { value: 45, label: '45 min', desc: 'Extended session' },
  { value: 60, label: '60 min', desc: 'Deep dive session' },
];

const CreateSession = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { token, role } = useRole();
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [topicsInput, setTopicsInput] = useState('');
  const [expertiseInput, setExpertiseInput] = useState('');
  const [availabilityRows, setAvailabilityRows] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>([
    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
  ]);
  const [onboardingStatus, setOnboardingStatus] = useState<{ complete: boolean; missing: string[] }>({
    complete: true,
    missing: [],
  });
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Please try again in a moment.';
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;
    const loadAvailability = async () => {
      try {
        const data = await getWeeklyAvailability();
        if (!isMounted) {
          return;
        }
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: `${String(Math.floor(slot.startMinute / 60)).padStart(2, '0')}:${String(slot.startMinute % 60).padStart(2, '0')}`,
            endTime: `${String(Math.floor(slot.endMinute / 60)).padStart(2, '0')}:${String(slot.endMinute % 60).padStart(2, '0')}`,
          }));
          setAvailabilityRows(mapped);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setAvailabilityRows([{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }]);
        }
      }
    };

    loadAvailability();
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || role !== 'professional') {
      setOnboardingStatus({ complete: true, missing: [] });
      return;
    }

    let isMounted = true;
    const loadOnboarding = async () => {
      try {
        setIsOnboardingLoading(true);
        const data = await getProfessionalMe();
        const skills = Array.isArray((data as { skills?: unknown }).skills) ? ((data as { skills?: string[] }).skills ?? []) : [];
        const missing: string[] = [];
        
        // Check backend profile data instead of localStorage
        if (!(data as { fullName?: string }).fullName?.trim()) {
          missing.push('Full name');
        }
        if (!(data as { bio?: string }).bio?.trim()) {
          missing.push('Bio');
        }
        if (!(data as { availabilitySummary?: string }).availabilitySummary?.trim()) {
          missing.push('Availability summary');
        }
        if (skills.length === 0) {
          missing.push('Skills');
        }
        
        if (isMounted) {
          setOnboardingStatus({ complete: missing.length === 0, missing });
        }
      } catch {
        if (isMounted) {
          setOnboardingStatus({ complete: false, missing: ['Profile data'] });
        }
      } finally {
        if (isMounted) {
          setIsOnboardingLoading(false);
        }
      }
    };

    loadOnboarding();
    return () => {
      isMounted = false;
    };
  }, [role, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to create a session.',
        variant: 'destructive',
      });
      navigate('/signin');
      return;
    }

    if (role === 'professional' && !onboardingStatus.complete) {
      toast({
        title: 'Complete your profile',
        description: 'Finish onboarding before creating a session.',
        variant: 'destructive',
      });
      return;
    }

    const priceValue = Number(price);
    if (!selectedDuration || !priceValue || priceValue <= 0) {
      toast({
        title: 'Missing details',
        description: 'Provide a duration and a valid price to continue.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const availabilityPayload = availabilityRows.map((row) => {
        const [startHour, startMinute] = row.startTime.split(':').map(Number);
        const [endHour, endMinute] = row.endTime.split(':').map(Number);
        if (Number.isNaN(startHour) || Number.isNaN(startMinute) || Number.isNaN(endHour) || Number.isNaN(endMinute)) {
          throw new Error('Availability time must be valid');
        }
        const startMinuteValue = startHour * 60 + startMinute;
        const endMinuteValue = endHour * 60 + endMinute;
        if (endMinuteValue <= startMinuteValue) {
          throw new Error('Availability end time must be after start time');
        }
        return {
          dayOfWeek: row.dayOfWeek,
          startMinute: startMinuteValue,
          endMinute: endMinuteValue,
          timezone: 'UTC',
        };
      });

      if (availabilityPayload.length === 0) {
        throw new Error('Availability must include at least one time window');
      }

      await updateWeeklyAvailability(availabilityPayload);

      const topics = topicsInput
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean);
      const expertiseTags = expertiseInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const mintData = await apiRequest<{ id: string }>('/marketplace/tokens/mint', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          duration: selectedDuration,
          price: priceValue,
          title: title.trim(),
          description: description.trim() || undefined,
          topics,
          expertiseTags,
        }),
      });

      await apiRequest(`/marketplace/tokens/${mintData.id}/list`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      toast({
        title: 'Session Created!',
        description: 'Your session has been listed on the marketplace.',
      });

      navigate('/my-sessions');
    } catch (error: unknown) {
      toast({
        title: 'Unable to create session',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const isReady = selectedDuration && title.length > 3 && Number(price) > 0 && availabilityRows.length > 0 && onboardingStatus.complete;

  const handleAddAvailability = () => {
    setAvailabilityRows((prev) => [...prev, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }]);
  };

  const handleRemoveAvailability = (index: number) => {
    setAvailabilityRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="section-container py-8 lg:py-12">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back
          </Button>
          
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Create New Session
          </h1>
          <p className="text-muted-foreground">
            Set up a new session offering for buyers to discover and book.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {!onboardingStatus.complete && role === 'professional' && (
              <div className="mb-6">
                <ErrorNotice
                  title="Complete onboarding to list sessions"
                  message={
                    isOnboardingLoading
                      ? 'Checking your profile completion status.'
                      : `Missing: ${onboardingStatus.missing.join(', ')}.`
                  }
                  actionLabel="Go to Profile"
                  onAction={() => navigate('/profile')}
                />
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Session Title */}
              <div className="card-elevated p-6">
                <h2 className="font-display text-lg font-semibold text-foreground mb-4">
                  Session Details
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Session Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Business Strategy Consultation"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1.5 h-12"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      A clear, descriptive title helps buyers understand what you offer.
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what buyers can expect from this session..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1.5 min-h-[100px]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="topics">Topics</Label>
                    <Input
                      id="topics"
                      placeholder="e.g., Growth, Strategy, Leadership"
                      value={topicsInput}
                      onChange={(e) => setTopicsInput(e.target.value)}
                      className="mt-1.5 h-12"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Separate topics with commas to help buyers discover your session.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="expertise">Expertise Tags</Label>
                    <Input
                      id="expertise"
                      placeholder="e.g., B2B, Operations, Product"
                      value={expertiseInput}
                      onChange={(e) => setExpertiseInput(e.target.value)}
                      className="mt-1.5 h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price (INR)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="1"
                      placeholder="Enter session price"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="mt-1.5 h-12"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Duration Selection */}
              <div className="card-elevated p-6">
                <h2 className="font-display text-lg font-semibold text-foreground mb-4">
                  Session Duration
                </h2>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  {durations.map((duration) => (
                    <button
                      key={duration.value}
                      type="button"
                      onClick={() => setSelectedDuration(duration.value)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedDuration === duration.value
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedDuration === duration.value ? 'bg-accent/20' : 'bg-secondary'
                        }`}>
                          <Clock className={selectedDuration === duration.value ? 'text-accent' : 'text-muted-foreground'} size={18} />
                        </div>
                        <div>
                          <p className={`font-semibold ${selectedDuration === duration.value ? 'text-accent' : 'text-foreground'}`}>
                            {duration.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{duration.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div className="card-elevated p-6">
                <h2 className="font-display text-lg font-semibold text-foreground mb-4">
                  Availability
                </h2>

                <div className="space-y-3">
                  {availabilityRows.map((row, index) => (
                    <div key={`${row.dayOfWeek}-${index}`} className="grid sm:grid-cols-[140px_1fr_1fr_auto] gap-3 items-center">
                      <div className="space-y-1">
                        <Label>Day</Label>
                        <select
                          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                          value={row.dayOfWeek}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setAvailabilityRows((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, dayOfWeek: value } : item))
                            );
                          }}
                        >
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, value) => (
                            <option key={label} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>Start</Label>
                        <Input
                          type="time"
                          value={row.startTime}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAvailabilityRows((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, startTime: value } : item))
                            );
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>End</Label>
                        <Input
                          type="time"
                          value={row.endTime}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAvailabilityRows((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, endTime: value } : item))
                            );
                          }}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleRemoveAvailability(index)}
                          disabled={availabilityRows.length === 1}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar size={16} />
                      <span>Availability uses UTC time</span>
                    </div>
                    <Button type="button" variant="outline" onClick={handleAddAvailability}>
                      Add Window
                    </Button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={!isReady}
                >
                  <CheckCircle size={18} className="mr-2" />
                  Create Session
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Pricing Preview */}
            <div className="card-elevated p-6 mb-6 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="text-cronox-indigo" size={20} />
                <h3 className="font-display font-semibold text-foreground">Pricing Preview</h3>
              </div>

              <div className="bg-secondary/50 rounded-xl p-5 border border-border mb-4">
                {selectedDuration ? (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Suggested Price for {selectedDuration} min
                    </p>
                    <p className="text-sm text-muted-foreground italic">
                      The AI-calculated price in INR will appear here based on your profile, 
                      selected duration, and current market conditions.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Select a duration to see the suggested pricing.
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                  CronoX uses AI to suggest optimal pricing based on your expertise, 
                  market demand, and session parameters. You can review the pricing 
                  before publishing.
                </p>
              </div>
            </div>

            {/* Listing Readiness */}
            <div className="card-elevated p-6">
              <h3 className="font-display font-semibold text-foreground mb-4">
                Listing Readiness
              </h3>

              <div className="space-y-3">
                {[
                  { label: 'Session title', done: title.length > 3 },
                  { label: 'Duration selected', done: !!selectedDuration },
                  { label: 'Price set', done: Number(price) > 0 },
                  { label: 'Availability set', done: availabilityRows.length > 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      item.done ? 'bg-status-available/20' : 'bg-muted'
                    }`}>
                      {item.done ? (
                        <CheckCircle className="text-status-available" size={12} />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>
                    <span className={`text-sm ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CreateSession;
