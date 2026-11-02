"""
donors/serializers.py
"""

from rest_framework import serializers
from .models import DonorProfile, DonationHistory


class DonorProfileSerializer(serializers.ModelSerializer):
    user_email    = serializers.EmailField(source="user.email",      read_only=True)
    user_name     = serializers.CharField(source="user.get_full_name", read_only=True)
    has_coordinates = serializers.BooleanField(read_only=True)
    days_since_last_donation = serializers.IntegerField(read_only=True)
    is_eligible_by_interval  = serializers.BooleanField(read_only=True)

    class Meta:
        model  = DonorProfile
        fields = [
            "id", "user_email", "user_name",
            "blood_group", "city", "state",
            "availability", "verification_status",
            "is_profile_complete", "has_coordinates",
            "last_donation_date", "days_since_last_donation",
            "is_eligible_by_interval",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "verification_status", "created_at", "updated_at"]


class DonorProfileWriteSerializer(serializers.ModelSerializer):
    """Used for CREATE / UPDATE operations. Includes sensitive fields."""

    class Meta:
        model  = DonorProfile
        fields = [
            "id", "blood_group", "date_of_birth",
            "address", "city", "state",
            "latitude", "longitude",
            "availability", "verification_status", "last_donation_date",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        # Prevent non-admin donors from self-verifying
        if "verification_status" in attrs:
            is_admin_user = bool(user and (user.is_staff or getattr(user, "is_admin", False)))
            if not is_admin_user:
                raise serializers.ValidationError(
                    {"verification_status": "Only administrators can change verification status."}
                )

        # Mark profile complete when essential fields are present
        bg = attrs.get("blood_group") or (self.instance.blood_group if self.instance else None)
        city = attrs.get("city") or (self.instance.city if self.instance else None)
        attrs["is_profile_complete"] = bool(bg and city)
        return attrs


class DonationHistorySerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source="donor.user.get_full_name", read_only=True)

    class Meta:
        model  = DonationHistory
        fields = [
            "id", "donor", "donor_name", "request", "hospital",
            "donation_date", "status", "is_verified", "notes", "created_at",
        ]
        read_only_fields = ["id", "is_verified", "created_at"]
