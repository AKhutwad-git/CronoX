import { motion } from 'framer-motion';
import { useRole } from '@/contexts/RoleContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge, type SessionStatus } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
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
  return (
    <div className="space-y-8">
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
                <p className="text-2xl font-bold text-foreground mb-1">Ready</p>
                <p className="text-xs text-muted-foreground">Your profile and availability are set up. This section will show your real-time readiness status based on profile completion and active availability.</p>
              </div>
            )
          },
          { 
            title: 'Active Listings', 
            icon: Calendar, 
            color: 'text-status-booked',
            bgColor: 'bg-status-booked/10',
            content: (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Session listings count will appear here</p>
                <p className="text-xs text-muted-foreground italic">Shows the number of active session offerings currently visible in the marketplace.</p>
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
                <p className="text-sm text-muted-foreground mb-2">Earnings summary will appear here</p>
                <p className="text-xs text-muted-foreground italic">Displays total earnings in INR for the current month from completed sessions.</p>
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
                <p className="text-sm text-muted-foreground mb-2">Upcoming count will appear here</p>
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
              <p className="text-xs text-muted-foreground italic mt-2">Count will appear here</p>
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
  return (
    <div className="space-y-8">
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
                <p className="text-sm text-muted-foreground mb-2">Session count will appear here</p>
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
                <p className="text-sm text-muted-foreground mb-2">Completed count will appear here</p>
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
                <p className="text-sm text-muted-foreground mb-2">Amount in INR will appear here</p>
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
