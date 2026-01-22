import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  ShoppingBag, 
  Calendar, 
  Wallet, 
  User,
  LogOut,
  Clock
} from 'lucide-react';

export const Navbar = () => {
  const { role, isAuthenticated, logout } = useRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = isAuthenticated
    ? [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
        { path: '/my-sessions', label: 'My Sessions', icon: Calendar },
        ...(role === 'professional' ? [{ path: '/earnings', label: 'Earnings', icon: Wallet }] : []),
        { path: '/profile', label: 'Profile', icon: User },
      ]
    : [];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="section-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-cronox-secondary flex items-center justify-center">
              <Clock className="text-primary-foreground" size={20} />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              CronoX<span className="text-accent">V2</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      isActive(item.path)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Auth Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground capitalize px-3 py-1 rounded-full bg-secondary">
                  {role}
                </span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut size={16} className="mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/signin">Sign In</Link>
                </Button>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            {isAuthenticated ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 mb-2">
                  <span className="text-sm text-muted-foreground">Logged in as</span>
                  <span className="text-sm font-medium capitalize px-3 py-1 rounded-full bg-secondary">
                    {role}
                  </span>
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                        isActive(item.path)
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-secondary'
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
                <div className="mt-4 pt-4 border-t border-border px-4">
                  <Button variant="outline" className="w-full" onClick={handleLogout}>
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 px-4">
                <Button variant="outline" asChild className="w-full">
                  <Link to="/signin" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                </Button>
                <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};
