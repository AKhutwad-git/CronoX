import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navbar } from '@/components/layout/Navbar';
import { useRole } from '@/contexts/RoleContext';
import { Clock, Shield, IndianRupee, CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, type ApiRequestError } from '@/lib/api';

const SignUp = () => {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role') as 'buyer' | 'professional' | null;
  const navigate = useNavigate();
  const { setRole, setToken, setAuthenticated } = useRole();
  const { toast } = useToast();
  
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'professional'>(roleParam || 'buyer');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
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
    return 'Unable to create account. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isSubmitting) {
      return;
    }

    const fullName = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!fullName || !email || !password) {
      setFormError('Name, email, and password are required.');
      return;
    }

    try {
      setIsSubmitting(true);

      const data = await apiRequest<{
        token?: string;
        role?: 'buyer' | 'professional';
        message?: string;
      }>(`/auth/signup`, {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          role: selectedRole,
        }),
      });

      if (!data?.token) {
        throw new Error('Account created but no token was returned.');
      }

      setRole(data.role || selectedRole);
      setToken(data.token);
      setAuthenticated(true);

      toast({
        title: 'Account created successfully!',
        description: `Welcome to CronoX as a ${data.role || selectedRole}.`,
      });
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('[auth] Sign up failed', error);
      const message = getErrorMessage(error);
      setFormError(message);
      toast({
        title: 'Sign up failed',
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
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-6xl mx-auto">
          {/* Form Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="max-w-md">
              <h1 className="font-display text-3xl font-bold text-foreground mb-2">
                Create your account
              </h1>
              <p className="text-muted-foreground mb-8">
                Join CronoX and start connecting with experts or offering your expertise.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Role Selection */}
                <div>
                  <Label className="text-sm font-medium text-foreground mb-3 block">
                    I want to use CronoX as a
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('buyer')}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedRole === 'buyer'
                          ? 'border-status-booked bg-status-booked/5'
                          : 'border-border hover:border-status-booked/50'
                      }`}
                      disabled={isSubmitting}
                    >
                      <span className={`text-sm font-medium ${selectedRole === 'buyer' ? 'text-status-booked' : 'text-foreground'}`}>
                        Buyer
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">Book sessions</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('professional')}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedRole === 'professional'
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-accent/50'
                      }`}
                      disabled={isSubmitting}
                    >
                      <span className={`text-sm font-medium ${selectedRole === 'professional' ? 'text-accent' : 'text-foreground'}`}>
                        Professional
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">Offer sessions</p>
                    </button>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="mt-1.5 h-12"
                    required
                    disabled={isSubmitting}
                  />
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
                    disabled={isSubmitting}
                  />
                </div>

                {/* Password */}
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-12 pr-12"
                      required
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={isSubmitting}
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
                      Creating Account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>

              <p className="text-sm text-muted-foreground mt-6 text-center">
                Already have an account?{' '}
                <Link to="/signin" className="text-accent font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>

          {/* Trust Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="hidden lg:block"
          >
            <div className="bg-gradient-to-br from-primary to-cronox-secondary rounded-3xl p-10 text-primary-foreground">
              <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mb-8">
                <Clock className="text-accent" size={28} />
              </div>
              
              <h2 className="font-display text-2xl font-bold mb-4">
                You're in safe hands
              </h2>
              
              <p className="text-primary-foreground/80 mb-8 leading-relaxed">
                CronoX is built with trust and transparency at its core. 
                Here's what you can expect when you join.
              </p>

              <ul className="space-y-4">
                {[
                  { icon: Shield, text: 'Your data is encrypted and secure' },
                  { icon: IndianRupee, text: 'All pricing shown transparently in INR' },
                  { icon: CheckCircle, text: 'No obligation until you book or list' },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <item.icon className="text-accent" size={16} />
                    </div>
                    <span className="text-sm text-primary-foreground/90">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
