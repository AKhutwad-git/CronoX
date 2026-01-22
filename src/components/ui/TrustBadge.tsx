import { cn } from '@/lib/utils';
import { Shield, IndianRupee, FileText, Lock, CheckCircle } from 'lucide-react';

type TrustType = 'secure' | 'inr' | 'invoice' | 'verified' | 'transparent';

interface TrustBadgeProps {
  type: TrustType;
  className?: string;
  size?: 'sm' | 'md';
}

const trustConfig: Record<TrustType, { label: string; icon: React.ElementType }> = {
  secure: { label: 'Secure Payments', icon: Lock },
  inr: { label: 'INR Pricing', icon: IndianRupee },
  invoice: { label: 'Invoice Available', icon: FileText },
  verified: { label: 'Verified', icon: CheckCircle },
  transparent: { label: 'Transparent Pricing', icon: Shield },
};

export const TrustBadge = ({ type, className, size = 'md' }: TrustBadgeProps) => {
  const config = trustConfig[type];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium bg-secondary text-secondary-foreground border border-border',
        size === 'sm' && 'text-xs px-2 py-1',
        size === 'md' && 'text-sm',
        className
      )}
    >
      <Icon size={size === 'sm' ? 12 : 14} className="text-accent" />
      {config.label}
    </span>
  );
};
