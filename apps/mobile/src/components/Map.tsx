import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { View } from 'react-native';
import { usePalette } from '@/lib/theme';

export interface MapPoint { lat: number; lng: number; kind: 'me' | 'jobzer' }

/** Native map (Apple Maps on iOS, Google Maps on Android). Web uses Map.web.tsx. */
export function JobzeeMap({ center, points = [], height = 260 }: { center: { lat: number; lng: number }; points?: MapPoint[]; height?: number }) {
  const p = usePalette();
  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden' }}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsUserLocation
        accessibilityLabel="Hartă cu zona ta"
      >
        {points.map((pt, i) => (
          <Marker key={i} coordinate={{ latitude: pt.lat, longitude: pt.lng }} pinColor={pt.kind === 'jobzer' ? p.or : p.ink} />
        ))}
      </MapView>
    </View>
  );
}
