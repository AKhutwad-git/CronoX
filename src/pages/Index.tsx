import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { 
  Clock, 
  Users, 
  Search, 
  CreditCard, 
  Calendar, 
  Video, 
  Settings, 
  TrendingUp, 
  Megaphone, 
  Wallet,
  Shield,
  IndianRupee,
  FileText,
  ArrowRight,
  CheckCircle,
  Sparkles
} from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-cronox-secondary to-primary py-24 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        
        <motion.div 
          className="section-container relative z-10"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent text-sm font-medium border border-accent/30">
                <Sparkles size={16} />
                India Edition — Launching Soon
              </span>
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight"
            >
              Turn Your Expertise Into{' '}
              <span className="text-accent">Bookable Time</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              CronoX connects professionals with buyers seeking expert consultations. 
              Offer paid sessions, set your availability, and get paid securely—all with 
              transparent pricing in Indian Rupees.
            </motion.p>
            
            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
            >
              <Button asChild size="lg" className="btn-hero-primary text-lg h-14 px-8">
                <Link to="/auth?role=buyer">
                  <Search size={20} className="mr-2" />
                  Find Experts
                </Link>
              </Button>
              <Button asChild size="lg" className="btn-hero-secondary text-lg h-14 px-8">
                <Link to="/auth?role=professional">
                  <Clock size={20} className="mr-2" />
                  Offer Your Time
                </Link>
              </Button>
            </motion.div>
            
            <motion.div 
              variants={fadeInUp}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <TrustBadge type="inr" />
              <TrustBadge type="secure" />
              <TrustBadge type="transparent" />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* What is CronoX */}
      <section className="py-20 lg:py-28 bg-cronox-surface">
        <div className="section-container">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              What is CronoX?
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              CronoX is a marketplace where professionals monetise their time and expertise 
              through bookable paid sessions. Buyers can discover experts, purchase session 
              time, and schedule meetings—all with clear, upfront pricing in INR.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: 'Expert Marketplace',
                description: 'Browse a curated selection of professionals offering their expertise across various domains—from business consulting to creative services.'
              },
              {
                icon: IndianRupee,
                title: 'Transparent INR Pricing',
                description: 'Every session shows clear pricing in Indian Rupees. No hidden fees, no surprises. You know exactly what you pay before booking.'
              },
              {
                icon: Shield,
                title: 'Secure & Trusted',
                description: 'Payments are processed securely through trusted Indian gateways. Both buyers and professionals are protected throughout the transaction.'
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                className="card-elevated p-8 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="text-accent" size={28} />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28">
        <div className="section-container">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you're looking to book expert time or offer your skills, 
              CronoX makes the process simple and transparent.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            {/* For Buyers */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-status-booked/10 flex items-center justify-center">
                  <Search className="text-status-booked" size={24} />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground">For Buyers</h3>
              </div>
              
              <div className="space-y-6">
                {[
                  { icon: Search, step: '1', title: 'Browse Expert Sessions', desc: 'Explore the marketplace to find professionals who match your needs' },
                  { icon: CreditCard, step: '2', title: 'Purchase a Session', desc: 'Pay securely in INR with full price transparency' },
                  { icon: Calendar, step: '3', title: 'Book a Time Slot', desc: 'Select an available slot that fits your schedule' },
                  { icon: Video, step: '4', title: 'Attend the Session', desc: 'Connect with the professional at your scheduled time' },
                ].map((item, index) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-status-booked/10 flex items-center justify-center text-status-booked font-bold text-sm">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* For Professionals */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Clock className="text-accent" size={24} />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground">For Professionals</h3>
              </div>
              
              <div className="space-y-6">
                {[
                  { icon: Settings, step: '1', title: 'Set Your Availability', desc: 'Define when you can take sessions and set duration options' },
                  { icon: TrendingUp, step: '2', title: 'View System Pricing', desc: 'See AI-assisted pricing suggestions based on your profile and market data' },
                  { icon: Megaphone, step: '3', title: 'List Your Sessions', desc: 'Publish your offerings to the marketplace' },
                  { icon: Wallet, step: '4', title: 'Conduct & Get Paid', desc: 'Complete sessions and receive payouts to your bank account' },
                ].map((item, index) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust & Transparency */}
      <section className="py-20 lg:py-28 bg-cronox-surface">
        <div className="section-container">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Trust & Transparency
            </h2>
            <p className="text-lg text-muted-foreground">
              CronoX is built for the Indian market with features that prioritise 
              trust, clarity, and reliability in every transaction.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: IndianRupee, title: 'INR Pricing', desc: 'All prices clearly shown in Indian Rupees' },
              { icon: CreditCard, title: 'Session-Based Payments', desc: 'Pay per session with no hidden subscriptions' },
              { icon: FileText, title: 'Invoices & Records', desc: 'Get proper documentation for all transactions' },
              { icon: Shield, title: 'Reliable Platform', desc: 'Secure infrastructure built for Indian users' },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                className="bg-card rounded-2xl p-6 border border-border"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <item.icon className="text-accent" size={22} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 lg:py-32 bg-gradient-to-br from-primary via-cronox-secondary to-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        
        <motion.div 
          className="section-container relative z-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
            Join CronoX today and experience a new way to connect expertise with opportunity.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="btn-hero-primary text-lg h-14 px-8">
              <Link to="/auth?role=buyer">
                Get Started as Buyer
                <ArrowRight size={18} className="ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" className="btn-hero-secondary text-lg h-14 px-8">
              <Link to="/auth?role=professional">
                Get Started as Professional
                <ArrowRight size={18} className="ml-2" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
