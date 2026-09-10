import os
import json

def calculate_center(pts):
    if not pts:
        return 0.0, 0.0
    sum_x = sum(p[0] for p in pts)
    sum_y = sum(p[1] for p in pts)
    return sum_x / len(pts), sum_y / len(pts)

def get_min_max_x(pts):
    if not pts:
        return 0.0, 0.0
    xs = [p[0] for p in pts]
    return min(xs), max(xs)

def main():
    outputs_dir = "outputs"
    landmarks_path = os.path.join(outputs_dir, "landmarks.json")
    
    if not os.path.exists(landmarks_path):
        print(f"Error: {landmarks_path} not found. Run detect_landmarks.py first.")
        return
        
    with open(landmarks_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    results = []
    
    for item in data:
        filename = item["image"]
        bbox = item["bbox"]
        kpts = item["keypoints"]
        
        # Bbox is [x0, y0, x1, y1, score]
        head_width = bbox[2] - bbox[0]
        head_height = bbox[3] - bbox[1]
        
        if head_width <= 0 or head_height <= 0:
            print(f"Warning: Invalid bbox for {filename}")
            continue
            
        head_aspect_ratio = head_width / head_height
        
        # Left eye: indices 11-16
        left_eye_pts = kpts[11:17]
        # Right eye: indices 17-22
        right_eye_pts = kpts[17:23]
        
        left_cx, left_cy = calculate_center(left_eye_pts)
        right_cx, right_cy = calculate_center(right_eye_pts)
        
        eye_center_distance_ratio = abs(right_cx - left_cx) / head_width
        eye_y_diff_ratio = abs(right_cy - left_cy) / head_height
        
        _, left_max_x = get_min_max_x(left_eye_pts)
        right_min_x, _ = get_min_max_x(right_eye_pts)
        
        inter_eye_gap = right_min_x - left_max_x
        inter_eye_gap_ratio = inter_eye_gap / head_width
        
        results.append({
            "image": filename,
            "head_aspect_ratio": head_aspect_ratio,
            "eye_center_distance_ratio": eye_center_distance_ratio,
            "inter_eye_gap_ratio": inter_eye_gap_ratio,
            "eye_y_diff_ratio": eye_y_diff_ratio
        })
        
    features_path = os.path.join(outputs_dir, "features.json")
    with open(features_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        
    print(f"Extracted features for {len(results)} images to {features_path}")

if __name__ == "__main__":
    main()
