import { cn } from '@/lib/utils';
import { Check, Clock, CreditCard, Users } from 'lucide-react';

type LifecycleStage = 'created' | 'purchased' | 'completed' | 'paid';

interface LifecycleIndicatorProps {
  currentStage: LifecycleStage;
  className?: string;
}

const stages: { key: LifecycleStage; label: string; icon: React.ElementType }[] = [
  { key: 'created', label: 'Created', icon: Clock },
  { key: 'purchased', label: 'Purchased', icon: CreditCard },
  { key: 'completed', label: 'Completed', icon: Users },
  { key: 'paid', label: 'Paid', icon: Check },
];

export const LifecycleIndicator = ({ currentStage, className }: LifecycleIndicatorProps) => {
  const currentIndex = stages.findIndex(s => s.key === currentStage);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  isCompleted
                    ? 'bg-accent border-accent text-accent-foreground'
                    : 'bg-muted border-border text-muted-foreground',
                  isCurrent && 'ring-4 ring-accent/20'
                )}
              >
                <Icon size={18} />
              </div>
              <span
                className={cn(
                  'text-xs mt-1.5 font-medium',
                  isCompleted ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {stage.label}
              </span>
            </div>
            {index < stages.length - 1 && (
              <div
                className={cn(
                  'w-12 h-0.5 mx-2 -mt-6',
                  index < currentIndex ? 'bg-accent' : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
