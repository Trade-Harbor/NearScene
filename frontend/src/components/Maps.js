import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background: ${color};
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      border: 2px solid white;
    ">${label}</div>`,
    iconSize: [100, 30],
    iconAnchor: [50, 15],
  });
};

const eventIcon = (category) => createCustomIcon('#6366F1', category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' '));
const truckIcon = createCustomIcon('#EC4899', 'Food Truck');
const userIcon = createCustomIcon('#10B981', 'You');

// Component to recenter map
const RecenterMap = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
};

export const EventMap = ({ 
  events = [], 
  center = [40.7128, -74.006], 
  zoom = 12,
  onEventClick,
  showUserLocation = false,
  userLocation = null
}) => {
  const mapRef = useRef(null);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden" data-testid="event-map">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        ref={mapRef}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {showUserLocation && userLocation && (
          <Marker 
            position={[userLocation.latitude, userLocation.longitude]}
            icon={userIcon}
          >
            <Popup>
              <div className="text-center p-2">
                <strong>Your Location</strong>
              </div>
            </Popup>
          </Marker>
        )}
        
        {events.map((event) => (
          <Marker
            key={event.event_id}
            position={[event.latitude, event.longitude]}
            icon={eventIcon(event.category)}
            eventHandlers={{
              click: () => onEventClick?.(event)
            }}
          >
            <Popup>
              <div className="min-w-[200px] p-1">
                <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
                <p className="text-xs text-gray-600 mb-2">{event.location_name}</p>
                <button 
                  className="text-xs text-indigo-600 font-medium hover:underline"
                  onClick={() => onEventClick?.(event)}
                >
                  View Details →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {userLocation && <RecenterMap lat={userLocation.latitude} lng={userLocation.longitude} />}
      </MapContainer>
    </div>
  );
};

export const FoodTruckMap = ({ 
  trucks = [], 
  center = [40.7128, -74.006], 
  zoom = 13,
  onTruckClick,
  showUserLocation = false,
  userLocation = null,
  selectedTruck = null
}) => {
  const mapRef = useRef(null);

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden" data-testid="food-truck-map">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        ref={mapRef}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {showUserLocation && userLocation && (
          <Marker 
            position={[userLocation.latitude, userLocation.longitude]}
            icon={userIcon}
          >
            <Popup>
              <div className="text-center p-2">
                <strong>Your Location</strong>
              </div>
            </Popup>
          </Marker>
        )}
        
        {trucks.map((truck) => (
          <Marker
            key={truck.truck_id}
            position={[truck.latitude, truck.longitude]}
            icon={truckIcon}
            eventHandlers={{
              click: () => onTruckClick?.(truck)
            }}
          >
            <Popup>
              <div className="min-w-[200px] p-1">
                <h4 className="font-semibold text-sm mb-1">{truck.name}</h4>
                <p className="text-xs text-gray-600 mb-1">{truck.cuisine_type}</p>
                <p className="text-xs text-gray-500 mb-2">{truck.operating_hours}</p>
                <button 
                  className="text-xs text-pink-600 font-medium hover:underline"
                  onClick={() => onTruckClick?.(truck)}
                >
                  View Details →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {selectedTruck && (
          <RecenterMap lat={selectedTruck.latitude} lng={selectedTruck.longitude} />
        )}
      </MapContainer>
    </div>
  );
};
