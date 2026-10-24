"""
DRISHTI - AI Road Safety & Pothole Detection Pipeline
Powered by Ultralytics YOLOv11 + Computer Vision Road Distress Analysis
"""

import os
import cv2
import numpy as np
import base64
from ultralytics import YOLO
from typing import List, Dict, Any, Tuple

class DrishtiYOLODetector:
    def __init__(self, model_path: str = None):
        if model_path is None:
            # Default to local yolo11n.pt
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_path = os.path.join(base_dir, "yolo11n.pt")
            if not os.path.exists(model_path):
                model_path = "yolo11n.pt"
        
        self.model_path = model_path
        print(f"[DRISHTI AI] Initializing YOLOv11 Engine from: {model_path}")
        try:
            self.model = YOLO(model_path)
            self.is_ready = True
            print(f"[DRISHTI AI] YOLOv11 Engine Ready. Model name: {self.model.model_name}")
        except Exception as e:
            print(f"[DRISHTI AI] Warning: Could not initialize YOLO model directly ({e}). Using CV Distress Engine.")
            self.model = None
            self.is_ready = False

    def detect_potholes(self, image_np: np.ndarray) -> Dict[str, Any]:
        """
        Runs dual-stage detection:
        Stage 1: YOLOv11 visual pipeline inference
        Stage 2: Adaptive Road Distress & Crater Cavity Localization
        """
        h, w = image_np.shape[:2]
        total_pixels = h * w
        
        # 1. Run YOLO inference if available
        yolo_detections = []
        if self.model is not None:
            try:
                results = self.model(image_np, verbose=False, conf=0.25)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        cls_name = r.names.get(cls_id, str(cls_id)).lower()
                        conf = float(box.conf[0])
                        xyxy = box.xyxy[0].cpu().numpy().tolist()
                        # If custom model detects 'pothole' or road defects
                        if "pothole" in cls_name or "defect" in cls_name or "crack" in cls_name:
                            yolo_detections.append({
                                "box": [int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])],
                                "confidence": conf,
                                "source": "yolo11"
                            })
            except Exception as e:
                print(f"[DRISHTI AI] YOLO inference notice: {e}")

        # 2. Road Distress & Crater Cavity Localization Pipeline
        cv_detections = self._extract_road_crater_candidates(image_np)
        
        # Combine detections (prioritizing high-confidence candidates)
        all_candidates = yolo_detections + cv_detections
        
        # Non-Maximum Suppression (NMS) to remove overlapping candidate boxes
        merged_boxes = self._apply_nms(all_candidates, iou_thresh=0.35)
        
        # Classify severity and compute risk metrics for each pothole
        potholes = []
        annotated_img = image_np.copy()
        
        # Draw tactical HUD header on the annotated image
        self._draw_hud_header(annotated_img, len(merged_boxes))
        
        for idx, item in enumerate(merged_boxes, 1):
            x1, y1, x2, y2 = item["box"]
            bw = x2 - x1
            bh = y2 - y1
            area = bw * bh
            area_ratio = area / total_pixels
            
            # Analyze crater depth contrast in cavity interior
            patch = image_np[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
            depth_score = item.get("depth_score", 35.0)
            if patch.size > 0:
                gray_patch = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
                # Compute dark cavity core ratio
                core_val = float(np.percentile(gray_patch, 15))
                rim_val = float(np.percentile(gray_patch, 85))
                contrast = max(0, rim_val - core_val)
                depth_score = (depth_score + contrast) / 2.0
            
            # Calculate severity
            if area_ratio >= 0.045 or depth_score >= 42.0:
                severity = "Critical"
                color = (40, 40, 235) # BGR Red
                hex_color = "#EF4444"
                est_depth = round(11.0 + (depth_score * 0.15), 1) # cm
                risk_score = min(98, int(80 + (area_ratio * 300) + (depth_score * 0.2)))
                recommended_action = "Emergency Patching Required. High vehicle overturn & tire blowout hazard."
            elif area_ratio >= 0.02 or depth_score >= 28.0:
                severity = "High"
                color = (30, 150, 245) # BGR Amber
                hex_color = "#F59E0B"
                est_depth = round(6.5 + (depth_score * 0.1), 1)
                risk_score = min(79, int(55 + (area_ratio * 400)))
                recommended_action = "Priority Repair within 24h. Two-wheeler skid hazard."
            else:
                severity = "Medium"
                color = (45, 210, 235) # BGR Yellow
                hex_color = "#EAB308"
                est_depth = round(3.0 + (depth_score * 0.06), 1)
                risk_score = min(54, int(35 + (area_ratio * 400)))
                recommended_action = "Scheduled Maintenance. Road surface degradation detected."
            
            # Estimated real-world width in cm based on standard lane width scaling
            est_diameter = round(max(15.0, (bw / w) * 220), 1) # cm
            conf = item.get("confidence", 0.91)
            
            pothole_info = {
                "id": f"DEFECT-{idx:02d}",
                "box": [x1, y1, x2, y2],
                "normalized_box": [round(x1/w, 4), round(y1/h, 4), round(x2/w, 4), round(y2/h, 4)],
                "severity": severity,
                "color": hex_color,
                "confidence": round(conf, 3),
                "estimated_depth_cm": est_depth,
                "estimated_diameter_cm": est_diameter,
                "risk_score": risk_score,
                "area_pixels": area,
                "area_ratio": round(area_ratio, 4),
                "recommended_action": recommended_action
            }
            potholes.append(pothole_info)
            
            # Draw tactical cyber-style HUD annotations
            self._draw_tactical_bounding_box(
                annotated_img, x1, y1, x2, y2, 
                severity, conf, est_depth, est_diameter, color, idx
            )
            
        # Determine overall road condition summary
        if any(p["severity"] == "Critical" for p in potholes):
            overall_condition = "Critical Hazard (Immediate Action Required)"
            status_code = "CRITICAL"
        elif any(p["severity"] == "High" for p in potholes):
            overall_condition = "High Risk (Caution Advised)"
            status_code = "HIGH"
        elif len(potholes) > 0:
            overall_condition = "Moderate Distress (Scheduled Attention)"
            status_code = "MODERATE"
        else:
            overall_condition = "Road Surface Clear (No Immediate Potholes Detected)"
            status_code = "CLEAR"
            
        # Encode annotated image to Base64
        _, buffer = cv2.imencode(".jpg", annotated_img, [cv2.IMWRITE_JPEG_QUALITY, 88])
        annotated_b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")
        
        return {
            "potholes_count": len(potholes),
            "overall_condition": overall_condition,
            "status_code": status_code,
            "potholes": potholes,
            "image_dimensions": {"width": w, "height": h},
            "annotated_image": annotated_b64
        }

    def _extract_road_crater_candidates(self, img: np.ndarray) -> List[Dict[str, Any]]:
        """
        Specialized computer vision algorithm to isolate dark road cavities,
        asphalt fracturing, and crater rims.
        """
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Smooth high frequency road asphalt pebble noise while keeping crater edges
        blurred = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Road asphalt baseline intensity (mean brightness of center road area)
        road_baseline = float(np.median(blurred))
        
        # Threshold for significantly darker asphalt cavities (pothole depression)
        dark_thresh_val = max(18, int(road_baseline * 0.72))
        _, thresh = cv2.threshold(blurred, dark_thresh_val, 255, cv2.THRESH_BINARY_INV)
        
        # Morphological operations to clean speckles and fuse pothole cavities
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        opened = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
        closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates = []
        
        min_area = (w * h) * 0.0035  # At least 0.35% of frame
        max_area = (w * h) * 0.35    # Max 35% of frame to avoid background shadows
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if min_area <= area <= max_area:
                x, y, bw, bh = cv2.boundingRect(cnt)
                
                # Check aspect ratio (potholes are roughly elliptical/irregular, not thin lines)
                aspect_ratio = bw / float(bh) if bh > 0 else 0
                if 0.35 <= aspect_ratio <= 3.2:
                    # Calculate crater depth metric by comparing interior vs exterior
                    mask = np.zeros(gray.shape, dtype=np.uint8)
                    cv2.drawContours(mask, [cnt], -1, 255, -1)
                    mean_val = cv2.mean(gray, mask=mask)[0]
                    depth_score = max(10.0, road_baseline - mean_val)
                    
                    # Calculate confidence based on contour circularity & contrast
                    perimeter = cv2.arcLength(cnt, True)
                    circularity = 4 * np.pi * (area / (perimeter * perimeter)) if perimeter > 0 else 0
                    confidence = float(np.clip(0.78 + (depth_score * 0.004) + (circularity * 0.15), 0.75, 0.97))
                    
                    candidates.append({
                        "box": [x, y, x + bw, y + bh],
                        "confidence": confidence,
                        "depth_score": depth_score,
                        "source": "cv_distress"
                    })
                    
        return candidates

    def _apply_nms(self, candidates: List[Dict[str, Any]], iou_thresh: float = 0.35) -> List[Dict[str, Any]]:
        if not candidates:
            return []
            
        boxes = np.array([c["box"] for c in candidates])
        scores = np.array([c.get("confidence", 0.8) for c in candidates])
        
        x1 = boxes[:, 0]
        y1 = boxes[:, 1]
        x2 = boxes[:, 2]
        y2 = boxes[:, 3]
        
        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort()[::-1]
        
        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)
            
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])
            
            w = np.maximum(0.0, xx2 - xx1)
            h = np.maximum(0.0, yy2 - yy1)
            inter = w * h
            
            iou = inter / (areas[i] + areas[order[1:]] - inter)
            inds = np.where(iou <= iou_thresh)[0]
            order = order[inds + 1]
            
        return [candidates[k] for k in keep]

    def _draw_hud_header(self, img: np.ndarray, count: int):
        h, w = img.shape[:2]
        # Overlay semi-transparent top banner
        overlay = img.copy()
        cv2.rectangle(overlay, (0, 0), (w, 42), (18, 20, 24), -1)
        cv2.addWeighted(overlay, 0.75, img, 0.25, 0, img)
        
        # Border line
        cv2.line(img, (0, 42), (w, 42), (60, 65, 75), 1)
        
        # Text branding
        cv2.putText(img, "DRISHTI AI VISION [YOLOv11+CV]", (16, 26), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 230, 255), 2, cv2.LINE_AA)
        
        status_text = f"THREATS DETECTED: {count}" if count > 0 else "SURFACE STATUS: ALL CLEAR"
        status_color = (40, 40, 245) if count > 0 else (50, 220, 50)
        cv2.putText(img, status_text, (w - 300, 26), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, status_color, 2, cv2.LINE_AA)

    def _draw_tactical_bounding_box(self, img: np.ndarray, x1: int, y1: int, x2: int, y2: int,
                                   severity: str, conf: float, depth: float, diam: float,
                                   color: Tuple[int, int, int], idx: int):
        # Semi-transparent box fill for high-visibility crater highlighting
        overlay = img.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
        cv2.addWeighted(overlay, 0.15, img, 0.85, 0, img)
        
        # Main bounding box
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)
        
        # Cyber / tactical corner reticles
        corner_len = min(22, int(min(x2 - x1, y2 - y1) * 0.25))
        # Top-Left
        cv2.line(img, (x1, y1), (x1 + corner_len, y1), color, 4)
        cv2.line(img, (x1, y1), (x1, y1 + corner_len), color, 4)
        # Top-Right
        cv2.line(img, (x2, y1), (x2 - corner_len, y1), color, 4)
        cv2.line(img, (x2, y1), (x2, y1 + corner_len), color, 4)
        # Bottom-Left
        cv2.line(img, (x1, y2), (x1 + corner_len, y2), color, 4)
        cv2.line(img, (x1, y2), (x1, y2 - corner_len), color, 4)
        # Bottom-Right
        cv2.line(img, (x2, y2), (x2 - corner_len, y2), color, 4)
        cv2.line(img, (x2, y2), (x2, y2 - corner_len), color, 4)
        
        # Center crosshair
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        cv2.line(img, (cx - 8, cy), (cx + 8, cy), color, 1)
        cv2.line(img, (cx, cy - 8), (cx, cy + 8), color, 1)
        
        # Label badge
        label = f"#{idx} {severity.upper()} {int(conf * 100)}%"
        sub_label = f"D:{depth}cm | W:{diam}cm"
        
        # Draw label background
        badge_y = max(24, y1 - 8)
        cv2.rectangle(img, (x1, badge_y - 20), (x1 + 175, badge_y + 16), (20, 22, 28), -1)
        cv2.rectangle(img, (x1, badge_y - 20), (x1 + 175, badge_y + 16), color, 1)
        
        # Text
        cv2.putText(img, label, (x1 + 6, badge_y - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.48, color, 1, cv2.LINE_AA)
        cv2.putText(img, sub_label, (x1 + 6, badge_y + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (220, 225, 230), 1, cv2.LINE_AA)
