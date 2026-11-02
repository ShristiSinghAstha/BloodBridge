"""
accounts/tests.py

Tests for user registration, login, JWT token flow, and permissions.
"""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class RegistrationTests(APITestCase):
    """Test the POST /api/v1/auth/register/ endpoint."""

    url = "/api/v1/auth/register/"

    def test_patient_registration_succeeds(self):
        payload = {
            "email":      "patient@test.com",
            "first_name": "Alice",
            "last_name":  "Smith",
            "password":   "SecurePass123!",
            "password2":  "SecurePass123!",
            "role":       "patient",
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("tokens", response.data)
        self.assertIn("access", response.data["tokens"])
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["role"], "patient")

    def test_donor_registration_succeeds(self):
        payload = {
            "email":      "donor@test.com",
            "first_name": "Bob",
            "last_name":  "Jones",
            "password":   "SecurePass123!",
            "password2":  "SecurePass123!",
            "role":       "donor",
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_self_registration_forbidden(self):
        payload = {
            "email":      "admin@test.com",
            "first_name": "Eve",
            "last_name":  "Admin",
            "password":   "SecurePass123!",
            "password2":  "SecurePass123!",
            "role":       "admin",
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_mismatch_rejected(self):
        payload = {
            "email":      "x@test.com",
            "first_name": "X",
            "last_name":  "Y",
            "password":   "SecurePass123!",
            "password2":  "WrongPass!",
            "role":       "patient",
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_email_rejected(self):
        User.objects.create_user(
            email="dup@test.com",
            password="Pass123!",
            first_name="A", last_name="B",
        )
        payload = {
            "email":      "dup@test.com",
            "first_name": "A",
            "last_name":  "B",
            "password":   "Pass123!",
            "password2":  "Pass123!",
            "role":       "patient",
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_ignores_stale_bearer_token(self):
        """Verifies fix: RegisterView has authentication_classes = [] so stale Bearer tokens don't 401."""
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid-or-expired-token")
        payload = {
            "email":      "stale_header_test@test.com",
            "first_name": "Stale",
            "last_name":  "TokenUser",
            "password":   "SecurePass123!",
            "password2":  "SecurePass123!",
            "role":       "patient",
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("tokens", response.data)
        self.assertEqual(response.data["user"]["role"], "patient")


class LoginTests(APITestCase):
    """Test JWT login via POST /api/v1/auth/login/."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="login@test.com",
            password="Secure123!",
            first_name="Test", last_name="User",
            role="patient",
        )

    def test_login_returns_tokens(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "login@test.com", "password": "Secure123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_wrong_password_rejected(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "login@test.com", "password": "WrongPass!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileTests(APITestCase):
    """Test GET/PATCH /api/v1/auth/me/."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="me@test.com",
            password="Secure123!",
            first_name="Me", last_name="User",
            role="patient",
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_me_returns_current_user(self):
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "me@test.com")

    def test_unauthenticated_me_rejected(self):
        self.client.credentials()   # Clear credentials
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_updates_phone(self):
        response = self.client.patch(
            "/api/v1/auth/me/",
            {"phone": "9876543210"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "9876543210")
