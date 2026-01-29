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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { endSession, getBookings, startSession } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const MySessions = () => {
  const { role, token } = useRole();
  const { toast } = useToast();
  const isProfessional = role === 'professional';

  type BookingSummary = {
    id: string;
    scheduledAt: string;
    status: 'scheduled' | 'completed' | 'cancelled';
    buyer?: {
      email?: string;
    };
    token?: {
      id: string;
      durationMinutes?: number;
      price?: number;
      professional?: { user?: { email?: string } };
    };
    session?: {
      id: string;
      status: 'pending' | 'active' | 'completed' | 'failed';
      startedAt?: string;
      endedAt?: string;
    };
  };

  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionAction, setSessionAction] = useState<Record<string, 'start' | 'end' | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

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
    const interval = window.setInterval(() => {
      load(false, false);
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [token, toast]);

  const resolveSessionStatus = useCallback((booking: BookingSummary) => {
    if (booking.session?.status) {
      return booking.session.status;
    }
    return booking.status === 'completed' ? 'completed' : 'pending';
  }, []);

  const resolveBadgeStatus = (booking: BookingSummary) => {
    const status = resolveSessionStatus(booking);
    if (status === 'active') return 'active';
    if (status === 'completed') return 'completed';
    return 'pending';
  };

  const resolveStatusLabel = (booking: BookingSummary) => {
    const status = resolveSessionStatus(booking);
    if (status === 'active') return 'Started';
    if (status === 'completed') return 'Ended';
    if (status === 'failed') return 'Ended';
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
      const updated = await startSession(sessionId);
      setBookings((prev) =>
        prev.map((booking) =>
          booking.session?.id === sessionId
            ? {
                ...booking,
                session: {
                  ...booking.session,
                  ...(updated as BookingSummary['session']),
                  status: (updated as BookingSummary['session'])?.status ?? 'active',
                },
              }
            : booking
        )
      );
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
      const updated = await endSession(sessionId, 'completed');
      setBookings((prev) =>
        prev.map((booking) =>
          booking.session?.id === sessionId
            ? {
                ...booking,
                session: {
                  ...booking.session,
                  ...(updated as BookingSummary['session']),
                  status: (updated as BookingSummary['session'])?.status ?? 'completed',
                },
                status: 'completed',
              }
            : booking
        )
      );
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

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => {
          const status = resolveSessionStatus(b);
          return status === 'pending' || status === 'active';
        })
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [bookings, resolveSessionStatus]
  );
  const completed = useMemo(
    () =>
      bookings.filter((b) => {
        const status = resolveSessionStatus(b);
        return status === 'completed' || status === 'failed';
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
                  <div key={b.id} className="card-elevated p-5">
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status={resolveBadgeStatus(b)} />
                      <span className="text-xs text-muted-foreground">{new Date(b.scheduledAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-foreground font-medium">
                      {isProfessional ? b.buyer?.email || 'Buyer' : b.token?.professional?.user?.email || 'Professional'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.token?.durationMinutes ? `${b.token.durationMinutes} min` : 'Duration TBD'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {typeof b.token?.price === 'number' ? `₹ ${Number(b.token.price).toFixed(0)}` : 'Price TBD'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Status: {resolveStatusLabel(b)}
                    </p>
                    {isProfessional && b.session?.id && (
                      <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => handleStartSession(b.session?.id)}
                          disabled={resolveSessionStatus(b) !== 'pending' || sessionAction[b.session.id] === 'start'}
                          className="bg-accent hover:bg-accent/90 text-accent-foreground"
                        >
                          {sessionAction[b.session.id] === 'start' ? (
                            <>
                              <Loader2 className="mr-2 animate-spin" size={14} />
                              Starting
                            </>
                          ) : (
                            'Start Session'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEndSession(b.session?.id)}
                          disabled={resolveSessionStatus(b) !== 'active' || sessionAction[b.session.id] === 'end'}
                          variant="outline"
                        >
                          {sessionAction[b.session.id] === 'end' ? (
                            <>
                              <Loader2 className="mr-2 animate-spin" size={14} />
                              Ending
                            </>
                          ) : (
                            'End Session'
                          )}
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
                      <span className="text-xs text-muted-foreground">{new Date(b.scheduledAt).toLocaleString()}</span>
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
