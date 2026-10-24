"""
DRISHTI - Map Configuration & Geocoding Service
Handles API key persistence (Mapbox, Google Maps, OpenRouteService) and Reverse Geocoding.
"""

import os
import json
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "config.json")

DEFAULT_CONFIG = {
    "active_provider": "esri_dark",
    "mapbox_token": os.environ.get("MAPBOX_ACCESS_TOKEN", ""),
    "google_maps_key": os.environ.get("GOOGLE_MAPS_API_KEY", ""),
    "openrouteservice_key": os.environ.get("OPENROUTESERVICE_API_KEY", ""),
    "custom_tile_url": ""
}

class ConfigService:
    def __init__(self):
        self._ensure_config()

    def _ensure_config(self):
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        if not os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_CONFIG, f, indent=2)

    def get_config(self) -> Dict[str, Any]:
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                # Fallback to env vars if file is empty
                for k, v in DEFAULT_CONFIG.items():
                    if not cfg.get(k) and v:
                        cfg[k] = v
                return cfg
        except Exception:
            return DEFAULT_CONFIG.copy()

    def save_config(self, new_cfg: Dict[str, Any]) -> Dict[str, Any]:
        curr = self.get_config()
        for k in ["active_provider", "mapbox_token", "google_maps_key", "openrouteservice_key", "custom_tile_url"]:
            if k in new_cfg:
                curr[k] = str(new_cfg[k]).strip()
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(curr, f, indent=2)
        return curr

    def reverse_geocode(self, lat: float, lon: float) -> Dict[str, str]:
        """
        Reverse geocodes coordinates to obtain real road name, neighborhood/ward, and city.
        Uses Nominatim with a dedicated DRISHTI User-Agent.
        """
        try:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
            req = urllib.request.Request(url, headers={"User-Agent": "DrishtiRoadSafetyPlatform/1.0 (contact: info@drishti.gov)"})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    address = data.get("address", {})
                    road = address.get("road") or address.get("pedestrian") or address.get("suburb") or "Identified Municipal Road"
                    suburb = address.get("suburb") or address.get("neighbourhood") or address.get("city_district") or address.get("county") or "Central Division"
                    city = address.get("city") or address.get("town") or address.get("village") or "Metropolitan Region"
                    
                    return {
                        "road_name": f"{road}, {suburb}",
                        "ward": f"{suburb} Zone - {city}",
                        "display_name": data.get("display_name", "")
                    }
        except Exception as e:
            print(f"[DRISHTI Geocode] Reverse geocoding notice: {e}")
        
        # Fallback to local coordinate representation
        return {
            "road_name": f"Road Segment [{lat:.4f}, {lon:.4f}]",
            "ward": "Identified Municipal Ward",
            "display_name": f"Latitude: {lat}, Longitude: {lon}"
        }

config_service = ConfigService()
