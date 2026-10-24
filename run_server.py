"""
DRISHTI - Server Runner
Launches FastAPI with Uvicorn on 127.0.0.1:8000
"""

import uvicorn
import os
import sys

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("=" * 60)
    print("DRISHTI - AI Road Safety & Pothole Intelligence Platform")
    print("Tagline: See the Risk. Save a Life.")
    print("Serving on: http://127.0.0.1:8000")
    print("=" * 60)
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
