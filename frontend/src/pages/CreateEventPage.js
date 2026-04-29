import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Image,
  Tag,
  DollarSign,
  Ticket,
  Loader2,
  ArrowLeft,
  Plus
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { value: 'concert', label: 'Concert' },
  { value: 'parade', label: 'Parade' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'market', label: 'Market' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'garage_sale', label: 'Garage Sale' },
  { value: 'food_festival', label: 'Food Festival' },
  { value: 'community', label: 'Community Event' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
];

// US States list for selector
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { isAuthenticated, token, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    start_date: null,
    start_time: '12:00',
    end_date: null,
    end_time: '',
    location_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    latitude: 40.7128,
    longitude: -74.006,
    image_url: '',
    is_paid: false,
    ticket_price: '',
    discount_percentage: '',
    total_tickets: '',
    tags: []
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast.error('Please login to create an event');
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim().toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim().toLowerCase()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  // Geocode address to get lat/lng
  const geocodeAddress = async () => {
    if (!formData.address || !formData.city || !formData.state) return;
    
    try {
      const query = `${formData.address}, ${formData.city}, ${formData.state} ${formData.zip_code}`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        }));
        toast.success('Location coordinates found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.start_date) {
      toast.error('Please select a start date');
      return;
    }
    
    if (!formData.category) {
      toast.error('Please select a category');
      return;
    }

    setLoading(true);
    
    try {
      // Combine date and time
      const startDateTime = new Date(formData.start_date);
      const [startHours, startMinutes] = formData.start_time.split(':');
      startDateTime.setHours(parseInt(startHours), parseInt(startMinutes));

      let endDateTime = null;
      if (formData.end_date && formData.end_time) {
        endDateTime = new Date(formData.end_date);
        const [endHours, endMinutes] = formData.end_time.split(':');
        endDateTime.setHours(parseInt(endHours), parseInt(endMinutes));
      }

      const eventData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime ? endDateTime.toISOString() : null,
        location_name: formData.location_name,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        latitude: formData.latitude,
        longitude: formData.longitude,
        image_url: formData.image_url || null,
        is_paid: formData.is_paid,
        ticket_price: formData.is_paid ? parseFloat(formData.ticket_price) : null,
        discount_percentage: formData.is_paid && formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
        total_tickets: formData.is_paid && formData.total_tickets ? parseInt(formData.total_tickets) : null,
        tags: formData.tags
      };

      const response = await axios.post(
        `${API_URL}/api/events`,
        eventData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Event created successfully!');
      navigate(`/events/${response.data.event_id}`);
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error(error.response?.data?.detail || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="create-event-page">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-3xl py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold">Create New Event</h1>
            <p className="text-muted-foreground">Share your event with the local community</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-card rounded-2xl p-6 shadow-sm dark:border dark:border-white/10">
            <h2 className="font-heading text-lg font-semibold mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="Give your event a catchy name"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  required
                  data-testid="event-title-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleChange('category', value)}
                >
                  <SelectTrigger data-testid="category-select">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Tell people what your event is about..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={4}
                  required
                  data-testid="event-description-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL (optional)</Label>
                <div className="relative">
                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="image_url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.image_url}
                    onChange={(e) => handleChange('image_url', e.target.value)}
                    className="pl-10"
                    data-testid="event-image-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="bg-card rounded-2xl p-6 shadow-sm dark:border dark:border-white/10">
            <h2 className="font-heading text-lg font-semibold mb-4">Date & Time</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="start-date-trigger"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.start_date ? format(formData.start_date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.start_date}
                      onSelect={(date) => handleChange('start_date', date)}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleChange('start_time', e.target.value)}
                    className="pl-10"
                    required
                    data-testid="start-time-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="end-date-trigger"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.end_date ? format(formData.end_date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.end_date}
                      onSelect={(date) => handleChange('end_date', date)}
                      disabled={(date) => date < (formData.start_date || new Date())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleChange('end_time', e.target.value)}
                    className="pl-10"
                    data-testid="end-time-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-card rounded-2xl p-6 shadow-sm dark:border dark:border-white/10">
            <h2 className="font-heading text-lg font-semibold mb-4">Location</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location_name">Venue Name *</Label>
                <Input
                  id="location_name"
                  placeholder="e.g., Central Park, The Blue Note"
                  value={formData.location_name}
                  onChange={(e) => handleChange('location_name', e.target.value)}
                  required
                  data-testid="venue-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Street Address *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    placeholder="123 Main Street"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="pl-10"
                    required
                    data-testid="address-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="New York"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    required
                    data-testid="city-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => handleChange('state', value)}
                  >
                    <SelectTrigger data-testid="state-select">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip_code">Zip Code *</Label>
                  <Input
                    id="zip_code"
                    placeholder="10001"
                    value={formData.zip_code}
                    onChange={(e) => handleChange('zip_code', e.target.value)}
                    onBlur={geocodeAddress}
                    required
                    data-testid="zipcode-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tickets & Pricing */}
          <div className="bg-card rounded-2xl p-6 shadow-sm dark:border dark:border-white/10">
            <h2 className="font-heading text-lg font-semibold mb-4">Tickets & Pricing</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_paid">Paid Event</Label>
                  <p className="text-sm text-muted-foreground">Enable ticket sales for this event</p>
                </div>
                <Switch
                  id="is_paid"
                  checked={formData.is_paid}
                  onCheckedChange={(checked) => handleChange('is_paid', checked)}
                  data-testid="is-paid-switch"
                />
              </div>

              {formData.is_paid && (
                <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <Label htmlFor="ticket_price">Ticket Price ($) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="ticket_price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="25.00"
                        value={formData.ticket_price}
                        onChange={(e) => handleChange('ticket_price', e.target.value)}
                        className="pl-10"
                        required={formData.is_paid}
                        data-testid="ticket-price-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_percentage">Discount %</Label>
                    <Input
                      id="discount_percentage"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="15"
                      value={formData.discount_percentage}
                      onChange={(e) => handleChange('discount_percentage', e.target.value)}
                      data-testid="discount-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total_tickets">Total Tickets</Label>
                    <div className="relative">
                      <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="total_tickets"
                        type="number"
                        min="1"
                        placeholder="100"
                        value={formData.total_tickets}
                        onChange={(e) => handleChange('total_tickets', e.target.value)}
                        className="pl-10"
                        data-testid="total-tickets-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-card rounded-2xl p-6 shadow-sm dark:border dark:border-white/10">
            <h2 className="font-heading text-lg font-semibold mb-4">Tags</h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Add tags (e.g., music, outdoor, family)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="pl-10"
                    data-testid="tag-input"
                  />
                </div>
                <Button type="button" onClick={addTag} variant="outline" data-testid="add-tag-btn">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90"
              disabled={loading}
              data-testid="submit-event-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Event'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
