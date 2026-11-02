"""
donors/admin.py – Django admin for donor models.
"""

from django.contrib import admin
from .models import DonorProfile, DonationHistory


@admin.register(DonorProfile)
class DonorProfileAdmin(admin.ModelAdmin):
    list_display  = ("user", "blood_group", "city", "availability",
                      "verification_status", "is_profile_complete", "updated_at")
    list_filter   = ("blood_group", "availability", "verification_status")
    search_fields = ("user__email", "user__first_name", "user__last_name", "city")
    readonly_fields = ("created_at", "updated_at")
    actions       = ["verify_donors", "reject_donors"]

    @admin.action(description="Mark selected donors as Verified")
    def verify_donors(self, request, queryset):
        queryset.update(verification_status=DonorProfile.VerificationStatus.VERIFIED)

    @admin.action(description="Mark selected donors as Rejected")
    def reject_donors(self, request, queryset):
        queryset.update(verification_status=DonorProfile.VerificationStatus.REJECTED)


@admin.register(DonationHistory)
class DonationHistoryAdmin(admin.ModelAdmin):
    list_display  = ("donor", "donation_date", "status", "is_verified", "hospital")
    list_filter   = ("status", "is_verified")
    search_fields = ("donor__user__email",)
