"use client";

import { useEffect, useRef, useState } from "react";
import { Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";

export interface MapPawwer {
  id: string;
  name: string;
  price: string;
  lat: number;
  lng: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

interface MapViewProps {
  pawwers: MapPawwer[];
  searchCenter?: LatLng | null;
  radiusMeters?: number;
  selectedId?: string | null;
  onMarkerClick?: (id: string) => void;
}

const BOGOTA_CENTER: LatLng = { lat: 4.706, lng: -74.053 };

// Pans the map and manages the radius circle — must live inside <Map>
function MapController({ center, radiusMeters }: { center?: LatLng | null; radiusMeters?: number }) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    // Clear previous circle
    circleRef.current?.setMap(null);
    circleRef.current = null;

    if (!center) return;

    // Pan + zoom to match radius
    map.panTo(center);
    const zoom =
      !radiusMeters || radiusMeters <= 1000 ? 15
      : radiusMeters <= 2000 ? 14
      : radiusMeters <= 5000 ? 13
      : 12;
    map.setZoom(zoom);

    // Draw radius circle
    if (radiusMeters) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      circleRef.current = new (window as any).google.maps.Circle({
        map,
        center,
        radius: radiusMeters,
        fillColor: "#FF7031",
        fillOpacity: 0.08,
        strokeColor: "#FF7031",
        strokeOpacity: 0.7,
        strokeWeight: 2,
      });
    }

    return () => {
      circleRef.current?.setMap(null);
      circleRef.current = null;
    };
  }, [map, center, radiusMeters]);

  return null;
}

export default function MapView({ pawwers, searchCenter, radiusMeters, selectedId, onMarkerClick }: MapViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <Map
      defaultCenter={BOGOTA_CENTER}
      defaultZoom={13}
      mapId="DEMO_MAP_ID"
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      style={{ width: "100%", height: "100%" }}
    >
      {/* Handles pan + circle when search location is set */}
      <MapController center={searchCenter} radiusMeters={radiusMeters} />

      {/* User location pin */}
      {searchCenter && (
        <AdvancedMarker position={searchCenter} zIndex={10}>
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 bg-[#FF7031] rounded-full border-[3px] border-white shadow-lg ring-[6px] ring-[#FF7031]/20" />
          </div>
        </AdvancedMarker>
      )}

      {/* Pawwer price markers */}
      {pawwers.map((p) => (
        <AdvancedMarker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          onMouseEnter={() => setHoveredId(p.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onMarkerClick?.(p.id)}
        >
          <div
            className={`font-bold text-sm px-3 py-1.5 rounded-full shadow-lg border transition-all duration-150 whitespace-nowrap select-none cursor-pointer
              ${selectedId === p.id || hoveredId === p.id
                ? "bg-[#FF7031] text-white border-[#FF7031] scale-110"
                : "bg-white text-[#120A2B] border-gray-200"
              }`}
          >
            {p.price}
          </div>
        </AdvancedMarker>
      ))}
    </Map>
  );
}
