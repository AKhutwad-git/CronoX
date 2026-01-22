import { cn } from '@/lib/utils';

export type SessionStatus = 'available' | 'booked' | 'completed' | 'paid' | 'pending';

interface StatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

const statusConfig: Record<SessionStatus, { label: string; className: string }> = {
  available: {
    label: 'Available',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  booked: {
    label: 'Booked',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  paid: {
    label: 'Paid',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  pending: {
    label: 'Pending',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <span className={cn(
        'w-1.5 h-1.5 rounded-full mr-1.5',
        status === 'available' && 'bg-emerald-500',
        status === 'booked' && 'bg-blue-500',
        status === 'completed' && 'bg-green-500',
        status === 'paid' && 'bg-amber-500',
        status === 'pending' && 'bg-slate-400',
      )} />
      {config.label}
    </span>
  );
};
