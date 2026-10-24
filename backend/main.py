"""
DRISHTI - AI-Powered Road Safety Intelligence Platform
FastAPI Application Entry Point
"""

import os
import cv2
import numpy as np
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from .detector import DrishtiYOLODetector
from .db import db
from .pdf_service import generate_pothole_pdf
from .routing_service import router
from .config_service import config_service

app = FastAPI(
    title="DRISHTI - Road Safety Intelligence Platform",
    description="AI-powered road safety and pothole management platform using YOLOv11",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI Detector
detector = DrishtiYOLODetector()

# Base directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
STATIC_DIR = os.path.join(FRONTEND_DIR, "static")
SAMPLE_DIR = os.path.join(BASE_DIR, "sample_images")

# Mount static and sample image directories
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if os.path.exists(SAMPLE_DIR):
    app.mount("/sample_images", StaticFiles(directory=SAMPLE_DIR), name="sample_images")

# ----------------- Models -----------------
class PotholeCreateRequest(BaseModel):
    road_name: str
    ward: str
    latitude: float
    longitude: float
    severity: str
    risk_score: Optional[int] = 70
    confidence: Optional[float] = 0.92
    estimated_depth_cm: Optional[float] = 8.0
    estimated_diameter_cm: Optional[float] = 45.0
    reported_by: Optional[str] = "Citizen"
    reporter_contact: Optional[str] = ""
    priority_zone: Optional[str] = "General Road"
    description: Optional[str] = ""
    photo_url: Optional[str] = "/sample_images/sample_critical_arterial.jpg"

class StatusUpdateRequest(BaseModel):
    status: str
    note: Optional[str] = None
    contractor: Optional[str] = None
    materials: Optional[str] = None
    after_photo_url: Optional[str] = None

class DepartmentAssignRequest(BaseModel):
    department: str
    note: Optional[str] = None

class RouteRequest(BaseModel):
    origin: List[float]
    destination: List[float]
    mode: Optional[str] = "two_wheeler"

class MapConfigRequest(BaseModel):
    active_provider: Optional[str] = "carto_dark"
    mapbox_token: Optional[str] = ""
    google_maps_key: Optional[str] = ""
    openrouteservice_key: Optional[str] = ""
    custom_tile_url: Optional[str] = ""

# ----------------- Endpoints -----------------

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "app_name": "DRISHTI",
        "tagline": "See the Risk. Save a Life.",
        "ai_engine": "YOLOv11 Deep Vision",
        "ai_ready": detector.is_ready,
        "model_path": detector.model_path
    }

@app.post("/api/detect")
async def detect_potholes(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    sample_name: Optional[str] = Form(None)
):
    """
    Accepts direct image file upload, camera base64 data, or sample image preset.
    Runs YOLOv11 + Computer Vision Road Distress Localizer.
    """
    img_np = None

    if file is not None:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    elif image_base64:
        # Format might be 'data:image/jpeg;base64,...'
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]
        img_bytes = base64.b64decode(image_base64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    elif sample_name:
        sample_path = os.path.join(SAMPLE_DIR, sample_name)
        if os.path.exists(sample_path):
            img_np = cv2.imread(sample_path)

    if img_np is None:
        raise HTTPException(status_code=400, detail="No valid image provided for YOLOv11 detection.")

    # Run AI Detection Pipeline
    result = detector.detect_potholes(img_np)
    return result

@app.get("/api/potholes")
def list_potholes(department: Optional[str] = None, status: Optional[str] = None, severity: Optional[str] = None):
    return db.get_all_potholes(department=department, status=status, severity=severity)

@app.get("/api/potholes/{pothole_id}")
def get_pothole(pothole_id: str):
    item = db.get_pothole_by_id(pothole_id)
    if not item:
        raise HTTPException(status_code=404, detail="Pothole ID not found in municipal registry.")
    return item

@app.post("/api/potholes")
def create_pothole(req: PotholeCreateRequest):
    record = db.create_pothole(req.dict())
    return record

@app.patch("/api/potholes/{pothole_id}/status")
def update_status(pothole_id: str, req: StatusUpdateRequest):
    updated = db.update_pothole_status(
        pothole_id=pothole_id,
        new_status=req.status,
        note=req.note,
        contractor=req.contractor,
        materials=req.materials,
        after_photo_url=req.after_photo_url
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Pothole ID not found.")
    return updated

@app.patch("/api/potholes/{pothole_id}/assign")
def assign_department(pothole_id: str, req: DepartmentAssignRequest):
    updated = db.assign_department(
        pothole_id=pothole_id,
        department_id=req.department,
        note=req.note
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Pothole ID not found.")
    return updated

@app.get("/api/reports/pdf/{pothole_id}")
def download_pdf_report(pothole_id: str):
    item = db.get_pothole_by_id(pothole_id)
    if not item:
        raise HTTPException(status_code=404, detail="Pothole ID not found.")
    
    pdf_bytes = generate_pothole_pdf(item)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=DRISHTI_Official_Report_{pothole_id}.pdf"
        }
    )

@app.get("/api/analytics")
def get_analytics():
    return db.get_analytics()

@app.post("/api/navigation/plan")
def plan_navigation(req: RouteRequest):
    return router.plan_route(origin=req.origin, destination=req.destination, mode=req.mode)

@app.get("/api/config/maps")
def get_map_config():
    return config_service.get_config()

@app.post("/api/config/maps")
def update_map_config(req: MapConfigRequest):
    saved = config_service.save_config(req.dict())
    return {"status": "success", "config": saved}

@app.get("/api/geocode/reverse")
def reverse_geocode(lat: float, lon: float):
    return config_service.reverse_geocode(lat, lon)

@app.get("/api/samples")
def list_samples():
    samples = []
    if os.path.exists(SAMPLE_DIR):
        for f in os.listdir(SAMPLE_DIR):
            if f.endswith((".jpg", ".png", ".jpeg")):
                samples.append({
                    "name": f,
                    "url": f"/sample_images/{f}",
                    "title": f.replace("sample_", "").replace(".jpg", "").replace("_", " ").title()
                })
    return samples

# Serve Web UI
@app.get("/", response_class=HTMLResponse)
def serve_ui():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>DRISHTI Platform Initializing...</h1>")
