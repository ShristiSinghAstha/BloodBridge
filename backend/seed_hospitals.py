"""
Seed initial hospitals with realistic geographic coordinates (Bangalore/India region)
so road distance calculation with OSRM and distance routing work out of the box.
"""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from hospitals.models import Hospital

hospitals_data = [
    {
        "name": "Manipal Hospital",
        "city": "Bangalore",
        "state": "Karnataka",
        "address": "98 HAL Old Airport Rd, Kodihalli",
        "phone": "+91 80 2502 4444",
        "email": "emergency@manipal.edu",
        "latitude": 12.9582,
        "longitude": 77.6492,
        "is_verified": True,
    },
    {
        "name": "Apollo Hospital",
        "city": "Bangalore",
        "state": "Karnataka",
        "address": "154/11 Bannerghatta Main Rd, Krishnaraju Layout",
        "phone": "+91 80 2630 4050",
        "email": "bloodbank@apollo.com",
        "latitude": 12.8954,
        "longitude": 77.5986,
        "is_verified": True,
    },
    {
        "name": "Fortis Hospital",
        "city": "Bangalore",
        "state": "Karnataka",
        "address": "14 Cunningham Rd, Vasanth Nagar",
        "phone": "+91 80 4199 4444",
        "email": "care@fortis.com",
        "latitude": 12.9863,
        "longitude": 77.5983,
        "is_verified": True,
    },
    {
        "name": "Columbia Asia Hospital",
        "city": "Bangalore",
        "state": "Karnataka",
        "address": "Kirloskar Business Park, Bellary Rd, Hebbal",
        "phone": "+91 80 6660 0666",
        "email": "help@columbiaasia.com",
        "latitude": 13.0489,
        "longitude": 77.5937,
        "is_verified": True,
    }
]

created_count = 0
for h in hospitals_data:
    obj, created = Hospital.objects.get_or_create(
        name=h["name"],
        defaults=h
    )
    if created:
        created_count += 1

print(f"[OK] Seeded {created_count} hospitals. Total: {Hospital.objects.count()}")
