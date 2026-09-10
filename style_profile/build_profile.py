import os
import json
import numpy as np

def compute_stats(values):
    if not values:
        return {}
    
    v = np.array(values)
    return {
        "count": len(v),
        "mean": float(np.mean(v)),
        "median": float(np.median(v)),
        "std": float(np.std(v, ddof=1) if len(v) > 1 else 0.0),
        "min": float(np.min(v)),
        "max": float(np.max(v)),
        "p25": float(np.percentile(v, 25)),
        "p75": float(np.percentile(v, 75))
    }

def main():
    outputs_dir = "outputs"
    features_path = os.path.join(outputs_dir, "features.json")
    
    if not os.path.exists(features_path):
        print(f"Error: {features_path} not found. Run extract_style_features.py first.")
        return
        
    with open(features_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    if not data:
        print("No feature data found.")
        return
        
    # Collect values for each feature
    feature_lists = {
        "head_aspect_ratio": [],
        "eye_center_distance_ratio": [],
        "inter_eye_gap_ratio": [],
        "eye_y_diff_ratio": []
    }
    
    for item in data:
        for key in feature_lists:
            if key in item:
                feature_lists[key].append(item[key])
                
    # Compute statistics
    profile = {}
    for key, values in feature_lists.items():
        profile[key] = compute_stats(values)
        
    profile_path = os.path.join(outputs_dir, "chibi_2head_front_v1.json")
    with open(profile_path, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2)
        
    print(f"Built style profile based on {len(data)} images.")
    print(f"Saved profile to {profile_path}")

if __name__ == "__main__":
    main()
