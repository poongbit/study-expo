import os
import json
import cv2
import anime_face_detector
import glob

def main():
    images_dir = "images"
    outputs_dir = "outputs"
    
    os.makedirs(outputs_dir, exist_ok=True)
    
    print("Loading anime-face-detector...")
    # Using CPU to ensure compatibility
    detector = anime_face_detector.create_detector("yolov3", device="cpu")
    
    image_paths = []
    for ext in ["*.png", "*.jpg", "*.jpeg"]:
        image_paths.extend(glob.glob(os.path.join(images_dir, ext)))
        image_paths.extend(glob.glob(os.path.join(images_dir, ext.upper())))
    
    # Remove duplicates if any
    image_paths = list(set(image_paths))
    
    if not image_paths:
        print(f"No images found in {images_dir}/. Please add some images.")
        return
        
    print(f"Found {len(image_paths)} images.")
    
    results = []
    failed = []
    
    for path in sorted(image_paths):
        filename = os.path.basename(path)
        img = cv2.imread(path)
        if img is None:
            failed.append({"image": filename, "reason": "Failed to read image"})
            continue
            
        try:
            preds = detector(img)
        except Exception as e:
            failed.append({"image": filename, "reason": f"Detector error: {str(e)}"})
            continue
            
        if len(preds) == 0:
            failed.append({"image": filename, "reason": "No face detected"})
            continue
            
        # Sort faces by confidence score (index 4 of bbox)
        preds.sort(key=lambda x: x["bbox"][4], reverse=True)
        best_face = preds[0]
        
        score = float(best_face["bbox"][4])
        if score < 0.5:
            failed.append({"image": filename, "reason": f"Low confidence: {score:.2f}"})
            continue
            
        # Convert to serializable format
        bbox = [float(x) for x in best_face["bbox"]]
        keypoints = [[float(x) for x in pt] for pt in best_face["keypoints"]]
        
        results.append({
            "image": filename,
            "bbox": bbox,
            "keypoints": keypoints
        })
        print(f"Processed {filename}: Score {score:.2f}")
        
    # Save results
    landmarks_path = os.path.join(outputs_dir, "landmarks.json")
    with open(landmarks_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"Saved {len(results)} success results to {landmarks_path}")
    
    failed_path = os.path.join(outputs_dir, "failed_images.json")
    with open(failed_path, "w", encoding="utf-8") as f:
        json.dump(failed, f, indent=2)
    print(f"Saved {len(failed)} failed results to {failed_path}")

if __name__ == "__main__":
    main()
