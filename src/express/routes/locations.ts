/**
 * Locations Routes
 *
 * API endpoints for location search and geocoding.
 * Uses Photon (OpenStreetMap) for free geocoding, no API key required.
 * Google Places API available as fallback when GOOGLE_MAPS_SERVER_KEY is set.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Google API key for server-side use (must NOT have HTTP referer restrictions)
const GOOGLE_MAPS_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || '';

// Photon API response types (OpenStreetMap-based, free, no API key)
interface PhotonFeature {
  properties: {
    osm_id: number;
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

// Google API response types (fallback)
interface GooglePlacesAutocompleteResponse {
  status: string;
  error_message?: string;
  predictions: Array<{
    place_id: string;
    description: string;
    structured_formatting?: {
      main_text: string;
      secondary_text?: string;
    };
  }>;
}

interface GooglePlaceDetailsResponse {
  status: string;
  result: {
    formatted_address: string;
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
    address_components?: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  };
}

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    place_id: string;
    formatted_address: string;
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
    address_components?: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
}

/**
 * Search locations using Photon (OpenStreetMap)
 * Free, no API key required
 */
async function searchWithPhoton(query: string, limit: number) {
  const response = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village&lang=en`
  );

  if (!response.ok) {
    throw new Error(`Photon API error: ${response.status}`);
  }

  const data = (await response.json()) as PhotonResponse;

  return (data.features || []).map((feature) => {
    const props = feature.properties;
    const [longitude, latitude] = feature.geometry.coordinates;

    // Build display name
    const parts: string[] = [];
    if (props.name) parts.push(props.name);
    if (props.state && props.state !== props.name) parts.push(props.state);
    if (props.country) parts.push(props.country);

    const displayName = parts.join(', ');
    const city = props.city || props.name || '';
    const country = props.country || '';

    return {
      id: `osm_${props.osm_id}`,
      name: props.name || displayName,
      address: displayName,
      city,
      country,
      coordinates: {
        latitude,
        longitude,
      },
      placeId: `osm_${props.osm_id}`,
      type: 'city' as const,
    };
  });
}

/**
 * Search locations using Google Places API
 * Requires GOOGLE_MAPS_SERVER_KEY (without HTTP referer restrictions)
 */
async function searchWithGoogle(query: string, limit: number) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${GOOGLE_MAPS_SERVER_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  const data = (await response.json()) as GooglePlacesAutocompleteResponse;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(
      `Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`
    );
  }

  // Get place details for each result to get coordinates
  const results = await Promise.all(
    (data.predictions || []).slice(0, limit).map(async (prediction) => {
      try {
        const detailsResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,address_components,formatted_address&key=${GOOGLE_MAPS_SERVER_KEY}`
        );
        const details = (await detailsResponse.json()) as GooglePlaceDetailsResponse;

        if (details.status !== 'OK') {
          return null;
        }

        const result = details.result;
        const addressComponents = result.address_components || [];

        const city =
          addressComponents.find(
            (c) => c.types.includes('locality') || c.types.includes('administrative_area_level_1')
          )?.long_name ||
          prediction.structured_formatting?.main_text ||
          '';

        const country = addressComponents.find((c) => c.types.includes('country'))?.long_name || '';

        return {
          id: prediction.place_id,
          name: prediction.structured_formatting?.main_text || prediction.description,
          address: result.formatted_address || prediction.description,
          city,
          country,
          coordinates: {
            latitude: result.geometry?.location?.lat || 0,
            longitude: result.geometry?.location?.lng || 0,
          },
          placeId: prediction.place_id,
          type: 'city' as const,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

/**
 * GET /api/locations/search
 * Search for locations - uses Photon (free) by default, Google as optional
 */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { query, limit = 10, provider } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      res.status(400).json({
        ok: false,
        error: 'Query must be at least 2 characters',
        results: [],
      });
      return;
    }

    const numLimit = Math.min(Number(limit) || 10, 20);

    try {
      let results;

      // Use Google if explicitly requested AND key is available
      if (provider === 'google' && GOOGLE_MAPS_SERVER_KEY) {
        results = await searchWithGoogle(query.trim(), numLimit);
      } else {
        // Default to Photon (free, no API key)
        results = await searchWithPhoton(query.trim(), numLimit);
      }

      res.json({
        ok: true,
        results,
        provider: provider === 'google' && GOOGLE_MAPS_SERVER_KEY ? 'google' : 'photon',
      });
    } catch (error) {
      console.error('Location search error:', error);
      res.status(500).json({
        ok: false,
        error: 'Location search failed',
        results: [],
      });
    }
  })
);

/**
 * GET /api/locations/reverse
 * Reverse geocoding - get address from coordinates
 * Uses Photon by default
 */
router.get(
  '/reverse',
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      res.status(400).json({
        ok: false,
        error: 'Latitude and longitude are required',
        result: null,
      });
      return;
    }

    try {
      // Use Photon reverse geocoding
      const response = await fetch(
        `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`
      );

      if (!response.ok) {
        throw new Error(`Photon API error: ${response.status}`);
      }

      const data = (await response.json()) as PhotonResponse;

      if (!data.features?.length) {
        res.json({ ok: true, result: null });
        return;
      }

      const feature = data.features[0];
      const props = feature.properties;

      const city = props.city || props.name || '';
      const country = props.country || '';

      const parts: string[] = [];
      if (props.name) parts.push(props.name);
      if (props.state && props.state !== props.name) parts.push(props.state);
      if (props.country) parts.push(props.country);
      const displayName = parts.join(', ');

      res.json({
        ok: true,
        result: {
          id: `osm_${props.osm_id}`,
          name: city || displayName,
          address: displayName,
          city,
          country,
          coordinates: {
            latitude: Number(latitude),
            longitude: Number(longitude),
          },
          placeId: `osm_${props.osm_id}`,
          type: 'address' as const,
        },
      });
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      res.status(500).json({
        ok: false,
        error: 'Reverse geocoding failed',
        result: null,
      });
    }
  })
);

/**
 * GET /api/locations/geocode
 * Forward geocoding - get coordinates from address
 */
router.get(
  '/geocode',
  asyncHandler(async (req, res) => {
    const { address } = req.query;

    if (!address || typeof address !== 'string') {
      res.status(400).json({
        ok: false,
        error: 'Address is required',
      });
      return;
    }

    try {
      // Use Photon for forward geocoding
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&lang=en`
      );

      if (!response.ok) {
        throw new Error(`Photon API error: ${response.status}`);
      }

      const data = (await response.json()) as PhotonResponse;

      if (!data.features?.length) {
        res.json({ ok: true, latitude: null, longitude: null });
        return;
      }

      const [longitude, latitude] = data.features[0].geometry.coordinates;

      res.json({
        ok: true,
        latitude,
        longitude,
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      res.status(500).json({
        ok: false,
        error: 'Geocoding failed',
      });
    }
  })
);

export default router;
