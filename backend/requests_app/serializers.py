"""
requests_app/serializers.py
"""

from rest_framework import serializers
from .models import BloodRequest, DonorResponse
from hospitals.serializers import HospitalSerializer


class BloodRequestSerializer(serializers.ModelSerializer):
    patient_name   = serializers.CharField(source="patient.get_full_name", read_only=True)
    hospital_detail = HospitalSerializer(source="hospital", read_only=True)
    is_cancellable  = serializers.BooleanField(read_only=True)
    units_still_needed = serializers.IntegerField(read_only=True)

    class Meta:
        model  = BloodRequest
        fields = [
            "id", "patient", "patient_name",
            "hospital", "hospital_detail",
            "blood_group", "units_required", "units_fulfilled", "units_still_needed",
            "urgency", "required_by", "description",
            "status", "is_cancellable",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "patient", "units_fulfilled", "status", "created_at", "updated_at",
        ]

    def create(self, validated_data):
        validated_data["patient"] = self.context["request"].user
        return super().create(validated_data)


class DonorResponseSerializer(serializers.ModelSerializer):
    donor_name    = serializers.CharField(
        source="donor.user.get_full_name", read_only=True
    )
    donor_blood_group = serializers.CharField(
        source="donor.blood_group", read_only=True
    )
    donor_city    = serializers.CharField(source="donor.city", read_only=True)

    class Meta:
        model  = DonorResponse
        fields = [
            "id", "request", "donor", "donor_name",
            "donor_blood_group", "donor_city",
            "status", "notes", "responded_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "responded_at", "created_at", "updated_at",
        ]
