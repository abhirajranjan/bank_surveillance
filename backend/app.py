from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import cv2
import time
import json
import base64 
from collections import deque
from model_loader import preprocess_frame, predict_from_buffer
from twilio.rest import Client


UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app)

video_sessions = {}

last_execution_time = 0
COOLDOWN_PERIOD = 120  # 2 minutes in seconds

def load_twilio_config(config_file='twilio_config.json'):
    with open(config_file, 'r') as f:
        config = json.load(f)
    
    # Extract Twilio credentials
    twilio_config = config.get('twilio', {})
    account_sid = twilio_config.get('account_sid')
    auth_token = twilio_config.get('auth_token')
    flow = twilio_config.get('flow')
    phone_to = twilio_config.get('phone_to')
    phone_from = twilio_config.get('phone_from')
    
    if not account_sid or not auth_token:
        raise ValueError("Missing Twilio credentials in config file")
        
    return [account_sid,auth_token,flow,phone_to,phone_from]
    
account_sid,auth_token,flow,phone_to,phone_from = load_twilio_config()

def notify():
    global last_execution_time
    current_time = time.time()
    
    if current_time - last_execution_time <= COOLDOWN_PERIOD:
        print("cooldown period")
        return
    
    last_execution_time = current_time
    client = Client(account_sid,auth_token)
    execution = client.studio.v2.flows(flow).executions.create(to=phone_to, from_=phone_from)
    
    message = client.messages.create(
        from_=phone_from,
        body='Alert! This is a security warning. Unauthorized activity has been detected in bank. A robbery is currently in progress. Please take immediate action and contact emergency services. Repeat: a robbery is in progress at bank',
        to=phone_to
    )

    print(message)

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
        return jsonify({"message": "Video uploaded successfully", "session_id": session_id}), 200
    return jsonify({"error": "File upload failed"}), 500

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

    frame_buffer = list()
    
    # Get video FPS to control streaming speed
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_delay = 1.0 / fps if fps > 0 else 0.033  # Default to ~30 FPS if unknown

    print(f"Starting synchronized stream for {video_path} with buffer_size {buffer_size_frames}, FPS: {fps:.2f}")
    try:
        while cap.isOpened():
            stream_loop_start_time = time.time()
            ret, frame = cap.read()
            if not ret:
                print("End of video or cannot read frame.")
                break

            _, jpeg_buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 100])
            jpg_as_text = base64.b64encode(jpeg_buffer).decode('utf-8')
            frame_payload = json.dumps({"image_data": jpg_as_text})
            yield f"event: frame_update\ndata: {frame_payload}\n\n"

            processed_model_frame = preprocess_frame(frame.copy()) 
            frame_buffer.append(processed_model_frame)

            # 3. If buffer is full, predict and send detection
            if len(frame_buffer) == buffer_size_frames:
                # print(f"Buffer full ({len(frame_buffer)} frames), predicting...")
                predicted_class, confidence = predict_from_buffer(frame_buffer)

                if confidence >= 0.75:
                    notify()
                
                if predicted_class is not None:
                    detection_payload = json.dumps({
                        "class_name": predicted_class,
                        "confidence": float(confidence) 
                    })
                    yield f"event: detection_update\ndata: {detection_payload}\n\n"
                    # print(f"Sent detection: {predicted_class} - {confidence:.2f}")
                
                frame_buffer = frame_buffer[:0]
            
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