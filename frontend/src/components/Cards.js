import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Calendar, MapPin, Clock, Users, Star, Ticket } from 'lucide-react';
import { format } from 'date-fns';

export const EventCard = ({ event, onClick }) => {
  const startDate = new Date(event.start_date);
  const isPromoted = event.is_promoted;
  const isFree = !event.is_paid;
  const hasDiscount = event.discount_percentage > 0;
  
  // Category icons
  const categoryIcons = {
    concert: '🎵',
    parade: '🎉',
    marathon: '🏃',
    market: '🛍️',
    happy_hour: '🍸',
    garage_sale: '🏷️',
    food_festival: '🍔',
    community: '👥',
    sports: '🏆',
    other: '📅'
  };

  return (
    <Card 
      className="event-card group cursor-pointer overflow-hidden border-0 shadow-card hover:shadow-card-hover dark:border dark:border-white/10"
      onClick={onClick}
      data-testid={`event-card-${event.event_id}`}
    >
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden">
        <img 
          src={event.image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800'} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {isPromoted && (
            <span className="badge-promoted flex items-center gap-1">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
          {isFree && (
            <span className="badge-free">Free</span>
          )}
          {hasDiscount && !isFree && (
            <Badge variant="destructive" className="text-xs">
              {event.discount_percentage}% OFF
            </Badge>
          )}
        </div>
        
        {/* Category Badge */}
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="backdrop-blur-sm bg-white/80 dark:bg-black/60 text-xs">
            {categoryIcons[event.category] || '📅'} {event.category.replace('_', ' ')}
          </Badge>
        </div>
        
        {/* Date Badge */}
        <div className="absolute bottom-3 left-3">
          <div className="bg-white dark:bg-card rounded-lg px-3 py-2 text-center shadow-lg">
            <div className="text-xs font-medium text-muted-foreground uppercase">
              {format(startDate, 'MMM')}
            </div>
            <div className="text-xl font-bold text-foreground">
              {format(startDate, 'd')}
            </div>
          </div>
        </div>
        
        {/* Distance Badge */}
        {event.distance !== undefined && (
          <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium">
            {event.distance} mi
          </div>
        )}
      </div>
      
      {/* Content */}
      <CardContent className="p-4">
        <h3 className="font-heading font-semibold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">
          {event.title}
        </h3>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {event.description}
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">{event.location_name}, {event.city}</span>
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{format(startDate, 'EEE, MMM d • h:mm a')}</span>
          </div>
        </div>
        
        {/* Price & Tickets */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          {event.is_paid ? (
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              {hasDiscount ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm line-through text-muted-foreground">${event.ticket_price}</span>
                  <span className="font-semibold text-primary">${event.discounted_price}</span>
                </div>
              ) : event.ticket_price ? (
                <span className="font-semibold">${event.ticket_price}</span>
              ) : (
                // External event with unknown price (Ticketmaster/SeatGeek often
                // don't expose pricing in the public API)
                <span className="font-semibold text-sm">Tickets available</span>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium text-accent">Free Entry</span>
          )}
          
          {event.total_tickets && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="h-4 w-4 mr-1" />
              {event.total_tickets - event.tickets_sold} left
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const FoodTruckCard = ({ truck, onClick }) => {
  return (
    <Card 
      className="event-card group cursor-pointer overflow-hidden border-0 shadow-card hover:shadow-card-hover dark:border dark:border-white/10"
      onClick={onClick}
      data-testid={`truck-card-${truck.truck_id}`}
    >
      <div className="relative h-40 overflow-hidden">
        <img 
          src={truck.image_url || 'https://images.unsplash.com/photo-1620589125156-fd5028c5e05b?w=800'} 
          alt={truck.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <Badge 
            variant={truck.is_active_today ? "default" : "secondary"}
            className={truck.is_active_today ? "bg-accent" : ""}
          >
            {truck.is_active_today ? 'Open Today' : 'Closed'}
          </Badge>
        </div>
        
        {/* Cuisine Badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="backdrop-blur-sm bg-white/80 dark:bg-black/60 text-xs">
            {truck.cuisine_type}
          </Badge>
        </div>
        
        {/* Distance */}
        {truck.distance !== undefined && (
          <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium">
            {truck.distance} mi
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-heading font-semibold text-lg group-hover:text-primary transition-colors">
            {truck.name}
          </h3>
          {truck.rating > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{truck.rating}</span>
              <span className="text-muted-foreground">({truck.review_count})</span>
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {truck.description}
        </p>
        
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">{truck.address}</span>
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>{truck.operating_hours}</span>
        </div>
        
        {/* Menu Highlights */}
        {truck.menu_highlights?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {truck.menu_highlights.slice(0, 3).map((item, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {item}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
