import { cn } from '@/lib/utils';

export type SessionStatus =
  | 'available'
  | 'booked'
  | 'completed'
  | 'paid'
  | 'pending'
  | 'active'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded';

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
  active: {
    label: 'Started',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
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
  cancelled: {
    label: 'Cancelled',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  refund_requested: {
    label: 'Refund Requested',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
        status === 'active' && 'bg-indigo-500',
        status === 'completed' && 'bg-green-500',
        status === 'paid' && 'bg-amber-500',
        status === 'pending' && 'bg-slate-400',
        status === 'cancelled' && 'bg-rose-500',
        status === 'refund_requested' && 'bg-amber-500',
        status === 'refunded' && 'bg-emerald-500',
      )} />
      {config.label}
    </span>
  );
};
