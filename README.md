# DRISHTI: AI-Powered Road Safety & Pothole Intelligence Platform

> **Tagline:** *See the Risk. Save a Life.*

DRISHTI is an enterprise-grade AI road safety intelligence platform designed to detect potholes, identify road hazards, assess asphalt distress levels, and empower civic authorities to prioritize repairs. By combining state-of-the-art **Ultralytics YOLOv11** computer vision with real-time citizen reporting and intelligent risk analysis, DRISHTI makes roads safer, smarter, and accident-free.

---

## 🚀 Key Modules & Architecture

### 1. User Authentication & Access Control (Dual-Portal Architecture)
- **General Public Portal**: Empower citizens to scan road hazards via camera/upload, track grievance status, and navigate safely.
- **Authority Command Center**: Dedicated role-based access for:
  - **Municipality / Civic Corporation**: Inner street maintenance, sanitation, and ward repairs.
  - **Traffic Police Department**: Traffic hazard management, emergency barricading, and school/hospital zone diversions.
  - **Roads & Development Department (PWD)**: Arterial roads, state highways, flyovers, and major infrastructure resurfacing.

### 2. Pothole Detection & Reporting Module (YOLOv11 Vision Core)
- **AI Computer Vision Pipeline**: Powered by Ultralytics YOLOv11 coupled with road distress cavity localization and asphalt depth gradient analysis.
- **Input Modes**:
  - Direct live camera capture (Webcam stream with real-time HUD reticle).
  - Manual image upload (Smartphones, Dashcams, CCTV).
  - Preloaded real-world sample hazard gallery for instant testing.
- **Geolocation & Tagging**:
  - One-click HTML5 GPS auto-fetch.
  - Interactive map pin dropper & manual coordinate override (Lat/Lon).
  - Contextual metadata: Road name, Ward/Area assignment, and Priority Sensitive Zone tagging (School zones, Hospital corridors).

### 3. Live Map & Intelligent Safe Navigation
- **Integrated Risk Heatmap**: Dynamic Leaflet heatmap visualizing pothole hazard density across city corridors.
- **Color-Coded Severity Markers**:
  - 🔴 **Critical**: Depth > 10cm or large crater cavity (Immediate puncture / turnover risk).
  - 🟠 **High**: Depth 5-10cm (Two-wheeler skid risk).
  - 🟡 **Medium**: Shallow depression / asphalt surface cracking.
  - 🟢 **Certified Repaired**: Inspected and closed work order sites.
- **Smart Road Selection (Dynamic Safe Routing)**:
  - Generates side-by-side comparison between **Direct Route** (Hazard Prone) and **DRISHTI Safe Route** (Detour bypassing all potholes).
  - Tailored transit modes:
    - 🚶 **Pedestrian** (Avoids muddy splash pools and damaged sidewalks).
    - 🛵 **Two-Wheeler** (Maximum hazard penalty for balance & skid prevention).
    - 🚗 **Four-Wheeler** (Bypasses rim-damaging craters).
    - 🏫 **Priority Sensitive Zones** (School & Hospital emergency corridors).

### 4. Department Routing & Complaint Management
- **Automated Ticket Assignment**: Automatically routes grievances based on road speed classification and severity.
- **Lookup & Verification**: Instant search by unique Ticket ID (e.g., `DRISHTI-2026-1042`).
- **Official Documentation**: Downloads official Government PDF Inspection Reports generated with ReportLab containing digital certification hashes, engineering telemetry, and department sign-offs.

### 5. Work Orders & Repair Lifecycle Tracking
- **Interactive Kanban Board**: Tracks 5 lifecycle stages:
  1. `Reported & Logged`
  2. `Inspection Scheduled`
  3. `Crew Dispatched`
  4. `Repair In-Progress (Bitumen/Cold-mix)`
  5. `Completed & Quality Certified`
- **Before vs After Verification**: Officials can upload completion photos, specify contractor names, and log asphalt materials used.

### 6. Reports & Strategic Analytics
- **Resolution KPIs**: Real-time counters for Total Detected, Successfully Repaired, Active Crews Deployed, and Resolution Rate %.
- **Hotspot Identification**: Automatically flags recurring danger corridors (e.g., Outer Ring Road, MG Road School Crossing) with structural audit recommendations.
- **Visual Analytics**: Interactive Chart.js donut and bar charts for department workload and severity distribution.

---

## 🛠️ Quick Start

### 1. Launch the Server
Double-click `start_drishti.bat` or run:
```powershell
cd C:\Users\HP\.gemini\antigravity\scratch\drishti
py run_server.py
```

### 2. Access the Platform
Open your browser and navigate to:
```
http://127.0.0.1:8000
```
