import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPinned, Navigation, LoaderCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import 'leaflet/dist/leaflet.css';

// Explicit marker assets avoid broken default icon URLs in Vite builds.
const pickupIcon = new L.DivIcon({ className: 'route-map-marker', html: '<span class="route-map-pin route-map-pin-pickup">P</span>', iconSize: [28, 36], iconAnchor: [14, 32] });
const deliveryIcon = new L.DivIcon({ className: 'route-map-marker', html: '<span class="route-map-pin route-map-pin-delivery">D</span>', iconSize: [28, 36], iconAnchor: [14, 32] });

function FitRoute({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(points, { padding: [28, 28], maxZoom: 7 });
    else if (points.length === 1) map.setView(points[0], 6);
  }, [map, points]);
  return null;
}

async function geocode(city, state, signal) {
  const query = [city, state, 'USA'].filter(Boolean).join(', ');
  if (!city || !state) return null;
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Map location lookup failed');
  const results = await response.json();
  if (!results.length) return null;
  return [Number(results[0].lat), Number(results[0].lon)];
}

export default function RouteMap({ load }) {
  const [locations, setLocations] = useState({ pickup: null, delivery: null });
  const [status, setStatus] = useState('loading');
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeStatus, setRouteStatus] = useState('loading');
  const origin = `${load?.pickup_city || ''}, ${load?.pickup_state || ''}`.replace(/^, |, $/g, '');
  const destination = `${load?.delivery_city || ''}, ${load?.delivery_state || ''}`.replace(/^, |, $/g, '');

  useEffect(() => {
    const controller = new AbortController();
    if (!load?.pickup_city || !load?.pickup_state || !load?.delivery_city || !load?.delivery_state) {
      setLocations({ pickup: null, delivery: null });
      setRouteCoordinates([]); setRouteInfo(null);
      setStatus('missing'); setRouteStatus('missing');
      return () => controller.abort();
    }
    setStatus('loading'); setRouteStatus('loading');
    setRouteCoordinates([]); setRouteInfo(null);
    Promise.all([
      geocode(load.pickup_city, load.pickup_state, controller.signal),
      geocode(load.delivery_city, load.delivery_state, controller.signal),
    ]).then(async ([pickup, delivery]) => {
      if (controller.signal.aborted) return;
      setLocations({ pickup, delivery });
      if (!pickup || !delivery) {
        setStatus('not-found'); setRouteStatus('not-found');
        return;
      }
      setStatus('ready');
      // OSRM uses longitude,latitude in requests and returns GeoJSON [longitude, latitude].
      const coordinates = `${pickup[1]},${pickup[0]};${delivery[1]},${delivery[0]}`;
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('Driving route request failed');
        const result = await response.json();
        const route = result.code === 'Ok' && result.routes?.[0];
        if (!route?.geometry?.coordinates?.length) throw new Error('No driving route returned');
        setRouteCoordinates(route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]));
        setRouteInfo({ distanceMiles: route.distance / 1609.344, durationHours: route.duration / 3600 });
        setRouteStatus('ready');
      } catch (error) {
        if (error.name === 'AbortError') return;
        // Do not draw a misleading straight line when road routing is unavailable.
        setRouteCoordinates([]); setRouteInfo(null); setRouteStatus('error');
      }
    }).catch((error) => {
      if (error.name !== 'AbortError') { setStatus('error'); setRouteStatus('error'); }
    });
    return () => controller.abort();
  }, [load?.pickup_city, load?.pickup_state, load?.delivery_city, load?.delivery_state]);

  const points = useMemo(() => [locations.pickup, locations.delivery].filter(Boolean), [locations]);
  const center = points.length ? points[0] : [39.5, -98.35];
  const fitPoints = routeCoordinates.length ? routeCoordinates : points;
  const routeUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${locations.pickup ? `${locations.pickup[0]}%2C${locations.pickup[1]}` : ''}%3B${locations.delivery ? `${locations.delivery[0]}%2C${locations.delivery[1]}` : ''}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><MapPinned className="h-4 w-4 text-primary" /> Route map</CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="route-map-legend-dot bg-emerald-500" /> {origin || 'Pickup not set'}</span>
          <span className="flex items-center gap-1"><span className="route-map-legend-dot bg-orange-500" /> {destination || 'Delivery not set'}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {status === 'ready' ? (
          <>
            <MapContainer center={center} zoom={5} scrollWheelZoom={false} className="load-route-map" aria-label={`Route map from ${origin} to ${destination}`}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitRoute points={fitPoints} />
              <Marker position={locations.pickup} icon={pickupIcon} />
              <Marker position={locations.delivery} icon={deliveryIcon} />
              {routeCoordinates.length > 1 && <Polyline positions={routeCoordinates} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }} />}
            </MapContainer>
            <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
              <span>{routeStatus === 'ready' && routeInfo ? `Driving route · ${Math.round(routeInfo.distanceMiles).toLocaleString()} mi · about ${Math.round(routeInfo.durationHours)} hr` : routeStatus === 'loading' ? 'Calculating road route…' : routeStatus === 'error' ? 'Driving route unavailable right now' : load.loaded_miles ? `${Number(load.loaded_miles).toLocaleString()} loaded miles` : 'Driving route pending'}</span>
              <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={routeUrl} target="_blank" rel="noreferrer"><Navigation className="h-3.5 w-3.5" /> Open directions</a>
            </div>
          </>
        ) : (
          <div className="flex min-h-36 items-center justify-center bg-muted/40 px-5 py-7 text-center">
            <div className="max-w-sm">
              {status === 'loading' ? <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-muted-foreground" /> : <MapPinned className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />}
              <p className="text-sm font-medium">{status === 'loading' ? 'Finding route locations…' : status === 'missing' ? 'Add pickup and delivery cities and states to show the route.' : status === 'error' ? 'Could not load map locations. Check your connection and try again.' : 'Could not locate one or both cities. Check the city and state fields.'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Map tiles and geocoding are provided by OpenStreetMap.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
