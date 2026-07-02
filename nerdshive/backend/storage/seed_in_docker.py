import os
import sys

from app.db.session import SessionLocal
from app.models.user import AuthUser, Admin, Superuser
from app.models.business import Pricing, PricingPlan
from app.core.security import get_password_hash

def main():
    session = SessionLocal()
    try:
        # 1. Create Superuser
        su_email = "superuser@example.com"
        existing_su = session.query(AuthUser).filter(AuthUser.email == su_email).first()
        if not existing_su:
            su_auth = AuthUser(
                email=su_email,
                hashed_password=get_password_hash("password123"),
                is_active=True
            )
            session.add(su_auth)
            session.flush()
            
            su_profile = Superuser(
                auth_id=su_auth.id,
                full_name="Default Superuser",
                mobile="9876543210",
                city="Chennai",
                location="Adyar",
                occupation="Super Administrator"
            )
            session.add(su_profile)
            print("Superuser seeded successfully.")
        else:
            print("Superuser already exists.")
            
        # 2. Create Admin
        admin_email = "admin@example.com"
        existing_admin = session.query(AuthUser).filter(AuthUser.email == admin_email).first()
        if not existing_admin:
            admin_auth = AuthUser(
                email=admin_email,
                hashed_password=get_password_hash("password123"),
                is_active=True
            )
            session.add(admin_auth)
            session.flush()
            
            admin_profile = Admin(
                auth_id=admin_auth.id,
                full_name="Default Admin",
                mobile="9876543211",
                city="Chennai",
                location="T Nagar",
                occupation="Administrator"
            )
            session.add(admin_profile)
            print("Admin seeded successfully.")
        # 3. Seed default pricing plans
        default_prices = {
            "day": {"amount": 200, "gst_rate": 18},
            "week": {"amount": 1200, "gst_rate": 18},
            "month": {"amount": 4500, "gst_rate": 18}
        }
        for plan_type, values in default_prices.items():
            existing_price = session.query(Pricing).filter(Pricing.plan_type == plan_type).first()
            if not existing_price:
                price_entry = Pricing(
                    plan_type=plan_type,
                    amount=values["amount"],
                    gst_rate=values["gst_rate"]
                )
                session.add(price_entry)
                print(f"Seeded pricing for {plan_type} plan.")

        # 4. Seed pricing plans restructures
        default_plans = [
            {
                "category": "customer",
                "plan_name": "HOT DESK",
                "price": 699,
                "billing_type": "day",
                "features_json": [
                    "Reserved private desk for the day",
                    "High-speed WiFi access",
                    "Power backup facility",
                    "Fully air-conditioned space",
                    "Pantry access"
                ]
            },
            {
                "category": "customer",
                "plan_name": "WEEKLY PASS",
                "price": 2400,
                "billing_type": "week",
                "features_json": [
                    "All Private Hot Desk benefits",
                    "1 hour meeting room access",
                    "Lockable personal storage",
                    "Priority private seating",
                    "Pantry access",
                    "Networking events access"
                ]
            },
            {
                "category": "customer",
                "plan_name": "MONTHLY SINGLE",
                "price": 8000,
                "billing_type": "month",
                "features_json": [
                    "Private dedicated desk",
                    "Meeting room access",
                    "Lockable storage",
                    "Extended facility access",
                    "Pantry access",
                    "Guest access",
                    "Basic printing services"
                ]
            },
            {
                "category": "corporate",
                "plan_name": "MONTHLY TEAM PLAN",
                "price": 5200,
                "billing_type": "seat",
                "features_json": [
                    "Dedicated private desk / team cabin",
                    "Meeting room access",
                    "Lockable storage",
                    "Extended facility access",
                    "Pantry access",
                    "Guest access",
                    "Basic printing services"
                ]
            },
            {
                "category": "corporate",
                "plan_name": "TRIAL PLAN",
                "price": 7000,
                "billing_type": "week",
                "features_json": [
                    "Full access to shared workspaces & hot desks",
                    "High-speed enterprise-grade WiFi",
                    "Complementary premium pantry access",
                    "Access to meeting rooms (2 hrs/week)",
                    "24/7 security and power backup"
                ]
            }
        ]
        
        for plan in default_plans:
            existing = session.query(PricingPlan).filter(PricingPlan.plan_name == plan["plan_name"]).first()
            if not existing:
                plan_entry = PricingPlan(
                    category=plan["category"],
                    plan_name=plan["plan_name"],
                    price=plan["price"],
                    billing_type=plan["billing_type"],
                    features_json=plan["features_json"],
                    is_active=True
                )
                session.add(plan_entry)
                print(f"Seeded pricing plan: {plan['plan_name']}")

        # 5. Seed default meeting room
        from app.models.meeting import MeetingRoom
        existing_room = session.query(MeetingRoom).filter(MeetingRoom.room_name == "Meeting Room").first()
        if not existing_room:
            room = MeetingRoom(
                room_name="Meeting Room",
                capacity=10,
                location="Ground Floor",
                status="ACTIVE"
            )
            session.add(room)
            print("Seeded default meeting room: Meeting Room")

        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        session.close()


if __name__ == "__main__":
    main()
