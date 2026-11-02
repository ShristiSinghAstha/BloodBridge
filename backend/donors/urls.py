"""donors/urls.py – Donor profile and matching endpoints."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DonorProfileViewSet, DonationHistoryViewSet

router = DefaultRouter()
router.register(r"profiles",  DonorProfileViewSet,     basename="donor-profile")
router.register(r"history",   DonationHistoryViewSet,  basename="donation-history")

urlpatterns = [
    path("", include(router.urls)),
]
