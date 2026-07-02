import os
import sys
# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import AuthUser
import bcrypt

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    print(f"Connecting to database: {db_url}")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    users = session.query(AuthUser).all()
    for u in users:
        # Check if Admin@123 works
        try:
            ok_admin123 = bcrypt.checkpw("Admin@123".encode('utf-8'), u.hashed_password.encode('utf-8'))
        except Exception as e:
            ok_admin123 = f"Error: {e}"
            
        try:
            ok_password123 = bcrypt.checkpw("password123".encode('utf-8'), u.hashed_password.encode('utf-8'))
        except Exception as e:
            ok_password123 = f"Error: {e}"
            
        print(f"Email: {u.email} | Hash: {u.hashed_password} | Admin@123: {ok_admin123} | password123: {ok_password123}")

if __name__ == "__main__":
    main()
