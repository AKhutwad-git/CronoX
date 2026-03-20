import { motion } from 'framer-motion';
import { useRole } from '@/contexts/RoleContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge, type SessionStatus } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBookings, getPayments, getProfessionalMe } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  Calendar, 
  TrendingUp, 
  Plus, 
  ArrowRight, 
  Users,
  Wallet,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Sparkles
} from 'lucide-react';

const Dashboard = () => {
  const { role } = useRole();
  const isProfessional = role === 'professional';

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
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            {isProfessional 
              ? 'Manage your sessions, track earnings, and grow your expertise business.'
              : 'Discover experts, manage bookings, and track your scheduled sessions.'}
          </p>
        </motion.div>

        {isProfessional ? <ProfessionalDashboard /> : <BuyerDashboard />}
      </main>

      <Footer />
    </div>
  );
};

const ProfessionalDashboard = () => {
  const { token } = useRole();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<
    Array<{
      id: string;
      scheduledAt: string;
      status: 'scheduled' | 'completed' | 'cancelled';
      buyer?: { email?: string };
      token?: { price?: number; durationMinutes?: number };
      session?: { id: string; status: 'pending' | 'active' | 'completed' | 'failed' };
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      sessionId: string;
      amount: number;
      status: 'pending' | 'settled' | 'failed';
      createdAt?: string;
      settledAt?: string;
    }>
  >([]);
  const [onboardingStatus, setOnboardingStatus] = useState<{ complete: boolean; missing: string[] }>({
    complete: true,
    missing: [],
  });

  useEffect(() => {
    let isMounted = true;

    const load = async (showLoading: boolean, showToast: boolean) => {
      if (!token) {
        if (isMounted) {
          setBookings([]);
          setPayments([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        if (showLoading) {
          setIsLoading(true);
        }
        const [bookingData, paymentData] = await Promise.all([getBookings(), getPayments()]);
        if (isMounted) {
          setBookings(Array.isArray(bookingData) ? bookingData : []);
          setPayments(Array.isArray(paymentData) ? paymentData : []);
          setLoadError(null);
        }
      } catch (err: unknown) {
        if (!isMounted) {
          return;
        }
        if (showToast) {
          const message = err instanceof Error ? err.message : 'Please try again in a moment.';
          setLoadError(message);
          toast({
            title: 'Unable to load sessions',
            description: message,
            variant: 'destructive',
          });
        }
      } finally {
        if (isMounted && showLoading) {
          setIsLoading(false);
        }
      }
    };

    load(true, true);
    const interval = window.setInterval(() => {
      load(false, false);
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [token, toast]);

  useEffect(() => {
    if (!token) {
      setOnboardingStatus({ complete: true, missing: [] });
      return;
    }

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

    let isMounted = true;
    const loadOnboarding = async () => {
      try {
        const localProfile = readLocalProfile();
        const data = await getProfessionalMe();
        const skills = Array.isArray((data as { skills?: unknown }).skills) ? ((data as { skills?: string[] }).skills ?? []) : [];
        const missing: string[] = [];
        if (!localProfile.fullName.trim()) {
          missing.push('Full name');
        }
        if (!localProfile.bio.trim()) {
          missing.push('Bio');
        }
        if (!localProfile.availabilitySummary.trim()) {
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
      }
    };

    loadOnboarding();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const resolveSessionStatus = useCallback(
    (booking: { status: string; session?: { status?: string } }) =>
      booking.session?.status ?? (booking.status === 'completed' ? 'completed' : 'pending'),
    []
  );

  const upcomingSessions = useMemo(
    () => bookings.filter((booking) => ['pending', 'active'].includes(resolveSessionStatus(booking))),
    [bookings, resolveSessionStatus]
  );
  const completedSessions = useMemo(
    () => bookings.filter((booking) => ['completed', 'failed'].includes(resolveSessionStatus(booking))),
    [bookings, resolveSessionStatus]
  );
  const paymentsBySessionId = useMemo(() => {
    const map = new Map<string, { buyer?: { email?: string }; scheduledAt?: string; token?: { durationMinutes?: number } }>();
    bookings.forEach((booking) => {
      if (booking.session?.id) {
        map.set(booking.session.id, {
          buyer: booking.buyer,
          scheduledAt: booking.scheduledAt,
          token: booking.token,
        });
      }
    });
    return map;
  }, [bookings]);
  const pendingPayout = useMemo(
    () => payments.filter((payment) => payment.status === 'pending').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );
  const currentMonthEarnings = useMemo(() => {
    const now = new Date();
    return payments.reduce((sum, payment) => {
      const dateValue = payment.settledAt ?? payment.createdAt;
      if (!dateValue) {
        return sum;
      }
      const date = new Date(dateValue);
      if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        return sum + Number(payment.amount || 0);
      }
      return sum;
    }, 0);
  }, [payments]);
  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => {
        const dateA = a.settledAt ?? a.createdAt ?? '';
        const dateB = b.settledAt ?? b.createdAt ?? '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
      .slice(0, 3);
  }, [payments]);

  return (
    <div className="space-y-8">
      <ErrorNotice title="Unable to load dashboard data" message={loadError} />
      {!onboardingStatus.complete && (
        <ErrorNotice
          title="Complete onboarding to list sessions"
          message={`Missing: ${onboardingStatus.missing.join(', ')}.`}
          actionLabel="Update Profile"
          onAction={() => {
            window.location.assign('/profile');
          }}
        />
      )}
      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link to="/create-session">
              <Plus size={18} className="mr-2" />
              Create New Session
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/availability">
              <Calendar size={18} className="mr-2" />
              Manage Availability
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/earnings">
              <Wallet size={18} className="mr-2" />
              View Earnings
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            title: 'Work Readiness', 
            icon: CheckCircle, 
            color: 'text-status-available',
            bgColor: 'bg-status-available/10',
            content: (
              <div>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {onboardingStatus.complete ? 'Ready' : 'Incomplete'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {onboardingStatus.complete
                    ? 'Your profile details are complete and ready for booking.'
                    : `Finish ${onboardingStatus.missing.join(', ')} to unlock listings.`}
                </p>
              </div>
            )
          },
          { 
            title: 'Pending Payout', 
            icon: Calendar, 
            color: 'text-status-booked',
            bgColor: 'bg-status-booked/10',
            content: (
              <div>
                {isLoading ? (
                  <span className="text-2xl font-bold text-foreground">—</span>
                ) : (
                  <PriceDisplay amount={pendingPayout} size="lg" />
                )}
                <p className="text-xs text-muted-foreground italic mt-1">Payments awaiting settlement.</p>
              </div>
            )
          },
          { 
            title: 'This Month', 
            icon: TrendingUp, 
            color: 'text-accent',
            bgColor: 'bg-accent/10',
            content: (
              <div>
                {isLoading ? (
                  <span className="text-2xl font-bold text-foreground">—</span>
                ) : (
                  <PriceDisplay amount={currentMonthEarnings} size="lg" />
                )}
                <p className="text-xs text-muted-foreground italic mt-1">Total earnings this month.</p>
              </div>
            )
          },
          { 
            title: 'Upcoming Sessions', 
            icon: Clock, 
            color: 'text-cronox-amber',
            bgColor: 'bg-cronox-amber/10',
            content: (
              <div>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {isLoading ? '—' : upcomingSessions.length}
                </p>
                <p className="text-xs text-muted-foreground italic">Number of booked sessions scheduled for the coming week.</p>
              </div>
            )
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            className="card-elevated p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={stat.color} size={20} />
              </div>
            </div>
            {stat.content}
          </motion.div>
        ))}
      </div>

      <motion.div
        className="card-elevated p-6 lg:p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-foreground">
            Recent Payments
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/earnings">
              View All
              <ArrowRight size={16} className="ml-1" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Wallet className="mx-auto text-muted-foreground/50 mb-3" size={32} />
            <p className="text-muted-foreground">Loading payments...</p>
          </div>
        ) : recentPayments.length > 0 ? (
          <div className="space-y-3">
            {recentPayments.map((payment) => {
              const booking = paymentsBySessionId.get(payment.sessionId);
              const sessionLabel = booking?.token?.durationMinutes
                ? `${booking.token.durationMinutes} min session`
                : `Session ${payment.sessionId.slice(0, 6).toUpperCase()}`;
              const dateValue = payment.settledAt ?? payment.createdAt ?? booking?.scheduledAt;
              const statusBadge =
                payment.status === 'settled' ? 'paid' : payment.status === 'pending' ? 'pending' : null;
              return (
                <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{sessionLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {booking?.buyer?.email || 'Buyer'} · {dateValue ? new Date(dateValue).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <PriceDisplay amount={Number(payment.amount)} size="sm" />
                    {statusBadge ? (
                      <StatusBadge status={statusBadge} />
                    ) : (
                      <span className="text-xs font-medium text-foreground">Failed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Wallet className="mx-auto text-muted-foreground/50 mb-3" size={32} />
            <p className="text-muted-foreground">No payments yet</p>
          </div>
        )}
      </motion.div>

      {/* Pricing Insight Section */}
      <motion.div
        className="card-elevated p-6 lg:p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-cronox-indigo/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="text-cronox-indigo" size={24} />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-1">
              AI-Assisted Pricing Insights
            </h2>
            <p className="text-muted-foreground text-sm">
              CronoX uses market data and your profile to suggest optimal session pricing
            </p>
          </div>
        </div>

        <div className="bg-secondary/50 rounded-xl p-6 border border-border">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Base Rate Suggestion</p>
              <p className="text-sm text-muted-foreground italic">
                Your suggested base rate in INR will appear here based on your expertise, experience, and market demand.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Market Position</p>
              <p className="text-sm text-muted-foreground italic">
                How your pricing compares to similar professionals in your domain.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Demand Signal</p>
              <p className="text-sm text-muted-foreground italic">
                Current demand level for your expertise category will be shown here.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Session Listings Overview */}
      <motion.div
        className="card-elevated p-6 lg:p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-foreground">
            Your Session Listings
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/my-sessions">
              View All
              <ArrowRight size={16} className="ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {([
            { status: 'available', label: 'Available', desc: 'Sessions currently listed and bookable' },
            { status: 'booked', label: 'Booked', desc: 'Sessions purchased and awaiting completion' },
            { status: 'completed', label: 'Completed', desc: 'Sessions successfully delivered' },
          ] as { status: SessionStatus; label: string; desc: string }[]).map((item) => (
            <div key={item.status} className="bg-secondary/50 rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={item.status} />
              </div>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
              <p className="text-xs text-muted-foreground italic mt-2">
                {item.status === 'booked'
                  ? `${isLoading ? '—' : upcomingSessions.length} booked`
                  : item.status === 'completed'
                  ? `${isLoading ? '—' : completedSessions.length} completed`
                  : 'Count will appear here'}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center py-8 border border-dashed border-border rounded-xl">
          <Calendar className="mx-auto text-muted-foreground/50 mb-3" size={32} />
          <p className="text-muted-foreground mb-4">
            Your session listings will appear here once created
          </p>
          <Button asChild size="sm">
            <Link to="/create-session">
              <Plus size={16} className="mr-1" />
              Create Your First Session
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const BuyerDashboard = () => {
  const { token } = useRole();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<
    Array<{
      id: string;
      scheduledAt: string;
      status: 'scheduled' | 'completed' | 'cancelled';
      token?: { price?: number; durationMinutes?: number; professional?: { user?: { email?: string } } };
      session?: { id: string; status: 'pending' | 'active' | 'completed' | 'failed' };
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      sessionId: string;
      amount: number;
      status: 'pending' | 'settled' | 'failed';
      createdAt?: string;
      settledAt?: string;
    }>
  >([]);

  useEffect(() => {
    let isMounted = true;

    const load = async (showLoading: boolean, showToast: boolean) => {
      if (!token) {
        if (isMounted) {
          setBookings([]);
          setPayments([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        if (showLoading) {
          setIsLoading(true);
        }
        const [bookingData, paymentData] = await Promise.all([getBookings(), getPayments()]);
        if (isMounted) {
          setBookings(Array.isArray(bookingData) ? bookingData : []);
          setPayments(Array.isArray(paymentData) ? paymentData : []);
          setLoadError(null);
        }
      } catch (err: unknown) {
        if (!isMounted) {
          return;
        }
        if (showToast) {
          const message = err instanceof Error ? err.message : 'Please try again in a moment.';
          setLoadError(message);
          toast({
            title: 'Unable to load sessions',
            description: message,
            variant: 'destructive',
          });
        }
      } finally {
        if (isMounted && showLoading) {
          setIsLoading(false);
        }
      }
    };

    load(true, true);
    const interval = window.setInterval(() => {
      load(false, false);
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [token, toast]);

  const resolveSessionStatus = useCallback(
    (booking: { status: string; session?: { status?: string } }) =>
      booking.session?.status ?? (booking.status === 'completed' ? 'completed' : 'pending'),
    []
  );

  const upcomingSessions = useMemo(
    () => bookings.filter((booking) => ['pending', 'active'].includes(resolveSessionStatus(booking))),
    [bookings, resolveSessionStatus]
  );
  const completedSessions = useMemo(
    () => bookings.filter((booking) => ['completed', 'failed'].includes(resolveSessionStatus(booking))),
    [bookings, resolveSessionStatus]
  );
  const paymentsBySessionId = useMemo(() => {
    const map = new Map<string, { professional?: { user?: { email?: string } }; scheduledAt?: string; token?: { durationMinutes?: number } }>();
    bookings.forEach((booking) => {
      if (booking.session?.id) {
        map.set(booking.session.id, {
          professional: booking.token?.professional,
          scheduledAt: booking.scheduledAt,
          token: booking.token,
        });
      }
    });
    return map;
  }, [bookings]);
  const totalSpent = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );
  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => {
        const dateA = a.settledAt ?? a.createdAt ?? '';
        const dateB = b.settledAt ?? b.createdAt ?? '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
      .slice(0, 3);
  }, [payments]);

  return (
    <div className="space-y-8">
      <ErrorNotice title="Unable to load dashboard data" message={loadError} />
      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="bg-status-booked hover:bg-status-booked/90 text-white">
            <Link to="/marketplace">
              <Users size={18} className="mr-2" />
              Browse Experts
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/my-sessions">
              <Calendar size={18} className="mr-2" />
              My Sessions
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { 
            title: 'Upcoming Sessions', 
            icon: Calendar, 
            color: 'text-status-booked',
            bgColor: 'bg-status-booked/10',
            content: (
              <div>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {isLoading ? '—' : upcomingSessions.length}
                </p>
                <p className="text-xs text-muted-foreground italic">Shows booked sessions scheduled in the coming days.</p>
              </div>
            )
          },
          { 
            title: 'Completed Sessions', 
            icon: CheckCircle, 
            color: 'text-status-completed',
            bgColor: 'bg-status-completed/10',
            content: (
              <div>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {isLoading ? '—' : completedSessions.length}
                </p>
                <p className="text-xs text-muted-foreground italic">Total sessions you've attended with experts.</p>
              </div>
            )
          },
          { 
            title: 'Total Spent', 
            icon: Wallet, 
            color: 'text-cronox-amber',
            bgColor: 'bg-cronox-amber/10',
            content: (
              <div>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {isLoading ? '—' : `₹ ${totalSpent.toFixed(0)}`}
                </p>
                <p className="text-xs text-muted-foreground italic">Total amount spent on session bookings.</p>
              </div>
            )
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            className="card-elevated p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={stat.color} size={20} />
              </div>
            </div>
            {stat.content}
          </motion.div>
        ))}
      </div>

      {/* Upcoming Sessions */}
      <motion.div
        className="card-elevated p-6 lg:p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-foreground">
            Your Upcoming Sessions
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/my-sessions">
              View All
              <ArrowRight size={16} className="ml-1" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Calendar className="mx-auto text-muted-foreground/50 mb-3" size={32} />
            <p className="text-muted-foreground mb-4">
              Loading your sessions...
            </p>
          </div>
        ) : upcomingSessions.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingSessions.slice(0, 3).map((booking) => (
              <div key={booking.id} className="bg-secondary/50 rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <StatusBadge status={booking.session?.status === 'active' ? 'active' : 'pending'} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(booking.scheduledAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {booking.token?.professional?.user?.email || 'Professional'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: {booking.session?.status === 'active' ? 'Started' : 'Scheduled'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Calendar className="mx-auto text-muted-foreground/50 mb-3" size={32} />
            <p className="text-muted-foreground mb-4">
              Your booked sessions will appear here
            </p>
            <Button asChild size="sm">
              <Link to="/marketplace">
                <Users size={16} className="mr-1" />
                Browse Experts
              </Link>
            </Button>
          </div>
        )}
      </motion.div>

      <motion.div
        className="card-elevated p-6 lg:p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-foreground">
            Recent Payments
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/earnings">
              View All
              <ArrowRight size={16} className="ml-1" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Wallet className="mx-auto text-muted-foreground/50 mb-3" size={32} />
            <p className="text-muted-foreground">Loading payments...</p>
          </div>
        ) : recentPayments.length > 0 ? (
          <div className="space-y-3">
            {recentPayments.map((payment) => {
              const booking = paymentsBySessionId.get(payment.sessionId);
              const sessionLabel = booking?.token?.durationMinutes
                ? `${booking.token.durationMinutes} min session`
                : `Session ${payment.sessionId.slice(0, 6).toUpperCase()}`;
              const counterparty = booking?.professional?.user?.email || 'Professional';
              const dateValue = payment.settledAt ?? payment.createdAt ?? booking?.scheduledAt;
              const statusBadge =
                payment.status === 'settled' ? 'paid' : payment.status === 'pending' ? 'pending' : null;
              return (
                <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{sessionLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {counterparty} · {dateValue ? new Date(dateValue).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <PriceDisplay amount={Number(payment.amount)} size="sm" />
                    {statusBadge ? (
                      <StatusBadge status={statusBadge} />
                    ) : (
                      <span className="text-xs font-medium text-foreground">Failed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Wallet className="mx-auto text-muted-foreground/50 mb-3" size={32} />
            <p className="text-muted-foreground">No payments yet</p>
          </div>
        )}
      </motion.div>

      {/* Featured Experts */}
      <motion.div
        className="card-elevated p-6 lg:p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-foreground">
            Discover Experts
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/marketplace">
              Browse All
              <ArrowRight size={16} className="ml-1" />
            </Link>
          </Button>
        </div>

        <p className="text-muted-foreground mb-6">
          Featured professionals and recommended experts based on your interests will appear here.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-secondary/50 rounded-xl p-5 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Users size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expert Name</p>
                  <p className="text-xs text-muted-foreground">Expertise area</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Professional details, session duration, and pricing in INR will be displayed here.
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
