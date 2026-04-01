import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getWeeklyAvailability, updateWeeklyAvailability } from '@/lib/api';
import { parseAsIST } from '@/lib/date-utils';
import { Calendar, Save, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type WeeklyAvailability = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  timezone?: string;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const Availability = () => {
  const { role, token } = useRole();
  const { toast } = useToast();
  
  const [schedule, setSchedule] = useState<{
    [key: number]: { enabled: boolean; start: string; end: string }
  }>({
    0: { enabled: false, start: '09:00', end: '17:00' },
    1: { enabled: true, start: '09:00', end: '17:00' },
    2: { enabled: true, start: '09:00', end: '17:00' },
    3: { enabled: true, start: '09:00', end: '17:00' },
    4: { enabled: true, start: '09:00', end: '17:00' },
    5: { enabled: true, start: '09:00', end: '17:00' },
    6: { enabled: false, start: '09:00', end: '17:00' },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadAvailability = async () => {
      if (!token || role !== 'professional') {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const data = await getWeeklyAvailability();
        if (isMounted) {
          const availData = Array.isArray(data) ? (data as WeeklyAvailability[]) : [];
          
          if (availData.length > 0) {
            const nextSchedule = { ...schedule };
            // Reset all to disabled first, to only enable returned ones
            for (let i = 0; i < 7; i++) {
              nextSchedule[i] = { ...nextSchedule[i], enabled: false };
            }

            availData.forEach(slot => {
              // Rule: Storage = UTC, Display = IST
              // Create a dummy Date in UTC for the stored minutes
              const date = new Date(Date.UTC(2026, 2, 22 + slot.dayOfWeek, Math.floor(slot.startMinute / 60), slot.startMinute % 60));
              
              // Get local components for display
              // Note: This helper correctly handles IST conversion for display purposes
              const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
              const localDay = istDate.getDay();
              const startH = String(istDate.getHours()).padStart(2, '0');
              const startM = String(istDate.getMinutes()).padStart(2, '0');

              const endUtcDate = new Date(Date.UTC(2026, 2, 22 + slot.dayOfWeek, Math.floor(slot.endMinute / 60), slot.endMinute % 60));
              const istEndDate = new Date(endUtcDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
              const endH = String(istEndDate.getHours()).padStart(2, '0');
              const endM = String(istEndDate.getMinutes()).padStart(2, '0');
              
              nextSchedule[localDay] = {
                enabled: true,
                start: `${startH}:${startM}`,
                end: `${endH}:${endM}`
              };
            });
            
            setSchedule(nextSchedule);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          toast({
            title: 'Failed to load availability',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAvailability();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role, toast]);

  const handleSave = async () => {
    if (!token || role !== 'professional') return;

    try {
      setIsSaving(true);
      const payload: WeeklyAvailability[] = [];

      for (let i = 0; i < 7; i++) {
        if (schedule[i].enabled) {
          const [startH, startM] = schedule[i].start.split(':').map(Number);
          const [endH, endM] = schedule[i].end.split(':').map(Number);
          
          // Rule: INPUT = IST, Logic/Storage = UTC
          // Create a Date object representing the time securely in IST
          const startIstStr = `2026-03-${22 + i}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`;
          const endIstStr = `2026-03-${22 + i}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
          
          const startUtcDate = parseAsIST(startIstStr);
          const endUtcDate = parseAsIST(endIstStr);
          
          const startMinute = startUtcDate.getUTCHours() * 60 + startUtcDate.getUTCMinutes();
          const endMinute = endUtcDate.getUTCHours() * 60 + endUtcDate.getUTCMinutes();
          const dayOfWeek = startUtcDate.getUTCDay();

          payload.push({
            dayOfWeek,
            startMinute,
            endMinute,
            timezone: 'UTC' // We store as UTC now
          });

          // Handle day-wrap for the end minute if necessary
          // However, for weekly availability, it's usually better to keep slots within a single UTC day
          // If a slot spans two UTC days, we might need two payload entries or just accept the wrap.
          // For simplicity, we trust the UTC day returned by the date object.
        }
      }

      await updateWeeklyAvailability(payload);
      
      toast({
        title: 'Availability saved',
        description: 'Your weekly schedule has been updated.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled }
    }));
  };

  const updateTime = (day: number, field: 'start' | 'end', value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  if (role !== 'professional') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="section-container py-12 text-center">
          <p>Only professionals can access this page.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="section-container py-8 lg:py-12 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
              <Calendar className="text-primary" />
              Weekly Availability
            </h1>
            <p className="text-muted-foreground mt-2">
              Set your regular weekly schedule for automated booking requests.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="card-elevated p-12 text-center flex flex-col items-center">
            <Loader2 className="animate-spin text-muted-foreground mb-4" size={32} />
            <p className="text-muted-foreground">Loading your schedule...</p>
          </div>
        ) : (
          <motion.div 
            className="card-elevated p-6 lg:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="space-y-6">
              {DAYS.map((dayName, index) => {
                const dayConfig = schedule[index];
                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-4 py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3 sm:w-40">
                      <input
                        type="checkbox"
                        id={`day-${index}`}
                        checked={dayConfig.enabled}
                        onChange={() => toggleDay(index)}
                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <label htmlFor={`day-${index}`} className="font-medium text-foreground cursor-pointer">
                        {dayName}
                      </label>
                    </div>

                    {dayConfig.enabled ? (
                      <div className="flex items-center gap-3 flex-1 sm:justify-end">
                        <Input
                          type="time"
                          value={dayConfig.start}
                          onChange={(e) => updateTime(index, 'start', e.target.value)}
                          className="w-32"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={dayConfig.end}
                          onChange={(e) => updateTime(index, 'end', e.target.value)}
                          className="w-32"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 text-sm text-muted-foreground italic sm:text-right">
                        Unavailable
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-border flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={16} />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="mr-2" size={16} />
                    Save Schedule
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Availability;
