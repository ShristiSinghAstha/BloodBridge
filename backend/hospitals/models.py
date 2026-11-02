"""
hospitals/models.py

Hospital – locations where blood donations and transfusions occur.

Hospitals are managed by administrators and selected by patients
when submitting a blood request.
"""

from django.db import models


class Hospital(models.Model):
    """A hospital or medical facility registered on the platform."""

    name    = models.CharField(max_length=200, unique=True)
    address = models.TextField()
    city    = models.CharField(max_length=100, db_index=True)
    state   = models.CharField(max_length=100)
    country = models.CharField(max_length=100, default="India")
    phone   = models.CharField(max_length=20, blank=True)
    email   = models.EmailField(blank=True)

    # ── Geographic coordinates ────────────────────────────────────────────────
    latitude  = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )

    # ── Status ────────────────────────────────────────────────────────────────
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive hospitals are hidden from patients.",
    )
    is_verified = models.BooleanField(default=False)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Hospital"
        verbose_name_plural = "Hospitals"

    def __str__(self):
        return f"{self.name} – {self.city}"

    @property
    def has_coordinates(self):
        return self.latitude is not None and self.longitude is not None
