"""
Script to generate sample realistic road images with potholes for instant testing in DRISHTI.
"""
import cv2
import numpy as np
import os

sample_dir = r"C:\Users\HP\.gemini\antigravity\scratch\drishti\sample_images"
os.makedirs(sample_dir, exist_ok=True)

def create_asphalt_texture(w=800, h=600):
    # Base asphalt color (dark grey with noise)
    base = np.random.normal(70, 15, (h, w, 3)).astype(np.uint8)
    # Add subtle asphalt grain
    grain = np.random.randint(-15, 15, (h, w, 3), dtype=np.int16)
    asphalt = np.clip(base.astype(np.int16) + grain, 20, 120).astype(np.uint8)
    return asphalt

def add_lane_marking(img):
    h, w, _ = img.shape
    # White dashed lane line on right side
    cv2.line(img, (int(w * 0.8), 0), (int(w * 0.8), h), (220, 220, 220), 12)
    # Yellow center line
    for y in range(0, h, 60):
        cv2.line(img, (int(w * 0.2), y), (int(w * 0.2), min(y + 35, h)), (40, 200, 230), 8)

def draw_pothole(img, center, axes, angle, depth_darkness=30, roughness=1.2):
    # Draw crater cavity with dark depth gradient and jagged edges
    cx, cy = center
    rx, ry = axes
    
    # Create jagged polygon for realistic irregular pothole
    num_points = 24
    angles = np.linspace(0, 2 * np.pi, num_points, endpoint=False)
    # Random radius variation for irregular rim
    radii_x = rx * (1 + (np.random.rand(num_points) - 0.5) * 0.35 * roughness)
    radii_y = ry * (1 + (np.random.rand(num_points) - 0.5) * 0.35 * roughness)
    
    pts = []
    rad = np.radians(angle)
    cos_a, sin_a = np.cos(rad), np.sin(rad)
    for i in range(num_points):
        x = radii_x[i] * np.cos(angles[i])
        y = radii_y[i] * np.sin(angles[i])
        rx_rot = int(cx + x * cos_a - y * sin_a)
        ry_rot = int(cy + x * sin_a + y * cos_a)
        pts.append([rx_rot, ry_rot])
    
    poly = np.array(pts, dtype=np.int32)
    
    # Outer broken edge rim (lighter crumbling asphalt dust)
    cv2.polylines(img, [poly], isClosed=True, color=(110, 105, 100), thickness=6)
    
    # Crater filling with depth gradient (darker towards the center/deepest part)
    cv2.fillPoly(img, [poly], color=(depth_darkness, depth_darkness - 5, depth_darkness - 10))
    
    # Add inner shadow / deep crater pit
    inner_poly = np.array([[int(cx + (p[0] - cx) * 0.6), int(cy + (p[1] - cy) * 0.6)] for p in pts], dtype=np.int32)
    cv2.fillPoly(img, [inner_poly], color=(max(5, depth_darkness - 20), max(5, depth_darkness - 22), max(5, depth_darkness - 25)))
    
    # Radiating asphalt cracks around the pothole rim
    for i in range(0, num_points, 4):
        start_pt = tuple(pts[i])
        crack_len = np.random.randint(25, 70)
        crack_angle = angles[i] + np.random.uniform(-0.3, 0.3)
        end_pt = (
            int(start_pt[0] + crack_len * np.cos(crack_angle)),
            int(start_pt[1] + crack_len * np.sin(crack_angle))
        )
        mid_pt = (
            int((start_pt[0] + end_pt[0]) / 2 + np.random.randint(-8, 8)),
            int((start_pt[1] + end_pt[1]) / 2 + np.random.randint(-8, 8))
        )
        cv2.polylines(img, [np.array([start_pt, mid_pt, end_pt], dtype=np.int32)], isClosed=False, color=(25, 25, 25), thickness=2)

# Sample 1: Critical Deep Crater on Arterial Road
img1 = create_asphalt_texture(800, 600)
add_lane_marking(img1)
draw_pothole(img1, center=(420, 340), axes=(130, 85), angle=-10, depth_darkness=25, roughness=1.4)
draw_pothole(img1, center=(220, 220), axes=(60, 45), angle=15, depth_darkness=35, roughness=1.1)
cv2.imwrite(os.path.join(sample_dir, "sample_critical_arterial.jpg"), img1)

# Sample 2: High Severity Urban Road Pothole
img2 = create_asphalt_texture(800, 600)
add_lane_marking(img2)
draw_pothole(img2, center=(380, 290), axes=(95, 60), angle=25, depth_darkness=30, roughness=1.2)
cv2.imwrite(os.path.join(sample_dir, "sample_high_urban.jpg"), img2)

# Sample 3: Multi-hazard School Zone Road
img3 = create_asphalt_texture(800, 600)
add_lane_marking(img3)
draw_pothole(img3, center=(480, 380), axes=(110, 75), angle=-15, depth_darkness=25, roughness=1.3)
draw_pothole(img3, center=(260, 310), axes=(55, 40), angle=30, depth_darkness=40, roughness=1.0)
draw_pothole(img3, center=(600, 210), axes=(45, 30), angle=-5, depth_darkness=42, roughness=0.9)
cv2.imwrite(os.path.join(sample_dir, "sample_school_zone_hazards.jpg"), img3)

# Sample 4: Medium Distress Road Surface
img4 = create_asphalt_texture(800, 600)
add_lane_marking(img4)
draw_pothole(img4, center=(350, 310), axes=(55, 38), angle=12, depth_darkness=45, roughness=0.8)
cv2.imwrite(os.path.join(sample_dir, "sample_medium_suburban.jpg"), img4)

print("Generated 4 realistic sample road images in", sample_dir)
