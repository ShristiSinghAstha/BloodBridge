"""
requests_app/views.py

Blood request and donor response viewsets.
"""

from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsPatient, IsDonor, IsPatientOrAdmin, IsDonorOrAdmin
from donors.models import DonorProfile
from notifications.models import Notification
from core.services.matching import find_matching_donors
from .models import BloodRequest, DonorResponse
from .serializers import BloodRequestSerializer, DonorResponseSerializer


def process_fulfillment(blood_request, donor_response_id=None, units=1, notes="", confirmed_by=None):
    """
    Core business logic for confirming blood donation receipt.
    Validates status transitions, donor response state, units math,
    updates models atomically, creates donation history, and triggers notifications.
    Returns (status_code, response_data).
    """
    # 1. Check request status
    if blood_request.status == BloodRequest.Status.FULFILLED:
        return status.HTTP_400_BAD_REQUEST, {"detail": "This request is already fulfilled."}
    if blood_request.status in (BloodRequest.Status.CANCELLED, BloodRequest.Status.EXPIRED):
        return status.HTTP_400_BAD_REQUEST, {
            "detail": f"Cannot fulfill a request with status '{blood_request.status}'."
        }

    # 2. Check units value
    try:
        units = int(units)
    except (ValueError, TypeError):
        return status.HTTP_400_BAD_REQUEST, {"detail": "Invalid units value."}
    if units < 1:
        return status.HTTP_400_BAD_REQUEST, {"detail": "Units donated must be at least 1."}

    remaining = blood_request.units_required - blood_request.units_fulfilled
    if units > remaining:
        return status.HTTP_400_BAD_REQUEST, {
            "detail": f"Units donated ({units}) cannot exceed remaining units needed ({remaining})."
        }

    # 3. Locate donor response
    if donor_response_id:
        try:
            donor_response_id = int(donor_response_id)
        except (ValueError, TypeError):
            return status.HTTP_400_BAD_REQUEST, {"detail": "Invalid donor_response_id."}
        donor_response = blood_request.donor_responses.filter(id=donor_response_id).first()
        if not donor_response:
            return status.HTTP_404_NOT_FOUND, {"detail": "Donor response not found for this request."}
    else:
        accepted_responses = blood_request.donor_responses.filter(
            status=DonorResponse.ResponseStatus.ACCEPTED
        )
        if not accepted_responses.exists():
            return status.HTTP_400_BAD_REQUEST, {
                "detail": "Cannot confirm donation: No accepted donor response exists for this request."
            }
        if accepted_responses.count() > 1:
            return status.HTTP_400_BAD_REQUEST, {
                "detail": "Multiple accepted donors exist; please specify donor_response_id."
            }
        donor_response = accepted_responses.first()

    # 4. Check donor response status
    if donor_response.status == DonorResponse.ResponseStatus.COMPLETED:
        return status.HTTP_400_BAD_REQUEST, {
            "detail": "Donation from this donor has already been confirmed."
        }
    if donor_response.status != DonorResponse.ResponseStatus.ACCEPTED:
        return status.HTTP_400_BAD_REQUEST, {
            "detail": f"Donor response must be in 'accepted' status to confirm donation (current status: '{donor_response.status}')."
        }

    with transaction.atomic():
        # Update donor response
        donor_response.status = DonorResponse.ResponseStatus.COMPLETED
        if notes:
            donor_response.notes = f"{donor_response.notes}\n[Fulfillment Note]: {notes}".strip()
        donor_response.save(update_fields=["status", "notes", "updated_at"])

        # Update units fulfilled
        blood_request.units_fulfilled += units

        # Determine new status
        if blood_request.units_fulfilled >= blood_request.units_required:
            blood_request.status = BloodRequest.Status.FULFILLED
        else:
            # Partial fulfillment
            has_other_accepted = blood_request.donor_responses.filter(
                status=DonorResponse.ResponseStatus.ACCEPTED
            ).exists()
            if has_other_accepted:
                blood_request.status = BloodRequest.Status.DONOR_ACCEPTED
            else:
                has_pending = blood_request.donor_responses.filter(
                    status=DonorResponse.ResponseStatus.PENDING
                ).exists()
                if has_pending:
                    blood_request.status = BloodRequest.Status.AWAITING_RESPONSE
                else:
                    blood_request.status = BloodRequest.Status.OPEN

        blood_request.save(update_fields=["units_fulfilled", "status", "updated_at"])

        # Create DonationHistory record
        from donors.models import DonationHistory
        DonationHistory.objects.create(
            donor=donor_response.donor,
            request=blood_request,
            hospital=blood_request.hospital,
            donation_date=timezone.now().date(),
            status=DonationHistory.DonationStatus.COMPLETED,
            is_verified=True,
            notes=notes or f"Donation of {units} unit(s) confirmed received by patient.",
        )
        donor_profile = donor_response.donor
        donor_profile.last_donation_date = timezone.now().date()
        donor_profile.save(update_fields=["last_donation_date", "updated_at"])

        # Notify donor
        Notification.objects.create(
            recipient=donor_response.donor.user,
            notification_type=Notification.NotificationType.REQUEST_FULFILLED,
            title="Donation Confirmed Received",
            message=(
                f"Patient {blood_request.patient.get_full_name()} confirmed receipt of "
                f"your blood donation ({units} unit(s) of {blood_request.blood_group}) "
                f"at {blood_request.hospital.name}. Thank you for saving a life!"
            ),
            related_request=blood_request,
        )

        # Notify admins
        User = get_user_model()
        admins = User.objects.filter(Q(is_superuser=True) | Q(role="admin") | Q(is_staff=True)).distinct()
        for admin_user in admins:
            Notification.objects.create(
                recipient=admin_user,
                notification_type=Notification.NotificationType.REQUEST_FULFILLED,
                title="Blood Donation Confirmed",
                message=(
                    f"Donation confirmed for Request #{blood_request.id} ({blood_request.blood_group}) "
                    f"at {blood_request.hospital.name}. Donor: {donor_response.donor.user.get_full_name()}. "
                    f"Units: {blood_request.units_fulfilled}/{blood_request.units_required}. "
                    f"Status: {blood_request.status.upper()}."
                ),
                related_request=blood_request,
            )

    return status.HTTP_200_OK, BloodRequestSerializer(blood_request).data


class BloodRequestViewSet(viewsets.ModelViewSet):
    """
    POST   /api/v1/requests/blood/               – patient creates a request
    GET    /api/v1/requests/blood/               – list (patient sees own; admin sees all)
    GET    /api/v1/requests/blood/{id}/          – detail
    PATCH  /api/v1/requests/blood/{id}/          – patient updates (limited fields)
    POST   /api/v1/requests/blood/{id}/cancel/   – patient cancels
    GET    /api/v1/requests/blood/{id}/matches/  – matching donors list
    GET    /api/v1/requests/blood/{id}/responses/ – donor responses for this request
    """

    serializer_class = BloodRequestSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ["blood_group", "status", "hospital__name"]
    ordering_fields  = ["-created_at", "urgency"]

    def get_permissions(self):
        if self.action == "create":
            return [IsPatient()]
        if self.action in ("matches", "responses", "fulfill", "cancel"):
            return [IsPatientOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs   = BloodRequest.objects.select_related("patient", "hospital").all()
        if user.is_patient:
            qs = qs.filter(patient=user)
        elif user.is_donor:
            # Donors see open/awaiting requests matching their blood group
            try:
                profile = user.donor_profile
                from core.services.compatibility import compatible_donor_groups
                compatible = compatible_donor_groups(profile.blood_group)
                qs = qs.filter(
                    blood_group__in=compatible,
                    status__in=[
                        BloodRequest.Status.OPEN,
                        BloodRequest.Status.AWAITING_RESPONSE,
                    ],
                )
            except DonorProfile.DoesNotExist:
                return qs.none()
        # Admin sees all

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def perform_create(self, serializer):
        """
        On creation, save the request and kick off matching.
        """
        with transaction.atomic():
            blood_request = serializer.save(
                patient=self.request.user,
                status=BloodRequest.Status.OPEN,
            )
            # Trigger matching asynchronously (synchronous for now)
            self._trigger_matching(blood_request)

    def _trigger_matching(self, blood_request):
        """Find matching donors and send them notifications."""
        blood_request.status = BloodRequest.Status.MATCHING
        blood_request.save(update_fields=["status"])

        candidates = find_matching_donors(blood_request, require_verified=True)

        if candidates:
            blood_request.status = BloodRequest.Status.AWAITING_RESPONSE
        else:
            blood_request.status = BloodRequest.Status.OPEN
        blood_request.save(update_fields=["status"])

        # Create a pending DonorResponse + notification for each candidate
        for candidate in candidates:
            DonorResponse.objects.get_or_create(
                request=blood_request,
                donor=candidate.profile,
                defaults={"status": DonorResponse.ResponseStatus.PENDING},
            )
            Notification.objects.create(
                recipient=candidate.profile.user,
                notification_type=Notification.NotificationType.REQUEST_MATCHED,
                title="New blood donation request",
                message=(
                    f"A patient needs {blood_request.blood_group} blood "
                    f"at {blood_request.hospital.name}."
                ),
                related_request=blood_request,
            )

    @action(detail=True, methods=["post"], permission_classes=[IsPatient])
    def cancel(self, request, pk=None):
        """POST /api/v1/requests/blood/{id}/cancel/"""
        blood_request = self.get_object()
        if blood_request.patient != request.user:
            return Response(
                {"detail": "You can only cancel your own requests."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not blood_request.is_cancellable:
            return Response(
                {"detail": f"Cannot cancel a request with status '{blood_request.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        blood_request.status = BloodRequest.Status.CANCELLED
        blood_request.save(update_fields=["status", "updated_at"])
        return Response(BloodRequestSerializer(blood_request).data)

    @action(detail=True, methods=["get"], permission_classes=[IsPatientOrAdmin])
    def matches(self, request, pk=None):
        """GET /api/v1/requests/blood/{id}/matches/ – matching donor candidates."""
        blood_request = self.get_object()
        if request.user.is_patient and blood_request.patient != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        candidates = find_matching_donors(blood_request)
        data = []
        for c in candidates:
            data.append({
                "donor_id":       c.profile.pk,
                "name":           c.profile.user.get_full_name(),
                "blood_group":    c.profile.blood_group,
                "city":           c.profile.city,
                "availability":   c.profile.availability,
                "distance_km":    c.distance_km,
                "duration_min":   c.duration_min,
                "routing_source": getattr(c, "routing_source", "unavailable"),
                "routing_error":  c.routing_error,
                "is_fallback":    getattr(c, "is_fallback", False),
            })
        return Response(data)

    @action(detail=True, methods=["get"], permission_classes=[IsPatientOrAdmin])
    def responses(self, request, pk=None):
        """GET /api/v1/requests/blood/{id}/responses/"""
        blood_request = self.get_object()
        if request.user.is_patient and blood_request.patient != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        responses = blood_request.donor_responses.select_related(
            "donor__user"
        ).all()
        return Response(DonorResponseSerializer(responses, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsPatientOrAdmin])
    def fulfill(self, request, pk=None):
        """
        POST /api/v1/requests/blood/{id}/fulfill/
        Confirm donation received from an accepted donor response.
        Payload:
        {
            "donor_response_id": <int, optional if single accepted response exists>,
            "units": <int, default 1>,
            "notes": "<str, optional>"
        }
        """
        blood_request = self.get_object()
        if request.user.is_patient and blood_request.patient != request.user:
            return Response(
                {"detail": "You can only confirm fulfillment for your own requests."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not (request.user.is_patient or request.user.is_admin):
            return Response(
                {"detail": "Only patients or admins can confirm fulfillment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        resp_id = request.data.get("donor_response_id")
        units = request.data.get("units", 1)
        notes = request.data.get("notes", "")

        status_code, data = process_fulfillment(
            blood_request=blood_request,
            donor_response_id=resp_id,
            units=units,
            notes=notes,
            confirmed_by=request.user,
        )
        return Response(data, status=status_code)


class DonorResponseViewSet(viewsets.ModelViewSet):
    """
    Donors accept or reject a pending DonorResponse.
    """

    serializer_class   = DonorResponseSerializer
    permission_classes = [IsDonorOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return DonorResponse.objects.select_related(
                "donor__user", "request"
            ).all()
        try:
            profile = user.donor_profile
            return DonorResponse.objects.filter(donor=profile).select_related("request")
        except DonorProfile.DoesNotExist:
            return DonorResponse.objects.none()

    @action(detail=True, methods=["post"], permission_classes=[IsDonor])
    def accept(self, request, pk=None):
        """POST /api/v1/requests/responses/{id}/accept/"""
        return self._update_response(request, DonorResponse.ResponseStatus.ACCEPTED)

    @action(detail=True, methods=["post"], permission_classes=[IsDonor])
    def reject(self, request, pk=None):
        """POST /api/v1/requests/responses/{id}/reject/"""
        return self._update_response(request, DonorResponse.ResponseStatus.REJECTED)

    def _update_response(self, request, new_status):
        response_obj = self.get_object()

        # Ensure donor owns this response
        try:
            profile = request.user.donor_profile
        except DonorProfile.DoesNotExist:
            return Response(
                {"detail": "Donor profile not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if response_obj.donor != profile:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if response_obj.status != DonorResponse.ResponseStatus.PENDING:
            return Response(
                {"detail": "This response is no longer pending."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check donor is still available
        if (
            new_status == DonorResponse.ResponseStatus.ACCEPTED
            and profile.availability != DonorProfile.Availability.AVAILABLE
        ):
            return Response(
                {"detail": "You must be marked Available to accept a request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            response_obj.status       = new_status
            response_obj.responded_at = timezone.now()
            response_obj.save(update_fields=["status", "responded_at", "updated_at"])

            # Notify the patient
            Notification.objects.create(
                recipient=response_obj.request.patient,
                notification_type=Notification.NotificationType.DONOR_RESPONDED,
                title=f"Donor {new_status.capitalize()}",
                message=(
                    f"{profile.user.get_full_name()} has {new_status} "
                    f"your blood request."
                ),
                related_request=response_obj.request,
            )

            if new_status == DonorResponse.ResponseStatus.ACCEPTED:
                blood_request = response_obj.request
                blood_request.status = BloodRequest.Status.DONOR_ACCEPTED
                blood_request.save(update_fields=["status", "updated_at"])

        return Response(DonorResponseSerializer(response_obj).data)

    @action(detail=True, methods=["post"], permission_classes=[IsPatientOrAdmin])
    def confirm(self, request, pk=None):
        """
        POST /api/v1/requests/responses/{id}/confirm/
        Confirm donation for this specific donor response.
        """
        response_obj = self.get_object()
        blood_request = response_obj.request
        if request.user.is_patient and blood_request.patient != request.user:
            return Response(
                {"detail": "You can only confirm fulfillment for your own requests."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not (request.user.is_patient or request.user.is_admin):
            return Response(
                {"detail": "Only patients or admins can confirm fulfillment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        units = request.data.get("units", 1)
        notes = request.data.get("notes", "")

        status_code, data = process_fulfillment(
            blood_request=blood_request,
            donor_response_id=response_obj.id,
            units=units,
            notes=notes,
            confirmed_by=request.user,
        )
        return Response(data, status=status_code)

