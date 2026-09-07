"use client";

import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";
import type { LatLng } from "./MapView";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (coords: LatLng, label: string, neighborhood?: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

interface Prediction {
  place_id: string;
  main: string;
  secondary: string;
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, autoFocus }: Props) {
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  const placesLib = useMapsLibrary("places");
  const geocodingLib = useMapsLibrary("geocoding");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);

  // Init service once Places library is available
  useEffect(() => {
    if (!placesLib) return;
    autocompleteRef.current = new placesLib.AutocompleteService();
  }, [placesLib]);

  // Fetch suggestions with debounce — skip if value was just set by a selection
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (!autocompleteRef.current || value.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      autocompleteRef.current!.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: "co" },
          locationBias: { center: { lat: 4.710, lng: -74.065 }, radius: 30000 },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (predictions: any, status: any) => {
          if (status === "OK" && predictions) {
            setSuggestions(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              predictions.slice(0, 5).map((p: any) => ({
                place_id: p.place_id,
                main: p.structured_formatting.main_text,
                secondary: p.structured_formatting.secondary_text,
              }))
            );
            setOpen(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  // Close on click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSelect(prediction: Prediction) {
    justSelectedRef.current = true;
    setOpen(false);
    setSuggestions([]);
    onChange(prediction.main);

    if (!geocodingLib) return;
    const geocoder = new geocodingLib.Geocoder();
    const result = await geocoder.geocode({ placeId: prediction.place_id });
    const loc = result.results[0]?.geometry?.location;
    if (loc) {
      type AddrComp = { types: string[]; long_name: string };
      const comps = (result.results[0]?.address_components ?? []) as AddrComp[];
      const findComp = (type: string) =>
        comps.find((c) => c.types.includes(type))?.long_name ?? "";
      const neighborhood =
        findComp("sublocality_level_1") ||
        findComp("sublocality") ||
        findComp("neighborhood") ||
        "";
      onSelect({ lat: loc.lat(), lng: loc.lng() }, prediction.main, neighborhood || undefined);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center border border-gray-300 rounded-xl p-3 focus-within:border-[#FF7031] focus-within:ring-1 ring-[#FF7031]">
        <MapPin size={18} className="text-gray-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder={placeholder || "Ej. Calle 116 # 12-34, Bogotá"}
          className="w-full outline-none text-[#120A2B] text-base bg-transparent"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && suggestions.length > 0) handleSelect(suggestions[0]); }}
          autoComplete="off"
        />
        {value && (
          <button onClick={() => { onChange(""); setSuggestions([]); }} className="text-gray-400 hover:text-gray-600 shrink-0 ml-1">
            ×
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[100]">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-3 hover:bg-[#FFF1EB] flex items-start gap-3 border-b border-gray-50 last:border-0 transition-colors"
            >
              <MapPin size={15} className="text-[#FF7031] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#120A2B] truncate">{s.main}</p>
                <p className="text-xs text-gray-400 truncate">{s.secondary}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
