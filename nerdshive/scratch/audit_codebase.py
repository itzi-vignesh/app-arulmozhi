import sys
import os

# Adjust path to import backend
sys.path.append(r"E:\1\backend")

from app.main import app
from app.models.base import Base
from sqlalchemy import inspect
import json

def get_endpoints():
    endpoints = []
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            path = getattr(route, "path")
            for method in route.methods:
                if method != "OPTIONS":
                    endpoints.append(f"{method} {path}")
    return sorted(list(set(endpoints)))

def get_models():
    models = {}
    for table_name, table in Base.metadata.tables.items():
        columns = [col.name for col in table.columns]
        models[table_name] = columns
    return models

def main():
    endpoints = get_endpoints()
    models = get_models()
    
    output = {
        "endpoints": endpoints,
        "models": models
    }
    
    with open(r"E:\1\scratch\audit_results.json", "w") as f:
        json.dump(output, f, indent=4)
        
if __name__ == "__main__":
    main()
