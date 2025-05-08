from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import cv2
import time
import json
import base64 # For encoding frames
from collections import deque
from model_loader import preprocess_frame, predict_from_buffer

# Configuration
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app)

video_sessions = {} 

@app.route('/upload', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({"error": "No video file part"}), 400
    file = request.files['video']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file:
        filename = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filename)
        session_id = "".join(c for c in file.filename if c.isalnum()) + str(int(time.time()))
        video_sessions[session_id] = {"filepath": filename, "buffer_size": 32} # Default
        # We don't return video_url anymore as the frontend won't use a <video> tag src
        return jsonify({"message": "Video uploaded successfully", "session_id": session_id}), 200
    return jsonify({"error": "File upload failed"}), 500

# This route might still be useful for debugging or other purposes, but not for main video display
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


def generate_frames_and_detections(video_path, buffer_size_frames):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        # Send an error event if video can't be opened
        error_payload = json.dumps({"message": "Could not open video file."})
        yield f"event: error\ndata: {error_payload}\n\n"
        return

    frame_buffer = deque(maxlen=buffer_size_frames)
    
    # Get video FPS to control streaming speed
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_delay = 1.0 / fps if fps > 0 else 0.033  # Default to ~30 FPS if unknown

    frame_count = 0
    print(f"Starting synchronized stream for {video_path} with buffer_size {buffer_size_frames}, FPS: {fps:.2f}")
    try:
        while cap.isOpened():
            stream_loop_start_time = time.time()
            ret, frame = cap.read()
            if not ret:
                print("End of video or cannot read frame.")
                break

            # 1. Send frame for display to frontend
            _, jpeg_buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 100]) # Quality 70 for smaller size
            jpg_as_text = base64.b64encode(jpeg_buffer).decode('utf-8')
            frame_payload = json.dumps({"image_data": jpg_as_text})
            yield f"event: frame_update\ndata: {frame_payload}\n\n"

            print(f"sent frame {frame_count}")
            frame_count += 1

            # 2. Preprocess and add to internal buffer for model
            # preprocess_frame expects BGR, cv2.read provides BGR
            processed_model_frame = preprocess_frame(frame.copy()) # Use a copy for preprocessing
            frame_buffer.append(processed_model_frame)

            # 3. If buffer is full, predict and send detection
            if len(frame_buffer) == buffer_size_frames:
                # print(f"Buffer full ({len(frame_buffer)} frames), predicting...")
                # Pass a list copy of the deque to predict_from_buffer
                predicted_class, confidence = predict_from_buffer(list(frame_buffer)) 
                
                if predicted_class is not None:
                    detection_payload = json.dumps({
                        "class_name": predicted_class,
                        "confidence": float(confidence) 
                    })
                    yield f"event: detection_update\ndata: {detection_payload}\n\n"
                    # print(f"Sent detection: {predicted_class} - {confidence:.2f}")
                
                # Slide the window: remove the oldest frame to make space for the next one.
                # This ensures continuous prediction on overlapping clips.
                frame_buffer.popleft() 
            
            # Control streaming speed
            elapsed_time = time.time() - stream_loop_start_time
            sleep_time = frame_delay - elapsed_time
            if sleep_time > 0:
                time.sleep(sleep_time)
        
    except Exception as e:
        print(f"Error during streaming: {e}")
        error_payload = json.dumps({"message": f"Streaming error: {str(e)}"})
        yield f"event: error\ndata: {error_payload}\n\n"
    finally:
        cap.release()
        end_payload = json.dumps({"message": "Video processing finished."})
        yield f"event: stream_end\ndata: {end_payload}\n\n"
        print(f"Stream finished for {video_path}")


@app.route('/process_video_stream/<session_id>')
def process_video_stream_route(session_id):
    if session_id not in video_sessions:
        return jsonify({"error": "Invalid session ID"}), 404
    
    video_data = video_sessions[session_id]
    video_path = video_data['filepath']
    # Get buffer_size from query param, fallback to session, then to default
    buffer_size = int(request.args.get('buffer_size', video_data.get('buffer_size', 32)))
    video_sessions[session_id]['buffer_size'] = buffer_size # Update session

    if not os.path.exists(video_path):
        return jsonify({"error": "Video file not found on server"}), 404
        
    return Response(generate_frames_and_detections(video_path, buffer_size), 
                    mimetype='text/event-stream')

if __name__ == '__main__':
    print("Starting Flask server for Bank Surveillance Mock...")
    app.run(debug=True, host='0.0.0.0', port=16439, threaded=True)