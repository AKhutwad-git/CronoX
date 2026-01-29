import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SessionCard } from '@/components/ui/SessionCard';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Search, Filter, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';

type ListedToken = {
  id: string;
  state: string;
  durationMinutes: number;
  price: number;
  title?: string;
  topics?: string[];
  expertiseTags?: string[];
  professional?: {
    verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
    user?: {
      email?: string;
      role?: string;
    };
  };
};

type MarketplaceResponse = {
  items: ListedToken[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
};

type FilterState = {
  search: string;
  skills: string;
  topics: string;
  minPrice: string;
  maxPrice: string;
  pageSize: string;
};

const Marketplace = () => {
  const defaultPageSize = 9;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tokens, setTokens] = useState<ListedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    totalCount: 0,
    currentPage: 1,
    pageSize: defaultPageSize,
  });
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    skills: '',
    topics: '',
    minPrice: '',
    maxPrice: '',
    pageSize: String(defaultPageSize),
  });

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (!next.get('page')) {
      next.set('page', '1');
      changed = true;
    }
    if (!next.get('pageSize')) {
      next.set('pageSize', String(defaultPageSize));
      changed = true;
    }
    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [defaultPageSize, searchParams, setSearchParams]);

  useEffect(() => {
    setFilters({
      search: searchParams.get('search') ?? '',
      skills: searchParams.get('skills') ?? '',
      topics: searchParams.get('topics') ?? '',
      minPrice: searchParams.get('minPrice') ?? '',
      maxPrice: searchParams.get('maxPrice') ?? '',
      pageSize: searchParams.get('pageSize') ?? String(defaultPageSize),
    });
  }, [defaultPageSize, searchParams]);

  useEffect(() => {
    const loadTokens = async () => {
      setIsLoading(true);
      try {
        const queryString = searchParams.toString();
        const path = queryString ? `/marketplace/tokens?${queryString}` : '/marketplace/tokens';
        const data = await apiRequest<MarketplaceResponse | ListedToken[]>(path);

        if (Array.isArray(data)) {
          setTokens(data);
          setPagination({
            totalCount: data.length,
            currentPage: 1,
            pageSize: data.length || defaultPageSize,
          });
        } else {
          setTokens(Array.isArray(data.items) ? data.items : []);
          setPagination({
            totalCount: Number(data.totalCount) || 0,
            currentPage: Number(data.currentPage) || 1,
            pageSize: Number(data.pageSize) || defaultPageSize,
          });
        }
        setLoadError(null);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Please try again in a moment.';
        setLoadError(message);
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
  }, [defaultPageSize, searchParams, toast]);

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string) => {
      const trimmed = value.trim();
      if (trimmed) {
        next.set(key, trimmed);
      } else {
        next.delete(key);
      }
    };

    setOrDelete('search', filters.search);
    setOrDelete('skills', filters.skills);
    setOrDelete('topics', filters.topics);
    setOrDelete('minPrice', filters.minPrice);
    setOrDelete('maxPrice', filters.maxPrice);
    next.set('page', '1');
    next.set('pageSize', filters.pageSize || String(defaultPageSize));
    setSearchParams(next);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      skills: '',
      topics: '',
      minPrice: '',
      maxPrice: '',
      pageSize: String(defaultPageSize),
    });
    setSearchParams({ page: '1', pageSize: String(defaultPageSize) });
  };

  const goToPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next);
  };

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

  const totalPages = Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="section-container py-8 lg:py-12">
        <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Marketplace</h1>
          <p className="text-muted-foreground mb-6">Discover expert sessions and book time with professionals.</p>
          
          <form
            className="flex flex-col sm:flex-row gap-4 mb-6"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search experts, skills, or topics..."
                className="pl-10 h-12"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
            <Button type="submit" variant="outline" className="h-12">
              <Search size={18} className="mr-2" />
              Search
            </Button>
          </form>
          
          <div className="flex gap-2"><TrustBadge type="inr" size="sm" /><TrustBadge type="transparent" size="sm" /></div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="card-elevated p-6 h-fit">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground">
              <Filter size={16} />
              Filters
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Skills</p>
                <Input
                  placeholder="e.g. Design, Product"
                  value={filters.skills}
                  onChange={(event) => setFilters((prev) => ({ ...prev, skills: event.target.value }))}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Topics</p>
                <Input
                  placeholder="e.g. Growth, Strategy"
                  value={filters.topics}
                  onChange={(event) => setFilters((prev) => ({ ...prev, topics: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Min price</p>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={filters.minPrice}
                    onChange={(event) => setFilters((prev) => ({ ...prev, minPrice: event.target.value }))}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Max price</p>
                  <Input
                    type="number"
                    min={0}
                    placeholder="2000"
                    value={filters.maxPrice}
                    onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Results per page</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={filters.pageSize}
                  onChange={(event) => setFilters((prev) => ({ ...prev, pageSize: event.target.value }))}
                >
                  {[6, 9, 12, 24].map((size) => (
                    <option key={size} value={String(size)}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={applyFilters}>
                  Apply
                </Button>
                <Button variant="outline" className="flex-1" onClick={clearFilters}>
                  Clear
                </Button>
              </div>
            </div>
          </div>

          <div>
            <ErrorNotice title="Unable to load marketplace" message={loadError} />

            {isLoading ? (
              <div className="card-elevated p-8 text-center">
                <Users className="mx-auto text-muted-foreground/50 mb-3" size={40} />
                <p className="text-muted-foreground">Loading listed sessions...</p>
              </div>
            ) : tokens.length > 0 ? (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tokens.map((token, index) => (
                    <motion.div key={token.id || index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                      <SessionCard
                        professionalName={token.professional?.user?.email || 'Professional'}
                        role={token.professional?.user?.role || 'Professional'}
                        verificationStatus={token.professional?.verificationStatus}
                        duration={token.durationMinutes}
                        price={Number(token.price)}
                        status={getStatus(token.state)}
                        title={token.title}
                        tags={token.topics?.length ? token.topics : token.expertiseTags}
                        onAction={() => handleViewDetails(token.id)}
                      />
                    </motion.div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 text-sm text-muted-foreground">
                  <span>
                    Showing page {pagination.currentPage} of {totalPages} · {pagination.totalCount} results
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.currentPage <= 1}
                      onClick={() => goToPage(pagination.currentPage - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.currentPage >= totalPages}
                      onClick={() => goToPage(pagination.currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="card-elevated p-8 text-center">
                <Users className="mx-auto text-muted-foreground/50 mb-3" size={40} />
                <p className="text-muted-foreground mb-2">No sessions match these filters</p>
                <p className="text-xs text-muted-foreground italic">Try adjusting your search or filter selections.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Marketplace;
