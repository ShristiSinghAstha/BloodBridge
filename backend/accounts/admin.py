"""
accounts/admin.py

Register the custom User model with Django's admin so it appears
in the /admin/ interface alongside the default user management UI.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Extends the built-in UserAdmin to handle our email-based login
    and role field.
    """

    # ── List view ─────────────────────────────────────────────────────────────
    list_display   = ("email", "first_name", "last_name", "role", "is_active", "date_joined")
    list_filter    = ("role", "is_active", "is_staff")
    search_fields  = ("email", "first_name", "last_name", "phone")
    ordering       = ("-date_joined",)

    # ── Detail view fieldsets ─────────────────────────────────────────────────
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal Info", {"fields": ("first_name", "last_name", "phone")}),
        ("Role & Permissions", {
            "fields": ("role", "is_active", "is_staff", "is_superuser",
                       "groups", "user_permissions"),
        }),
        ("Important Dates", {"fields": ("last_login", "date_joined")}),
    )

    # ── Add user form ─────────────────────────────────────────────────────────
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "first_name", "last_name", "role", "password1", "password2"),
        }),
    )
