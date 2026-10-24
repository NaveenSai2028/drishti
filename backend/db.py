"""
DRISHTI - Database & Persistent State Management
Stores complaints, department routing, work orders, repair lifecycle, and strategic audit data.
"""

import os
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "drishti_db.json")

INITIAL_DATA = {
    "departments": [
        {
            "id": "municipality",
            "name": "Municipality / Municipal Corporation",
            "short_name": "Municipality",
            "head": "Chief Municipal Engineer",
            "contact": "control@municipality.gov.in",
            "jurisdiction": "Ward Roads, Inner Streets, Drainage & Sanitation"
        },
        {
            "id": "police",
            "name": "Traffic Police Department",
            "short_name": "Traffic Police",
            "head": "DCP Traffic & Road Safety",
            "contact": "traffic.safety@police.gov.in",
            "jurisdiction": "Traffic Hazard Management, Emergency Barricading & Accident Prevention"
        },
        {
            "id": "roads_dev",
            "name": "Roads & Development Department (PWD)",
            "short_name": "Roads & Development",
            "head": "Superintending Engineer (Highways)",
            "contact": "pwd.roads@state.gov.in",
            "jurisdiction": "Arterial Roads, State Highways, Flyovers & Major Infrastructure"
        }
    ],
    "potholes": [
        {
            "id": "DRISHTI-2026-1042",
            "road_name": "Outer Ring Road, Near Tech Hub Flyover",
            "ward": "Ward 7 - South Corridor",
            "latitude": 12.9279,
            "longitude": 77.6271,
            "severity": "Critical",
            "risk_score": 94,
            "confidence": 0.965,
            "estimated_depth_cm": 15.2,
            "estimated_diameter_cm": 72.0,
            "reported_by": "Citizen (Pooja Rao)",
            "reporter_contact": "+91 98450-29182",
            "reported_at": "2026-10-21T09:30:00Z",
            "assigned_department": "roads_dev",
            "status": "in_progress",  # reported, inspection, dispatched, in_progress, completed
            "priority_zone": "High-Speed Arterial Corridor",
            "description": "Deep tire-bursting crater on middle lane. Severe water stagnation during rains.",
            "photo_url": "/sample_images/sample_critical_arterial.jpg",
            "after_photo_url": None,
            "contractor": "National Infrastructure Infra Corp",
            "materials_used": "Bituminous Concrete (Grade 2), Tack Coat",
            "timeline": [
                {"step": "Reported", "timestamp": "2026-10-21T09:30:00Z", "note": "Grievance logged via DRISHTI Citizen App"},
                {"step": "AI Triage & Verification", "timestamp": "2026-10-21T09:31:00Z", "note": "YOLOv11 categorized CRITICAL. Depth: 15.2cm"},
                {"step": "Department Assigned", "timestamp": "2026-10-21T10:15:00Z", "note": "Auto-routed to Roads & Development Dept"},
                {"step": "Inspection Completed", "timestamp": "2026-10-21T14:00:00Z", "note": "Field Engineer verified structural base failure"},
                {"step": "Crew Dispatched", "timestamp": "2026-10-22T08:30:00Z", "note": "Hot-mix asphalt patch team deployed (Truck #KA-04-E-8812)"},
                {"step": "Repair In-Progress", "timestamp": "2026-10-22T11:00:00Z", "note": "Milling and edge cutting underway"}
            ]
        },
        {
            "id": "DRISHTI-2026-1088",
            "road_name": "MG Road, Opp. St. Mary's Convent School",
            "ward": "Ward 3 - Central Civic",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "severity": "Critical",
            "risk_score": 96,
            "confidence": 0.948,
            "estimated_depth_cm": 13.8,
            "estimated_diameter_cm": 65.0,
            "reported_by": "School Administration",
            "reporter_contact": "+91 97411-88231",
            "reported_at": "2026-10-22T07:45:00Z",
            "assigned_department": "police",
            "status": "dispatched",
            "priority_zone": "School Zone",
            "description": "Hazardous cluster right outside school entrance gate. Two school vans suffered rim damage.",
            "photo_url": "/sample_images/sample_school_zone_hazards.jpg",
            "after_photo_url": None,
            "contractor": "Apex Highway Maintenance",
            "materials_used": "Cold-mix emergency asphalt, retroreflective warning signs",
            "timeline": [
                {"step": "Reported", "timestamp": "2026-10-22T07:45:00Z", "note": "Reported as high risk to student transit"},
                {"step": "AI Triage", "timestamp": "2026-10-22T07:46:00Z", "note": "Flagged CRITICAL with Priority Sensitive Zone Tag"},
                {"step": "Police Barricading", "timestamp": "2026-10-22T08:20:00Z", "note": "Traffic Police deployed safety cones & diversion signs"},
                {"step": "Crew Dispatched", "timestamp": "2026-10-22T13:00:00Z", "note": "Emergency repair crew dispatched"}
            ]
        },
        {
            "id": "DRISHTI-2026-1102",
            "road_name": "100ft Hospital Access Road, Metro Pillar 184",
            "ward": "Ward 5 - West End",
            "latitude": 12.9815,
            "longitude": 77.5452,
            "severity": "High",
            "risk_score": 78,
            "confidence": 0.925,
            "estimated_depth_cm": 8.5,
            "estimated_diameter_cm": 48.0,
            "reported_by": "Ambulance Driver (Suresh K.)",
            "reporter_contact": "+91 99002-12443",
            "reported_at": "2026-10-20T16:10:00Z",
            "assigned_department": "municipality",
            "status": "completed",
            "priority_zone": "Hospital Corridor",
            "description": "Pothole in ambulance emergency lane causing severe patient discomfort and transport delay.",
            "photo_url": "/sample_images/sample_high_urban.jpg",
            "after_photo_url": "/sample_images/sample_medium_suburban.jpg",
            "contractor": "City Civic Infrastructure Works",
            "materials_used": "Rapid-setting mastic asphalt, roller compaction",
            "timeline": [
                {"step": "Reported", "timestamp": "2026-10-20T16:10:00Z", "note": "Grievance filed for Hospital transit zone"},
                {"step": "Department Assigned", "timestamp": "2026-10-20T16:40:00Z", "note": "Assigned to Municipality Ward Division"},
                {"step": "Inspection Completed", "timestamp": "2026-10-21T08:30:00Z", "note": "Emergency hospital corridor fast-track approved"},
                {"step": "Crew Dispatched", "timestamp": "2026-10-21T10:15:00Z", "note": "Asphalt crew on site"},
                {"step": "Repaired & Verified", "timestamp": "2026-10-21T17:45:00Z", "note": "Repair certified and road opened for emergency transit"}
            ]
        },
        {
            "id": "DRISHTI-2026-1145",
            "road_name": "4th Cross, 2nd Main, Indiranagar Residential",
            "ward": "Ward 4 - East District",
            "latitude": 12.9784,
            "longitude": 77.6408,
            "severity": "Medium",
            "risk_score": 45,
            "confidence": 0.880,
            "estimated_depth_cm": 4.2,
            "estimated_diameter_cm": 32.0,
            "reported_by": "Resident Association",
            "reporter_contact": "+91 98860-55442",
            "reported_at": "2026-10-23T11:20:00Z",
            "assigned_department": "municipality",
            "status": "inspection",
            "priority_zone": "Residential Street",
            "description": "Surface peeling and shallow depression after monsoon drain pipe work.",
            "photo_url": "/sample_images/sample_medium_suburban.jpg",
            "after_photo_url": None,
            "contractor": "Ward 4 Zonal Contractor",
            "materials_used": "Cold asphalt patch",
            "timeline": [
                {"step": "Reported", "timestamp": "2026-10-23T11:20:00Z", "note": "Logged by Resident Welfare President"},
                {"step": "Department Assigned", "timestamp": "2026-10-23T12:00:00Z", "note": "Assigned to Municipality Zonal Team"},
                {"step": "Inspection Scheduled", "timestamp": "2026-10-23T15:30:00Z", "note": "Site visit scheduled for tomorrow 10:00 AM"}
            ]
        }
    ],
    "hotspots": [
        {
            "name": "Outer Ring Road - Tech Corridor Junction",
            "ward": "Ward 7",
            "latitude": 12.9285,
            "longitude": 77.6280,
            "risk_level": "CRITICAL",
            "recurring_count": 8,
            "last_audited": "2026-10-18",
            "recommendation": "Full base course reconstruction & stormwater subsurface drainage redesign."
        },
        {
            "name": "MG Road - St. Mary's School Crossing",
            "ward": "Ward 3",
            "latitude": 12.9718,
            "longitude": 77.5950,
            "risk_level": "CRITICAL",
            "recurring_count": 6,
            "last_audited": "2026-10-15",
            "recommendation": "Pedestrian safety raised tabletop crossing with high-durability mastic overlay."
        },
        {
            "name": "Old Airport Road - Wind Tunnel Curve",
            "ward": "Ward 8",
            "latitude": 12.9560,
            "longitude": 77.6520,
            "risk_level": "HIGH",
            "recurring_count": 5,
            "last_audited": "2026-10-12",
            "recommendation": "Milling of degraded top layer and installation of geo-grid reinforcement."
        },
        {
            "name": "Hosur Main Road - Silk Board Approach",
            "ward": "Ward 9",
            "latitude": 12.9175,
            "longitude": 77.6235,
            "risk_level": "CRITICAL",
            "recurring_count": 11,
            "last_audited": "2026-10-20",
            "recommendation": "Heavy vehicle rutting repair. Replace bituminous macadam with micro-surfacing."
        }
    ]
}

class DrishtiDB:
    def __init__(self):
        self._ensure_db()

    def _ensure_db(self):
        os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
        if not os.path.exists(DB_FILE):
            with open(DB_FILE, "w", encoding="utf-8") as f:
                json.dump(INITIAL_DATA, f, indent=2)

    def _read(self) -> Dict[str, Any]:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write(self, data: Dict[str, Any]):
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def get_all_potholes(self, department: Optional[str] = None, status: Optional[str] = None, severity: Optional[str] = None) -> List[Dict[str, Any]]:
        data = self._read()
        potholes = data.get("potholes", [])
        if department and department != "all":
            potholes = [p for p in potholes if p.get("assigned_department") == department]
        if status and status != "all":
            potholes = [p for p in potholes if p.get("status") == status]
        if severity and severity != "all":
            potholes = [p for p in potholes if p.get("severity", "").lower() == severity.lower()]
        return potholes

    def get_pothole_by_id(self, pothole_id: str) -> Optional[Dict[str, Any]]:
        data = self._read()
        for p in data.get("potholes", []):
            if p.get("id").upper() == pothole_id.upper():
                return p
        return None

    def create_pothole(self, pothole_data: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read()
        potholes = data.get("potholes", [])
        
        # Generate unique ID
        year = datetime.now().year
        seq = 1000 + len(potholes) + 1
        new_id = f"DRISHTI-{year}-{seq:04d}"
        
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Automated Ticket Routing Algorithm
        severity = pothole_data.get("severity", "Medium")
        priority_zone = pothole_data.get("priority_zone", "")
        road_name = pothole_data.get("road_name", "").lower()
        
        # Department Routing logic:
        # 1. Police Dept: if School zone / Hospital zone emergency or High-speed highway needing urgent diversion
        # 2. Roads & Dev (PWD): if Arterial / Highway / Ring Road or Critical structural base failure
        # 3. Municipality: Ward streets, inner civic roads, residential roads
        if "school" in priority_zone.lower() or "hospital" in priority_zone.lower() or "accident" in road_name:
            auto_dept = "police"
        elif "ring road" in road_name or "highway" in road_name or "flyover" in road_name or severity == "Critical":
            auto_dept = "roads_dev"
        else:
            auto_dept = "municipality"
            
        record = {
            "id": new_id,
            "road_name": pothole_data.get("road_name", "Unspecified Municipal Road"),
            "ward": pothole_data.get("ward", "Ward 1 - General Central"),
            "latitude": float(pothole_data.get("latitude", 12.9716)),
            "longitude": float(pothole_data.get("longitude", 77.5946)),
            "severity": severity,
            "risk_score": int(pothole_data.get("risk_score", 65)),
            "confidence": float(pothole_data.get("confidence", 0.92)),
            "estimated_depth_cm": float(pothole_data.get("estimated_depth_cm", 6.0)),
            "estimated_diameter_cm": float(pothole_data.get("estimated_diameter_cm", 40.0)),
            "reported_by": pothole_data.get("reported_by", "Concerned Citizen"),
            "reporter_contact": pothole_data.get("reporter_contact", "Not Provided"),
            "reported_at": now_iso,
            "assigned_department": auto_dept,
            "status": "reported",
            "priority_zone": priority_zone or "General Urban Road",
            "description": pothole_data.get("description", "Detected and reported through DRISHTI AI safety platform."),
            "photo_url": pothole_data.get("photo_url", "/sample_images/sample_critical_arterial.jpg"),
            "after_photo_url": None,
            "contractor": "To Be Assigned by Department",
            "materials_used": "Pending Engineering Assessment",
            "timeline": [
                {"step": "Reported", "timestamp": now_iso, "note": "Grievance logged with AI telemetry"},
                {"step": "AI Vision Triage", "timestamp": now_iso, "note": f"YOLOv11 verified. Severity: {severity}. Estimated depth: {pothole_data.get('estimated_depth_cm', 6.0)}cm"},
                {"step": "Automated Department Routing", "timestamp": now_iso, "note": f"Ticket auto-assigned to {auto_dept.upper()} based on road classification"}
            ]
        }
        
        potholes.insert(0, record)
        data["potholes"] = potholes
        self._write(data)
        return record

    def update_pothole_status(self, pothole_id: str, new_status: str, note: Optional[str] = None, 
                              contractor: Optional[str] = None, materials: Optional[str] = None,
                              after_photo_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        data = self._read()
        potholes = data.get("potholes", [])
        now_iso = datetime.now(timezone.utc).isoformat()
        
        status_labels = {
            "reported": "Reported & Logged",
            "inspection": "Inspection Scheduled",
            "dispatched": "Crew Dispatched to Site",
            "in_progress": "Repair In-Progress (Asphalt Layering)",
            "completed": "Repair Completed & Quality Certified"
        }
        
        for p in potholes:
            if p.get("id").upper() == pothole_id.upper():
                p["status"] = new_status
                if contractor:
                    p["contractor"] = contractor
                if materials:
                    p["materials_used"] = materials
                if after_photo_url:
                    p["after_photo_url"] = after_photo_url
                    
                step_title = status_labels.get(new_status, new_status.replace("_", " ").title())
                p.setdefault("timeline", []).append({
                    "step": step_title,
                    "timestamp": now_iso,
                    "note": note or f"Status transitioned to {step_title}"
                })
                self._write(data)
                return p
        return None

    def assign_department(self, pothole_id: str, department_id: str, note: Optional[str] = None) -> Optional[Dict[str, Any]]:
        data = self._read()
        potholes = data.get("potholes", [])
        now_iso = datetime.now(timezone.utc).isoformat()
        
        for p in potholes:
            if p.get("id").upper() == pothole_id.upper():
                old_dept = p.get("assigned_department", "Unassigned")
                p["assigned_department"] = department_id
                p.setdefault("timeline", []).append({
                    "step": "Department Re-assignment",
                    "timestamp": now_iso,
                    "note": note or f"Transferred from {old_dept} to {department_id.upper()}"
                })
                self._write(data)
                return p
        return None

    def get_analytics(self) -> Dict[str, Any]:
        data = self._read()
        potholes = data.get("potholes", [])
        
        total = len(potholes)
        completed = sum(1 for p in potholes if p.get("status") == "completed")
        in_progress = sum(1 for p in potholes if p.get("status") in ["dispatched", "in_progress"])
        pending = sum(1 for p in potholes if p.get("status") in ["reported", "inspection"])
        
        critical_count = sum(1 for p in potholes if p.get("severity") == "Critical")
        high_count = sum(1 for p in potholes if p.get("severity") == "High")
        medium_count = sum(1 for p in potholes if p.get("severity") == "Medium")
        
        resolution_rate = round((completed / total * 100), 1) if total > 0 else 0.0
        
        # Department counts
        by_dept = {
            "municipality": {"total": 0, "completed": 0},
            "police": {"total": 0, "completed": 0},
            "roads_dev": {"total": 0, "completed": 0}
        }
        for p in potholes:
            d = p.get("assigned_department", "municipality")
            if d in by_dept:
                by_dept[d]["total"] += 1
                if p.get("status") == "completed":
                    by_dept[d]["completed"] += 1
                    
        return {
            "metrics": {
                "total_detected": total,
                "repaired": completed,
                "in_progress": in_progress,
                "pending": pending,
                "resolution_rate_percent": resolution_rate,
                "average_repair_time_hours": 18.6,
                "active_crews_deployed": 14,
                "accidents_prevented_est": total * 3
            },
            "severity_breakdown": {
                "Critical": critical_count,
                "High": high_count,
                "Medium": medium_count
            },
            "department_performance": by_dept,
            "hotspots": data.get("hotspots", [])
        }

db = DrishtiDB()
