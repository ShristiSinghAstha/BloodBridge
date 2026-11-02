"""
requests_app/models.py

BloodRequest – the core entity of the platform.
DonorResponse – a donor's acceptance or rejection of a request.

Request lifecycle
─────────────────
OPEN → MATCHING → AWAITING_RESPONSE → DONOR_ACCEPTED → FULFILLED
                                                      ↘ CANCELLED / EXPIRED
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class BloodRequest(models.Model):
    """A request submitted by a patient for blood at a hospital."""

    # ── Blood groups (same as DonorProfile for consistency) ──────────────────
    class BloodGroup(models.TextChoices):
        O_POS  = "O+",  "O+"
        O_NEG  = "O-",  "O-"
        A_POS  = "A+",  "A+"
        A_NEG  = "A-",  "A-"
        B_POS  = "B+",  "B+"
        B_NEG  = "B-",  "B-"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB-"

    # ── Urgency ───────────────────────────────────────────────────────────────
    class Urgency(models.TextChoices):
        CRITICAL = "critical", "Critical (within hours)"
        HIGH     = "high",     "High (within 24 h)"
        MEDIUM   = "medium",   "Medium (within 3 days)"
        LOW      = "low",      "Low (within a week)"

    # ── Request status lifecycle ───────────────────────────────────────────────
    class Status(models.TextChoices):
        OPEN              = "open",              "Open"
        MATCHING          = "matching",          "Matching in Progress"
        AWAITING_RESPONSE = "awaiting_response", "Awaiting Donor Responses"
        DONOR_ACCEPTED    = "donor_accepted",    "Donor Accepted"
        FULFILLED         = "fulfilled",         "Fulfilled"
        CANCELLED         = "cancelled",         "Cancelled"
        EXPIRED           = "expired",           "Expired"

    # ── Relations ─────────────────────────────────────────────────────────────
    patient  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blood_requests",
        limit_choices_to={"role": "patient"},
    )
    hospital = models.ForeignKey(
        "hospitals.Hospital",
        on_delete=models.PROTECT,   # Don't delete a hospital with active requests
        related_name="blood_requests",
    )

    # ── Request details ───────────────────────────────────────────────────────
    blood_group     = models.CharField(max_length=4, choices=BloodGroup.choices)
    units_required  = models.PositiveSmallIntegerField(default=1)
    units_fulfilled = models.PositiveSmallIntegerField(default=0)
    urgency         = models.CharField(
        max_length=10,
        choices=Urgency.choices,
        default=Urgency.HIGH,
    )
    required_by     = models.DateTimeField(
        null=True, blank=True,
        help_text="Deadline for donation.",
    )
    description     = models.TextField(
        blank=True,
        help_text="Additional medical notes (visible to matched donors only).",
    )

    # ── Status ────────────────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Blood Request"
        verbose_name_plural = "Blood Requests"

    def __str__(self):
        return (
            f"[{self.status.upper()}] {self.blood_group} × {self.units_required} "
            f"@ {self.hospital.name}"
        )

    @property
    def is_cancellable(self):
        """A request can be cancelled only if it hasn't been fulfilled."""
        return self.status not in (
            self.Status.FULFILLED,
            self.Status.CANCELLED,
            self.Status.EXPIRED,
        )

    @property
    def units_still_needed(self):
        return max(0, self.units_required - self.units_fulfilled)

    def is_expired(self):
        if self.required_by and timezone.now() > self.required_by:
            return True
        return False


class DonorResponse(models.Model):
    """
    Records a donor's decision (accept/reject) for a specific BloodRequest.

    The unique_together constraint on (request, donor) prevents a donor
    from responding to the same request twice.
    """

    class ResponseStatus(models.TextChoices):
        PENDING   = "pending",   "Pending"
        ACCEPTED  = "accepted",  "Accepted"
        REJECTED  = "rejected",  "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"
        COMPLETED = "completed", "Donation Completed"

    request = models.ForeignKey(
        BloodRequest,
        on_delete=models.CASCADE,
        related_name="donor_responses",
    )
    donor   = models.ForeignKey(
        "donors.DonorProfile",
        on_delete=models.CASCADE,
        related_name="responses",
    )
    status  = models.CharField(
        max_length=15,
        choices=ResponseStatus.choices,
        default=ResponseStatus.PENDING,
    )
    notes           = models.TextField(blank=True)
    responded_at    = models.DateTimeField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("request", "donor")]   # Prevents duplicate responses
        ordering = ["-created_at"]
        verbose_name = "Donor Response"
        verbose_name_plural = "Donor Responses"

    def __str__(self):
        return (
            f"{self.donor.user.get_full_name()} → "
            f"Request #{self.request_id} [{self.status}]"
        )
