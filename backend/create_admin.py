"""
Script to create an admin superuser with a known password for development.
Run: python create_admin.py
"""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

email    = "admin@bloodbridge.dev"
password = "Admin@123"

if User.objects.filter(email=email).exists():
    print(f"[INFO] Admin already exists: {email}")
else:
    User.objects.create_superuser(
        email=email,
        password=password,
        first_name="Admin",
        last_name="BloodBridge",
    )
    print(f"[OK] Superuser created: {email} / {password}")
    print("[WARN] Change this password in production!")
