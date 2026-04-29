import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation as useLocationContext } from '../context/LocationContext';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
  MapPin, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  User, 
  LogOut, 
  Calendar, 
  Ticket,
  LayoutDashboard,
  Truck,
  Plus
} from 'lucide-react';
import { useState } from 'react';

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { location } = useLocationContext();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60" data-testid="navbar">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2" data-testid="logo-link">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg font-heading">N</span>
            </div>
            <span className="font-heading font-bold text-xl gradient-brand-text hidden sm:block">NearScene</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/events" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="nav-events"
            >
              Events
            </Link>
            <Link 
              to="/restaurants" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="nav-restaurants"
            >
              Restaurants
            </Link>
            <Link 
              to="/attractions" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="nav-attractions"
            >
              Explore
            </Link>
            <Link 
              to="/food-trucks" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="nav-food-trucks"
            >
              Food Trucks
            </Link>
            <Link 
              to="/community" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="nav-community"
            >
              Community
            </Link>
            <Link 
              to="/pricing" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="nav-pricing"
            >
              Pricing
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-3">
            {/* Location Indicator */}
            <button 
              className="hidden sm:flex items-center space-x-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate('/events')}
              data-testid="location-indicator"
            >
              <MapPin className="h-4 w-4" />
              <span className="max-w-[120px] truncate">{location?.city || 'Set Location'}</span>
            </button>

            {/* Theme Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme}
              className="rounded-full"
              data-testid="theme-toggle"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            {/* Auth Section */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="user-menu-trigger">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.profile_picture} alt={user?.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} data-testid="menu-dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/my-events')} data-testid="menu-my-events">
                    <Calendar className="mr-2 h-4 w-4" />
                    My Events
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/my-tickets')} data-testid="menu-my-tickets">
                    <Ticket className="mr-2 h-4 w-4" />
                    My Tickets
                  </DropdownMenuItem>
                  {user?.account_type === 'business' && (
                    <DropdownMenuItem onClick={() => navigate('/my-food-trucks')} data-testid="menu-my-trucks">
                      <Truck className="mr-2 h-4 w-4" />
                      My Food Trucks
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/create-event')} data-testid="menu-create-event">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Event
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/login')}
                  className="hidden sm:inline-flex"
                  data-testid="login-btn"
                >
                  Sign In
                </Button>
                <Button 
                  onClick={() => navigate('/register')}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90"
                  data-testid="register-btn"
                >
                  Get Started
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4 animate-slide-up" data-testid="mobile-menu">
            <div className="flex flex-col space-y-3">
              <Link 
                to="/events" 
                className="px-2 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Events
              </Link>
              <Link 
                to="/restaurants" 
                className="px-2 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Restaurants
              </Link>
              <Link 
                to="/attractions" 
                className="px-2 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Explore (Parks & Trails)
              </Link>
              <Link 
                to="/food-trucks" 
                className="px-2 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Food Trucks
              </Link>
              <Link 
                to="/community" 
                className="px-2 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Community
              </Link>
              <Link 
                to="/pricing" 
                className="px-2 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              {isAuthenticated && (
                <Link 
                  to="/create-event" 
                  className="px-2 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Post Event
                </Link>
              )}
              <div className="flex items-center space-x-1 px-2 py-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{location?.city || 'Set Location'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-muted/30 mt-auto" data-testid="footer">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center space-x-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
                <span className="text-white font-bold font-heading">N</span>
              </div>
              <span className="font-heading font-bold text-lg">NearScene</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Discover what's happening in your community. Events, food trucks, and local experiences.
            </p>
          </div>
          
          <div>
            <h4 className="font-heading font-semibold mb-4">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/events" className="hover:text-foreground transition-colors">All Events</Link></li>
              <li><Link to="/food-trucks" className="hover:text-foreground transition-colors">Food Trucks</Link></li>
              <li><Link to="/events?category=concert" className="hover:text-foreground transition-colors">Concerts</Link></li>
              <li><Link to="/events?category=market" className="hover:text-foreground transition-colors">Markets</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-heading font-semibold mb-4">For Business</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/register?type=business" className="hover:text-foreground transition-colors">Business Account</Link></li>
              <li><Link to="/create-event" className="hover:text-foreground transition-colors">Post an Event</Link></li>
              <li><Link to="/pricing" className="hover:text-foreground transition-colors">Pricing Plans</Link></li>
              <li><Link to="/dashboard" className="hover:text-foreground transition-colors">Promote Events</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-heading font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Help Center</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Contact Us</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Terms of Service</span></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} NearScene. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground mt-2 md:mt-0">
            Made with love for local communities
          </p>
        </div>
      </div>
    </footer>
  );
};

export const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};
