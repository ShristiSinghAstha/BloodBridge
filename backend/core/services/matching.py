"""
core/services/matching.py

Donor Matching Service.

Orchestrates the complete pipeline:
  1. Validate the blood request
  2. Find compatible blood groups
  3. Retrieve verified, available donors
  4. Apply eligibility filters (last donation interval)
  5. Get road distances via OSRM Table API (best-effort)
  6. Rank candidates
  7. Return annotated candidate list

This module is intentionally stateless — it reads from the database
but does not modify it.  Callers (views / signals) are responsible for
persisting DonorResponse objects and sending notifications.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from donors.models import DonorProfile
from .compatibility import compatible_donor_groups
from .routing import get_table

logger = logging.getLogger(__name__)


@dataclass
class DonorCandidate:
    """
    Represents a single donor candidate returned by the matching service.
    """

    profile: DonorProfile

    # Routing data (populated by OSRM or Haversine straight-line fallback)
    distance_m: Optional[float] = None
    duration_s: Optional[float] = None
    routing_available: bool = False
    routing_error: Optional[str] = None
    routing_source: str = "unavailable"
    is_fallback: bool = False

    @property
    def distance_km(self):
        if self.distance_m is None:
            return None
        return round(self.distance_m / 1000, 2)

    @property
    def duration_min(self):
        if self.duration_s is None:
            return None
        return round(self.duration_s / 60, 1)

    @property
    def sort_key(self):
        """
        Rank donors by:
          1. Road travel duration (if OSRM route available)
          2. Straight-line distance (if Haversine fallback available)
          3. Donors without coordinate data go to the end
        """
        if self.routing_source == "osrm" and self.duration_s is not None:
            return (0, self.duration_s, self.distance_m or 0)
        elif self.distance_m is not None:
            return (1, self.distance_m, 0)
        else:
            return (2, float("inf"), float("inf"))


def find_matching_donors(
    blood_request,
    require_verified: bool = True,
    max_candidates: int = 50,
) -> list[DonorCandidate]:
    """
    Find and rank donor candidates for a BloodRequest.

    Parameters
    ──────────
    blood_request    – a BloodRequest instance
    require_verified – if True, only verified donors are considered
    max_candidates   – maximum number of candidates to return

    Returns
    ───────
    Sorted list of DonorCandidate objects, best matches first.
    The list may be empty if no eligible donors are found.

    Routing failures never prevent matching from returning results —
    they are logged and reflected in the DonorCandidate.routing_error field.
    """
    recipient_group = blood_request.blood_group
    hospital        = blood_request.hospital

    # ── Step 1: Blood group compatibility ────────────────────────────────────
    compatible_groups = compatible_donor_groups(recipient_group)
    logger.info(
        "Matching request #%s (%s): compatible donor groups: %s",
        blood_request.pk, recipient_group, compatible_groups,
    )

    # ── Step 2: Database query ────────────────────────────────────────────────
    queryset = DonorProfile.objects.select_related("user").filter(
        blood_group__in=compatible_groups,
        availability=DonorProfile.Availability.AVAILABLE,
        user__is_active=True,
    )

    if require_verified:
        queryset = queryset.filter(
            verification_status=DonorProfile.VerificationStatus.VERIFIED
        )

    donors = list(queryset[:max_candidates * 2])   # Fetch extra before eligibility filter

    # ── Step 3: Eligibility filter (donation interval) ────────────────────────
    eligible = [d for d in donors if d.is_eligible_by_interval]

    # ── Step 4: OSRM road distance (Table API) ────────────────────────────────
    candidates = _annotate_with_routing(eligible, hospital)

    # ── Step 5: Rank and truncate ─────────────────────────────────────────────
    candidates.sort(key=lambda c: c.sort_key)
    return candidates[:max_candidates]


def _annotate_with_routing(
    donors: list[DonorProfile],
    hospital,
) -> list[DonorCandidate]:
    """
    Annotate each donor with road distance and duration from their
    location to the hospital, using the OSRM Table API.

    Donors without coordinates receive routing_available=False.
    If OSRM fails entirely, all candidates still return with routing_available=False.
    """
    # Separate donors with and without coordinates
    with_coords    = [(d, (float(d.latitude), float(d.longitude)))
                      for d in donors if d.has_coordinates]
    without_coords = [d for d in donors if not d.has_coordinates]

    candidates_without = [
        DonorCandidate(
            profile=d,
            routing_available=False,
            routing_error="Donor location not available.",
        )
        for d in without_coords
    ]

    if not with_coords or not hospital.has_coordinates:
        reason = (
            "Hospital location not available."
            if not hospital.has_coordinates
            else "No donor coordinates available."
        )
        return candidates_without + [
            DonorCandidate(profile=d, routing_available=False, routing_error=reason)
            for d, _ in with_coords
        ]

    # All donors as sources; hospital as single destination
    sources      = [coords for _, coords in with_coords]
    destinations = [(float(hospital.latitude), float(hospital.longitude))]

    table_result = get_table(sources, destinations)

    candidates_with = []
    for i, (donor, _) in enumerate(with_coords):
        src = table_result.get("source")
        if src == "osrm":
            try:
                duration = table_result["durations"][i][0]
                distance = table_result["distances"][i][0]
                candidates_with.append(DonorCandidate(
                    profile=donor,
                    distance_m=distance,
                    duration_s=duration,
                    routing_available=(duration is not None),
                    routing_source="osrm",
                    routing_error=None if duration is not None else "No road route found.",
                    is_fallback=False,
                ))
            except (IndexError, TypeError) as exc:
                logger.warning("Routing data missing for donor %s: %s", donor.pk, exc)
                candidates_with.append(DonorCandidate(
                    profile=donor,
                    routing_available=False,
                    routing_source="unavailable",
                    routing_error="Routing data incomplete.",
                    is_fallback=False,
                ))
        elif src == "haversine":
            try:
                distance = table_result["distances"][i][0]
                candidates_with.append(DonorCandidate(
                    profile=donor,
                    distance_m=distance,
                    duration_s=None,
                    routing_available=False,
                    routing_source="haversine",
                    routing_error="OSRM unavailable; straight-line distance computed via Haversine.",
                    is_fallback=True,
                ))
            except (IndexError, TypeError) as exc:
                candidates_with.append(DonorCandidate(
                    profile=donor,
                    routing_available=False,
                    routing_source="unavailable",
                    routing_error="Fallback distance calculation error.",
                    is_fallback=False,
                ))
        else:
            candidates_with.append(DonorCandidate(
                profile=donor,
                routing_available=False,
                routing_source="unavailable",
                routing_error=table_result.get("error", "Routing unavailable."),
                is_fallback=False,
            ))

    return candidates_with + candidates_without
