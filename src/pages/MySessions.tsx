import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useRole } from '@/contexts/RoleContext';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Video, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const MySessions = () => {
  const { role } = useRole();
  const isProfessional = role === 'professional';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="section-container py-8 lg:py-12">
        <motion.div className="flex items-center justify-between mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">My Sessions</h1>
            <p className="text-muted-foreground">{isProfessional ? 'Manage your session offerings and bookings.' : 'View your booked and completed sessions.'}</p>
          </div>
          {isProfessional && <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground"><Link to="/create-session"><Plus size={18} className="mr-2" />New Session</Link></Button>}
        </motion.div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="mb-6"><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger>{isProfessional && <TabsTrigger value="listings">My Listings</TabsTrigger>}</TabsList>
          
          <TabsContent value="upcoming">
            <div className="card-elevated p-8 text-center">
              <Calendar className="mx-auto text-muted-foreground/50 mb-3" size={40} />
              <p className="text-muted-foreground mb-2">Your upcoming sessions will appear here</p>
              <p className="text-xs text-muted-foreground italic">Booked sessions with date, time, and join button will be displayed.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="completed">
            <div className="card-elevated p-8 text-center">
              <Clock className="mx-auto text-muted-foreground/50 mb-3" size={40} />
              <p className="text-muted-foreground">Completed session history will appear here</p>
            </div>
          </TabsContent>
          
          {isProfessional && <TabsContent value="listings">
            <div className="card-elevated p-8 text-center">
              <Video className="mx-auto text-muted-foreground/50 mb-3" size={40} />
              <p className="text-muted-foreground mb-4">Your session listings will appear here</p>
              <Button asChild><Link to="/create-session"><Plus size={16} className="mr-1" />Create Session</Link></Button>
            </div>
          </TabsContent>}
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default MySessions;
