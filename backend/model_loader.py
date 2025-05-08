# backend/model_loader.py
# (Ensure I3DClassifier, load_model, LABELS, DEVICE are as before)
import torch
import torch.nn as nn
from huggingface_hub import hf_hub_download
from pytorchvideo.models.hub import i3d_r50
import numpy as np
import cv2
from collections import deque

LABELS = ["arrest", "Explosion", "Fight", "normal", "roadaccidents", "shooting", "Stealing", "vandalism"]
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class I3DClassifier(nn.Module):
    def __init__(self, num_classes):
        super(I3DClassifier, self).__init__()
        self.i3d = i3d_r50(pretrained=True)
        
        self.dropout = nn.Dropout(0.3)
        self.i3d.blocks[6].proj = nn.Linear(2048, num_classes)

    def forward(self, x):
        x = self.i3d(x)
        x = self.dropout(x)
        return x

def load_model(repo_id="Ahmeddawood0001/i3d_ucf_finetuned", filename="i3d_ucf_finetuned.pth"):
    print(f"Loading model on {DEVICE}...")
    model = I3DClassifier(num_classes=len(LABELS)).to(DEVICE)
    try:
        weights_path = hf_hub_download(repo_id=repo_id, filename=filename)
        model.load_state_dict(torch.load(weights_path, map_location=DEVICE))
        print("Model weights loaded successfully.")
    except Exception as e:
        print(f"Error loading weights: {e}. Using base I3D model.")
    model.eval()
    return model

MODEL = load_model()

def preprocess_frame(frame):
    frame = cv2.resize(frame, (224, 224)) # I3D image input size
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return frame # Return as uint8 numpy array

def predict_from_buffer(frame_buffer_list):
    if not frame_buffer_list:
        return None, None

    frames_np = np.array(frame_buffer_list) # Shape: (T, H, W, C)
    
    frames_tensor = torch.from_numpy(frames_np).float() / 255.0 # Normalize
    frames_tensor = frames_tensor.permute(3, 0, 1, 2) 
    frames_tensor = frames_tensor.unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        output = MODEL(frames_tensor)
        probs = torch.softmax(output, dim=1)
        confidence, pred_idx = torch.max(probs, dim=1)
        return LABELS[pred_idx.item()], confidence.item()