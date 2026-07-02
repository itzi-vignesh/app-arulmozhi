from datetime import datetime, timezone
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

def utc_now():
    return datetime.now(timezone.utc)
