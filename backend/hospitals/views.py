"""
hospitals/views.py
"""

from rest_framework import viewsets, permissions, filters
from accounts.permissions import IsAdminUser
from .models import Hospital
from .serializers import HospitalSerializer


class HospitalViewSet(viewsets.ModelViewSet):
    """
    GET (list, retrieve) – any authenticated user
    POST / PUT / PATCH / DELETE – admin only
    Supports ?search=<city|name> query param.
    """

    queryset           = Hospital.objects.filter(is_active=True)
    serializer_class   = HospitalSerializer
    filter_backends    = [filters.SearchFilter]
    search_fields      = ["name", "city", "state"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminUser()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        """Admins see inactive hospitals too."""
        user = self.request.user
        if user.is_authenticated and getattr(user, "is_admin", False):
            return Hospital.objects.all()
        return Hospital.objects.filter(is_active=True)
