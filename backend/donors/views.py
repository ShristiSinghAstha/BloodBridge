"""
donors/views.py
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsDonor, IsDonorOrAdmin, IsAdminUser
from .models import DonorProfile, DonationHistory
from .serializers import (
    DonorProfileSerializer,
    DonorProfileWriteSerializer,
    DonationHistorySerializer,
)


class DonorProfileViewSet(viewsets.ModelViewSet):
    """
    CRUD for donor profiles.
    - GET list:   admin only (contains sensitive fields)
    - GET detail: owner or admin
    - POST:       donor only (creates their own profile)
    - PATCH/PUT:  owner or admin
    """

    queryset = DonorProfile.objects.select_related("user").order_by("-created_at")

    def get_permissions(self):
        if self.action in ("list",):
            return [IsAdminUser()]
        if self.action in ("create",):
            return [IsDonor()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return DonorProfileWriteSerializer
        return DonorProfileSerializer

    def perform_create(self, serializer):
        existing = DonorProfile.objects.filter(user=self.request.user).first()
        if existing:
            for attr, val in serializer.validated_data.items():
                setattr(existing, attr, val)
            existing.save()
            serializer.instance = existing
        else:
            serializer.save(user=self.request.user)

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return super().get_queryset()
        # Donors see only their own profile
        return super().get_queryset().filter(user=user)

    @action(detail=False, methods=["get", "patch"],
            permission_classes=[IsDonor], url_path="me")
    def my_profile(self, request):
        """GET or PATCH the current donor's own profile."""
        profile, _ = DonorProfile.objects.get_or_create(user=request.user)
        if request.method == "GET":
            return Response(DonorProfileSerializer(profile).data)
        serializer = DonorProfileWriteSerializer(
            profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DonorProfileSerializer(profile).data)

    @action(detail=False, methods=["patch"],
            permission_classes=[IsDonor], url_path="availability")
    def set_availability(self, request):
        """PATCH /api/v1/donors/profiles/availability/ – toggle availability."""
        profile, _ = DonorProfile.objects.get_or_create(user=request.user)
        new_status = request.data.get("availability")
        if new_status not in DonorProfile.Availability.values:
            return Response(
                {"availability": f"Must be one of {DonorProfile.Availability.values}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.availability = new_status
        profile.save(update_fields=["availability", "updated_at"])
        return Response({"availability": profile.availability})


class DonationHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Donation history — donors see their own, admins see all."""

    serializer_class   = DonationHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return DonationHistory.objects.select_related(
                "donor__user", "hospital", "request"
            ).all()
        return DonationHistory.objects.filter(
            donor__user=user
        ).select_related("hospital", "request")
