# Return the current air quality index for a specified geographic location

## Overview

The `currentConditions` endpoint of the Air Quality API provides current hourly
air quality information for a specified geographic location. By default, it
returns the Universal Air Quality Index (UAQI), the air quality category, and
the dominant pollutant. You can also customize the request to include local
AQIs, detailed pollutant concentrations, pollutant sources and effects, and
health recommendations tailored to various population groups.

## Endpoint

Send an HTTP `POST` request to the `currentConditions:lookup` endpoint:

```
https://airquality.googleapis.com/v1/currentConditions:lookup?key=YOUR_API_KEY
```

### Required Headers

*   `Content-Type: application/json`
*   `X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1` (Required for usage
    attribution)

## Request Body Parameters

The request body must be formatted as JSON and contain the following fields:

*   **`location`** (Required): An object specifying the geographic coordinates.
    *   `latitude` (number): The latitude in degrees.
    *   `longitude` (number): The longitude in degrees.
*   **`universalAqi`** (Optional, boolean): If `true` (default), includes the
    Universal AQI in the response. Set to `false` to omit it.
*   **`extraComputations`** (Optional, array of strings): Specifies additional
    information to include in the response. Supported values:
    *   `"LOCAL_AQI"`: Includes the local AQI(s) available for the specified
        location (e.g., `usa_epa`).
    *   `"HEALTH_RECOMMENDATIONS"`: Includes health advice for the general
        population and sensitive groups (elderly, children, athletes, pregnant
        women, and individuals with heart or lung diseases).
    *   `"POLLUTANT_CONCENTRATION"`: Includes the concentration values and units
        for all measured pollutants (e.g., `co`, `no2`, `o3`, `pm10`, `pm25`,
        `so2`).
    *   `"DOMINANT_POLLUTANT_CONCENTRATION"`: Includes the concentration of the
        dominant pollutant.
    *   `"POLLUTANT_ADDITIONAL_INFO"`: Includes information about the sources
        and health effects of each pollutant.
*   **`languageCode`** (Optional, string): The language code (e.g., `"en"`) for
    localized text in the response.

## Implementation Examples

### 1. Basic Request (Universal AQI Only)

To retrieve just the current Universal AQI, category, and dominant pollutant for
a specific latitude and longitude:

#### cURL

```bash
curl -X POST -d '{
  "location": {
    "latitude": 37.419734,
    "longitude": -122.0827784
  }
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
'https://airquality.googleapis.com/v1/currentConditions:lookup?key=YOUR_API_KEY'
```

#### JavaScript (`fetch`)

```javascript
async function getBasicAirQuality(latitude, longitude, apiKey) {
  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    },
    body: JSON.stringify({
      location: {
        latitude: latitude,
        longitude: longitude
      }
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
```

#### Basic Response

```json
{
  "dateTime": "2023-10-26T18:00:00Z",
  "regionCode": "us",
  "indexes": [
    {
      "code": "uaqi",
      "displayName": "Universal AQI",
      "aqi": 52,
      "aqiDisplay": "52",
      "color": {
        "red": 0.9490196,
        "green": 0.98039216,
        "blue": 0.019607844
      },
      "category": "Moderate air quality",
      "dominantPollutant": "no2"
    }
  ]
}
```

> **Note:** If a `color` channel value (`red`, `green`, or `blue`) is `0`, that
> specific field is omitted from the `color` object in the response.

--------------------------------------------------------------------------------

### 2. Advanced Request (Multiple Parameters)

To retrieve local AQIs, detailed pollutant concentrations, additional pollutant
details, and health recommendations:

#### cURL

```bash
curl -X POST -d '{
  "universalAqi": true,
  "location": {
    "latitude": 37.419734,
    "longitude": -122.0827784
  },
  "extraComputations": [
    "HEALTH_RECOMMENDATIONS",
    "DOMINANT_POLLUTANT_CONCENTRATION",
    "POLLUTANT_CONCENTRATION",
    "LOCAL_AQI",
    "POLLUTANT_ADDITIONAL_INFO"
  ],
  "languageCode": "en"
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
'https://airquality.googleapis.com/v1/currentConditions:lookup?key=YOUR_API_KEY'
```

#### JavaScript (`fetch`)

```javascript
async function getDetailedAirQuality(latitude, longitude, apiKey) {
  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;

  const requestBody = {
    universalAqi: true,
    location: {
      latitude: latitude,
      longitude: longitude
    },
    extraComputations: [
      "HEALTH_RECOMMENDATIONS",
      "DOMINANT_POLLUTANT_CONCENTRATION",
      "POLLUTANT_CONCENTRATION",
      "LOCAL_AQI",
      "POLLUTANT_ADDITIONAL_INFO"
    ],
    languageCode: "en"
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
```

#### Advanced Response

```json
{
  "dateTime": "2023-06-15T10:00:00Z",
  "regionCode": "us",
  "indexes": [
    {
      "code": "uaqi",
      "displayName": "Universal AQI",
      "aqi": 89,
      "aqiDisplay": "89",
      "color": {
        "red": 48,
        "green": 175,
        "blue": 55,
        "alpha": 255
      },
      "category": "Excellent air quality",
      "dominantPollutant": "o3"
    },
    {
      "code": "usa_epa",
      "displayName": "AQI (US)",
      "aqi": 41,
      "aqiDisplay": "41",
      "color": {
        "green": 228,
        "alpha": 255
      },
      "category": "Good air quality",
      "dominantPollutant": "pm25"
    }
  ],
  "pollutants": [
    {
      "code": "co",
      "displayName": "CO",
      "fullName": "Carbon monoxide",
      "concentration": {
        "value": 334.24,
        "units": "PARTS_PER_BILLION"
      },
      "additionalInfo": {
        "sources": "Typically originates from incomplete combustion...",
        "effects": "When inhaled, carbon monoxide can prevent the blood from..."
      }
    },
    {
      "code": "pm25",
      "displayName": "PM2.5",
      "fullName": "Fine particulate matter (<2.5µm)",
      "concentration": {
        "value": 2.83,
        "units": "MICROGRAMS_PER_CUBIC_METER"
      },
      "additionalInfo": {
        "sources": "Main sources are combustion processes...",
        "effects": "Fine particles can penetrate into the lungs and bloodstream..."
      }
    }
  ],
  "healthRecommendations": {
    "generalPopulation": "With this level of air quality, you have no limitations. Enjoy the outdoors!",
    "elderly": "If you start to feel respiratory discomfort such as coughing or breathing difficulties...",
    "lungDiseasePopulation": "...",
    "heartDiseasePopulation": "...",
    "athletes": "...",
    "pregnantWomen": "...",
    "children": "..."
  }
}
```
