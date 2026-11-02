"""
core/services/compatibility.py

Blood Group Compatibility Service.

This service encodes standard ABO/Rh red blood cell compatibility rules
for WHOLE BLOOD and RED BLOOD CELL (RBC) transfusion matching.

⚠️  IMPORTANT DISCLAIMER  ⚠️
──────────────────────────────
These rules apply specifically to red blood cell (RBC) compatibility for
DONATION MATCHING PURPOSES ONLY.

Plasma, platelets, and other blood components have DIFFERENT compatibility
requirements that are NOT handled here.

Final transfusion compatibility and donor eligibility MUST be confirmed
by qualified healthcare professionals and appropriate laboratory testing
(cross-matching, antibody screening, etc.).

This application identifies POTENTIAL donors — it does NOT make clinical
transfusion decisions.

ABO/Rh Compatibility Reference (RBC Transfusion)
─────────────────────────────────────────────────
Recipient → Compatible Donors (can receive FROM)
  O-   → O-
  O+   → O+, O-
  A-   → A-, O-
  A+   → A+, A-, O+, O-
  B-   → B-, O-
  B+   → B+, B-, O+, O-
  AB-  → AB-, A-, B-, O-
  AB+  → AB+, AB-, A+, A-, B+, B-, O+, O- (universal recipient)

Source: Standard medical reference for ABO/Rh blood group compatibility.
"""

from typing import FrozenSet

# All valid blood group strings used on the platform
VALID_BLOOD_GROUPS: FrozenSet[str] = frozenset({
    "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"
})

# Compatibility map: recipient blood group → set of donor blood groups that can donate to them
# This represents the "can receive FROM" direction.
_RECIPIENT_CAN_RECEIVE_FROM: dict[str, FrozenSet[str]] = {
    "O-":  frozenset({"O-"}),
    "O+":  frozenset({"O+", "O-"}),
    "A-":  frozenset({"A-", "O-"}),
    "A+":  frozenset({"A+", "A-", "O+", "O-"}),
    "B-":  frozenset({"B-", "O-"}),
    "B+":  frozenset({"B+", "B-", "O+", "O-"}),
    "AB-": frozenset({"AB-", "A-", "B-", "O-"}),
    "AB+": frozenset({"AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"}),
}

# Invert map: donor blood group → set of recipient blood groups they can donate TO
_DONOR_CAN_DONATE_TO: dict[str, FrozenSet[str]] = {
    "O-":  frozenset({"O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"}),  # Universal donor (RBC)
    "O+":  frozenset({"O+", "A+", "B+", "AB+"}),
    "A-":  frozenset({"A-", "A+", "AB-", "AB+"}),
    "A+":  frozenset({"A+", "AB+"}),
    "B-":  frozenset({"B-", "B+", "AB-", "AB+"}),
    "B+":  frozenset({"B+", "AB+"}),
    "AB-": frozenset({"AB-", "AB+"}),
    "AB+": frozenset({"AB+"}),
}


def validate_blood_group(blood_group: str) -> str:
    """
    Normalise and validate a blood group string.
    Raises ValueError for invalid input.
    """
    normalised = blood_group.strip().upper().replace("POSITIVE", "+").replace("NEGATIVE", "-")
    if normalised not in VALID_BLOOD_GROUPS:
        raise ValueError(
            f"'{blood_group}' is not a recognised blood group. "
            f"Valid values: {sorted(VALID_BLOOD_GROUPS)}"
        )
    return normalised


def compatible_donor_groups(recipient_blood_group: str) -> FrozenSet[str]:
    """
    Return the set of donor blood groups that are compatible with a
    given recipient blood group (for RBC / whole-blood purposes).

    Example:
      compatible_donor_groups("A+") → frozenset({"A+", "A-", "O+", "O-"})

    Raises ValueError if recipient_blood_group is not recognised.
    """
    group = validate_blood_group(recipient_blood_group)
    return _RECIPIENT_CAN_RECEIVE_FROM[group]


def is_compatible(donor_blood_group: str, recipient_blood_group: str) -> bool:
    """
    Return True if a donor with donor_blood_group can donate RBCs to a
    recipient with recipient_blood_group.

    Raises ValueError if either group is not recognised.
    """
    donor_group     = validate_blood_group(donor_blood_group)
    recipient_group = validate_blood_group(recipient_blood_group)
    return donor_group in _RECIPIENT_CAN_RECEIVE_FROM[recipient_group]


def recipient_groups_for_donor(donor_blood_group: str) -> FrozenSet[str]:
    """
    Return the set of recipient blood groups that a given donor can donate to.

    Example:
      recipient_groups_for_donor("O-") → frozenset({"O-","O+","A-","A+","B-","B+","AB-","AB+"})
    """
    group = validate_blood_group(donor_blood_group)
    return _DONOR_CAN_DONATE_TO[group]
