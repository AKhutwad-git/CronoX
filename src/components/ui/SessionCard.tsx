import { cn } from '@/lib/utils';
import { Clock, User, ArrowRight } from 'lucide-react';
import { StatusBadge, SessionStatus } from './StatusBadge';
import { PriceDisplay } from './PriceDisplay';
import { Button } from './button';
import { Badge } from './badge';
import { TrustBadge } from './TrustBadge';

interface SessionCardProps {
  professionalName?: string;
  role?: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  duration?: number;
  price?: number;
  status?: SessionStatus;
  title?: string;
  tags?: string[];
  className?: string;
  showAction?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'compact';
  focusScore?: number | null;
  focusConfidence?: number | null;
  focusValidUntil?: string | null;
  performanceTier?: string | null;
  showPerformanceVerified?: boolean;
}

export const SessionCard = ({
  professionalName,
  role,
  verificationStatus,
  duration,
  price,
  status = 'available',
  title,
  tags,
  className,
  showAction = true,
  actionLabel = 'View Details',
  onAction,
  variant = 'default',
  focusScore,
  focusConfidence,
  focusValidUntil,
  performanceTier,
  showPerformanceVerified,
}: SessionCardProps) => {
  const isPlaceholder = !professionalName;
  const hasFocusData = typeof focusScore === 'number' && typeof focusConfidence === 'number' && Boolean(focusValidUntil);

  return (
    <div
      className={cn(
        'card-elevated p-5 transition-all duration-300 hover:border-accent/40 group cursor-pointer',
        variant === 'compact' && 'p-4',
        className
      )}
      onClick={onAction}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-cronox-secondary flex items-center justify-center text-primary-foreground font-semibold',
            variant === 'compact' && 'w-10 h-10'
          )}>
            {isPlaceholder ? <User size={20} /> : professionalName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {isPlaceholder ? 'Professional name will appear here' : professionalName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isPlaceholder ? 'Professional role/expertise' : role}
            </p>
            {verificationStatus === 'verified' && (
              <div className="mt-2">
                <TrustBadge type="verified" size="sm" />
              </div>
            )}
            {verificationStatus && verificationStatus !== 'verified' && !isPlaceholder && (
              <p className="text-xs text-muted-foreground mt-1 capitalize">
                {verificationStatus.replace('_', ' ')}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock size={14} />
          <span>{isPlaceholder ? 'Duration in minutes' : `${duration} min`}</span>
        </div>
      </div>

      {(title || (tags && tags.length > 0)) && (
        <div className="mb-4">
          {title && <p className="text-sm font-semibold text-foreground mb-2">{title}</p>}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {hasFocusData && (
        <div className="mb-4 rounded-lg border border-border px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Focus Score</p>
            {performanceTier ? (
              <Badge variant="outline" className="text-[10px] h-5">
                {performanceTier}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex items-end justify-between">
            <p className="text-lg font-bold text-foreground">{focusScore}</p>
            <p className="text-xs text-muted-foreground">Confidence {focusConfidence}%</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Valid until {new Date(focusValidUntil as string).toLocaleTimeString()}</p>
          {showPerformanceVerified ? (
            <Badge variant="secondary" className="mt-2 text-[10px] h-5">AI Performance Verified</Badge>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Session Price</p>
          <PriceDisplay 
            amount={isPlaceholder ? undefined : price} 
            size="lg"
            placeholder="Price in INR"
          />
        </div>
        {showAction && (
          <Button 
            variant="ghost" 
            className="group-hover:bg-accent group-hover:text-accent-foreground transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onAction?.();
            }}
          >
            {actionLabel}
            <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}
      </div>

      {isPlaceholder && (
        <p className="text-xs text-muted-foreground mt-3 italic border-t border-dashed border-border pt-3">
          This card will display real session data including the professional's name, expertise, duration, 
          and price in INR once sessions are available.
        </p>
      )}
    </div>
  );
};
