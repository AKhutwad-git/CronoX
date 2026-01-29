import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

type ErrorNoticeProps = {
  title?: string;
  message?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export const ErrorNotice = ({ title = 'Something went wrong', message, actionLabel, onAction, className }: ErrorNoticeProps) => {
  if (!message) {
    return null;
  }

  return (
    <Alert variant="destructive" className={cn('flex items-start gap-3', className)}>
      <AlertCircle className="h-4 w-4" />
      <div className="flex-1">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </div>
      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Alert>
  );
};
