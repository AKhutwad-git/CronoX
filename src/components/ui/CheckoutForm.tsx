import { useState, useEffect } from 'react';
import { 
  PaymentElement, 
  useStripe, 
  useElements 
} from '@stripe/react-stripe-js';
import { Button } from './button';
import { Loader2 } from 'lucide-react';

interface CheckoutFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function CheckoutForm({ onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Return URL is required, but we'll try to prevent redirect if possible 
        // by handling the result here (Stripe handles redirect automatically for some methods)
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message || 'An unexpected error occurred.');
    } else {
      onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={isLoading || !stripe || !elements}
        className="w-full mt-6 bg-primary hover:bg-primary/90"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 animate-spin" size={16} />
            Processing...
          </>
        ) : (
          'Pay Now'
        )}
      </Button>
    </form>
  );
}
