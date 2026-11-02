"""
accounts/views.py

Authentication and profile endpoints.

Endpoints
─────────
POST   /api/v1/auth/register/          – create a new account
POST   /api/v1/auth/login/             – obtain JWT access + refresh tokens
POST   /api/v1/auth/token/refresh/     – rotate access token using refresh token
POST   /api/v1/auth/logout/            – blacklist the refresh token
GET    /api/v1/auth/me/                – current user's profile
PATCH  /api/v1/auth/me/                – update name / phone
POST   /api/v1/auth/change-password/   – change password
"""

from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from .serializers import RegisterSerializer, UserSerializer, ChangePasswordSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """
    POST /api/v1/auth/register/
    Anyone can register (no authentication required).
    Returns 201 with the new user's data on success.
    """

    queryset         = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Return JWT tokens immediately after registration so the
        # user doesn't have to log in separately.
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user":    UserSerializer(user, context={"request": request}).data,
                "tokens": {
                    "access":  str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklists the provided refresh token so it cannot be used again.
    The access token expires naturally (short-lived by design).
    Body: { "refresh": "<refresh_token>" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"detail": "Refresh token is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()   # marks the token as used
            return Response({"detail": "Logged out successfully."})
        except (TokenError, InvalidToken) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/v1/auth/me/  – returns the current user's data
    PATCH /api/v1/auth/me/  – updates first_name, last_name, phone
    """

    serializer_class   = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # The object is always the authenticated user; no pk in the URL.
        return self.request.user

    def update(self, request, *args, **kwargs):
        # Force partial updates (PATCH); do not require all fields.
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)


class ChangePasswordView(generics.UpdateAPIView):
    """
    POST /api/v1/auth/change-password/
    Requires old_password and new_password in the body.
    """

    serializer_class   = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = self.get_object()
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Password changed successfully."})
