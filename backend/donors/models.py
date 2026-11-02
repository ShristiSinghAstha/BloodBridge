"""
donors/models.py

DonorProfile – one-to-one extension of the User model.

Design decisions
────────────────
- Blood group is stored as a short text choice for readability.
- Coordinates (latitude/longitude) are stored as DecimalFields with
  enough precision for geographic matching.
- verification_status separates the platform's review from the donor's
  self-reported availability. A donor who claims to be available but
  is not verified is still filtered by the matching service.
- last_donation_date is used by the eligibility engine to enforce the
  8-week (56-day) minimum donation interval recommended by health
  authorities. This is a GUIDELINE only; final clearance rests with
  healthcare professionals.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class DonorProfile(models.Model):
    """Extended profile for users with role=donor."""

    # ── Blood groups ──────────────────────────────────────────────────────────
    class BloodGroup(models.TextChoices):
        O_POS  = "O+",  "O+"
        O_NEG  = "O-",  "O-"
        A_POS  = "A+",  "A+"
        A_NEG  = "A-",  "A-"
        B_POS  = "B+",  "B+"
        B_NEG  = "B-",  "B-"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB-"

    # ── Availability ──────────────────────────────────────────────────────────
    class Availability(models.TextChoices):
        AVAILABLE   = "available",   "Available"
        UNAVAILABLE = "unavailable", "Unavailable"
        BUSY        = "busy",        "Temporarily Busy"

    # ── Verification ──────────────────────────────────────────────────────────
    class VerificationStatus(models.TextChoices):
        PENDING   = "pending",   "Pending Review"
        VERIFIED  = "verified",  "Verified"
        REJECTED  = "rejected",  "Rejected"
        SUSPENDED = "suspended", "Suspended"

    # ── Relations ─────────────────────────────────────────────────────────────
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="donor_profile",
    )

    # ── Medical info ──────────────────────────────────────────────────────────
    blood_group        = models.CharField(max_length=4, choices=BloodGroup.choices)
    date_of_birth      = models.DateField(
        null=True, blank=True,
        help_text="Used to estimate age for eligibility checks. Not exposed publicly.",
    )
    last_donation_date = models.DateField(
        null=True, blank=True,
        help_text="Last confirmed whole-blood donation date.",
    )

    # ── Location ──────────────────────────────────────────────────────────────
    address  = models.TextField(blank=True)
    city     = models.CharField(max_length=100, blank=True)
    state    = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )

    # ── Status ────────────────────────────────────────────────────────────────
    availability        = models.CharField(
        max_length=15,
        choices=Availability.choices,
        default=Availability.AVAILABLE,
    )
    verification_status = models.CharField(
        max_length=15,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    is_profile_complete = models.BooleanField(default=False)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Donor Profile"
        verbose_name_plural = "Donor Profiles"

    def __str__(self):
        return f"{self.user.get_full_name()} – {self.blood_group}"

    @property
    def has_coordinates(self):
        """True only when both lat and lng are stored."""
        return self.latitude is not None and self.longitude is not None

    @property
    def days_since_last_donation(self):
        """Returns integer days or None if never donated."""
        if not self.last_donation_date:
            return None
        return (timezone.now().date() - self.last_donation_date).days

    @property
    def is_eligible_by_interval(self):
        """
        Enforces the 56-day (8-week) minimum between whole-blood donations.
        Returns True if eligible or if no prior donation is recorded.
        This is a platform guideline only — not a medical decision.
        """
        days = self.days_since_last_donation
        if days is None:
            return True  # No history → assume eligible
        return days >= 56


class DonationHistory(models.Model):
    """Record of a completed or in-progress donation event."""

    class DonationStatus(models.TextChoices):
        SCHEDULED  = "scheduled",  "Scheduled"
        COMPLETED  = "completed",  "Completed"
        CANCELLED  = "cancelled",  "Cancelled"
        NO_SHOW    = "no_show",    "No Show"

    donor   = models.ForeignKey(
        DonorProfile,
        on_delete=models.CASCADE,
        related_name="donation_history",
    )
    request = models.ForeignKey(
        "requests_app.BloodRequest",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="donation_records",
    )
    hospital = models.ForeignKey(
        "hospitals.Hospital",
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    donation_date     = models.DateField()
    status            = models.CharField(
        max_length=15,
        choices=DonationStatus.choices,
        default=DonationStatus.SCHEDULED,
    )
    is_verified       = models.BooleanField(
        default=False,
        help_text="Set by admin/staff after the donation is confirmed.",
    )
    notes             = models.TextField(blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-donation_date"]
        verbose_name = "Donation Record"
        verbose_name_plural = "Donation Records"

    def __str__(self):
        return f"{self.donor} – {self.donation_date} ({self.status})"
