"""
accounts/permissions.py

Reusable DRF permission classes.  These enforce role-based access
on the *backend* — the React client also hides routes, but the real
enforcement must always happen server-side.
"""

from rest_framework.permissions import BasePermission


class IsPatient(BasePermission):
    """Allow only authenticated users with role=patient."""
    message = "Access restricted to patients."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_patient
        )


class IsDonor(BasePermission):
    """Allow only authenticated users with role=donor."""
    message = "Access restricted to donors."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_donor
        )


class IsAdminUser(BasePermission):
    """Allow only authenticated users with role=admin."""
    message = "Access restricted to administrators."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_admin
        )


class IsPatientOrAdmin(BasePermission):
    """Allow patients and administrators."""
    message = "Access restricted to patients or administrators."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_patient or request.user.is_admin)
        )


class IsDonorOrAdmin(BasePermission):
    """Allow donors and administrators."""
    message = "Access restricted to donors or administrators."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_donor or request.user.is_admin)
        )
