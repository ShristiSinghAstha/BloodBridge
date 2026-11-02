"""
notifications/models.py

Notification – in-app alerts delivered to users when important events occur.

Events that generate notifications
───────────────────────────────────
- A donor is matched to a new blood request
- A donor accepts/rejects a request
- A request status changes
- A donor's verification status changes
"""

from django.conf import settings
from django.db import models


class Notification(models.Model):
    """An in-app notification for any platform user."""

    class NotificationType(models.TextChoices):
        REQUEST_MATCHED    = "request_matched",    "New Matching Request"
        DONOR_RESPONDED    = "donor_responded",    "Donor Responded"
        REQUEST_FULFILLED  = "request_fulfilled",  "Request Fulfilled"
        REQUEST_CANCELLED  = "request_cancelled",  "Request Cancelled"
        VERIFICATION_UPDATE = "verification_update", "Verification Status Updated"
        SYSTEM             = "system",             "System Message"

    recipient    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(
        max_length=25,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
    )
    title        = models.CharField(max_length=200)
    message      = models.TextField()
    is_read      = models.BooleanField(default=False, db_index=True)

    # Optional foreign key to the related request (for deep linking)
    related_request = models.ForeignKey(
        "requests_app.BloodRequest",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="notifications",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        status = "✓" if self.is_read else "●"
        return f"{status} [{self.notification_type}] → {self.recipient.email}"
