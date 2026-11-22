# Return Health Recommendations Based on Current Air Quality

## Overview

The Air Quality API's `currentConditions:lookup` endpoint provides real-time
hourly air quality information for a specified geographic coordinate. While a
basic request returns only the Universal Air Quality Index (UAQI), you can
request tailored health advice for various demographic groups—along with
pollutant concentrations and their health effects—by configuring the
`extraComputations` array in the JSON request body.

## Endpoint

Send an HTTP `POST` request to the `currentConditions:lookup` endpoint:

```
https://airquality.googleapis.com/v1/currentConditions:lookup?key=YOUR_API_KEY
```

### Required Headers

*   `Content-Type: application/json`
*   `X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1`

## Request Parameters

To retrieve health recommendations and detailed pollutant information, include
the following fields in your JSON request body:

Field               | Type             | Required                  | Description
:------------------ | :--------------- | :------------------------ | :----------
`location`          | Object           | **Yes**                   | An object containing the `latitude` (number) and `longitude` (number) of the target location.
`extraComputations` | Array of Strings | **Yes** (for health data) | Controls what additional data is returned. Must include `"HEALTH_RECOMMENDATIONS"` to receive health advice.
`universalAqi`      | Boolean          | Optional                  | Defaults to `true`. Set to `true` to include the Universal AQI in the `indexes` response array.
`languageCode`      | String           | Optional                  | The language code (e.g., `"en"`, `"es"`) in which to return the health recommendations and pollutant descriptions.

### `extraComputations` Options for Health & Pollutants

*   `"HEALTH_RECOMMENDATIONS"`: **Required** for this capability. Returns
    tailored health advice for the general population and specific sensitive
    groups based on current conditions.
*   `"POLLUTANT_CONCENTRATION"`: Returns the concentration values and units for
    all measured pollutants present at the location.
*   `"POLLUTANT_ADDITIONAL_INFO"`: Returns the `sources` and health `effects`
    for each pollutant returned (requires `"POLLUTANT_CONCENTRATION"` or
    `"DOMINANT_POLLUTANT_CONCENTRATION"` to be enabled).
*   `"DOMINANT_POLLUTANT_CONCENTRATION"`: Returns concentration details
    exclusively for the dominant pollutant.
*   `"LOCAL_AQI"`: Returns the local/regional Air Quality Index (such as US EPA
    AQI) alongside or instead of the Universal AQI.

## Code Examples

### cURL Request (Health Recommendations & Pollutant Effects)

```bash
curl -X POST -d '{
  "universalAqi": true,
  "location": {
    "latitude": 37.419734,
    "longitude": -122.0827784
  },
  "extraComputations": [
    "HEALTH_RECOMMENDATIONS",
    "POLLUTANT_CONCENTRATION",
    "POLLUTANT_ADDITIONAL_INFO",
    "LOCAL_AQI"
  ],
  "languageCode": "en"
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
'https://airquality.googleapis.com/v1/currentConditions:lookup?key=YOUR_API_KEY'
```

### JavaScript (`fetch`) Implementation

```javascript
async function getAirQualityHealthRecommendations(latitude, longitude, apiKey) {
  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;

  const requestBody = {
    universalAqi: true,
    location: {
      latitude: latitude,
      longitude: longitude
    },
    extraComputations: [
      "HEALTH_RECOMMENDATIONS",
      "POLLUTANT_CONCENTRATION",
      "POLLUTANT_ADDITIONAL_INFO"
    ],
    languageCode: "en"
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return {
      indexes: data.indexes,
      healthRecommendations: data.healthRecommendations,
      pollutants: data.pollutants
    };
  } catch (error) {
    console.error("Failed to fetch air quality health recommendations:", error);
    throw error;
  }
}
```

## Response Structure

When `"HEALTH_RECOMMENDATIONS"`, `"POLLUTANT_CONCENTRATION"`, and
`"POLLUTANT_ADDITIONAL_INFO"` are requested, the JSON response contains the
`healthRecommendations` object and the `pollutants` array in addition to the
standard `indexes` array.

### Example Response

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
      "code": "o3",
      "displayName": "O3",
      "fullName": "Ozone",
      "concentration": {
        "value": 13.88,
        "units": "PARTS_PER_BILLION"
      },
      "additionalInfo": {
        "sources": "Ozone is created in a chemical reaction between atmospheric oxygen...",
        "effects": "Ozone can irritate the airways and cause coughing, a burning..."
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
        "sources": "Main sources are combustion processes (e.g. power plants, indoor heating...",
        "effects": "Fine particles can penetrate into the lungs and bloodstream. Short term..."
      }
    }
  ],
  "healthRecommendations": {
    "generalPopulation": "With this level of air quality, you have no limitations. Enjoy the outdoors!",
    "elderly": "If you start to feel respiratory discomfort such as coughing or breathing difficulties, consider reducing the intensity of your outdoor activities.",
    "lungDiseasePopulation": "If you start to feel respiratory discomfort such as coughing or breathing difficulties, consider reducing the intensity of your outdoor activities.",
    "heartDiseasePopulation": "If you start to feel respiratory discomfort such as coughing or breathing difficulties, consider reducing the intensity of your outdoor activities.",
    "athletes": "With this level of air quality, you have no limitations. Enjoy the outdoors!",
    "pregnantWomen": "With this level of air quality, you have no limitations. Enjoy the outdoors!",
    "children": "With this level of air quality, you have no limitations. Enjoy the outdoors!"
  }
}
```

### Parsing Key Health Fields

1.  **`healthRecommendations`**: Provides targeted guidance strings for specific
    groups:
    *   `generalPopulation`
    *   `elderly`
    *   `lungDiseasePopulation`
    *   `heartDiseasePopulation`
    *   `athletes`
    *   `pregnantWomen`
    *   `children`
2.  **`pollutants[].additionalInfo`**: Explains the origin (`sources`) and
    physiological impact (`effects`) of each specific pollutant (such as `co`,
    `no2`, `o3`, `pm10`, `pm25`, and `so2`).
3.  **`indexes[].dominantPollutant`**: Identifies the primary pollutant driving
    the AQI score (e.g., `"o3"` or `"pm25"`), which can be cross-referenced
    against the `pollutants` array to highlight the main health risk at that
    hour.

> **Note:** In the `indexes[].color` object, if a color channel value (`red`,
> `green`, or `blue`) is `0`, that specific field is omitted from the JSON
> response. Always default missing color channels to `0` when parsing the
> response for UI rendering.
