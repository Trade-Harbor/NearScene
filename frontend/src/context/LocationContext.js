import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LocationContext = createContext(null);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

// Default to NYC
const DEFAULT_LOCATION = {
  latitude: 40.7128,
  longitude: -74.006,
  city: 'New York',
  state: 'NY'
};

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(() => {
    const stored = localStorage.getItem('userLocation');
    return stored ? JSON.parse(stored) : DEFAULT_LOCATION;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radius, setRadius] = useState(() => {
    const stored = localStorage.getItem('searchRadius');
    return stored ? parseInt(stored, 10) : 25;
  });

  const updateRadius = useCallback((newRadius) => {
    setRadius(newRadius);
    localStorage.setItem('searchRadius', newRadius.toString());
  }, []);

  const detectLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city: 'Your Location',
        state: ''
      };

      setLocation(newLocation);
      localStorage.setItem('userLocation', JSON.stringify(newLocation));
    } catch (err) {
      setError('Unable to detect location. Using default.');
      console.error('Geolocation error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const setManualLocation = useCallback((newLocation) => {
    setLocation(newLocation);
    localStorage.setItem('userLocation', JSON.stringify(newLocation));
  }, []);

  useEffect(() => {
    // Try to detect location on first load if not stored
    const stored = localStorage.getItem('userLocation');
    if (!stored && navigator.geolocation) {
      detectLocation();
    }
  }, [detectLocation]);

  const value = {
    location,
    loading,
    error,
    radius,
    updateRadius,
    detectLocation,
    setManualLocation,
    hasLocation: !!location
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};
