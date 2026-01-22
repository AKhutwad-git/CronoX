import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';

const Profile = () => {
  const { role } = useRole();
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="section-container py-8 lg:py-12 max-w-3xl">
        <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Profile</h1>
          <p className="text-muted-foreground">Manage your account details and preferences.</p>
        </motion.div>

        <motion.div className="card-elevated p-6 mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-cronox-secondary flex items-center justify-center text-primary-foreground text-2xl font-bold">U</div>
            <div>
              <p className="font-semibold text-foreground">Your Name</p>
              <p className="text-sm text-muted-foreground capitalize">{role} Account</p>
            </div>
          </div>
          
          <div className="grid gap-4">
            {[{ icon: User, label: 'Full Name' }, { icon: Mail, label: 'Email' }, { icon: Phone, label: 'Phone' }, { icon: MapPin, label: 'Location' }].map((field) => (
              <div key={field.label}>
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground italic">
                  <field.icon size={14} />
                  <span>Your {field.label.toLowerCase()} will appear here</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Save Changes</Button>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
