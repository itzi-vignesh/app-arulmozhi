from app.db.session import SessionLocal
from app.models.user import User, AuthUser
from app.models.business import Checkin

db = SessionLocal()

# Find target users
u_dynamic = db.query(User).filter(User.email == "cns25001@a5cyber.com").first()
u_real = db.query(User).filter(User.email == "jfjf@gmail.com").first()

if u_dynamic and u_real:
    print(f"Moving checkins from {u_dynamic.email} (ID: {u_dynamic.id}) to {u_real.email} (ID: {u_real.id})")
    
    # Update checkin user_id
    checkins_updated = db.query(Checkin).filter(Checkin.user_id == u_dynamic.id).update(
        {Checkin.user_id: u_real.id}
    )
    print(f"Updated {checkins_updated} checkin records.")
    
    # Update real user properties to match biometric record to prevent future sync issues
    u_real.full_name = "Hariharan V"
    u_real.department = "CNS"
    db.add(u_real)
    
    # Delete the dynamically created duplicate user
    print(f"Deleting duplicate user {u_dynamic.email}")
    db.delete(u_dynamic)
    
    auth_dynamic = db.query(AuthUser).filter(AuthUser.id == u_dynamic.id).first()
    if auth_dynamic:
        db.delete(auth_dynamic)
        
    db.commit()
    print("Database fix completed successfully!")
else:
    print("Could not find both users in database. Check current records.")
