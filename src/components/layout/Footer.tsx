import { Link } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="section-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Clock className="text-accent-foreground" size={22} />
              </div>
              <span className="font-display font-bold text-xl">
                CronoX<span className="text-accent">V2</span>
              </span>
            </div>
            <p className="text-primary-foreground/70 text-sm leading-relaxed mb-6">
              Turn your expertise into bookable time. Connect with professionals and book sessions 
              with transparent, INR-based pricing.
            </p>
            <div className="flex items-center gap-2 text-sm text-primary-foreground/60">
              <MapPin size={14} />
              <span>India Edition</span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              <li><Link to="/marketplace" className="hover:text-accent transition-colors">Marketplace</Link></li>
              <li><Link to="/auth" className="hover:text-accent transition-colors">Become a Professional</Link></li>
              <li><Link to="/auth" className="hover:text-accent transition-colors">Find Experts</Link></li>
              <li><Link to="/" className="hover:text-accent transition-colors">How It Works</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              <li><Link to="/" className="hover:text-accent transition-colors">Help Centre</Link></li>
              <li><Link to="/" className="hover:text-accent transition-colors">Pricing Guide</Link></li>
              <li><Link to="/" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
              <li><Link to="/" className="hover:text-accent transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-accent" />
                <span>support@cronox.in</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-accent" />
                <span>+91 (800) 123-4567</span>
              </li>
            </ul>
            <div className="mt-6 p-4 rounded-lg bg-primary-foreground/5 border border-primary-foreground/10">
              <p className="text-xs text-primary-foreground/60">
                All prices displayed in Indian Rupees (₹). Secure payments via trusted Indian payment gateways.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-primary-foreground/50">
            © 2024 CronoX V2 India. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-primary-foreground/50">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              Secure & Reliable
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
