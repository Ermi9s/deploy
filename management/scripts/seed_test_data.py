"""
OKM Test Data Seed Script
=========================
Run via Django management shell:
    python manage.py shell < scripts/seed_test_data.py

Or import and call:
    from scripts.seed_test_data import run; run()

What this script creates
------------------------
Organisation : Apex Solutions Inc.
  - 5 Departments, each with 3 clearance levels (Public / Confidential / Secret)
  - 2–3 users per department (plus 1 superuser admin)

The script is idempotent – if a Department with the same name already exists
it is reused rather than duplicated.
"""

import os
import sys
import django

# ── Bootstrap Django when run as a plain script ────────────────────────────
if __name__ == "__main__":
    # Adjust the path so manage.py's parent directory is on sys.path
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, BASE_DIR)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "management.settings")
    django.setup()

# ── Imports (after django.setup) ────────────────────────────────────────────
from UserAccountManager.models import Department, PermissionLevel, User, Profile  # noqa: E402


# ═══════════════════════════════════════════════════════════════════════════
# DATA DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════

ORGANISATION = "Apex Solutions Inc."

# Each department has a name and 3 clearance levels (ranking 1, 2, 3).
DEPARTMENTS = [
    {
        "name": "Engineering",
        "description": "Software development and infrastructure teams",
        "levels": [
            {"name": "Public",       "ranking": 1},
            {"name": "Confidential", "ranking": 2},
            {"name": "Secret",       "ranking": 3},
        ],
    },
    {
        "name": "Human Resources",
        "description": "People operations, recruitment, and compliance",
        "levels": [
            {"name": "Public",       "ranking": 1},
            {"name": "Confidential", "ranking": 2},
            {"name": "Secret",       "ranking": 3},
        ],
    },
    {
        "name": "Finance",
        "description": "Accounting, budgeting, and financial reporting",
        "levels": [
            {"name": "Public",       "ranking": 1},
            {"name": "Confidential", "ranking": 2},
            {"name": "Secret",       "ranking": 3},
        ],
    },
    {
        "name": "Legal & Compliance",
        "description": "Contracts, regulatory filings, and risk management",
        "levels": [
            {"name": "Public",       "ranking": 1},
            {"name": "Confidential", "ranking": 2},
            {"name": "Secret",       "ranking": 3},
        ],
    },
    {
        "name": "Operations",
        "description": "Logistics, supply chain, and facility management",
        "levels": [
            {"name": "Public",       "ranking": 1},
            {"name": "Confidential", "ranking": 2},
            {"name": "Secret",       "ranking": 3},
        ],
    },
]

# Users  ─  email, first_name, last_name, department_name, level_name, is_staff/superuser
USERS = [
    # ── Superuser / Admin ──────────────────────────────────────────────────
    {
        "email": "admin@apexsolutions.com",
        "first_name": "System",
        "last_name": "Admin",
        "password": "Admin@1234!",
        "department": None,
        "level": None,
        "is_staff": True,
        "is_superuser": True,
    },
    # ── Engineering ────────────────────────────────────────────────────────
    {
        "email": "alice.chen@apexsolutions.com",
        "first_name": "Alice",
        "last_name": "Chen",
        "password": "Test@1234!",
        "department": "Engineering",
        "level": "Secret",          # Senior engineer – full access
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "bob.kumar@apexsolutions.com",
        "first_name": "Bob",
        "last_name": "Kumar",
        "password": "Test@1234!",
        "department": "Engineering",
        "level": "Confidential",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "carol.smith@apexsolutions.com",
        "first_name": "Carol",
        "last_name": "Smith",
        "password": "Test@1234!",
        "department": "Engineering",
        "level": "Public",          # Junior / intern
        "is_staff": False,
        "is_superuser": False,
    },
    # ── Human Resources ────────────────────────────────────────────────────
    {
        "email": "diana.osei@apexsolutions.com",
        "first_name": "Diana",
        "last_name": "Osei",
        "password": "Test@1234!",
        "department": "Human Resources",
        "level": "Secret",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "ethan.lewis@apexsolutions.com",
        "first_name": "Ethan",
        "last_name": "Lewis",
        "password": "Test@1234!",
        "department": "Human Resources",
        "level": "Confidential",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "fiona.tanaka@apexsolutions.com",
        "first_name": "Fiona",
        "last_name": "Tanaka",
        "password": "Test@1234!",
        "department": "Human Resources",
        "level": "Public",
        "is_staff": False,
        "is_superuser": False,
    },
    # ── Finance ────────────────────────────────────────────────────────────
    {
        "email": "george.mbeki@apexsolutions.com",
        "first_name": "George",
        "last_name": "Mbeki",
        "password": "Test@1234!",
        "department": "Finance",
        "level": "Secret",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "hannah.vogel@apexsolutions.com",
        "first_name": "Hannah",
        "last_name": "Vogel",
        "password": "Test@1234!",
        "department": "Finance",
        "level": "Confidential",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "ivan.petrov@apexsolutions.com",
        "first_name": "Ivan",
        "last_name": "Petrov",
        "password": "Test@1234!",
        "department": "Finance",
        "level": "Public",
        "is_staff": False,
        "is_superuser": False,
    },
    # ── Legal & Compliance ─────────────────────────────────────────────────
    {
        "email": "julia.santos@apexsolutions.com",
        "first_name": "Julia",
        "last_name": "Santos",
        "password": "Test@1234!",
        "department": "Legal & Compliance",
        "level": "Secret",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "kevin.park@apexsolutions.com",
        "first_name": "Kevin",
        "last_name": "Park",
        "password": "Test@1234!",
        "department": "Legal & Compliance",
        "level": "Confidential",
        "is_staff": False,
        "is_superuser": False,
    },
    # ── Operations ─────────────────────────────────────────────────────────
    {
        "email": "laura.mensah@apexsolutions.com",
        "first_name": "Laura",
        "last_name": "Mensah",
        "password": "Test@1234!",
        "department": "Operations",
        "level": "Secret",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "mike.ali@apexsolutions.com",
        "first_name": "Mike",
        "last_name": "Ali",
        "password": "Test@1234!",
        "department": "Operations",
        "level": "Confidential",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "nina.gruber@apexsolutions.com",
        "first_name": "Nina",
        "last_name": "Gruber",
        "password": "Test@1234!",
        "department": "Operations",
        "level": "Public",
        "is_staff": False,
        "is_superuser": False,
    },
]


# ═══════════════════════════════════════════════════════════════════════════
# SEED LOGIC
# ═══════════════════════════════════════════════════════════════════════════

def seed_departments():
    """Create departments and their clearance levels. Returns a lookup dict."""
    dept_map = {}   # dept_name -> Department instance
    level_map = {}  # (dept_name, level_name) -> PermissionLevel instance

    for dept_data in DEPARTMENTS:
        dept, created = Department.objects.get_or_create(name=dept_data["name"])
        status = "CREATED" if created else "EXISTS"
        print(f"  [{status}] Department: {dept.name}")
        dept_map[dept.name] = dept

        for lvl_data in dept_data["levels"]:
            lvl, lvl_created = PermissionLevel.objects.get_or_create(
                department=dept,
                ranking=lvl_data["ranking"],
                defaults={"name": lvl_data["name"]},
            )
            lvl_status = "CREATED" if lvl_created else "EXISTS"
            print(f"           [{lvl_status}] Level: {lvl.name} (rank {lvl.ranking})")
            level_map[(dept.name, lvl.name)] = lvl

    return dept_map, level_map


def seed_users(dept_map, level_map):
    """Create users and assign them to departments + clearance levels."""
    for u in USERS:
        user, created = User.objects.get_or_create(
            email=u["email"],
            defaults={
                "first_name": u["first_name"],
                "last_name": u["last_name"],
                "is_staff": u["is_staff"],
                "is_superuser": u["is_superuser"],
            },
        )

        if created:
            user.set_password(u["password"])
            user.save()
            print(f"  [CREATED] User: {user.email}")
        else:
            print(f"  [EXISTS ] User: {user.email}")

        # Assign department + level via Profile
        profile, _ = Profile.objects.get_or_create(user=user)

        if u["department"] and u["level"]:
            dept = dept_map.get(u["department"])
            level = level_map.get((u["department"], u["level"]))
            if dept and level:
                profile.department = dept
                profile.permission_level = level
                profile.firstname = u["first_name"]
                profile.lastname = u["last_name"]
                profile.save()
                print(f"           Assigned → {dept.name} / {level.name}")


def run():
    print("=" * 60)
    print(f"  OKM Test Data Seed — Organisation: {ORGANISATION}")
    print("=" * 60)

    print("\n▶  Seeding Departments & Clearance Levels …")
    dept_map, level_map = seed_departments()

    print("\n▶  Seeding Users …")
    seed_users(dept_map, level_map)

    print("\n✅  Done.  Summary:")
    print(f"    Departments : {Department.objects.count()}")
    print(f"    Levels      : {PermissionLevel.objects.count()}")
    print(f"    Users       : {User.objects.count()}")
    print()


# ── Entry point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run()
