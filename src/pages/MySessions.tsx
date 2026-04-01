import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useRole } from '@/contexts/RoleContext';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Calendar, Clock, Video, Plus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { endSession, getBookings, startSession, scheduleBooking, cancelBooking, getWeeklyAvailability, pingUser, requestEarlyStart, startSessionNow, buyerJoin } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatToIST, formatTimeIST, isWithinAvailability, parseAsIST, generateSuggestedTimes, getISTInputValues } from '@/lib/date-utils';

const MySessions = () => {
  const { role, token } = useRole();
  const { toast } = useToast();
  const isProfessional = role === 'professional';

  type BookingSummary = {
    id: string;
    scheduledAt: string | null;
    status: 'pending_schedule' | 'scheduled' | 'completed' | 'cancelled';
    meetingLink?: string;
    buyer?: {
      email?: string;
      lastSeenAt?: string;
    };
    token?: {
      id: string;
      durationMinutes?: number;
      price?: number;
      professionalId?: string;
      professional?: { user?: { email?: string; lastSeenAt?: string } };
    };
    session?: {
      id: string;
      status: 'pending' | 'active' | 'completed' | 'failed' | 'missed';
      startedAt?: string;
      endedAt?: string;
    };
    metadata?: {
      buyerLastSeen?: string;
      profLastSeen?: string;
      earlyStartRequested?: boolean;
    };
  };

  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const bookingsRef = useRef<BookingSummary[]>([]);
  bookingsRef.current = bookings;
  const [isLoading, setIsLoading] = useState(true);
  const [sessionAction, setSessionAction] = useState<Record<string, string | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [profAvailability, setProfAvailability] = useState<any[]>([]);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [nowMillis, setNowMillis] = useState<number>(Date.now());

  // Real-time UI live clock clock
  useEffect(() => {
    const timer = window.setInterval(() => setNowMillis(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async (showLoading: boolean, showToast: boolean) => {
      if (!token) {
        if (isMounted) {
          setBookings([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        if (showLoading) {
          setIsLoading(true);
        }

        // Global presence pinging
        const currentBks = bookingsRef.current;
        if (currentBks.length > 0) {
          if (currentBks.some(b => b.status === 'scheduled' || b.status === 'pending_schedule' || b.session?.status === 'active')) {
             pingUser().catch(() => {});
          }
        }

        const data = await getBookings();
        if (isMounted) {
          setBookings(Array.isArray(data) ? (data as BookingSummary[]) : []);
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

    let timeoutId: number;
    let currentInterval = 15000;

    const scheduleNext = () => {
      timeoutId = window.setTimeout(async () => {
        if (!isMounted) return;
        
        if (document.visibilityState === 'visible') {
          await load(false, false);
          currentInterval = 15000; // reset
        } else {
          // exponential backoff
          currentInterval = Math.min(currentInterval * 2, 60000);
        }
        
        if (isMounted) scheduleNext();
      }, currentInterval);
    };

    scheduleNext();

    // 30-minute reminder check
    const reminderInterval = window.setInterval(() => {
      setBookings(currentBookings => {
        currentBookings.forEach(b => {
          if (b.status === 'scheduled' && b.scheduledAt) {
            const timeUntil = new Date(b.scheduledAt).getTime() - Date.now();
            if (timeUntil > 29.5 * 60000 && timeUntil <= 30.5 * 60000) {
              console.log(`[REMINDER]: Your session for Booking ${b.id} starts in 30 minutes!`);
            }
            if (timeUntil > 0 && timeUntil <= 5.5 * 60000) {
              const toastKey = `notified_${b.id}`;
              if (!sessionStorage.getItem(toastKey)) {
                toast({ title: 'Session Starting', description: 'Your session starts in less than 5 minutes! Click Join when ready.' });
                sessionStorage.setItem(toastKey, 'true');
              }
            }
          }
        });
        return currentBookings;
      });
    }, 30000);

    // Initial SSE connection for real-time updates
    const eventSource = new EventSource(`/api/sse/events?token=${localStorage.getItem('token')}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (['SESSION_STARTED', 'BUYER_JOINED', 'SESSION_EXPIRED'].includes(data.type)) {
          console.log(`[SSE] Received ${data.type}, refreshing bookings...`);
          load(false, false);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse event data', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error', err);
      eventSource.close();
    };

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      window.clearInterval(reminderInterval);
      eventSource.close();
    };
  }, [token, toast]);

  const resolveSessionStatus = useCallback((booking: BookingSummary) => {
    if (booking.status === 'cancelled') return 'cancelled';
    if (booking.status === 'pending_schedule') return 'pending_schedule';
    if (booking.session?.status) {
      return booking.session.status;
    }
    return booking.status === 'completed' ? 'completed' : 'scheduled';
  }, []);

  const resolveBadgeStatus = (booking: BookingSummary) => {
    if (booking.status === 'cancelled') return 'cancelled';
    const status = resolveSessionStatus(booking);
    if (status === 'pending_schedule') return 'pending';
    if (status === 'active') return 'active';
    if (status === 'completed') return 'completed';
    if (status === 'missed') return 'cancelled';
    return 'pending';
  };

  const resolveStatusLabel = (booking: BookingSummary) => {
    if (booking.status === 'cancelled') return 'Cancelled';
    const status = resolveSessionStatus(booking);
    if (status === 'pending_schedule') return 'Awaiting Scheduling';
    if (status === 'active') return 'Started';
    if (status === 'completed' || status === 'failed') return 'Ended';
    if (status === 'missed') return 'Session Missed';
    return 'Scheduled';
  };

  const handleStartSession = async (sessionId?: string) => {
    if (!token || !sessionId) {
      return;
    }

    if (sessionAction[sessionId]) {
      return;
    }

    try {
      setSessionAction((prev) => ({ ...prev, [sessionId]: 'start' }));
      setSessionError(null);
      await startSession(sessionId);
      const data = await getBookings();
      setBookings(Array.isArray(data) ? data as BookingSummary[] : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to start this session.';
      setSessionError(message);
      toast({
        title: 'Start failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSessionAction((prev) => ({ ...prev, [sessionId]: null }));
    }
  };

  const handleEndSession = async (sessionId?: string) => {
    if (!token || !sessionId) {
      return;
    }

    if (sessionAction[sessionId]) {
      return;
    }

    try {
      setSessionAction((prev) => ({ ...prev, [sessionId]: 'end' }));
      setSessionError(null);
      await endSession(sessionId, 'completed');
      const data = await getBookings();
      setBookings(Array.isArray(data) ? data as BookingSummary[] : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to end this session.';
      setSessionError(message);
      toast({
        title: 'End failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSessionAction((prev) => ({ ...prev, [sessionId]: null }));
    }
  };

  const handleFetchAvailability = async (professionalId: string) => {
    try {
      setIsAvailabilityLoading(true);
      const data = await getWeeklyAvailability(professionalId);
      setProfAvailability(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch professional availability", err);
    } finally {
      setIsAvailabilityLoading(false);
    }
  };

  const handleScheduleBooking = async (bookingId: string) => {
    if (!token || !scheduleDate) return;

    try {
      // Force IST Timezone interpretation deeply using tz library
      const selectedDate = parseAsIST(scheduleDate);
      const scheduledAt = selectedDate.toISOString();
      
      console.log("User Selected (Local):", selectedDate.toString());
      console.log("Scheduling payload (UTC):", scheduledAt);

      // FRONTEND VALIDATION
      const targetBooking = bookings.find(b => b.id === bookingId);
      const duration = targetBooking?.token?.durationMinutes || 60;
      if (!isWithinAvailability(scheduledAt, profAvailability, duration)) {
        const errorMsg = "Selected time is outside the professional's availability window.";
        setSessionError(errorMsg);
        toast({ title: 'Invalid Time', description: errorMsg, variant: 'destructive' });
        return;
      }

      setSessionAction((prev) => ({ ...prev, [bookingId]: 'schedule' }));
      setSessionError(null);
      await scheduleBooking(bookingId, scheduledAt);
      const data = await getBookings();
      setBookings(Array.isArray(data) ? data as BookingSummary[] : []);
      setSchedulingId(null);
      setScheduleDate('');
      toast({ title: 'Scheduled', description: 'Session successfully scheduled.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to schedule session.';
      setSessionError(message);
      toast({ title: 'Scheduling failed', description: message, variant: 'destructive' });
    } finally {
      setSessionAction((prev) => ({ ...prev, [bookingId]: null }));
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!token) return;
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      setSessionAction((prev) => ({ ...prev, [bookingId]: 'cancel' }));
      setSessionError(null);
      await cancelBooking(bookingId);
      const data = await getBookings();
      setBookings(Array.isArray(data) ? data as BookingSummary[] : []);
      toast({ title: 'Cancelled', description: 'Booking successfully cancelled.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to cancel booking.';
      setSessionError(message);
      toast({ title: 'Cancel failed', description: message, variant: 'destructive' });
    } finally {
      setSessionAction((prev) => ({ ...prev, [bookingId]: null }));
    }
  };

  const handleRequestEarlyStart = async (bookingId: string) => {
    if (!token) return;
    try {
      setSessionAction(prev => ({ ...prev, [bookingId]: 'early-start' }));
      await requestEarlyStart(bookingId);
      const data = await getBookings();
      setBookings(Array.isArray(data) ? data as BookingSummary[] : []);
    } catch (err: any) {
      toast({ title: 'Request failed', description: err.message, variant: 'destructive' });
    } finally {
      setSessionAction(prev => ({ ...prev, [bookingId]: null }));
    }
  };

  const handleStartSessionNow = async (bookingId: string) => {
    if (!window.confirm("Start this session immediately? The buyer will be notified to join.")) return;
    try {
      setSessionAction(prev => ({ ...prev, [bookingId]: 'start-now' }));
      console.log('[START] bookingId:', bookingId);
      const res = await startSessionNow(bookingId);
      console.log('[START] response:', res);
      toast({ title: 'Session Started' });
      // Open meeting link from API response ONLY — never use stale state
      if (res.meetingLink) {
        window.open(res.meetingLink, '_blank');
      }
      // Full re-fetch from DB
      const data = await getBookings();
      setBookings(Array.isArray(data) ? data as BookingSummary[] : []);
    } catch (err: any) {
      toast({ title: 'Failed to start', description: err.message, variant: 'destructive' });
    } finally {
      setSessionAction(prev => ({ ...prev, [bookingId]: null }));
    }
  };

  const handleBuyerJoin = async (bookingId: string) => {
    try {
      setSessionAction(prev => ({ ...prev, [bookingId]: 'join' }));
      console.log('[JOIN] bookingId:', bookingId);
      const res = await buyerJoin(bookingId);
      console.log('[JOIN] response:', res);
      if (res.meetingLink) {
        window.open(res.meetingLink, '_blank');
      }
      // Full re-fetch from DB
      const data = await getBookings();
      setBookings(Array.isArray(data) ? data as BookingSummary[] : []);
    } catch (err: any) {
      const msg = err.message || 'Failed to join session';
      toast({ title: 'Join failed', description: msg, variant: 'destructive' });
    } finally {
      setSessionAction(prev => ({ ...prev, [bookingId]: null }));
    }
  };

  const isOtherUserOnline = (b: BookingSummary) => {
    const lastSeenStr = isProfessional 
      ? b.buyer?.lastSeenAt 
      : b.token?.professional?.user?.lastSeenAt;
    if (!lastSeenStr) return false;
    return (Date.now() - new Date(lastSeenStr).getTime()) < 35000;
  };

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => {
          const status = resolveSessionStatus(b);
          return status === 'pending_schedule' || status === 'scheduled' || status === 'pending' || status === 'active';
        })
        .sort((a, b) => {
          if (!a.scheduledAt) return -1;
          if (!b.scheduledAt) return 1;
          return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        }),
    [bookings, resolveSessionStatus]
  );
  const completed = useMemo(
    () =>
      bookings.filter((b) => {
        const sessionStat = resolveSessionStatus(b);
        return (
          sessionStat === 'completed' ||
          sessionStat === 'failed' ||
          sessionStat === 'cancelled' ||
          b.status === 'cancelled'
        );
      }),
    [bookings, resolveSessionStatus]
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="section-container py-8 lg:py-12">
        <motion.div className="flex items-center justify-between mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">My Sessions</h1>
            <p className="text-muted-foreground">{isProfessional ? 'Manage your session offerings and bookings.' : 'View your booked and completed sessions.'}</p>
          </div>
          {isProfessional && <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground"><Link to="/create-session"><Plus size={18} className="mr-2" />New Session</Link></Button>}
        </motion.div>

        <div className="space-y-3">
          <ErrorNotice title="Unable to load sessions" message={loadError} />
          <ErrorNotice title="Session update failed" message={sessionError} />
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="mb-6"><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger>{isProfessional && <TabsTrigger value="listings">My Listings</TabsTrigger>}</TabsList>
          
          <TabsContent value="upcoming">
            {isLoading ? (
              <div className="card-elevated p-8 text-center">
                <Calendar className="mx-auto text-muted-foreground/50 mb-3" size={40} />
                <p className="text-muted-foreground">Loading your bookings...</p>
              </div>
            ) : upcoming.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcoming.map((b) => (
                  <div key={b.id} className="card-elevated p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status={resolveBadgeStatus(b)} />
                      <span className="text-xs text-muted-foreground">
                        {b.scheduledAt ? formatToIST(b.scheduledAt) : 'Time TBD'}
                      </span>
                    </div>

                    {/* LIVE COUNTDOWN */}
                    {(() => {
                      if (!b.scheduledAt || b.status !== 'scheduled') return null;
                      const timeUntil = new Date(b.scheduledAt).getTime() - nowMillis;
                      if (timeUntil < 0) return null; // already passed
                      
                      const hours = Math.floor(timeUntil / 3600000);
                      const minutes = Math.floor((timeUntil % 3600000) / 60000);
                      const seconds = Math.floor((timeUntil % 60000) / 1000);
                      
                      // Only show countdown if less than 24 hours
                      if (hours >= 24) return null;
                      
                      return (
                         <div className="mb-2 w-full text-center py-1 bg-secondary/20 border border-secondary rounded-sm transition-colors duration-500 text-xs font-mono font-bold tracking-widest text-primary/80">
                           {String(hours).padStart(2,'0')}:{String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}
                         </div>
                      );
                    })()}

                    <p className="text-sm text-foreground font-medium flex items-center gap-2">
                      {isProfessional ? b.buyer?.email || 'Buyer' : b.token?.professional?.user?.email || 'Professional'}
                      {isOtherUserOnline(b) && (
                        <span className="flex items-center text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-sm">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse" />Online
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.token?.durationMinutes ? `${b.token.durationMinutes} min` : 'Duration TBD'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {typeof b.token?.price === 'number' ? `₹ ${Number(b.token.price).toFixed(0)}` : 'Price TBD'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 font-medium mb-auto">
                      Status: {resolveStatusLabel(b)}
                    </p>

                    {b.status === 'cancelled' ? (
                      <div className="mt-4 pt-4 border-t border-border/10">
                        <p className="text-destructive text-sm font-medium text-center">Session Cancelled</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border/10">
                        {/* Pending Schedule Actions (Professional only) */}
                        {isProfessional && (b.status === 'pending_schedule' || b.status === 'scheduled') && (
                          <div>
                            {schedulingId === b.id ? (
                              <div className="flex flex-col gap-3">
                                {profAvailability.length > 0 && (
                                  <div className="bg-primary/5 p-3 rounded-md border border-primary/10 mb-1">
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Valid Windows (IST)</p>
                                    <div className="space-y-1">
                                      {(() => {
                                        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                        return profAvailability.map((slot, idx) => {
                                          // Rule: Storage = UTC, Display = IST
                                          const date = new Date(Date.UTC(2026, 2, 22 + slot.dayOfWeek, Math.floor(slot.startMinute / 60), slot.startMinute % 60));
                                          const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                                          
                                          const endUtcDate = new Date(Date.UTC(2026, 2, 22 + slot.dayOfWeek, Math.floor(slot.endMinute / 60), slot.endMinute % 60));
                                          const istEndDate = new Date(endUtcDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

                                          const startH = String(istDate.getHours()).padStart(2, '0');
                                          const startM = String(istDate.getMinutes()).padStart(2, '0');
                                          const endH = String(istEndDate.getHours()).padStart(2, '0');
                                          const endM = String(istEndDate.getMinutes()).padStart(2, '0');
                                          const dayName = days[istDate.getDay()];

                                          return (
                                            <div key={idx} className="flex justify-between text-[11px] text-muted-foreground border-b border-primary/5 last:border-0 pb-1">
                                              <span className="font-medium text-foreground">{dayName}</span>
                                              <span>{startH}:{startM} - {endH}:{endM}</span>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </div>
                                )}
                                {isAvailabilityLoading && <div className="text-[10px] text-muted-foreground animate-pulse italic">Loading availability...</div>}
                                
                                {(() => {
                                  if (!profAvailability || profAvailability.length === 0) return null;
                                  const suggestions = generateSuggestedTimes(profAvailability, b.token?.durationMinutes || 60, 3);
                                  if (suggestions.length === 0) return null;
                                  return (
                                    <div className="mb-2">
                                      <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">Suggested (IST):</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {suggestions.map((time, i) => (
                                          <button
                                            key={i}
                                            type="button"
                                            className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                                            onClick={() => {
                                              const { dateStr, timeStr } = getISTInputValues(time);
                                              setScheduleDate(`${dateStr}T${timeStr}`);
                                            }}
                                          >
                                            {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(time)}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}

                                <input 
                                  type="datetime-local" 
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground"
                                  value={scheduleDate}
                                  onChange={(e) => setScheduleDate(e.target.value)}
                                  min={new Date().toISOString().slice(0, 16)}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleScheduleBooking(b.id)} disabled={!scheduleDate || sessionAction[b.id] === 'schedule'} className="w-full">
                                    {sessionAction[b.id] === 'schedule' ? <Loader2 className="mr-2 animate-spin" size={14} /> : 'Confirm Time'}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setSchedulingId(null); setProfAvailability([]); }}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <Button size="sm" onClick={() => { 
                                setSchedulingId(b.id); 
                                if (b.token?.professionalId) handleFetchAvailability(b.token.professionalId);
                              }} className="w-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20">
                                <Calendar className="mr-2" size={14} /> {b.status === 'scheduled' ? 'Reschedule Session' : 'Schedule Session'}
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Join Meeting Link (Both Professional and Buyer) */}
                        {(b.status === 'scheduled' || resolveSessionStatus(b) === 'active' || resolveSessionStatus(b) === 'missed') && b.meetingLink && (
                          <div className="flex flex-col gap-2">
                            {(() => {
                              const sessionStatus = resolveSessionStatus(b);
                              const sessionIsActive = sessionStatus === 'active';
                              const sessionIsMissed = sessionStatus === 'missed';
                              const canJoinEarly = b.scheduledAt && (new Date(b.scheduledAt).getTime() - 5 * 60000) <= Date.now();

                              if (sessionIsMissed) {
                                return (
                                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                    <p className="text-xs text-destructive text-center font-medium">❌ Session expired — professional started but you did not join in time.</p>
                                  </div>
                                );
                              }

                              if (sessionIsActive) {
                                // Session is active — both parties can join
                                return (
                                  <Button 
                                    size="sm" 
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold" 
                                    onClick={() => isProfessional ? window.open(b.meetingLink!, '_blank') : handleBuyerJoin(b.id)}
                                    disabled={sessionAction[b.id] === 'join'}
                                  >
                                    {sessionAction[b.id] === 'join' ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Video className="mr-2" size={16} />}
                                    Join Session Now
                                  </Button>
                                );
                              }

                              if (isProfessional && canJoinEarly) {
                                return (
                                  <Button size="sm" className="w-full bg-[#2a2a2a] hover:bg-[#333] text-white border border-[#444]" onClick={() => window.open(b.meetingLink!, '_blank')}>
                                    <Video className="mr-2" size={16} /> Join ({b.scheduledAt ? formatTimeIST(b.scheduledAt) : ''})
                                  </Button>
                                );
                              }

                              if (!isProfessional && !sessionIsActive) {
                                return (
                                  <div className="flex flex-col gap-1.5 p-3 bg-amber-50 border border-amber-100 rounded-md">
                                    <p className="text-[11px] text-amber-700 text-center font-semibold flex items-center justify-center gap-1.5">
                                      <Clock size={12} className="animate-spin-slow" /> ⏳ Waiting for professional to start session
                                    </p>
                                    <p className="text-[10px] text-amber-600/70 text-center">Button will appear once the professional joins.</p>
                                  </div>
                                );
                              }

                              return (
                                <Button size="sm" disabled className="w-full">
                                  Available 5 min before start
                                </Button>
                              );
                            })()}

                            <Button size="sm" variant="outline" asChild className="w-full bg-secondary/30">
                              <a href={`https://meet.jit.si/CronoX-Test-${b.id}-${nowMillis}`} target="_blank" rel="noopener noreferrer">
                                <Video className="mr-2 text-primary" size={14} /> Test Connection
                              </a>
                            </Button>

                            {!isProfessional && (
                              <Button size="sm" variant={b.metadata?.earlyStartRequested ? 'outline' : 'secondary'}
                                onClick={() => handleRequestEarlyStart(b.id)} className={`w-full font-medium ${b.metadata?.earlyStartRequested ? 'border-primary/30 bg-primary/5 text-primary' : ''}`}
                                disabled={sessionAction[b.id] === 'early-start'}
                              >
                                {sessionAction[b.id] === 'early-start' ? <Loader2 className="mr-2 animate-spin" size={14}/> : '⚡ '}
                                {b.metadata?.earlyStartRequested ? 'Cancel Early Request' : 'Request Early Start'}
                              </Button>
                            )}

                            {isProfessional && (
                              <div className="flex flex-col gap-1 w-full pt-1">
                                {b.metadata?.earlyStartRequested && (
                                  <p className="text-[10px] font-bold text-blue-600 text-center uppercase tracking-wide animate-pulse">Buyer requested to start!</p>
                                )}
                                <Button size="sm" variant="secondary" onClick={() => handleStartSessionNow(b.id)} 
                                  className="w-full font-medium transition-all text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100" 
                                  disabled={sessionAction[b.id] === 'start-now'}
                                >
                                  {sessionAction[b.id] === 'start-now' ? <Loader2 className="mr-2 animate-spin" size={14}/> : '⚡ '} Start Session Now
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Session Controls (Professional only) */}
                        {isProfessional && b.session?.id && b.status === 'scheduled' && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-1">
                            {(() => {
                              const canStart = (b.scheduledAt && (new Date(b.scheduledAt).getTime() - 5 * 60000) <= Date.now()) || resolveSessionStatus(b) === 'active';
                              return (
                                <Button
                                  size="sm"
                                  onClick={() => handleStartSession(b.session?.id)}
                                  disabled={!canStart || resolveSessionStatus(b) !== 'pending' || sessionAction[b.session!.id] === 'start'}
                                  className="bg-accent hover:bg-accent/90 text-accent-foreground flex-1"
                                  title={!canStart ? "Session not yet available" : undefined}
                                >
                                  {sessionAction[b.session!.id] === 'start' ? (
                                    <><Loader2 className="mr-2 animate-spin" size={14} />Starting</>
                                  ) : 'Start'}
                                </Button>
                              );
                            })()}
                            <Button
                              size="sm"
                              onClick={() => handleEndSession(b.session?.id)}
                              disabled={resolveSessionStatus(b) !== 'active' || sessionAction[b.session.id] === 'end'}
                              variant="outline"
                              className="flex-1"
                            >
                              {sessionAction[b.session.id] === 'end' ? (
                                <><Loader2 className="mr-2 animate-spin" size={14} />Ending</>
                              ) : 'End'}
                            </Button>
                          </div>
                        )}

                        {/* Cancel Booking Action */}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleCancelBooking(b.id)} 
                          disabled={sessionAction[b.id] === 'cancel'}
                          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 mt-1"
                        >
                          {sessionAction[b.id] === 'cancel' ? <Loader2 className="mr-2 animate-spin" size={14} /> : 'Cancel Booking'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-elevated p-8 text-center">
                <Calendar className="mx-auto text-muted-foreground/50 mb-3" size={40} />
                <p className="text-muted-foreground mb-2">Your upcoming sessions will appear here</p>
                <p className="text-xs text-muted-foreground italic">Booked sessions with date, time, and join button will be displayed.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="completed">
            {isLoading ? (
              <div className="card-elevated p-8 text-center">
                <Clock className="mx-auto text-muted-foreground/50 mb-3" size={40} />
                <p className="text-muted-foreground">Loading completed sessions...</p>
              </div>
            ) : completed.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {completed.map((b) => (
                  <div key={b.id} className="card-elevated p-5">
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status="completed" />
                      <span className="text-xs text-muted-foreground">{b.scheduledAt ? formatToIST(b.scheduledAt) : 'Time TBD'}</span>
                    </div>
                    <p className="text-sm text-foreground font-medium">
                      {isProfessional ? b.buyer?.email || 'Buyer' : b.token?.professional?.user?.email || 'Professional'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Status: {resolveStatusLabel(b)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-elevated p-8 text-center">
                <Clock className="mx-auto text-muted-foreground/50 mb-3" size={40} />
                <p className="text-muted-foreground">Completed session history will appear here</p>
              </div>
            )}
          </TabsContent>
          
          {isProfessional && <TabsContent value="listings">
            <div className="card-elevated p-8 text-center">
              <Video className="mx-auto text-muted-foreground/50 mb-3" size={40} />
              <p className="text-muted-foreground mb-4">Your session listings will appear here</p>
              <Button asChild><Link to="/create-session"><Plus size={16} className="mr-1" />Create Session</Link></Button>
            </div>
          </TabsContent>}
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default MySessions;
