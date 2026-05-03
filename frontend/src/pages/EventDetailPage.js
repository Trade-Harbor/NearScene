import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLocation as useLocationContext } from '../context/LocationContext';
import { format } from 'date-fns';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Ticket,
  Star,
  Share2,
  Heart,
  MessageCircle,
  ArrowLeft,
  ExternalLink,
  Sparkles
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, token } = useAuth();
  const { location } = useLocationContext();
  
  const [event, setEvent] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [promotionPackages, setPromotionPackages] = useState([]);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    fetchEvent();
    fetchComments();
  }, [eventId]);

  // Fetch promotion packages when current user is the organizer of an unpromoted event
  useEffect(() => {
    if (event && user && event.organizer_id === user.user_id && !event.is_promoted) {
      axios
        .get(`${API_URL}/api/payments/promotion-packages`)
        .then((res) => setPromotionPackages(res.data || []))
        .catch(() => setPromotionPackages([]));
    }
  }, [event, user]);

  const handlePromoteEvent = async (packageId) => {
    if (!isAuthenticated) {
      toast.error('Please login to promote this event');
      navigate('/login');
      return;
    }
    setPromoting(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/payments/checkout/promotion`,
        null,
        {
          params: { event_id: eventId, package_id: packageId },
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: window.location.origin,
          },
        }
      );
      window.location.href = response.data.checkout_url;
    } catch (error) {
      console.error('Promotion error:', error);
      toast.error(error.response?.data?.detail || 'Failed to start promotion checkout');
    } finally {
      setPromoting(false);
    }
  };

  const fetchEvent = async () => {
    try {
      const params = {};
      if (location) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
      }
      const response = await axios.get(`${API_URL}/api/events/${eventId}`, { params });
      setEvent(response.data);
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Event not found');
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/comments/event/${eventId}`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to comment');
      navigate('/login');
      return;
    }

    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/api/comments?target_type=event&target_id=${eventId}`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
      fetchComments();
      toast.success('Comment posted!');
    } catch (error) {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePurchaseTicket = async () => {
    // Externally-ingested events (Ticketmaster, SeatGeek) link out to the
    // original ticketing site instead of using NearScene's Stripe checkout —
    // we don't actually sell those tickets ourselves.
    if (event.external_url) {
      window.open(event.external_url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please login to purchase tickets');
      navigate('/login');
      return;
    }

    setPurchasing(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/payments/checkout/ticket`,
        {
          event_id: eventId,
          quantity: ticketQuantity,
          payment_method: 'stripe'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: window.location.origin
          }
        }
      );

      // Redirect to Stripe checkout
      window.location.href = response.data.checkout_url;
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(error.response?.data?.detail || 'Failed to process purchase');
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: event.title,
        text: event.description,
        url: window.location.href
      });
    } catch {
      // Fallback to copy link
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-96 bg-muted rounded-2xl" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const startDate = new Date(event.start_date);
  const endDate = event.end_date ? new Date(event.end_date) : null;
  const ticketsRemaining = event.total_tickets ? event.total_tickets - event.tickets_sold : null;
  const hasDiscount = event.discount_percentage > 0;
  const finalPrice = event.discounted_price || event.ticket_price;

  return (
    <div className="min-h-screen bg-background" data-testid="event-detail-page">
      {/* Hero Image */}
      <div className="relative h-[400px] md:h-[500px] overflow-hidden">
        <img
          src={event.image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200'}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full"
          onClick={() => navigate(-1)}
          data-testid="back-btn"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </Button>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full"
            onClick={handleShare}
            data-testid="share-btn"
          >
            <Share2 className="h-5 w-5 text-white" />
          </Button>
        </div>

        {/* Badges */}
        <div className="absolute bottom-6 left-6 flex flex-wrap gap-2">
          {event.is_promoted && (
            <Badge className="bg-gradient-to-r from-indigo-500 to-pink-500 text-white">
              <Star className="h-3 w-3 mr-1" /> Featured
            </Badge>
          )}
          {!event.is_paid && (
            <Badge className="bg-accent text-white">Free Event</Badge>
          )}
          <Badge variant="secondary" className="backdrop-blur-sm">
            {event.category.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-6xl -mt-20 relative z-10 pb-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Description */}
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-lg dark:border dark:border-white/10">
              <h1 className="font-heading text-3xl md:text-4xl font-bold mb-4">
                {event.title}
              </h1>

              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {event.organizer_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{event.organizer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.organizer_type === 'business' ? 'Business' : 'Community Organizer'}
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>

              {/* Tags */}
              {event.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {event.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Event Details */}
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-lg dark:border dark:border-white/10">
              <h2 className="font-heading text-xl font-semibold mb-6">Event Details</h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{format(startDate, 'EEEE, MMMM d, yyyy')}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(startDate, 'h:mm a')}
                      {endDate && ` - ${format(endDate, 'h:mm a')}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-secondary/10 rounded-xl">
                    <MapPin className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-medium">{event.location_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.address}, {event.city}, {event.state} {event.zip_code}
                    </p>
                    {event.distance !== undefined && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {event.distance} miles away
                      </p>
                    )}
                    <Button
                      variant="link"
                      className="p-0 h-auto text-sm"
                      onClick={() => window.open(
                        `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`,
                        '_blank'
                      )}
                    >
                      Get Directions <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>

                {ticketsRemaining !== null && (
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-accent/10 rounded-xl">
                      <Users className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">{ticketsRemaining} tickets remaining</p>
                      <p className="text-sm text-muted-foreground">
                        {event.tickets_sold} tickets sold
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-lg dark:border dark:border-white/10">
              <h2 className="font-heading text-xl font-semibold mb-6 flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Comments ({comments.length})
              </h2>

              {/* Comment Form */}
              <form onSubmit={handleComment} className="mb-6">
                <Textarea
                  placeholder={isAuthenticated ? "Share your thoughts..." : "Login to comment"}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={!isAuthenticated || submitting}
                  className="mb-3"
                  data-testid="comment-input"
                />
                <Button
                  type="submit"
                  disabled={!isAuthenticated || !newComment.trim() || submitting}
                  className="rounded-full"
                  data-testid="submit-comment-btn"
                >
                  {submitting ? 'Posting...' : 'Post Comment'}
                </Button>
              </form>

              {/* Comments List */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No comments yet. Be the first to share your thoughts!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.comment_id} className="flex gap-3 p-4 bg-muted/50 rounded-xl">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comment.user_picture} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {comment.user_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{comment.user_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Ticket Purchase */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card rounded-2xl p-6 shadow-lg dark:border dark:border-white/10">
              {event.external_url ? (
                // External event (Ticketmaster / SeatGeek) — link out for tickets.
                // We don't sell these directly, so skip the qty selector + subtotal.
                <>
                  <div className="text-center mb-6">
                    {event.ticket_price && (
                      <>
                        <span className="text-sm text-muted-foreground">From</span>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-3xl font-bold">${event.ticket_price}</span>
                        </div>
                      </>
                    )}
                    {!event.ticket_price && (
                      <p className="text-lg font-semibold">Tickets available</p>
                    )}
                    <Badge variant="secondary" className="mt-2">
                      via {event.source ? event.source.charAt(0).toUpperCase() + event.source.slice(1) : 'partner site'}
                    </Badge>
                  </div>
                  <Button
                    className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90"
                    size="lg"
                    onClick={handlePurchaseTicket}
                    data-testid="buy-tickets-btn"
                  >
                    <Ticket className="h-4 w-4 mr-2" />
                    Get Tickets
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    You'll be redirected to complete your purchase.
                  </p>
                </>
              ) : event.is_paid ? (
                <>
                  <div className="text-center mb-6">
                    {hasDiscount && (
                      <p className="text-sm text-muted-foreground line-through">
                        ${event.ticket_price}
                      </p>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-3xl font-bold">${finalPrice}</span>
                      <span className="text-muted-foreground">/ ticket</span>
                    </div>
                    {hasDiscount && (
                      <Badge className="mt-2 bg-destructive/10 text-destructive">
                        Save {event.discount_percentage}%
                      </Badge>
                    )}
                  </div>

                  {ticketsRemaining !== null && ticketsRemaining > 0 ? (
                    <>
                      <div className="mb-4">
                        <label className="text-sm font-medium mb-2 block">Quantity</label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                            disabled={ticketQuantity <= 1}
                            data-testid="decrease-qty-btn"
                          >
                            -
                          </Button>
                          <span className="w-12 text-center font-medium">{ticketQuantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setTicketQuantity(Math.min(ticketsRemaining, ticketQuantity + 1))}
                            disabled={ticketQuantity >= ticketsRemaining}
                            data-testid="increase-qty-btn"
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      <div className="border-t border-border pt-4 mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span>Subtotal</span>
                          <span>${(finalPrice * ticketQuantity).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Service fee</span>
                          <span>${(finalPrice * ticketQuantity * 0.05).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-border">
                          <span>Total</span>
                          <span>${(finalPrice * ticketQuantity * 1.05).toFixed(2)}</span>
                        </div>
                      </div>

                      <Button
                        className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90"
                        size="lg"
                        onClick={handlePurchaseTicket}
                        disabled={purchasing}
                        data-testid="buy-tickets-btn"
                      >
                        <Ticket className="h-4 w-4 mr-2" />
                        {event.external_url
                          ? 'Get Tickets'
                          : (purchasing ? 'Processing...' : `Buy ${ticketQuantity} Ticket${ticketQuantity > 1 ? 's' : ''}`)}
                        {event.external_url && <ExternalLink className="h-3 w-3 ml-2" />}
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <Badge variant="destructive" className="mb-2">Sold Out</Badge>
                      <p className="text-sm text-muted-foreground">
                        This event is no longer available for purchase.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <Badge className="bg-accent text-white text-lg px-4 py-1 mb-4">
                    Free Event
                  </Badge>
                  <p className="text-muted-foreground mb-4">
                    No tickets required. Just show up and enjoy!
                  </p>
                  <Button
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={() => window.open(
                      `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${format(startDate, "yyyyMMdd'T'HHmmss")}/${endDate ? format(endDate, "yyyyMMdd'T'HHmmss") : format(startDate, "yyyyMMdd'T'HHmmss")}&location=${encodeURIComponent(event.address)}`,
                      '_blank'
                    )}
                    data-testid="add-to-calendar-btn"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Add to Calendar
                  </Button>
                </div>
              )}
            </div>

            {/* Promote This Event — visible only to the organizer */}
            {user && event.organizer_id === user.user_id && !event.is_promoted && promotionPackages.length > 0 && (
              <div className="mt-4 bg-card rounded-2xl p-6 shadow-lg dark:border dark:border-white/10" data-testid="promote-event-card">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <h3 className="font-heading text-lg font-semibold">Promote This Event</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Get featured placement and reach more local attendees.
                </p>
                <div className="space-y-2">
                  {promotionPackages.map((pkg) => (
                    <Button
                      key={pkg.package_id}
                      variant="outline"
                      className="w-full justify-between rounded-full"
                      onClick={() => handlePromoteEvent(pkg.package_id)}
                      disabled={promoting}
                      data-testid={`promote-pkg-${pkg.package_id}`}
                    >
                      <span className="flex flex-col items-start">
                        <span className="font-medium">{pkg.name}</span>
                        <span className="text-xs text-muted-foreground">{pkg.duration_days} days</span>
                      </span>
                      <span className="font-bold">${pkg.price}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Already promoted indicator */}
            {user && event.organizer_id === user.user_id && event.is_promoted && (
              <div className="mt-4 bg-card rounded-2xl p-4 shadow-lg dark:border dark:border-white/10 flex items-center gap-2" data-testid="event-promoted-badge">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm">This event is currently promoted.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
