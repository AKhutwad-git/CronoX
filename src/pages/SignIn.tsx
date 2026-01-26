import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navbar } from '@/components/layout/Navbar';
import { useRole } from '@/contexts/RoleContext';
import { Eye, EyeOff, Clock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, type ApiRequestError } from '@/lib/api';

const SignIn = () => {
  const navigate = useNavigate();
  const { setRole, setToken, setAuthenticated } = useRole();
  const { toast } = useToast();
  
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'professional'>('buyer');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isApiError = (error: unknown): error is ApiRequestError =>
    typeof error === 'object' && error !== null && 'status' in error;

  const getErrorMessage = (error: unknown) => {
    if (isApiError(error)) {
      const data = error.data as { message?: unknown } | undefined;
      if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
        return data.message;
      }
      if (error.status === 0) {
        return 'Unable to reach the server. Check your connection and try again.';
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unable to sign in. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isSubmitting) {
      return;
    }

    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!email || !password) {
      setFormError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiRequest<{
        token?: string;
        role?: 'buyer' | 'professional';
        message?: string;
      }>(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!data?.token) {
        throw new Error('Login succeeded but no token was returned.');
      }

      setRole(data.role ?? selectedRole);
      setToken(data.token);
      setAuthenticated(true);

      toast({
        title: 'Welcome back!',
        description: `Signed in as a ${data.role || selectedRole}.`,
      });

      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('[auth] Sign in failed', error);
      const message = getErrorMessage(error);
      setFormError(message);
      toast({
        title: 'Sign in failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="section-container py-12 lg:py-20">
        <motion.div 
          className="max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-cronox-secondary flex items-center justify-center">
                <Clock className="text-primary-foreground" size={24} />
              </div>
              <span className="font-display font-bold text-2xl text-foreground">
                CronoX<span className="text-accent">V2</span>
              </span>
            </div>
          </div>

          <div className="card-elevated p-8">
            <div className="text-center mb-8">
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                Welcome back
              </h1>
              <p className="text-muted-foreground">
                Sign in to continue to your dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Role Selection */}
              <div>
                <Label className="text-sm font-medium text-foreground mb-3 block">
                  Sign in as
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('buyer')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedRole === 'buyer'
                        ? 'border-status-booked bg-status-booked/5'
                        : 'border-border hover:border-status-booked/50'
                    }`}
                    disabled={isSubmitting}
                  >
                    <span className={`text-sm font-medium ${selectedRole === 'buyer' ? 'text-status-booked' : 'text-foreground'}`}>
                      Buyer
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('professional')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedRole === 'professional'
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-accent/50'
                    }`}
                    disabled={isSubmitting}
                  >
                    <span className={`text-sm font-medium ${selectedRole === 'professional' ? 'text-accent' : 'text-foreground'}`}>
                      Professional
                    </span>
                  </button>
                </div>
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1.5 h-12"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/" className="text-xs text-accent hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-12 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}

              <Button 
                type="submit" 
                className={`w-full h-12 text-base ${
                  selectedRole === 'professional' 
                    ? 'bg-accent hover:bg-accent/90 text-accent-foreground' 
                    : 'bg-status-booked hover:bg-status-booked/90 text-white'
                }`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing In...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground mt-6 text-center">
              Don't have an account?{' '}
              <Link to="/auth" className="text-accent font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SignIn;
