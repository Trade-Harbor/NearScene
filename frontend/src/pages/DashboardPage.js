import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { EventCard } from '../components/Cards';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  TrendingUp,
  Star,
  Plus,
  ArrowRight,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Loader2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myEvents, setMyEvents] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [promotionPackages, setPromotionPackages] = useState([]);
  const [selectedEventForPromo, setSelectedEventForPromo] = useState(null);
  const [promotingEvent, setPromotingEvent] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchData();
    checkPromotionSuccess();
  }, [isAuthenticated, navigate, searchParams]);

  const checkPromotionSuccess = async () => {
    const sessionId = searchParams.get('session_id');
    const promotion = searchParams.get('promotion');
    
    if (sessionId && promotion === 'success') {
      try {
        const response = await axios.get(`${API_URL}/api/payments/checkout/status/${sessionId}`);
        if (response.data.payment_status === 'paid') {
          toast.success('Your event has been promoted!');
        }
      } catch (error) {
        console.error('Error checking promotion status:', error);
      }
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsRes, ticketsRes, packagesRes] = await Promise.all([
        axios.get(`${API_URL}/api/events/user/my-events`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/payments/my-tickets`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/payments/promotion-packages`)
      ]);

      setMyEvents(eventsRes.data);
      setMyTickets(ticketsRes.data);
      setPromotionPackages(packagesRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteEvent = async (packageId) => {
    if (!selectedEventForPromo) {
      toast.error('Please select an event to promote');
      return;
    }

    setPromotingEvent(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/payments/checkout/promotion?event_id=${selectedEventForPromo}&package_id=${packageId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: window.location.origin
          }
        }
      );

      window.location.href = response.data.checkout_url;
    } catch (error) {
      console.error('Error promoting event:', error);
      toast.error(error.response?.data?.detail || 'Failed to process promotion');
    } finally {
      setPromotingEvent(false);
    }
  };

  // Calculate stats
  const stats = {
    totalEvents: myEvents.length,
    activeEvents: myEvents.filter(e => new Date(e.start_date) > new Date()).length,
    ticketsSold: myEvents.reduce((acc, e) => acc + (e.tickets_sold || 0), 0),
    totalRevenue: myEvents.reduce((acc, e) => acc + ((e.tickets_sold || 0) * (e.discounted_price || e.ticket_price || 0)), 0)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {user?.name}</p>
          </div>
          <Button
            onClick={() => navigate('/create-event')}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90"
            data-testid="create-event-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{stats.totalEvents}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Events</p>
                  <p className="text-2xl font-bold">{stats.activeEvents}</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tickets Sold</p>
                  <p className="text-2xl font-bold">{stats.ticketsSold}</p>
                </div>
                <div className="p-3 bg-secondary/10 rounded-xl">
                  <Ticket className="h-5 w-5 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="events" className="space-y-6">
          <TabsList>
            <TabsTrigger value="events" data-testid="tab-events">My Events</TabsTrigger>
            <TabsTrigger value="tickets" data-testid="tab-tickets">My Tickets</TabsTrigger>
            <TabsTrigger value="promote" data-testid="tab-promote">Promote Events</TabsTrigger>
          </TabsList>

          {/* My Events Tab */}
          <TabsContent value="events">
            {myEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myEvents.map((event) => (
                  <EventCard
                    key={event.event_id}
                    event={event}
                    onClick={() => navigate(`/events/${event.event_id}`)}
                  />
                ))}
              </div>
            ) : (
              <Card className="dark:border-white/10">
                <CardContent className="p-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No events yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first event to start connecting with your community
                  </p>
                  <Button
                    onClick={() => navigate('/create-event')}
                    className="rounded-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Tickets Tab */}
          <TabsContent value="tickets">
            {myTickets.length > 0 ? (
              <div className="space-y-4">
                {myTickets.map((ticket) => (
                  <Card key={ticket.ticket_id} className="dark:border-white/10">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary/10 rounded-xl">
                            <Ticket className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{ticket.event_title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {ticket.quantity} ticket{ticket.quantity > 1 ? 's' : ''}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Purchased {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge
                            variant={ticket.payment_status === 'paid' ? 'default' : 'secondary'}
                            className={ticket.payment_status === 'paid' ? 'bg-accent' : ''}
                          >
                            {ticket.payment_status === 'paid' ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Confirmed</>
                            ) : (
                              <><Clock className="h-3 w-3 mr-1" /> Pending</>
                            )}
                          </Badge>
                          <span className="font-semibold">${ticket.total_price.toFixed(2)}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/events/${ticket.event_id}`)}
                            className="rounded-full"
                          >
                            View Event
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="dark:border-white/10">
                <CardContent className="p-12 text-center">
                  <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Browse events and get tickets for exciting local experiences
                  </p>
                  <Button
                    onClick={() => navigate('/events')}
                    className="rounded-full"
                  >
                    Browse Events
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Promote Events Tab */}
          <TabsContent value="promote">
            <div className="space-y-6">
              {myEvents.length > 0 ? (
                <>
                  {/* Event Selection */}
                  <Card className="dark:border-white/10">
                    <CardHeader>
                      <CardTitle>Select Event to Promote</CardTitle>
                      <CardDescription>
                        Choose an event to feature at the top of search results
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myEvents.filter(e => new Date(e.start_date) > new Date()).map((event) => (
                          <div
                            key={event.event_id}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              selectedEventForPromo === event.event_id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedEventForPromo(event.event_id)}
                            data-testid={`select-event-${event.event_id}`}
                          >
                            <div className="flex items-center gap-3">
                              {event.is_promoted && (
                                <Badge className="bg-gradient-to-r from-indigo-500 to-pink-500 text-white">
                                  <Star className="h-3 w-3 mr-1" /> Active
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold mt-2">{event.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(event.start_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Promotion Packages */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {promotionPackages.map((pkg) => (
                      <Card key={pkg.package_id} className="dark:border-white/10 relative overflow-hidden">
                        {pkg.package_id === 'promo_standard' && (
                          <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-pink-500 text-white text-xs px-3 py-1 rounded-bl-xl">
                            Popular
                          </div>
                        )}
                        <CardHeader>
                          <CardTitle>{pkg.name}</CardTitle>
                          <CardDescription>{pkg.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold mb-4">
                            ${pkg.price}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{pkg.duration_days} days
                            </span>
                          </div>
                          <Button
                            className="w-full rounded-full"
                            variant={pkg.package_id === 'promo_standard' ? 'default' : 'outline'}
                            onClick={() => handlePromoteEvent(pkg.package_id)}
                            disabled={!selectedEventForPromo || promotingEvent}
                            data-testid={`promote-btn-${pkg.package_id}`}
                          >
                            {promotingEvent ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Star className="h-4 w-4 mr-2" />
                                Get Started
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <Card className="dark:border-white/10">
                  <CardContent className="p-12 text-center">
                    <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No events to promote</h3>
                    <p className="text-muted-foreground mb-4">
                      Create an event first before promoting it
                    </p>
                    <Button
                      onClick={() => navigate('/create-event')}
                      className="rounded-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Event
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
