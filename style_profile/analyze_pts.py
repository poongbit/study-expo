import anime_face_detector
import cv2

detector = anime_face_detector.create_detector("yolov3", device="cpu")
img = cv2.imread("input.jpg")
preds = detector(img)
pts = preds[0]["keypoints"]
out = [{"idx": i, "x": float(p[0]), "y": float(p[1])} for i, p in enumerate(pts)]

print("Raw array:")
for p in out:
    print(f"idx={p['idx']}: x={p['x']:.1f}, y={p['y']:.1f}")
