"""
accounts/serializers.py

Serializers convert Python objects ↔ JSON for the REST API.
They also run field-level and object-level validation before
any data reaches the database.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """
    Used only for new account creation (POST /api/v1/auth/register/).
    password is write-only so it is never returned in responses.
    """

    password  = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],   # runs Django's built-in validators
        style={"input_type": "password"},
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        label="Confirm password",
        style={"input_type": "password"},
    )

    class Meta:
        model  = User
        fields = [
            "id", "email", "first_name", "last_name",
            "phone", "role", "password", "password2",
        ]
        # Extra constraints expressed via extra_kwargs
        extra_kwargs = {
            "first_name": {"required": True},
            "last_name":  {"required": True},
        }

    def validate(self, attrs):
        """Cross-field validation: both passwords must match."""
        if attrs["password"] != attrs.pop("password2"):
            raise serializers.ValidationError(
                {"password": "Passwords do not match."}
            )
        # Prevent self-registering as admin
        if attrs.get("role") == User.Role.ADMIN:
            raise serializers.ValidationError(
                {"role": "Admin accounts cannot be self-registered."}
            )
        return attrs

    def create(self, validated_data):
        """
        Use create_user() (not .save()) so the password is hashed
        by Django's password hasher (PBKDF2-SHA256 by default).
        """
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    """
    Read/update serializer.  Password is excluded; use a separate
    ChangePasswordSerializer for that.
    """

    full_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "phone", "role", "is_active", "date_joined",
        ]
        read_only_fields = ["id", "email", "role", "date_joined"]

    def get_full_name(self, obj):
        return obj.get_full_name()


class ChangePasswordSerializer(serializers.Serializer):
    """Allows an authenticated user to change their own password."""

    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
