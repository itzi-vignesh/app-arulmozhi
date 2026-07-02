import os
import sys

# Add backend to sys.path
sys.path.append('e:\\1\\backend')

from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:").replace(":5432/", ":5435/")
        
    print(f"Connecting to: {db_url}")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("Seeding meeting_rooms table...")
        
        # Check if rooms table is empty
        res = conn.execute(text("SELECT count(*) FROM meeting_rooms;")).scalar()
        if res == 0:
            rooms = [
                ("Meeting Room", 20, "1st Floor", "ACTIVE"),
            ]
            for name, capacity, loc, status in rooms:
                conn.execute(
                    text("INSERT INTO meeting_rooms (id, room_name, capacity, location, status, created_at, updated_at) "
                         "VALUES (gen_random_uuid(), :name, :capacity, :loc, :status, now(), now());"),
                    {"name": name, "capacity": capacity, "loc": loc, "status": status}
                )
            conn.commit()
            print("Successfully seeded 4 meeting rooms!")
        else:
            print(f"meeting_rooms table already has {res} records. Skipping seed.")

if __name__ == "__main__":
    main()
