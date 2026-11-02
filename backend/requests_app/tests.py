"""
requests_app/tests.py

Comprehensive tests for BloodRequest creation, matching, donor response,
and RBAC lifecycle.
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from hospitals.models import Hospital
from donors.models import DonorProfile
from requests_app.models import BloodRequest, DonorResponse

User = get_user_model()


class BloodRequestLifecycleTests(APITestCase):
    def setUp(self):
        self.patient = User.objects.create_user(
            email="patient_req@test.com",
            password="SecurePass123!",
            first_name="Alice",
            last_name="Patient",
            role="patient",
        )
        self.donor = User.objects.create_user(
            email="donor_req@test.com",
            password="SecurePass123!",
            first_name="Bob",
            last_name="Donor",
            role="donor",
        )
        self.donor_profile = DonorProfile.objects.create(
            user=self.donor,
            blood_group="O+",
            city="Bangalore",
            state="Karnataka",
            latitude=Decimal("12.9716"),
            longitude=Decimal("77.5946"),
            verification_status="verified",
            availability="available",
        )
        self.admin = User.objects.create_superuser(
            email="admin_req@test.com",
            password="AdminPass123!",
            first_name="Admin",
            last_name="Staff",
        )
        self.hospital = Hospital.objects.create(
            name="Apollo Hospital",
            address="123 Hospital Road, Bangalore",
            city="Bangalore",
            state="Karnataka",
            latitude=Decimal("12.9720"),
            longitude=Decimal("77.5950"),
            phone="080-12345678",
            is_active=True,
        )

        self.patient_token = str(RefreshToken.for_user(self.patient).access_token)
        self.donor_token = str(RefreshToken.for_user(self.donor).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)

    def test_patient_creates_request(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        payload = {
            "hospital": self.hospital.id,
            "blood_group": "O+",
            "units_required": 2,
            "urgency": "critical",
            "description": "Urgent surgery requirement",
        }
        response = self.client.post("/api/v1/requests/blood/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["blood_group"], "O+")
        self.assertEqual(response.data["patient"], self.patient.id)

    def test_donor_cannot_create_request(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.donor_token}")
        payload = {
            "hospital": self.hospital.id,
            "blood_group": "O+",
            "units_required": 1,
            "urgency": "medium",
        }
        response = self.client.post("/api/v1/requests/blood/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_donor_can_respond_and_accept(self):
        req = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=2,
            urgency="critical",
            status="awaiting_response",
        )
        donor_resp = DonorResponse.objects.create(
            request=req,
            donor=self.donor_profile,
            status=DonorResponse.ResponseStatus.PENDING,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.donor_token}")
        response = self.client.post(
            f"/api/v1/requests/responses/{donor_resp.id}/accept/",
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, BloodRequest.Status.DONOR_ACCEPTED)
        donor_resp.refresh_from_db()
        self.assertEqual(donor_resp.status, DonorResponse.ResponseStatus.ACCEPTED)

    def test_accepted_donor_can_be_confirmed_after_actual_donation(self):
        """1. Accepted donor can be confirmed after actual donation."""
        req = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=1,
            urgency="critical",
            status=BloodRequest.Status.DONOR_ACCEPTED,
        )
        donor_resp = DonorResponse.objects.create(
            request=req,
            donor=self.donor_profile,
            status=DonorResponse.ResponseStatus.ACCEPTED,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        response = self.client.post(
            f"/api/v1/requests/blood/{req.id}/fulfill/",
            {"donor_response_id": donor_resp.id, "units": 1, "notes": "Completed at counter 2"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        donor_resp.refresh_from_db()

        self.assertEqual(req.status, BloodRequest.Status.FULFILLED)
        self.assertEqual(req.units_fulfilled, 1)
        self.assertEqual(donor_resp.status, DonorResponse.ResponseStatus.COMPLETED)
        self.assertIn("Completed at counter 2", donor_resp.notes)

        # Check DonationHistory created
        from donors.models import DonationHistory
        history = DonationHistory.objects.filter(request=req, donor=self.donor_profile).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.status, DonationHistory.DonationStatus.COMPLETED)
        self.assertTrue(history.is_verified)

        # Check notifications for donor and admin
        from notifications.models import Notification
        donor_notif = Notification.objects.filter(
            recipient=self.donor,
            notification_type=Notification.NotificationType.REQUEST_FULFILLED,
        ).first()
        self.assertIsNotNone(donor_notif)
        admin_notif = Notification.objects.filter(
            recipient=self.admin,
            notification_type=Notification.NotificationType.REQUEST_FULFILLED,
        ).first()
        self.assertIsNotNone(admin_notif)

    def test_patient_cannot_confirm_without_accepted_response(self):
        """2. Patient cannot confirm without an accepted response."""
        req = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=1,
            urgency="critical",
            status=BloodRequest.Status.AWAITING_RESPONSE,
        )
        donor_resp = DonorResponse.objects.create(
            request=req,
            donor=self.donor_profile,
            status=DonorResponse.ResponseStatus.PENDING,  # Still pending, not accepted!
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        response = self.client.post(
            f"/api/v1/requests/blood/{req.id}/fulfill/",
            {"donor_response_id": donor_resp.id, "units": 1},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must be in 'accepted' status", response.data["detail"])

        # Try without specifying donor_response_id
        response2 = self.client.post(
            f"/api/v1/requests/blood/{req.id}/fulfill/",
            {"units": 1},
            format="json",
        )
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_partial_fulfillment(self):
        """3. Partial fulfillment: units_fulfilled updated, request remains active until all units received."""
        req = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=3,
            urgency="critical",
            status=BloodRequest.Status.DONOR_ACCEPTED,
        )
        donor_resp = DonorResponse.objects.create(
            request=req,
            donor=self.donor_profile,
            status=DonorResponse.ResponseStatus.ACCEPTED,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        response = self.client.post(
            f"/api/v1/requests/blood/{req.id}/fulfill/",
            {"donor_response_id": donor_resp.id, "units": 1},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        req.refresh_from_db()

        self.assertEqual(req.units_fulfilled, 1)
        self.assertEqual(req.units_still_needed, 2)
        # Must NOT be marked FULFILLED because only 1 of 3 units received
        self.assertNotEqual(req.status, BloodRequest.Status.FULFILLED)
        self.assertEqual(donor_resp.refresh_from_db() or donor_resp.status, DonorResponse.ResponseStatus.COMPLETED)

    def test_full_fulfillment(self):
        """4. Full fulfillment: request transitions to FULFILLED when total units are reached."""
        req = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=2,
            units_fulfilled=1,
            urgency="critical",
            status=BloodRequest.Status.DONOR_ACCEPTED,
        )
        donor2 = User.objects.create_user(
            email="donor2@test.com", password="Pass123!", role="donor"
        )
        donor2_profile = DonorProfile.objects.create(
            user=donor2, blood_group="O+", city="Bangalore", verification_status="verified"
        )
        donor_resp2 = DonorResponse.objects.create(
            request=req,
            donor=donor2_profile,
            status=DonorResponse.ResponseStatus.ACCEPTED,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        response = self.client.post(
            f"/api/v1/requests/blood/{req.id}/fulfill/",
            {"donor_response_id": donor_resp2.id, "units": 1},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        req.refresh_from_db()

        self.assertEqual(req.units_fulfilled, 2)
        self.assertEqual(req.units_still_needed, 0)
        self.assertEqual(req.status, BloodRequest.Status.FULFILLED)

    def test_duplicate_confirmation_prevention(self):
        """5. Duplicate confirmation prevention: completed response or fulfilled request cannot be confirmed again."""
        req = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=1,
            urgency="critical",
            status=BloodRequest.Status.DONOR_ACCEPTED,
        )
        donor_resp = DonorResponse.objects.create(
            request=req,
            donor=self.donor_profile,
            status=DonorResponse.ResponseStatus.ACCEPTED,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        # First confirmation -> succeeds
        res1 = self.client.post(
            f"/api/v1/requests/blood/{req.id}/fulfill/",
            {"donor_response_id": donor_resp.id, "units": 1},
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Second confirmation on same donor response -> rejected
        res2 = self.client.post(
            f"/api/v1/requests/blood/{req.id}/fulfill/",
            {"donor_response_id": donor_resp.id, "units": 1},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthorized_access(self):
        """6. Unauthorized access: unauthenticated users, donors, or other patients are rejected."""
        req = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=1,
            urgency="critical",
            status=BloodRequest.Status.DONOR_ACCEPTED,
        )
        donor_resp = DonorResponse.objects.create(
            request=req,
            donor=self.donor_profile,
            status=DonorResponse.ResponseStatus.ACCEPTED,
        )

        # A. Unauthenticated
        self.client.credentials()
        r1 = self.client.post(f"/api/v1/requests/blood/{req.id}/fulfill/", format="json")
        self.assertEqual(r1.status_code, status.HTTP_401_UNAUTHORIZED)

        # B. Other Patient (attempting to access another patient's request is forbidden / not found)
        other_patient = User.objects.create_user(
            email="other_patient@test.com", password="Pass123!", role="patient"
        )
        other_patient_tok = str(RefreshToken.for_user(other_patient).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_patient_tok}")
        r2 = self.client.post(f"/api/v1/requests/blood/{req.id}/fulfill/", format="json")
        self.assertIn(r2.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # C. Donor
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.donor_token}")
        r3 = self.client.post(f"/api/v1/requests/blood/{req.id}/fulfill/", format="json")
        self.assertEqual(r3.status_code, status.HTTP_403_FORBIDDEN)

    def test_fulfilled_filter(self):
        """7. Fulfilled filter: ?status=fulfilled returns only fulfilled requests."""
        # Active request
        req_active = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=1,
            status=BloodRequest.Status.OPEN,
        )
        # Fulfilled request
        req_fulfilled = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="A+",
            units_required=1,
            units_fulfilled=1,
            status=BloodRequest.Status.FULFILLED,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        response = self.client.get("/api/v1/requests/blood/?status=fulfilled")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        ids = [item["id"] for item in results]
        self.assertIn(req_fulfilled.id, ids)
        self.assertNotIn(req_active.id, ids)

    def test_existing_cancellation_and_acceptance_workflows(self):
        """8. Existing workflows: active requests can be cancelled, fulfilled cannot be cancelled, reject works."""
        # Active request can be cancelled
        req_active = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=1,
            status=BloodRequest.Status.OPEN,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.patient_token}")
        res_cancel = self.client.post(f"/api/v1/requests/blood/{req_active.id}/cancel/")
        self.assertEqual(res_cancel.status_code, status.HTTP_200_OK)
        req_active.refresh_from_db()
        self.assertEqual(req_active.status, BloodRequest.Status.CANCELLED)

        # Fulfilled request CANNOT be cancelled
        req_fulfilled = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=1,
            units_fulfilled=1,
            status=BloodRequest.Status.FULFILLED,
        )
        res_cancel_bad = self.client.post(f"/api/v1/requests/blood/{req_fulfilled.id}/cancel/")
        self.assertEqual(res_cancel_bad.status_code, status.HTTP_400_BAD_REQUEST)

        # Donor reject still works
        req2 = BloodRequest.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            blood_group="O+",
            units_required=1,
            status=BloodRequest.Status.AWAITING_RESPONSE,
        )
        resp2 = DonorResponse.objects.create(
            request=req2,
            donor=self.donor_profile,
            status=DonorResponse.ResponseStatus.PENDING,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.donor_token}")
        res_rej = self.client.post(f"/api/v1/requests/responses/{resp2.id}/reject/")
        self.assertEqual(res_rej.status_code, status.HTTP_200_OK)
        resp2.refresh_from_db()
        self.assertEqual(resp2.status, DonorResponse.ResponseStatus.REJECTED)
