"""
accounts/urls.py

Maps URL patterns to the views in this app.
All paths here are relative to the prefix /api/v1/auth/
defined in config/urls.py.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import RegisterView, LogoutView, MeView, ChangePasswordView

urlpatterns = [
    # Registration – POST only
    path("register/",        RegisterView.as_view(),      name="auth-register"),

    # Login – POST; returns access + refresh tokens
    path("login/",           TokenObtainPairView.as_view(), name="auth-login"),

    # Token refresh – POST { "refresh": "..." } → { "access": "..." }
    path("token/refresh/",   TokenRefreshView.as_view(),  name="auth-token-refresh"),

    # Logout – POST { "refresh": "..." }
    path("logout/",          LogoutView.as_view(),        name="auth-logout"),

    # Current user – GET / PATCH
    path("me/",              MeView.as_view(),            name="auth-me"),

    # Change password – POST
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
]
