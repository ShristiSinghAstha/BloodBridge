"""
Root URL configuration for BloodBridge.

All API endpoints are versioned under /api/v1/.
Django admin is available at /admin/.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

    # API v1 — each app registers its own router
    path("api/v1/auth/",          include("accounts.urls")),
    path("api/v1/donors/",        include("donors.urls")),
    path("api/v1/hospitals/",     include("hospitals.urls")),
    path("api/v1/requests/",      include("requests_app.urls")),
    path("api/v1/notifications/", include("notifications.urls")),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
