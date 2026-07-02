import os
import sys
# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    print(f"Connecting to database: {db_url}")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        conn.execute(text("CREATE SEQUENCE IF NOT EXISTS customer_id_seq START WITH 1;"))
        conn.commit()
        print("Sequence 'customer_id_seq' created successfully!")
            
if __name__ == "__main__":
    main()
