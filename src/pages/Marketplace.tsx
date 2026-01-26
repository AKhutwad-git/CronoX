import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SessionCard } from '@/components/ui/SessionCard';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';

type ListedToken = {
  id: string;
  state: string;
  durationMinutes: number;
  price: number;
  professional?: {
    user?: {
      email?: string;
      role?: string;
    };
  };
};

const Marketplace = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<ListedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        const data = await apiRequest<ListedToken[]>('/marketplace/tokens');
        setTokens(Array.isArray(data) ? data : []);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Please try again in a moment.';
        toast({
          title: 'Unable to load marketplace',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTokens();
  }, [toast]);

  const getStatus = (state: string) => {
    if (state === 'listed') return 'available';
    if (state === 'purchased') return 'booked';
    if (state === 'consumed') return 'completed';
    return 'pending';
  };

  const handleViewDetails = (tokenId?: string) => {
    console.log('[marketplace] view details click', { tokenId });
    if (!tokenId) {
      toast({
        title: 'Session unavailable',
        description: 'Missing session id for details view.',
        variant: 'destructive',
      });
      return;
    }
    const target = `/marketplace/tokens/${tokenId}`;
    console.log('[marketplace] navigate to details', { target });
    navigate(target);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="section-container py-8 lg:py-12">
        <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Marketplace</h1>
          <p className="text-muted-foreground mb-6">Discover expert sessions and book time with professionals.</p>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input placeholder="Search experts, skills, or topics..." className="pl-10 h-12" />
            </div>
            <Button variant="outline" className="h-12"><Filter size={18} className="mr-2" />Filters</Button>
          </div>
          
          <div className="flex gap-2"><TrustBadge type="inr" size="sm" /><TrustBadge type="transparent" size="sm" /></div>
        </motion.div>

        {isLoading ? (
          <div className="card-elevated p-8 text-center">
            <Users className="mx-auto text-muted-foreground/50 mb-3" size={40} />
            <p className="text-muted-foreground">Loading listed sessions...</p>
          </div>
        ) : tokens.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tokens.map((token, index) => (
              <motion.div key={token.id || index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <SessionCard
                  professionalName={token.professional?.user?.email || 'Professional'}
                  role={token.professional?.user?.role || 'Professional'}
                  duration={token.durationMinutes}
                  price={Number(token.price)}
                  status={getStatus(token.state)}
                  onAction={() => handleViewDetails(token.id)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="card-elevated p-8 text-center">
            <Users className="mx-auto text-muted-foreground/50 mb-3" size={40} />
            <p className="text-muted-foreground mb-2">No sessions are listed yet</p>
            <p className="text-xs text-muted-foreground italic">Once professionals list sessions, they will appear here.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Marketplace;
