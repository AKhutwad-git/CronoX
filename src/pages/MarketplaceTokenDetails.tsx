import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge, type SessionStatus } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { User, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';

type TokenDetails = {
  id: string;
  state: string;
  durationMinutes: number;
  price: number;
  currency?: string;
  createdAt?: string;
  professional?: {
    user?: {
      email?: string;
      role?: string;
    };
  };
};

const MarketplaceTokenDetails = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [token, setToken] = useState<TokenDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const status = useMemo<SessionStatus>(() => {
    if (!token?.state) return 'pending';
    if (token.state === 'listed') return 'available';
    if (token.state === 'purchased') return 'booked';
    if (token.state === 'consumed') return 'completed';
    return 'pending';
  }, [token?.state]);

  useEffect(() => {
    console.log('[marketplace] details route mount', { id });
    if (!id) {
      setError('Missing session id.');
      setIsLoading(false);
      return;
    }

    const loadToken = async () => {
      console.log('[marketplace] details fetch start', { id });
      try {
        const data = await apiRequest<TokenDetails>(`/marketplace/tokens/${id}`);
        console.log('[marketplace] details fetch success', { id });
        setToken(data ?? null);
        setError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to load session details.';
        console.log('[marketplace] details fetch error', { id, message });
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
  }, [id, toast]);

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
          <div className="card-elevated p-8 text-center">
            <p className="text-muted-foreground mb-2">Unable to load session details.</p>
            <p className="text-xs text-muted-foreground italic">{error}</p>
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
                </div>
              </div>
              <StatusBadge status={status} />
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
              </div>
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              <p>Token ID: {token.id}</p>
              {token.createdAt && <p>Created: {new Date(token.createdAt).toLocaleString()}</p>}
            </div>
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
