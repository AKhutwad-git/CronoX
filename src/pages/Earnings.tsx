import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { LifecycleIndicator } from '@/components/ui/LifecycleIndicator';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { useRole } from '@/contexts/RoleContext';
import { useToast } from '@/hooks/use-toast';
import { getBookings, getPayments } from '@/lib/api';
import { 
  Wallet, 
  Download, 
  Calendar,
  ArrowUpRight,
  Clock,
  IndianRupee,
  FileText,
} from 'lucide-react';

const Earnings = () => {
  const { role, token } = useRole();
  const { toast } = useToast();
  const isProfessional = role === 'professional';
  type PaymentRecord = {
    id: string;
    sessionId: string;
    amount: number;
    status: 'pending' | 'settled' | 'failed';
    createdAt?: string;
    settledAt?: string;
  };
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

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!token) {
        if (isMounted) {
          setPayments([]);
          setBookings([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        const [paymentsData, bookingsData] = await Promise.all([getPayments(token), getBookings(token)]);
        if (isMounted) {
          setPayments(Array.isArray(paymentsData) ? (paymentsData as PaymentRecord[]) : []);
          setBookings(Array.isArray(bookingsData) ? (bookingsData as BookingSummary[]) : []);
        }
      } catch (err: unknown) {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Please try again in a moment.';
        toast({
          title: 'Unable to load payments',
          description: message,
          variant: 'destructive',
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [token, toast]);

  const bookingsBySessionId = useMemo(() => {
    const map = new Map<string, BookingSummary>();
    bookings.forEach((booking) => {
      if (booking.session?.id) {
        map.set(booking.session.id, booking);
      }
    });
    return map;
  }, [bookings]);

  const paymentRows = useMemo(() => {
    return payments
      .map((payment) => ({
        payment,
        booking: bookingsBySessionId.get(payment.sessionId),
      }))
      .sort((a, b) => {
        const dateA = a.payment.settledAt ?? a.payment.createdAt ?? a.booking?.scheduledAt ?? '';
        const dateB = b.payment.settledAt ?? b.payment.createdAt ?? b.booking?.scheduledAt ?? '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [payments, bookingsBySessionId]);

  const totalAmount = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );
  const pendingAmount = useMemo(
    () => payments.filter((payment) => payment.status === 'pending').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );
  const settledPayments = useMemo(
    () => payments.filter((payment) => payment.status === 'settled'),
    [payments]
  );
  const currentMonthAmount = useMemo(() => {
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
  const lastSettled = useMemo(() => {
    return settledPayments
      .filter((payment) => payment.settledAt)
      .sort((a, b) => new Date(b.settledAt as string).getTime() - new Date(a.settledAt as string).getTime())[0];
  }, [settledPayments]);

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
            {isProfessional ? 'Earnings & Payouts' : 'Payment History'}
          </h1>
          <p className="text-muted-foreground">
            {isProfessional
              ? 'Track your session earnings, view payout history, and manage your earnings in INR.'
              : 'Review payments for completed sessions and consumed tokens.'}
          </p>
        </motion.div>

        {/* Earnings Summary */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { 
              title: isProfessional ? 'Total Earnings' : 'Total Paid', 
              icon: Wallet, 
              color: 'text-accent',
              bgColor: 'bg-accent/10',
              desc: isProfessional ? 'Lifetime earnings from all completed sessions' : 'Total paid for completed sessions'
            },
            { 
              title: 'This Month', 
              icon: Calendar, 
              color: 'text-status-booked',
              bgColor: 'bg-status-booked/10',
              desc: isProfessional ? 'Earnings from sessions completed this month' : 'Payments recorded this month'
            },
            { 
              title: isProfessional ? 'Pending Payout' : 'Pending Payments', 
              icon: Clock, 
              color: 'text-cronox-amber',
              bgColor: 'bg-cronox-amber/10',
              desc: isProfessional ? 'Amount awaiting settlement to your bank' : 'Payments still processing'
            },
            { 
              title: isProfessional ? 'Last Payout' : 'Last Payment', 
              icon: ArrowUpRight, 
              color: 'text-status-completed',
              bgColor: 'bg-status-completed/10',
              desc: isProfessional ? 'Most recent payout amount and date' : 'Most recent payment amount and date'
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              className="card-elevated p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={stat.color} size={20} />
                </div>
              </div>
              {stat.title === (isProfessional ? 'Total Earnings' : 'Total Paid') && (
                isLoading ? (
                  <span className="text-2xl font-bold text-foreground">—</span>
                ) : (
                  <PriceDisplay amount={totalAmount} size="lg" />
                )
              )}
              {stat.title === 'This Month' && (
                isLoading ? (
                  <span className="text-2xl font-bold text-foreground">—</span>
                ) : (
                  <PriceDisplay amount={currentMonthAmount} size="lg" />
                )
              )}
              {stat.title === (isProfessional ? 'Pending Payout' : 'Pending Payments') && (
                isLoading ? (
                  <span className="text-2xl font-bold text-foreground">—</span>
                ) : (
                  <PriceDisplay amount={pendingAmount} size="lg" />
                )
              )}
              {stat.title === (isProfessional ? 'Last Payout' : 'Last Payment') && (
                <div>
                  {isLoading ? (
                    <span className="text-2xl font-bold text-foreground">—</span>
                  ) : (
                    <PriceDisplay amount={lastSettled?.amount} size="lg" />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {lastSettled?.settledAt ? new Date(lastSettled.settledAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground italic mt-2">{stat.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Completed Sessions */}
          <motion.div
            className={`${isProfessional ? 'lg:col-span-2' : 'lg:col-span-3'} card-elevated p-6`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-foreground">
                {isProfessional ? 'Completed Sessions' : 'Payment History'}
              </h2>
              <Button variant="outline" size="sm">
                <Download size={16} className="mr-1" />
                Export
              </Button>
            </div>

            <p className="text-muted-foreground mb-6">
              {isProfessional
                ? 'Review session earnings, buyer details, and payout status.'
                : 'Track payments tied to your completed sessions and consumed tokens.'}
            </p>

            {/* Table Header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-secondary/50 rounded-lg text-sm font-medium text-muted-foreground mb-2">
              <span>Session</span>
              <span>{isProfessional ? 'Buyer' : 'Professional'}</span>
              <span>Date</span>
              <span>{isProfessional ? 'Earnings' : 'Amount'}</span>
              <span>Status</span>
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading payment history...
              </div>
            ) : paymentRows.length > 0 ? (
              <div className="space-y-2">
                {paymentRows.map(({ payment, booking }) => {
                  const sessionLabel = booking?.token?.durationMinutes
                    ? `${booking.token.durationMinutes} min session`
                    : `Session ${payment.sessionId.slice(0, 6).toUpperCase()}`;
                  const counterparty = isProfessional
                    ? booking?.buyer?.email || 'Buyer'
                    : booking?.token?.professional?.user?.email || 'Professional';
                  const dateValue = payment.settledAt ?? payment.createdAt ?? booking?.scheduledAt;
                  const statusBadge =
                    payment.status === 'settled' ? 'paid' : payment.status === 'pending' ? 'pending' : null;
                  return (
                    <div key={payment.id} className="grid grid-cols-5 gap-4 px-4 py-4 border-b border-border items-center text-sm">
                      <span className="text-foreground">{sessionLabel}</span>
                      <span className="text-muted-foreground">{counterparty}</span>
                      <span className="text-muted-foreground">{dateValue ? new Date(dateValue).toLocaleDateString() : '—'}</span>
                      <span className="text-foreground">
                        <PriceDisplay amount={Number(payment.amount)} size="sm" />
                      </span>
                      {statusBadge ? (
                        <StatusBadge status={statusBadge} />
                      ) : (
                        <span className="text-xs font-medium text-foreground">Failed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic mt-4 text-center">
                No completed payments yet.
              </p>
            )}
          </motion.div>

          {isProfessional && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              <div className="card-elevated p-6">
                <h3 className="font-display font-semibold text-foreground mb-4">
                  Payout Settings
                </h3>
                
                <div className="bg-secondary/50 rounded-xl p-4 border border-border mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <IndianRupee className="text-accent" size={18} />
                    <span className="text-sm font-medium text-foreground">Bank Account</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    Manage your payout destination for INR settlements.
                  </p>
                </div>

                <Button variant="outline" size="sm" className="w-full">
                  Manage Payout Settings
                </Button>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-display font-semibold text-foreground mb-4">
                  Session Lifecycle
                </h3>
                
                <div className="mb-4">
                  <LifecycleIndicator currentStage="completed" />
                </div>

                <p className="text-xs text-muted-foreground">
                  Payments appear after sessions complete and move from pending to settled.
                </p>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-display font-semibold text-foreground mb-4">
                  Invoices & Reports
                </h3>
                
                <div className="space-y-3">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText size={16} className="mr-2" />
                    Monthly Statement
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Download size={16} className="mr-2" />
                    Download All Invoices
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Earnings;
