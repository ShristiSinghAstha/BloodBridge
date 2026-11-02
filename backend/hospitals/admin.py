"""
hospitals/admin.py
"""

from django.contrib import admin
from .models import Hospital


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display  = ("name", "city", "state", "is_active", "is_verified", "created_at")
    list_filter   = ("is_active", "is_verified", "city")
    search_fields = ("name", "city", "state")
    readonly_fields = ("created_at", "updated_at")
