import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, joinSession, leaveSession } from '@/lib/api';
import { Navbar } from '@/components/layout/Navbar';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Loader2, ArrowLeft, Video, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTimeIST } from '@/lib/date-utils';

export default function SessionRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    if (!id) return;

    const loadSession = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getSession(id);
        setSession(data);
        joinSession(id).catch(console.error); // Track presence silently
      } catch (err: any) {
        setError(err.message || 'Failed to load session room. You might be too early or not have access.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [id]);

  useEffect(() => {
    if (!session?.endedAt) return;
    const endTime = new Date(session.endedAt).getTime();
    
    const interval = setInterval(() => {
      if (Date.now() > endTime + 5 * 60000) { // 5 min grace period
        alert("This session has concluded and the room is now closed.");
        navigate('/my-sessions');
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [session, navigate]);

  useEffect(() => {
    return () => {
      if (id) leaveSession(id).catch(console.error);
    };
  }, [id]);

  useEffect(() => {
    if (!session?.startedAt || !session?.endedAt) return;
    
    const startTime = new Date(session.startedAt).getTime();
    const endTime = new Date(session.endedAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      if (now < startTime) {
        const diff = Math.floor((startTime - now) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setCountdown(`Starts in: ${m}:${s}`);
      } else if (now >= startTime && now <= endTime) {
        const diff = Math.floor((endTime - now) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setCountdown(`Ends in: ${m}:${s}`);
      } else {
        setCountdown('Session Ended');
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [session]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col section-container py-4 lg:py-6 relative h-full">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => {
            if (id) leaveSession(id).catch(console.error);
            navigate('/my-sessions');
          }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Leave Session
          </Button>
          <div className="flex items-center space-x-6 text-sm font-medium text-foreground">
            {countdown && (
              <span className="text-muted-foreground font-mono bg-accent/10 px-3 py-1 rounded-md border border-accent/20">{countdown}</span>
            )}
            {session?.startedAt && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Clock size={14} />
                <span>{formatTimeIST(session.startedAt)} - {formatTimeIST(session.endedAt)} IST</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Secure Room</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-xl border border-border shadow-sm min-h-[600px]">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <p className="text-muted-foreground">Connecting securely...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full bg-card rounded-xl border border-border p-8 text-center shadow-sm">
            <ErrorNotice title="Cannot join session" message={error} />
            <Button className="mt-8 w-full" onClick={() => navigate('/my-sessions')}>
              Return to My Sessions
            </Button>
          </div>
        ) : session?.booking?.meetingLink ? (
          <div className="flex-1 w-full bg-[#1e1e1e] rounded-xl overflow-hidden shadow-2xl border border-border flex flex-col min-h-[70vh]">
            <iframe 
              src={`${session.booking.meetingLink}#config.prejoinPageEnabled=false&config.disableDeepLinking=true`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full flex-1 border-0"
              title={`CronoX Secure Session ${session.id}`}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full bg-card rounded-xl border border-border p-8 text-center shadow-sm">
            <Video className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Session Invalid</h3>
            <p className="text-muted-foreground mb-6">No active meeting link was found for this session room.</p>
            <Button className="w-full" onClick={() => navigate('/my-sessions')}>
              Return to My Sessions
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
