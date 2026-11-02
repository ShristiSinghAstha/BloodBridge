"""
donors/tests.py

Comprehensive tests for DonorProfile, verification permissions,
availability toggles, and admin moderation.
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from donors.models import DonorProfile

User = get_user_model()


class DonorProfileTests(APITestCase):
    def setUp(self):
        self.donor_user = User.objects.create_user(
            email="donor_unit@test.com",
            password="SecurePass123!",
            first_name="Unit",
            last_name="Donor",
            role="donor",
        )
        self.other_donor = User.objects.create_user(
            email="other_donor@test.com",
            password="SecurePass123!",
            first_name="Other",
            last_name="Donor",
            role="donor",
        )
        self.admin_user = User.objects.create_superuser(
            email="admin_unit@test.com",
            password="AdminPass123!",
            first_name="Admin",
            last_name="Unit",
        )
        self.patient_user = User.objects.create_user(
            email="patient_unit@test.com",
            password="PatientPass123!",
            first_name="Patient",
            last_name="Unit",
            role="patient",
        )

        self.donor_token = str(RefreshToken.for_user(self.donor_user).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin_user).access_token)
        self.patient_token = str(RefreshToken.for_user(self.patient_user).access_token)

    def test_donor_create_profile(self):
        """Donor can create their profile."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.donor_token}")
        payload = {
            "blood_group": "O+",
            "city": "Bangalore",
            "state": "Karnataka",
            "availability": "available",
        }
        response = self.client.post("/api/v1/donors/profiles/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        profile = DonorProfile.objects.get(user=self.donor_user)
        self.assertEqual(profile.blood_group, "O+")
        self.assertEqual(profile.city, "Bangalore")
        self.assertEqual(profile.verification_status, "pending")

    def test_donor_cannot_self_verify(self):
        """Regular donor cannot set verification_status to 'verified'."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.donor_token}")
        payload = {
            "blood_group": "A+",
            "city": "Mysore",
            "state": "Karnataka",
            "verification_status": "verified",
        }
        response = self.client.post("/api/v1/donors/profiles/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("verification_status", response.data)

    def test_admin_can_verify_donor(self):
        """Admin can update verification_status of a donor."""
        profile = DonorProfile.objects.create(
            user=self.donor_user,
            blood_group="B+",
            city="Bangalore",
            state="Karnataka",
            verification_status="pending",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        response = self.client.patch(
            f"/api/v1/donors/profiles/{profile.id}/",
            {"verification_status": "verified"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.verification_status, "verified")

    def test_donor_list_requires_admin(self):
        """Non-admin cannot list all donor profiles (HTTP 403)."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.donor_token}")
        response = self.client.get("/api/v1/donors/profiles/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        response = self.client.get("/api/v1/donors/profiles/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        response = self.client.get("/api/v1/donors/profiles/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_donor_availability_toggle(self):
        """Donor can toggle availability via /me/availability/."""
        DonorProfile.objects.create(
            user=self.donor_user,
            blood_group="AB+",
            city="Bangalore",
            state="Karnataka",
            availability="available",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.donor_token}")
        response = self.client.patch(
            "/api/v1/donors/profiles/availability/",
            {"availability": "busy"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = DonorProfile.objects.get(user=self.donor_user)
        self.assertEqual(profile.availability, "busy")
