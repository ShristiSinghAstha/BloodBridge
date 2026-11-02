"""
hospitals/serializers.py
"""

from rest_framework import serializers
from .models import Hospital


class HospitalSerializer(serializers.ModelSerializer):
    has_coordinates = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Hospital
        fields = [
            "id", "name", "address", "city", "state", "country",
            "phone", "email", "latitude", "longitude",
            "has_coordinates", "is_active", "is_verified",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
