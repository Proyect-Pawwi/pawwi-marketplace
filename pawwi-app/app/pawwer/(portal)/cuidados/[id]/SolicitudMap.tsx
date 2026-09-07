"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

interface Props {
  clientLat: number;
  clientLng: number;
  pawwerLat?: number | null;
  pawwerLng?: number | null;
  neighborhood?: string | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SolicitudMap({ clientLat, clientLng, pawwerLat, pawwerLng, neighborhood }: Props) {
  const distanceKm =
    pawwerLat != null && pawwerLng != null
      ? haversineKm(pawwerLat, pawwerLng, clientLat, clientLng)
      : null;

  const distanceLabel =
    distanceKm == null
      ? null
      : distanceKm < 1
      ? `${Math.round(distanceKm * 1000)} m de ti`
      : `${distanceKm.toFixed(1)} km de ti`;

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="rounded-[24px] overflow-hidden relative">
        <Map
          defaultCenter={{ lat: clientLat, lng: clientLng }}
          defaultZoom={15}
          mapId="solicitud-detail-map"
          disableDefaultUI
          style={{ width: "100%", height: "260px" }}
        >
          {/* Pin del cliente */}
          <AdvancedMarker position={{ lat: clientLat, lng: clientLng }}>
            <div className="flex flex-col items-center">
              <div className="w-11 h-11 bg-[#FF7031] rounded-full flex items-center justify-center border-[3px] border-white shadow-[0_4px_16px_rgba(255,112,49,0.5)] text-xl">
                🏠
              </div>
              {neighborhood && (
                <span className="mt-1 bg-[#120A2B] text-white text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                  {neighborhood}
                </span>
              )}
            </div>
          </AdvancedMarker>

          {/* Pin del pawwer (cuando hay coords) */}
          {pawwerLat != null && pawwerLng != null && (
            <AdvancedMarker position={{ lat: pawwerLat, lng: pawwerLng }}>
              <div className="w-8 h-8 bg-[#120A2B] rounded-full flex items-center justify-center border-2 border-white shadow-md text-sm">
                🐾
              </div>
            </AdvancedMarker>
          )}
        </Map>

        {/* Badge de distancia superpuesto */}
        {distanceLabel && (
          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm text-[#120A2B] text-xs font-black px-3 py-1.5 rounded-full shadow-[0_4px_12px_rgba(18,10,43,0.12)] flex items-center gap-1.5">
            <span className="text-[#FF7031]">📍</span>
            {distanceLabel}
          </div>
        )}
      </div>
    </APIProvider>
  );
}
