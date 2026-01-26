import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/contexts/RoleContext';
import { apiRequest } from '@/lib/api';
import { 
  Clock, 
  Calendar, 
  CheckCircle, 
  ArrowLeft, 
  Info,
  Sparkles,
  AlertCircle
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
  const { token } = useRole();
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Please try again in a moment.';
  };

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
      const mintData = await apiRequest<{ id: string }>('/marketplace/tokens/mint', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          duration: selectedDuration,
          price: priceValue,
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

  const isReady = selectedDuration && title.length > 3 && Number(price) > 0;

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
                
                <div className="bg-secondary/50 rounded-xl p-5 border border-border">
                  <div className="flex items-start gap-3">
                    <Calendar className="text-muted-foreground flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Your availability calendar will be displayed here. You'll be able to select specific 
                        days and time slots when you're available for sessions.
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        The calendar interface will allow you to set recurring availability patterns 
                        or individual time slots.
                      </p>
                    </div>
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
                  { label: 'Availability set', done: false },
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
