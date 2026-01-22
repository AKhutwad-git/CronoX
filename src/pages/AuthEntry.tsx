import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { Search, Clock, ArrowRight, Users, Wallet } from 'lucide-react';

const AuthEntry = () => {
  const [searchParams] = useSearchParams();
  const suggestedRole = searchParams.get('role');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="section-container py-16 lg:py-24">
        <motion.div 
          className="max-w-2xl mx-auto text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            How do you want to use CronoX?
          </h1>
          <p className="text-lg text-muted-foreground">
            Your choice determines your dashboard experience and available features. 
            You can always access both sides of the marketplace later.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Buyer Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className={`card-elevated p-8 h-full transition-all hover:border-status-booked/50 ${suggestedRole === 'buyer' ? 'ring-2 ring-status-booked border-status-booked/50' : ''}`}>
              <div className="w-16 h-16 rounded-2xl bg-status-booked/10 flex items-center justify-center mb-6">
                <Search className="text-status-booked" size={28} />
              </div>
              
              <h2 className="font-display text-2xl font-bold text-foreground mb-3">
                I want to book sessions
              </h2>
              
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Browse expert profiles, purchase session time, and schedule meetings 
                with professionals across various domains.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  'Discover verified professionals',
                  'Transparent pricing in INR',
                  'Flexible scheduling',
                  'Secure payment processing'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-booked" />
                    {item}
                  </li>
                ))}
              </ul>

              <Button asChild className="w-full bg-status-booked hover:bg-status-booked/90 text-white h-12">
                <Link to="/signup?role=buyer">
                  Continue as Buyer
                  <ArrowRight size={18} className="ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Professional Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className={`card-elevated p-8 h-full transition-all hover:border-accent/50 ${suggestedRole === 'professional' ? 'ring-2 ring-accent border-accent/50' : ''}`}>
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                <Clock className="text-accent" size={28} />
              </div>
              
              <h2 className="font-display text-2xl font-bold text-foreground mb-3">
                I want to offer sessions
              </h2>
              
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Monetise your expertise by creating bookable time slots. 
                Set your availability, receive bookings, and earn in INR.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  'Create paid session offerings',
                  'AI-assisted pricing suggestions',
                  'Manage your availability',
                  'Track earnings and payouts'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>

              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12">
                <Link to="/signup?role=professional">
                  Continue as Professional
                  <ArrowRight size={18} className="ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.p 
          className="text-center text-sm text-muted-foreground mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Already have an account?{' '}
          <Link to="/signin" className="text-accent font-medium hover:underline">
            Sign in here
          </Link>
        </motion.p>
      </div>
    </div>
  );
};

export default AuthEntry;
