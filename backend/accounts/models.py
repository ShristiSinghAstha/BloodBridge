"""
accounts/models.py

Custom User model for BloodBridge.

Why a custom model?
  Django's built-in User uses 'username' as the primary login field.
  We want to support email-based login and add a role field to keep
  role logic inside the database rather than a separate Profile table.

  IMPORTANT: AUTH_USER_MODEL must point here BEFORE the first
  `migrate` command is run. Changing it afterwards requires complex
  data migrations.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom manager so we can create users with email as the unique ID."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email address is required.")
        email = self.normalize_email(email)
        extra_fields.setdefault("is_active", True)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)   # hashes via Django's PBKDF2 by default
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Platform-wide user account.

    Roles
    ─────
    PATIENT   – submits blood requests
    DONOR     – responds to blood requests
    ADMIN     – manages the platform
    """

    class Role(models.TextChoices):
        PATIENT = "patient", "Patient"
        DONOR   = "donor",   "Donor"
        ADMIN   = "admin",   "Administrator"

    # ── Identity ──────────────────────────────────────────────────────────────
    email      = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150)
    last_name  = models.CharField(max_length=150)
    phone      = models.CharField(max_length=20, blank=True)

    # ── Role & Status ─────────────────────────────────────────────────────────
    role      = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.PATIENT,
    )
    is_active = models.BooleanField(default=True)
    is_staff  = models.BooleanField(default=False)  # Required for Django admin

    # ── Timestamps ────────────────────────────────────────────────────────────
    date_joined = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    objects = UserManager()

    # Email is the login field; Django uses this for authenticate()
    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        ordering = ["-date_joined"]
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}> [{self.role}]"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    # ── Role helpers ──────────────────────────────────────────────────────────
    @property
    def is_patient(self):
        return self.role == self.Role.PATIENT

    @property
    def is_donor(self):
        return self.role == self.Role.DONOR

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN
