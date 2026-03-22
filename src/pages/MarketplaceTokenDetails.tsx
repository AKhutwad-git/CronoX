import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge, type SessionStatus } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { User, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/contexts/RoleContext';
import { apiRequest, calculatePricing, createBooking, endSession, getBookings, getFocusScoreByUser, getWeeklyAvailability, purchaseMarketplaceToken, startSession } from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from '@/components/ui/CheckoutForm';
import { useQuery } from '@tanstack/react-query';

type TokenDetails = {
  id: string;
  state: string;
  professionalId?: string;
  durationMinutes: number;
  price: number;
  currency?: string;
  title?: string;
  description?: string;
  topics?: string[];
  expertiseTags?: string[];
  createdAt?: string;
  professional?: {
    verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
    skills?: string[];
    user?: {
      id?: string;
      email?: string;
      role?: string;
    };
  };
};

type FocusScoreSnapshot = {
  score: number;
  confidence: number;
  validUntil: string;
};

type BookingDetails = {
  id: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  token?: {
    id: string;
  };
  session?: {
    id: string;
    status?: 'pending' | 'active' | 'completed' | 'failed' | 'refund_requested' | 'refunded' | 'cancelled_by_buyer' | 'cancelled_by_professional';
    startedAt?: string;
    endedAt?: string;
  };
};

type WeeklyAvailability = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  timezone?: string;
};

const MarketplaceTokenDetails = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { role, token: authToken } = useRole();
  const [token, setToken] = useState<TokenDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [availability, setAvailability] = useState<WeeklyAvailability[]>([]);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [bookingLoadError, setBookingLoadError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const stripePromise = useMemo(() => {
    if (!clientSecret) {
      return null;
    }
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder_key_for_development';
    return loadStripe(publishableKey);
  }, [clientSecret]);

  const professionalUserId = token?.professional?.user?.id;

  const { data: focusScore, isLoading: isLoadingFocusScore } = useQuery<FocusScoreSnapshot | null>({
    queryKey: ['focusScore', professionalUserId],
    queryFn: async () => {
      if (!professionalUserId) {
        return null;
      }
      try {
        return await getFocusScoreByUser(professionalUserId);
      } catch {
        return null;
      }
    },
    enabled: Boolean(professionalUserId),
    refetchInterval: 30000,
  });

  const status = useMemo<SessionStatus>(() => {
    if (!token?.state) return 'pending';
    if (token.state === 'listed') return 'available';
    if (token.state === 'purchased') return 'booked';
    if (token.state === 'consumed') return 'completed';
    return 'pending';
  }, [token?.state]);

  const fetchToken = useCallback(async () => {
    if (!id) {
      return null;
    }
    const data = await apiRequest<TokenDetails>(`/marketplace/tokens/${id}`);
    setToken(data ?? null);
    return data ?? null;
  }, [id]);

  const fetchBooking = useCallback(async () => {
    if (!authToken || role !== 'buyer' || !id) {
      return null;
    }

    const data = await getBookings();
    const bookings = Array.isArray(data) ? (data as BookingDetails[]) : [];
    return bookings.find((item) => item.token?.id === id) ?? null;
  }, [authToken, id, role]);

  useEffect(() => {
    if (!id) {
      setError('Missing session id.');
      setIsLoading(false);
      return;
    }

    const loadToken = async () => {
      try {
        await fetchToken();
        setError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to load session details.';
        setError(message);
        toast({
          title: 'Unable to load session',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, [fetchToken, id, toast]);

  useEffect(() => {
    if (!authToken || role !== 'buyer' || !id) {
      setBooking(null);
      return;
    }

    let isMounted = true;

    const loadBookings = async () => {
      try {
        setIsBookingLoading(true);
        const matched = await fetchBooking();
        if (isMounted) {
          setBooking(matched);
          setBookingLoadError(null);
        }
      } catch (err: unknown) {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to load booking details.';
        setBookingLoadError(message);
        toast({
          title: 'Unable to load booking',
          description: message,
          variant: 'destructive',
        });
      } finally {
        if (isMounted) {
          setIsBookingLoading(false);
        }
      }
    };

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, [authToken, fetchBooking, id, role, toast]);

  useEffect(() => {
    if (!token?.professionalId) {
      setAvailability([]);
      return;
    }

    let isMounted = true;
    const loadAvailability = async () => {
      try {
        const data = await getWeeklyAvailability(token.professionalId);
        if (isMounted) {
          setAvailability(Array.isArray(data) ? (data as WeeklyAvailability[]) : []);
        }
      } catch (err: unknown) {
        if (!isMounted) {
          return;
        }
        setAvailability([]);
      }
    };
    loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [token?.professionalId]);

  const performanceTier = useMemo(() => {
    const score = focusScore?.score;
    if (typeof score !== 'number') {
      return null;
    }
    if (score >= 80) {
      return { label: 'Premium', color: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10' };
    }
    if (score >= 60) {
      return { label: 'Good', color: 'text-blue-400 border-blue-400/40 bg-blue-400/10' };
    }
    if (score >= 40) {
      return { label: 'Average', color: 'text-amber-400 border-amber-400/40 bg-amber-400/10' };
    }
    return { label: 'Low', color: 'text-red-400 border-red-400/40 bg-red-400/10' };
  }, [focusScore?.score]);

  const validUntilDate = useMemo(
    () => (focusScore?.validUntil ? new Date(focusScore.validUntil) : null),
    [focusScore?.validUntil],
  );
  const isExpired = validUntilDate ? validUntilDate.getTime() <= Date.now() : true;
  const remainingValidity = useMemo(() => {
    if (!validUntilDate) {
      return null;
    }
    const diff = validUntilDate.getTime() - Date.now();
    if (diff <= 0) {
      return 'Expired';
    }
    const mins = Math.floor(diff / 60000);
    return `${mins}m`;
  }, [validUntilDate]);

  const hasValidPerformanceData = Boolean(focusScore && !isExpired);
  const adjustedMultiplier = focusScore ? 1 + (focusScore.score - 50) / 500 : 1;
  const {
    data: pricingData,
  } = useQuery({
    queryKey: ['pricing', token?.professionalId, focusScore?.validUntil],
    queryFn: async () => {
      if (!token?.professionalId) {
        return null;
      }
      return calculatePricing(token.professionalId);
    },
    enabled: Boolean(token?.professionalId && hasValidPerformanceData),
    refetchInterval: 30000,
  });

  const adjustedPrice = useMemo(() => {
    if (pricingData?.price !== undefined) {
      return Number(pricingData.price);
    }
    if (!token) {
      return null;
    }
    return Number((Number(token.price) * adjustedMultiplier).toFixed(2));
  }, [pricingData?.price, token, adjustedMultiplier]);
  const basePrice = pricingData?.baseRate !== undefined ? Number(pricingData.baseRate) : token ? Number(token.price) : null;
  const priceDeltaPercent = basePrice !== null && adjustedPrice !== null && basePrice > 0
    ? Math.round(((adjustedPrice - basePrice) / basePrice) * 100)
    : 0;

  const isPurchasable = role === 'buyer' && token?.state === 'listed' && hasValidPerformanceData;
  const purchaseLabel =
    token?.state !== 'listed'
      ? token?.state === 'purchased'
        ? 'Purchased'
        : 'Not Available'
      : hasValidPerformanceData
        ? 'Purchase Token'
        : 'Unavailable';

  const handlePurchase = async () => {
    if (!id || !token) return;
    if (role !== 'buyer') {
      toast({ title: 'Buyer account required', description: 'Only buyers can purchase session tokens.', variant: 'destructive' });
      return;
    }
    if (!authToken) {
      toast({ title: 'Sign in required', description: 'Please sign in as a buyer to purchase this token.', variant: 'destructive' });
      return;
    }
    if (token.state !== 'listed') {
      toast({ title: 'Session unavailable', description: 'This token is no longer available for purchase.', variant: 'destructive' });
      return;
    }
    if (!hasValidPerformanceData) {
      toast({ title: 'Session unavailable', description: 'Session expired due to outdated performance data.', variant: 'destructive' });
      return;
    }
    if (isPurchasing) return;

    try {
      setIsPurchasing(true);
      setPurchaseError(null);
      const response = await purchaseMarketplaceToken(id);
      
      const { clientSecret: secret } = response as { clientSecret?: string };
      
      if (secret) {
        setClientSecret(secret);
      } else {
        throw new Error('No payment intent returned.');
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to initiate purchase.';
      setPurchaseError(message);
      toast({ title: 'Purchase failed', description: message, variant: 'destructive' });
    } finally {
      setIsPurchasing(false);
    }
  };

  const onPaymentSuccess = async () => {
    toast({
      title: 'Payment successful',
      description: 'Your payment was processed. Your session token is being secured.',
    });
    setClientSecret(null);
    
    // Webhook takes a moment to process. We poll or just refresh.
    // For simplicity, we just reload the token data after a short delay
    setTimeout(async () => {
      await fetchToken();
      // If token is now purchased, we are good.
    }, 2000);
  };

  const canBook = role === 'buyer' && token?.state === 'purchased' && !booking && hasValidPerformanceData;

  const handleBooking = async () => {
    if (!token || !id) {
      return;
    }

    if (role !== 'buyer') {
      toast({
        title: 'Buyer account required',
        description: 'Only buyers can book sessions.',
        variant: 'destructive',
      });
      return;
    }

    if (!authToken) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in as a buyer to book this session.',
        variant: 'destructive',
      });
      return;
    }

    if (!bookingDate || !bookingTime) {
      toast({
        title: 'Missing details',
        description: 'Please select a date and time to book this session.',
        variant: 'destructive',
      });
      return;
    }

    const scheduledAt = new Date(`${bookingDate}T${bookingTime}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast({
        title: 'Invalid date',
        description: 'Please select a valid date and time.',
        variant: 'destructive',
      });
      return;
    }

    if (scheduledAt.getTime() <= Date.now()) {
      toast({
        title: 'Choose a future time',
        description: 'Booking times must be in the future.',
        variant: 'destructive',
      });
      return;
    }

    if (availability.length > 0 && token?.durationMinutes) {
      const day = scheduledAt.getUTCDay();
      const startMinute = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();
      const endMinute = startMinute + token.durationMinutes;
      const inAvailability = availability.some(
        (slot) =>
          slot.dayOfWeek === day &&
          slot.startMinute <= startMinute &&
          slot.endMinute >= endMinute
      );
      if (!inAvailability) {
        toast({
          title: 'Outside availability',
          description: 'Select a time within the professional availability window.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (isBookingSubmitting) {
      return;
    }

    try {
      setIsBookingSubmitting(true);
      setBookingError(null);
      setSessionError(null);
      const response = await createBooking(id, scheduledAt.toISOString());
      const nextBooking =
        response && typeof response === 'object' && 'booking' in response
          ? (response as { booking?: BookingDetails }).booking
          : undefined;
      const bookingId =
        response && typeof response === 'object' && 'bookingId' in response
          ? (response as { bookingId?: string }).bookingId
          : nextBooking?.id;
      const sessionId =
        response && typeof response === 'object' && 'sessionId' in response
          ? (response as { sessionId?: string }).sessionId
          : response && typeof response === 'object' && 'session' in response
            ? (response as { session?: { id?: string } }).session?.id
            : nextBooking?.session?.id;
      const baseBooking =
        nextBooking ?? {
          id: bookingId ?? id,
          scheduledAt: scheduledAt.toISOString(),
          status: 'scheduled',
          token: { id },
          session: sessionId ? { id: sessionId } : undefined,
        };
      setBooking(baseBooking);
      toast({
        title: 'Booking confirmed',
        description: 'Your session is scheduled and ready.',
      });

      if (sessionId) {
        try {
          const started = await startSession(sessionId);
          const ended = await endSession(sessionId, 'completed');
          setBooking((current) => {
            const bookingState = current ?? baseBooking;
            const sessionState = {
              ...bookingState.session,
              ...(started as BookingDetails['session']),
              ...(ended as BookingDetails['session']),
              id: sessionId,
              status:
                (ended as BookingDetails['session'])?.status ??
                (started as BookingDetails['session'])?.status ??
                'completed',
            };
            return {
              ...bookingState,
              session: sessionState,
              status: 'completed',
            };
          });
          setToken((current) => (current ? { ...current, state: 'consumed' } : current));
          await fetchToken();
          const refreshed = await fetchBooking();
          if (refreshed) {
            setBooking(refreshed);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unable to update the session status.';
          setSessionError(message);
          toast({
            title: 'Session update failed',
            description: message,
            variant: 'destructive',
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to book this session.';
      setBookingError(message);
      toast({
        title: 'Booking failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="section-container py-8 lg:py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Session Details</h1>
            <p className="text-muted-foreground">Review the full details before booking.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/marketplace">
              <ArrowLeft size={16} className="mr-2" />
              Back to Marketplace
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="card-elevated p-8 text-center">
            <Loader2 className="mx-auto mb-3 animate-spin text-muted-foreground" size={32} />
            <p className="text-muted-foreground">Loading session details...</p>
          </div>
        ) : error ? (
          <div className="card-elevated p-8">
            <ErrorNotice
              title="Unable to load session details"
              message={error}
              actionLabel="Back to Marketplace"
              onAction={() => window.location.assign('/marketplace')}
            />
          </div>
        ) : token ? (
          <div className="card-elevated p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-cronox-secondary flex items-center justify-center text-primary-foreground font-semibold">
                  {token.professional?.user?.email ? token.professional.user.email.charAt(0).toUpperCase() : <User size={20} />}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {token.professional?.user?.email || 'Professional'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {token.professional?.user?.role || 'Professional'}
                  </p>
                  {token.professional?.verificationStatus === 'verified' && (
                    <div className="mt-2">
                      <TrustBadge type="verified" size="sm" />
                    </div>
                  )}
                </div>
              </div>
              <StatusBadge status={token.state === 'listed' && !hasValidPerformanceData ? 'pending' : status} />
            </div>

            <div className="grid sm:grid-cols-2 gap-6 mt-6">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Session Duration</p>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Clock size={16} />
                  <span>{token.durationMinutes} min</span>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Session Price</p>
                <PriceDisplay amount={Number(token.price)} size="lg" />
                {adjustedPrice !== null && (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Base Price: ₹{(basePrice ?? Number(token.price)).toFixed(2)}</p>
                    <p className="text-foreground font-semibold">Adjusted Price: ₹{adjustedPrice.toFixed(2)}</p>
                    <p className={priceDeltaPercent >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      ({priceDeltaPercent >= 0 ? '+' : ''}{priceDeltaPercent}% based on performance)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Focus Score</h3>
                {performanceTier && (
                  <Badge variant="outline" className={performanceTier.color}>
                    {performanceTier.label}
                  </Badge>
                )}
              </div>
              {isLoadingFocusScore ? (
                <p className="mt-3 text-sm text-muted-foreground">Loading performance data...</p>
              ) : focusScore ? (
                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Score</p>
                    <p className="text-xl font-bold text-foreground">{focusScore.score}</p>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-xl font-bold text-foreground">{focusScore.confidence}%</p>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-semibold text-foreground">{performanceTier?.label ?? 'Unrated'}</p>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Valid for</p>
                    <p className={`font-semibold ${isExpired ? 'text-red-400' : 'text-foreground'}`}>{remainingValidity ?? '--'}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No performance data available</p>
              )}
              {focusScore && focusScore.confidence > 70 && (
                <Badge variant="secondary" className="mt-3">AI Performance Verified</Badge>
              )}
              {!hasValidPerformanceData && (
                <p className="mt-3 text-sm text-amber-500">Session expired due to outdated performance data</p>
              )}
            </div>

            {(token.title || token.description || token.topics?.length || token.expertiseTags?.length) && (
              <div className="mt-6 rounded-xl border border-border p-4">
                {token.title && <p className="text-sm font-semibold text-foreground mb-2">{token.title}</p>}
                {token.description && <p className="text-sm text-muted-foreground mb-3">{token.description}</p>}
                {(token.topics?.length || token.expertiseTags?.length) && (
                  <div className="flex flex-wrap gap-2">
                    {(token.topics?.length ? token.topics : token.expertiseTags)?.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {availability.length > 0 && (
              <div className="mt-6 rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground mb-2">Availability</p>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  {availability.map((slot) => (
                    <div key={`${slot.dayOfWeek}-${slot.startMinute}-${slot.endMinute}`} className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.dayOfWeek]}
                      </span>
                      <span>
                        {String(Math.floor(slot.startMinute / 60)).padStart(2, '0')}:{String(slot.startMinute % 60).padStart(2, '0')} - {String(Math.floor(slot.endMinute / 60)).padStart(2, '0')}:{String(slot.endMinute % 60).padStart(2, '0')} {slot.timezone || 'UTC'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 text-sm text-muted-foreground">
              <p>Token ID: {token.id}</p>
              {token.createdAt && <p>Created: {new Date(token.createdAt).toLocaleString()}</p>}
            </div>

            {role === 'buyer' && (
              <div className="mt-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-t border-border pt-6">
                <div className="flex-1 space-y-3">
                  {!clientSecret ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {token.state === 'listed'
                          ? hasValidPerformanceData
                            ? 'Ready to purchase this session token.'
                            : 'Purchase disabled until fresh performance data is available.'
                          : 'This session token is no longer available for purchase.'}
                      </p>
                      <ErrorNotice title="Purchase failed" message={purchaseError} />
                    </>
                  ) : (
                    <div className="bg-card border border-border rounded-xl p-4 w-full">
                      <p className="font-semibold text-sm mb-4">Complete Payment</p>
                      <Elements stripe={stripePromise} options={{ clientSecret }}>
                        <CheckoutForm onSuccess={onPaymentSuccess} onError={(err) => setPurchaseError(err)} />
                      </Elements>
                    </div>
                  )}
                </div>
                {!clientSecret && (
                  <Button
                    onClick={handlePurchase}
                    disabled={!isPurchasable || isPurchasing}
                    className="bg-status-booked hover:bg-status-booked/90 text-white mt-2 sm:mt-0"
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={16} />
                        Processing Purchase
                      </>
                    ) : (
                      purchaseLabel
                    )}
                  </Button>
                )}
              </div>
            )}

            {role === 'buyer' && token.state === 'purchased' && (
              <div className="mt-6 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Book this session</h3>
                  {booking && (
                    <span className="text-xs text-muted-foreground">
                      Scheduled for {new Date(booking.scheduledAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    type="date"
                    value={bookingDate}
                    onChange={(event) => setBookingDate(event.target.value)}
                    disabled={!canBook || isBookingLoading}
                  />
                  <Input
                    type="time"
                    value={bookingTime}
                    onChange={(event) => setBookingTime(event.target.value)}
                    disabled={!canBook || isBookingLoading}
                  />
                  <Button
                    onClick={handleBooking}
                    disabled={!canBook || isBookingSubmitting || isBookingLoading}
                    className="bg-status-booked hover:bg-status-booked/90 text-white"
                  >
                    {isBookingSubmitting ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={16} />
                        Booking
                      </>
                    ) : booking ? (
                      'Session Booked'
                    ) : (
                      'Book Session'
                    )}
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  <ErrorNotice title="Booking failed" message={bookingError} />
                  <ErrorNotice title="Booking unavailable" message={bookingLoadError} />
                  <ErrorNotice title="Session update failed" message={sessionError} />
                </div>
                {!canBook && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {booking
                      ? 'This token has already been booked.'
                      : 'Complete purchase to unlock booking.'}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="card-elevated p-8 text-center">
            <p className="text-muted-foreground">Session not found.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default MarketplaceTokenDetails;
