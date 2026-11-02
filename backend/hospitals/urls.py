"""hospitals/urls.py – Hospital list and detail endpoints."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HospitalViewSet

router = DefaultRouter()
router.register(r"", HospitalViewSet, basename="hospital")

urlpatterns = [
    path("", include(router.urls)),
]
