import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager

from database import engine, Base, SessionLocal
from routes.monitor import router as monitor_router, get_or_create_default_user
from scheduler import start_scheduler, shutdown_scheduler

backend_dir = os.path.dirname(os.path.abspath(__file__))
screenshots_dir = os.path.join(backend_dir, "screenshots")
templates_dir = os.path.join(backend_dir, "templates")

# Ensure screenshots directory exists
os.makedirs(screenshots_dir, exist_ok=True)
# Ensure templates directory exists
os.makedirs(templates_dir, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database Tables
    Base.metadata.create_all(bind=engine)
    
    # Ensure interaction_steps and selector_confidence columns exist in SQLite monitors table
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('monitors')]
        if 'interaction_steps' not in columns:
            with engine.begin() as conn:
                conn.execute("ALTER TABLE monitors ADD COLUMN interaction_steps TEXT DEFAULT '[]'")
            print("Successfully added interaction_steps column to monitors table.")
        if 'selector_confidence' not in columns:
            with engine.begin() as conn:
                conn.execute("ALTER TABLE monitors ADD COLUMN selector_confidence TEXT DEFAULT 'LOW'")
            print("Successfully added selector_confidence column to monitors table.")
        if 'monitor_type' not in columns:
            with engine.begin() as conn:
                conn.execute("ALTER TABLE monitors ADD COLUMN monitor_type TEXT DEFAULT 'text'")
            print("Successfully added monitor_type column to monitors table.")
        if 'image_url' not in columns:
            with engine.begin() as conn:
                conn.execute("ALTER TABLE monitors ADD COLUMN image_url TEXT")
            print("Successfully added image_url column to monitors table.")
    except Exception as e:
        print(f"Failed to verify/add columns to monitors table: {e}")

    # Provision default user
    db = SessionLocal()
    try:
        get_or_create_default_user(db)
    finally:
        db.close()
        
    # Start APScheduler worker check job
    start_scheduler()
    
    print("[SERVER STARTED]")
    print("API available at:", "http://localhost:8000")
    
    yield
    
    # Shutdown: Stop APScheduler worker check job
    shutdown_scheduler()

app = FastAPI(
    title="DOM Monitor Server Platform",
    lifespan=lifespan
)

# CORS configuration to accept requests from chrome-extensions or localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount screenshots static files directory
app.mount("/screenshots", StaticFiles(directory=screenshots_dir), name="screenshots")

# Setup Jinja2 templates directory
templates = Jinja2Templates(directory=templates_dir)

# Register routes
app.include_router(monitor_router, prefix="/api/monitor", tags=["monitor"])

@app.get("/")
def serve_dashboard(request: Request):
    """
    Serves the primary interactive monitoring dashboard.
    """
    return templates.TemplateResponse("dashboard.html", {"request": request})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
