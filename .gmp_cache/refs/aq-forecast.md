# Return a Four-Day Forecast for the Air Quality Index

## Overview

The `forecast:lookup` endpoint provides up to 96 hours (4 days) of hourly air
quality forecast information for a specified geographic location. Each hourly
forecast entry returns calculated air quality indexes (AQI) and can optionally
include pollutant concentrations, dominant pollutants, health recommendations,
and localized text.

## Endpoint Specification

-   **HTTP Method**: `POST`
-   **Endpoint URL**:
    `https://airquality.googleapis.com/v1/forecast:lookup?key=YOUR_API_KEY`
-   **Required Headers**:
    -   `Content-Type: application/json`
    -   `X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1`

## Request Body Parameters

Construct a JSON payload containing the target coordinates, time frame, and
optional configuration parameters:

### Required Parameters

-   `location` (Object): The geographic coordinates for the forecast.
    -   `latitude` (number): Latitude in degrees.
    -   `longitude` (number): Longitude in degrees.
-   **Time Specification** (Provide either `dateTime` OR `period`, pointing to a
    future time within the next 96 hours starting from the next hour):
    -   `dateTime` (string): A single future timestamp in RFC3339 UTC "Zulu"
        format (e.g., `"2024-02-09T08:00:00Z"`).
    -   `period` (Object): A start and end time range for the forecast.
    -   `startTime` (string): RFC3339 timestamp.
    -   `endTime` (string): RFC3339 timestamp.

### Optional Parameters

-   `pageSize` (integer): The maximum number of hourly forecasts to return per
    page.
-   `pageToken` (string): The token retrieved from a previous response's
    `nextPageToken` field to fetch the subsequent page of results.
-   `universalAqi` (boolean): If `true`, includes the Universal AQI (`uaqi`) in
    the response.
-   `languageCode` (string): TheBCP-47 language code for translated fields
    (e.g., `"en"`).
-   `uaqiColorPalette` (string): Controls the color palette used for Universal
    AQI (e.g., `"RED_GREEN"`).
-   `extraComputations` (Array of strings): Specifies additional data to compute
    and return. Valid values include:
    -   `"HEALTH_RECOMMENDATIONS"`
    -   `"DOMINANT_POLLUTANT_CONCENTRATION"`
    -   `"POLLUTANT_ADDITIONAL_INFO"`
    -   `"POLLUTANT_CONCENTRATION"`
    -   `"LOCAL_AQI"`

--------------------------------------------------------------------------------

## Code Examples

### 1. Basic Forecast Request (Single Future Timestamp)

This request queries the forecast for a specific coordinate at a single future
hour.

```bash
curl -X POST -d '{
  "location": {
    "latitude": 37.4125333,
    "longitude": -122.0840937
  },
  "dateTime": "2024-02-09T08:00:00Z"
}' \
-H "Content-Type: application/json" \
-H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
-H "Accept-Language: *" \
"https://airquality.googleapis.com/v1/forecast:lookup?key=YOUR_API_KEY"
```

#### Basic Response

```json
{
  "hourlyForecasts": [
    {
      "dateTime": "2024-02-09T08:00:00Z",
      "indexes": [
        {
          "code": "uaqi",
          "displayName": "Universal AQI",
          "aqi": 80,
          "aqiDisplay": "80",
          "color": {
            "red": 0.34509805,
            "green": 0.74509805,
            "blue": 0.20784314
          },
          "category": "Excellent air quality",
          "dominantPollutant": "pm25"
        }
      ]
    }
  ],
  "regionCode": "us"
}
```

> **Note**: If a `color` channel (`red`, `green`, or `blue`) has a value of `0`,
> that field is omitted from the JSON response.

--------------------------------------------------------------------------------

### 2. Multi-Parameter Request (Time Period & Extra Computations)

This request queries a time range (`period`), configures pagination
(`pageSize`), and requests health recommendations and pollutant details via
`extraComputations`.

```bash
curl -X POST -d '{
  "pageSize": 10,
  "universalAqi": true,
  "location": {
    "latitude": 40.741895,
    "longitude": -73.989308
  },
  "period": {
    "startTime": "2024-02-27T13:58:14+02:00",
    "endTime": "2024-02-28T16:58:14+02:00"
  },
  "languageCode": "en",
  "extraComputations": [
    "HEALTH_RECOMMENDATIONS",
    "DOMINANT_POLLUTANT_CONCENTRATION",
    "POLLUTANT_ADDITIONAL_INFO"
  ],
  "uaqiColorPalette": "RED_GREEN"
}' \
-H "Content-Type: application/json" \
-H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
-H "Accept-Language: *" \
"https://airquality.googleapis.com/v1/forecast:lookup?key=YOUR_API_KEY"
```

#### Multi-Parameter Response

```json
{
  "hourlyForecasts": [
    {
      "dateTime": "2024-02-27T11:00:00Z",
      "indexes": [
        {
          "code": "uaqi",
          "displayName": "Universal AQI",
          "aqi": 75,
          "aqiDisplay": "75",
          "color": {
            "red": 0.43137255,
            "green": 0.7764706,
            "blue": 0.20392157
          },
          "category": "Good air quality",
          "dominantPollutant": "pm25"
        }
      ],
      "pollutants": [
        {
          "code": "pm25",
          "displayName": "PM2.5",
          "fullName": "Fine particulate matter (<2.5µm)",
          "concentration": {
            "value": 15.1,
            "units": "MICROGRAMS_PER_CUBIC_METER"
          },
          "additionalInfo": {
            "sources": "...",
            "effects": "..."
          }
        }
      ],
      "healthRecommendations": {
        "generalPopulation": "...",
        "lungDiseasePopulation": "...",
        "heartDiseasePopulation": "...",
        "athletes": "...",
        "pregnantWomen": "..."
      }
    }
  ],
  "regionCode": "us",
  "nextPageToken": "CjMKEglwCFVq9l5EQBH0aoDSUH9SwBoQCgYI1pDirgYSBgiGiOiuBiABKgMCBAMyAmVuOAEQGA=="
}
```

--------------------------------------------------------------------------------

### 3. Paginating Forecast Results

When the requested forecast range exceeds the `pageSize`, the response includes
a `nextPageToken`. Pass this value as `pageToken` in a subsequent request while
keeping all other parameters identical.

```bash
curl -X POST -d '{
  "universalAqi": true,
  "location": {
    "latitude": 40.741895,
    "longitude": -73.989308
  },
  "period": {
    "startTime": "2024-02-27T13:58:14+02:00",
    "endTime": "2024-02-28T16:58:14+02:00"
  },
  "languageCode": "en",
  "extraComputations": [
    "HEALTH_RECOMMENDATIONS",
    "DOMINANT_POLLUTANT_CONCENTRATION",
    "POLLUTANT_ADDITIONAL_INFO"
  ],
  "uaqiColorPalette": "RED_GREEN",
  "pageToken": "CjMKEglwCFVq9l5EQBH0aoDSUH9SwBoQCgYI1pDirgYSBgiGiOiuBiABKgMCBAMyAmVuOAEQGA=="
}' \
-H "Content-Type: application/json" \
-H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
-H "Accept-Language: *" \
"https://airquality.googleapis.com/v1/forecast:lookup?key=YOUR_API_KEY"
```

--------------------------------------------------------------------------------

### 4. JavaScript (`fetch`) Implementation

```javascript
async function getAirQualityForecast(apiKey, lat, lng, startTime, endTime) {
  const url = `https://airquality.googleapis.com/v1/forecast:lookup?key=${apiKey}`;

  const payload = {
    universalAqi: true,
    location: {
      latitude: lat,
      longitude: lng
    },
    period: {
      startTime: startTime,
      endTime: endTime
    },
    languageCode: "en",
    extraComputations: [
      "HEALTH_RECOMMENDATIONS",
      "DOMINANT_POLLUTANT_CONCENTRATION"
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Air Quality Forecast request failed: ${response.statusText}`);
  }

  return await response.json();
}
```
