"""
requests_app/admin.py
"""

from django.contrib import admin
from .models import BloodRequest, DonorResponse


@admin.register(BloodRequest)
class BloodRequestAdmin(admin.ModelAdmin):
    list_display  = ("id", "blood_group", "units_required", "hospital",
                      "urgency", "status", "patient", "created_at")
    list_filter   = ("status", "blood_group", "urgency")
    search_fields = ("patient__email", "hospital__name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(DonorResponse)
class DonorResponseAdmin(admin.ModelAdmin):
    list_display  = ("donor", "request", "status", "responded_at", "created_at")
    list_filter   = ("status",)
    search_fields = ("donor__user__email",)
