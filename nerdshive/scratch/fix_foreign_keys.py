import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    
    engine = create_engine(db_url)
    
    commands = [
        # queries (User support queries/tickets) - CASCADE delete queries when user is deleted
        """
        ALTER TABLE queries 
        DROP CONSTRAINT IF EXISTS queries_user_id_fkey,
        ADD CONSTRAINT queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE;
        """,
        # updates (Updates/Announcements) - NULL updates user_id when user is deleted
        """
        ALTER TABLE updates 
        DROP CONSTRAINT IF EXISTS updates_user_id_fkey,
        ADD CONSTRAINT updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL;
        """,
        # usage_logs - CASCADE delete usage logs when user is deleted
        """
        ALTER TABLE usage_logs 
        DROP CONSTRAINT IF EXISTS usage_logs_user_id_fkey,
        ADD CONSTRAINT usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE;
        """,
        # checkins (checkin_approved_by) - NULL approval admin when admin is deleted
        """
        ALTER TABLE checkins 
        DROP CONSTRAINT IF EXISTS checkins_checkin_approved_by_fkey,
        ADD CONSTRAINT checkins_checkin_approved_by_fkey FOREIGN KEY (checkin_approved_by) REFERENCES auth_users(id) ON DELETE SET NULL;
        """,
        # checkins (updated_by) - NULL update admin when admin is deleted
        """
        ALTER TABLE checkins 
        DROP CONSTRAINT IF EXISTS checkins_updated_by_fkey,
        ADD CONSTRAINT checkins_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE SET NULL;
        """,
        # pricing (updated_by) - NULL update admin when admin is deleted
        """
        ALTER TABLE pricing 
        DROP CONSTRAINT IF EXISTS pricing_updated_by_fkey,
        ADD CONSTRAINT pricing_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE SET NULL;
        """
    ]
    
    print(f"Connecting to database: {db_url}")
    with engine.begin() as conn:
        for cmd in commands:
            print(f"Executing constraint update...")
            conn.execute(text(cmd))
    print("Database constraints successfully updated!")

if __name__ == "__main__":
    main()
