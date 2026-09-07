export interface Barrio {
  nombre: string;
  lat: number;
  lng: number;
}

// Barrios del norte de Bogotá con coordenadas aproximadas
export const BARRIOS: Barrio[] = [
  { nombre: "Alhambra", lat: 4.7053, lng: -74.0524 },
  { nombre: "Álamos Norte", lat: 4.7101, lng: -74.1012 },
  { nombre: "Batán", lat: 4.6943, lng: -74.0701 },
  { nombre: "Bella Suiza", lat: 4.7210, lng: -74.0461 },
  { nombre: "Bonita", lat: 4.7320, lng: -74.0498 },
  { nombre: "Britalia", lat: 4.7389, lng: -74.0910 },
  { nombre: "Caobos Salazar", lat: 4.7001, lng: -74.0489 },
  { nombre: "Cedritos", lat: 4.7140, lng: -74.0494 },
  { nombre: "Chicó", lat: 4.6800, lng: -74.0520 },
  { nombre: "Chicó Norte", lat: 4.6870, lng: -74.0480 },
  { nombre: "Chicó Reservado", lat: 4.6830, lng: -74.0530 },
  { nombre: "Ciudad Jardín Norte", lat: 4.7270, lng: -74.0472 },
  { nombre: "El Batan", lat: 4.6960, lng: -74.0690 },
  { nombre: "El Country", lat: 4.6840, lng: -74.0456 },
  { nombre: "El Chico", lat: 4.6800, lng: -74.0490 },
  { nombre: "El Polo", lat: 4.6760, lng: -74.0535 },
  { nombre: "El Rincón", lat: 4.7450, lng: -74.0970 },
  { nombre: "Floresta", lat: 4.6912, lng: -74.0732 },
  { nombre: "Gratamira", lat: 4.7290, lng: -74.0430 },
  { nombre: "La Alhambra", lat: 4.7050, lng: -74.0510 },
  { nombre: "La Calleja", lat: 4.7060, lng: -74.0470 },
  { nombre: "La Carolina", lat: 4.6680, lng: -74.0530 },
  { nombre: "La Castellana", lat: 4.6820, lng: -74.0690 },
  { nombre: "La Floresta", lat: 4.6920, lng: -74.0740 },
  { nombre: "La Uribe", lat: 4.7080, lng: -74.0540 },
  { nombre: "Las Ferias", lat: 4.6890, lng: -74.0802 },
  { nombre: "Las Villas", lat: 4.6950, lng: -74.0660 },
  { nombre: "Lisboa", lat: 4.7520, lng: -74.0930 },
  { nombre: "Los Alcázares", lat: 4.6940, lng: -74.0770 },
  { nombre: "Los Cedros", lat: 4.7170, lng: -74.0470 },
  { nombre: "Mazurén", lat: 4.7350, lng: -74.0620 },
  { nombre: "Niza", lat: 4.6990, lng: -74.0630 },
  { nombre: "Niza Sur", lat: 4.6940, lng: -74.0620 },
  { nombre: "Normandía", lat: 4.6860, lng: -74.0880 },
  { nombre: "Pontevedra", lat: 4.7010, lng: -74.0658 },
  { nombre: "Prado Veraniego", lat: 4.7240, lng: -74.0560 },
  { nombre: "Rincón", lat: 4.7470, lng: -74.0980 },
  { nombre: "San Cristóbal Norte", lat: 4.7200, lng: -74.0490 },
  { nombre: "San Patricio", lat: 4.6780, lng: -74.0470 },
  { nombre: "Santa Bárbara", lat: 4.7050, lng: -74.0470 },
  { nombre: "Santa Bárbara Central", lat: 4.7040, lng: -74.0460 },
  { nombre: "Santa Paula", lat: 4.7110, lng: -74.0450 },
  { nombre: "Suba", lat: 4.7410, lng: -74.0837 },
  { nombre: "Tibabita", lat: 4.7480, lng: -74.0400 },
  { nombre: "Toberín", lat: 4.7350, lng: -74.0510 },
  { nombre: "Unicerros", lat: 4.6630, lng: -74.0470 },
  { nombre: "Usaquén", lat: 4.6970, lng: -74.0300 },
];

export const NOMBRES_BARRIOS = BARRIOS.map((b) => b.nombre).sort();

export function getCoordenadasBarrio(nombre: string): { lat: number; lng: number } | null {
  const barrio = BARRIOS.find((b) => b.nombre === nombre);
  return barrio ? { lat: barrio.lat, lng: barrio.lng } : null;
}
