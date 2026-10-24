"""
DRISHTI - Server Runner
Launches FastAPI with Uvicorn dynamically binding to Render's $PORT or local default.
"""

import uvicorn
import os
import sys

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Render assigns $PORT dynamically (default to 8000 locally)
    port = int(os.environ.get("PORT", 8000))
    # Listen on all interfaces (0.0.0.0) so Render's proxy can route traffic
    host = os.environ.get("HOST", "0.0.0.0")

    print("=" * 60)
    print("DRISHTI - AI Road Safety & Pothole Intelligence Platform")
    print("Tagline: See the Risk. Save a Life.")
    print(f"Serving on: http://{host}:{port}")
    print("=" * 60)
    
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
