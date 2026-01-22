import { cn } from '@/lib/utils';
import { IndianRupee } from 'lucide-react';

interface PriceDisplayProps {
  amount?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSymbol?: boolean;
  className?: string;
  placeholder?: string;
}

export const PriceDisplay = ({ 
  amount, 
  size = 'md', 
  showSymbol = true,
  className,
  placeholder = 'Price will be calculated based on your session parameters'
}: PriceDisplayProps) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
  };

  if (amount === undefined) {
    return (
      <span className={cn('text-muted-foreground italic text-sm', className)}>
        {placeholder}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center font-bold text-foreground', sizeClasses[size], className)}>
      {showSymbol && <IndianRupee className="mr-0.5" size={iconSizes[size]} />}
      {amount.toLocaleString('en-IN')}
    </span>
  );
};
