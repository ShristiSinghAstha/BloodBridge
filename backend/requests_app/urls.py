"""requests_app/urls.py – Blood request and donor response endpoints."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BloodRequestViewSet, DonorResponseViewSet

router = DefaultRouter()
router.register(r"blood",     BloodRequestViewSet,  basename="blood-request")
router.register(r"responses", DonorResponseViewSet, basename="donor-response")

urlpatterns = [
    path("", include(router.urls)),
]
