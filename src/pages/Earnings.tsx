import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { LifecycleIndicator } from '@/components/ui/LifecycleIndicator';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  TrendingUp, 
  Download, 
  Calendar,
  ArrowUpRight,
  CheckCircle,
  Clock,
  IndianRupee,
  FileText,
  ArrowRight
} from 'lucide-react';

const Earnings = () => {
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
            Earnings & Payouts
          </h1>
          <p className="text-muted-foreground">
            Track your session earnings, view payout history, and manage your earnings in INR.
          </p>
        </motion.div>

        {/* Earnings Summary */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { 
              title: 'Total Earnings', 
              icon: Wallet, 
              color: 'text-accent',
              bgColor: 'bg-accent/10',
              desc: 'Lifetime earnings from all completed sessions'
            },
            { 
              title: 'This Month', 
              icon: Calendar, 
              color: 'text-status-booked',
              bgColor: 'bg-status-booked/10',
              desc: 'Earnings from sessions completed this month'
            },
            { 
              title: 'Pending Payout', 
              icon: Clock, 
              color: 'text-cronox-amber',
              bgColor: 'bg-cronox-amber/10',
              desc: 'Amount awaiting settlement to your bank'
            },
            { 
              title: 'Last Payout', 
              icon: ArrowUpRight, 
              color: 'text-status-completed',
              bgColor: 'bg-status-completed/10',
              desc: 'Most recent payout amount and date'
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
              <p className="text-sm text-muted-foreground mb-2">Amount in INR will appear here</p>
              <p className="text-xs text-muted-foreground italic">{stat.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Completed Sessions */}
          <motion.div
            className="lg:col-span-2 card-elevated p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-foreground">
                Completed Sessions
              </h2>
              <Button variant="outline" size="sm">
                <Download size={16} className="mr-1" />
                Export
              </Button>
            </div>

            <p className="text-muted-foreground mb-6">
              This table will display all your completed sessions with details including 
              buyer name, session duration, date, earnings in INR, and payout status.
            </p>

            {/* Table Header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-secondary/50 rounded-lg text-sm font-medium text-muted-foreground mb-2">
              <span>Session</span>
              <span>Buyer</span>
              <span>Date</span>
              <span>Earnings</span>
              <span>Status</span>
            </div>

            {/* Placeholder Rows */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-5 gap-4 px-4 py-4 border-b border-border items-center text-sm">
                <span className="text-muted-foreground italic">Session title</span>
                <span className="text-muted-foreground italic">Buyer name</span>
                <span className="text-muted-foreground italic">Date</span>
                <span className="text-muted-foreground italic">₹ Amount</span>
                <StatusBadge status={i === 1 ? 'paid' : i === 2 ? 'completed' : 'pending'} />
              </div>
            ))}

            <p className="text-xs text-muted-foreground italic mt-4 text-center">
              Real session data with actual earnings in INR will be displayed once sessions are completed.
            </p>
          </motion.div>

          {/* Payout Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            {/* Payout Settings */}
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
                  Your linked bank account details will appear here for receiving payouts in INR.
                </p>
              </div>

              <Button variant="outline" size="sm" className="w-full">
                Manage Payout Settings
              </Button>
            </div>

            {/* Settlement Timeline */}
            <div className="card-elevated p-6">
              <h3 className="font-display font-semibold text-foreground mb-4">
                Session Lifecycle
              </h3>
              
              <div className="mb-4">
                <LifecycleIndicator currentStage="completed" />
              </div>

              <p className="text-xs text-muted-foreground">
                Sessions progress through stages from creation to payout. 
                The indicator above shows an example lifecycle progression.
              </p>
            </div>

            {/* Invoice Download */}
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

              <p className="text-xs text-muted-foreground italic mt-3">
                GST-compliant invoices and earnings statements in INR will be available for download.
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Earnings;
