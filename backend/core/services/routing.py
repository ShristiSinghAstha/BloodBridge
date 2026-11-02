"""
core/services/routing.py

OSRM Routing Service wrapper.

This module is the single point of contact between BloodBridge and any
road-routing provider.  Swapping OSRM for another provider only requires
changes here.

OSRM coordinate order: longitude,latitude  (note: reversed from lat,lng)
OSRM public demo: http://router.project-osrm.org
  • Use respectfully — it is rate-limited and not for production traffic.
  • Never block a blood request match if OSRM is unavailable.

Endpoints used
──────────────
Route API  – /route/v1/driving/{coords}?overview=false&steps=false
Table API  – /table/v1/driving/{sources};{destinations}?annotations=distance,duration
"""

import logging
import math
from dataclasses import dataclass
from typing import Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def haversine_distance(
    lat1: Optional[float],
    lng1: Optional[float],
    lat2: Optional[float],
    lng2: Optional[float],
) -> Optional[float]:
    """
    Calculate the great-circle (straight-line) distance between two geographic points
    in metres using the Haversine formula.

    Returns distance in metres (float rounded to 2 decimal places) or None if any
    coordinate is missing or outside valid geographic bounds (-90..90 for lat, -180..180 for lng).
    """
    if None in (lat1, lng1, lat2, lng2):
        return None
    try:
        lat1, lng1, lat2, lng2 = float(lat1), float(lng1), float(lat2), float(lng2)
    except (TypeError, ValueError):
        return None

    if not (-90.0 <= lat1 <= 90.0 and -90.0 <= lat2 <= 90.0):
        return None
    if not (-180.0 <= lng1 <= 180.0 and -180.0 <= lng2 <= 180.0):
        return None

    # Earth radius in metres
    R = 6371000.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(R * c, 2)


@dataclass
class RouteResult:
    """
    Result of a single point-to-point routing request.

    distance_m  – road or fallback distance in metres (None if unavailable)
    duration_s  – travel time in seconds (None if unavailable)
    source      – 'osrm', 'haversine', or 'unavailable'
    error       – human-readable error or explanation
    is_fallback – True if straight-line Haversine fallback was used
    """

    distance_m: Optional[float]
    duration_s: Optional[float]
    source: str = "osrm"
    error: Optional[str] = None
    is_fallback: bool = False

    @property
    def distance_km(self) -> Optional[float]:
        if self.distance_m is None:
            return None
        return round(self.distance_m / 1000, 2)

    @property
    def duration_min(self) -> Optional[float]:
        if self.duration_s is None:
            return None
        return round(self.duration_s / 60, 1)

    @property
    def is_available(self) -> bool:
        return self.source == "osrm" and self.distance_m is not None


def _base_url() -> str:
    """Return the configured OSRM base URL (no trailing slash)."""
    return settings.OSRM_BASE_URL.rstrip("/")


def _timeout() -> int:
    return getattr(settings, "OSRM_TIMEOUT", 10)


def get_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> RouteResult:
    """
    Get the road distance and travel time between two coordinates.

    Attempts OSRM Route API first. If OSRM fails (timeout, connection error,
    DNS failure, non-200 code), cleanly falls back to computing straight-line
    geographic distance via Haversine formula without fabricating travel time.
    """
    # Validate coordinate presence
    for val, name in [
        (origin_lat, "origin_lat"), (origin_lng, "origin_lng"),
        (dest_lat,   "dest_lat"),   (dest_lng,   "dest_lng"),
    ]:
        if val is None:
            return RouteResult(
                distance_m=None,
                duration_s=None,
                source="unavailable",
                error=f"Missing coordinate: {name}",
                is_fallback=False,
            )

    # Check coordinate numeric bounds
    try:
        o_lat, o_lng, d_lat, d_lng = float(origin_lat), float(origin_lng), float(dest_lat), float(dest_lng)
        if not (-90.0 <= o_lat <= 90.0 and -90.0 <= d_lat <= 90.0 and -180.0 <= o_lng <= 180.0 and -180.0 <= d_lng <= 180.0):
            return RouteResult(
                distance_m=None,
                duration_s=None,
                source="unavailable",
                error="Invalid coordinate bounds.",
                is_fallback=False,
            )
    except (TypeError, ValueError):
        return RouteResult(
            distance_m=None,
            duration_s=None,
            source="unavailable",
            error="Non-numeric coordinate value.",
            is_fallback=False,
        )

    # OSRM uses lng,lat order
    coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    url    = f"{_base_url()}/route/v1/driving/{coords}"
    params = {"overview": "false", "steps": "false"}

    osrm_err = None
    try:
        response = requests.get(url, params=params, timeout=_timeout())
        response.raise_for_status()
        data = response.json()

        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            return RouteResult(
                distance_m=route["distance"],
                duration_s=route["duration"],
                source="osrm",
                is_fallback=False,
            )
        else:
            osrm_err = f"OSRM returned code={data.get('code')}"
    except requests.Timeout:
        logger.warning("OSRM route request timed out for %s", coords)
        osrm_err = "Routing service timed out."
    except requests.RequestException as exc:
        logger.warning("OSRM route request failed: %s", exc)
        osrm_err = str(exc)
    except (KeyError, ValueError, IndexError) as exc:
        logger.warning("OSRM response parsing failed: %s", exc)
        osrm_err = "Unexpected OSRM response format."

    # Fallback to Haversine straight-line distance
    h_dist = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
    if h_dist is not None:
        return RouteResult(
            distance_m=h_dist,
            duration_s=None,  # Travel time is strictly unavailable for straight-line distance
            source="haversine",
            error=f"OSRM unavailable: {osrm_err}. Straight-line distance computed via Haversine.",
            is_fallback=True,
        )

    return RouteResult(
        distance_m=None,
        duration_s=None,
        source="unavailable",
        error=f"OSRM routing failed ({osrm_err}) and coordinates invalid.",
        is_fallback=False,
    )


def get_table(
    sources: list[tuple[float, float]],   # [(lat, lng), ...]
    destinations: list[tuple[float, float]],
) -> dict:
    """
    Use the OSRM Table API to calculate distances and durations from
    multiple sources to multiple destinations in one HTTP call.

    If OSRM is unavailable, times out, or fails DNS resolution, automatically
    falls back to calculating the pairwise Haversine straight-line distance
    matrix without fabricating travel times (durations remain None).
    """
    if not sources or not destinations:
        return {
            "durations": [], "distances": [], "source": "unavailable",
            "error": "Empty source or destination list.", "is_fallback": False,
        }

    # Build coordinate string: all coords together, sources first
    all_coords = sources + destinations
    coord_str  = ";".join(f"{lng},{lat}" for lat, lng in all_coords)
    src_indices = ";".join(str(i) for i in range(len(sources)))
    dst_indices = ";".join(
        str(i) for i in range(len(sources), len(all_coords))
    )

    url    = f"{_base_url()}/table/v1/driving/{coord_str}"
    params = {
        "sources":      src_indices,
        "destinations": dst_indices,
        "annotations":  "distance,duration",
    }

    osrm_err = None
    try:
        response = requests.get(url, params=params, timeout=_timeout())
        response.raise_for_status()
        data = response.json()

        if data.get("code") == "Ok":
            return {
                "durations": data.get("durations", []),
                "distances": data.get("distances", []),
                "source":    "osrm",
                "error":     None,
                "is_fallback": False,
            }
        else:
            osrm_err = f"OSRM table returned code={data.get('code')}"
    except requests.Timeout:
        logger.warning("OSRM table request timed out.")
        osrm_err = "Routing service timed out."
    except requests.RequestException as exc:
        logger.warning("OSRM table request failed: %s", exc)
        osrm_err = str(exc)
    except (KeyError, ValueError) as exc:
        logger.warning("OSRM table response parsing failed: %s", exc)
        osrm_err = "Unexpected OSRM response format."

    # Haversine straight-line fallback matrix calculation
    fallback_distances = []
    fallback_durations = []
    for s_lat, s_lng in sources:
        row_dist = []
        row_dur  = []
        for d_lat, d_lng in destinations:
            d = haversine_distance(s_lat, s_lng, d_lat, d_lng)
            row_dist.append(d)
            row_dur.append(None)  # Travel time is strictly unavailable
        fallback_distances.append(row_dist)
        fallback_durations.append(row_dur)

    return {
        "durations": fallback_durations,
        "distances": fallback_distances,
        "source":    "haversine",
        "error":     f"OSRM table unavailable: {osrm_err}. Straight-line distance computed via Haversine.",
        "is_fallback": True,
    }
