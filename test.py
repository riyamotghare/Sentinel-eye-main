import cv2
cap = cv2.VideoCapture("uploads/webcam-1786877072553", cv2.CAP_FFMPEG)
print("Local frames:", int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))
cap.release()

from detector import extract_frames

frames = extract_frames("uploads/webcam-1786877072553")
print("Local frame[0] mean pixel value:", frames[0].mean())
print("Local frame[0][0][0]:", frames[0][0][0])

from detector import extract_frames, predict_video

frames = extract_frames("uploads/webcam-1786877072553")
print("Local frame[0] mean pixel value:", frames[0].mean())
print("Local frame[0][0][0]:", frames[0][0][0])

result = predict_video("uploads/webcam-1786877072553")
print(result)