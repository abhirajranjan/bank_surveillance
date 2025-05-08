import React, { useState, useRef } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';

function UploadScreen({ onVideoUploaded }) {
  const [videoFile, setVideoFile] = useState(null);
  const [bufferSize, setBufferSize] = useState(32);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!videoFile) {
      setError('Please select a video file.');
      return;
    }

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('video', videoFile);

    try {
      const response = await fetch('http://localhost:5001/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      onVideoUploaded(data.session_id, bufferSize, `http://localhost:5001${data.video_url}`);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || 'Failed to upload video.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 flex items-center justify-center p-6">
      <div className="bg-gray-900 shadow-2xl rounded-3xl p-10 w-full max-w-xl text-white">
        <h1 className="text-center text-4xl font-bold text-teal-400 mb-10">
          🎥 Smart Surveillance Detector
        </h1>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Upload Video</label>
            <div
              className="border-2 border-dashed border-teal-500 p-4 rounded-xl bg-gray-800 cursor-pointer hover:bg-gray-700 transition"
              onClick={() => fileInputRef.current.click()}
            >
              <div className="flex items-center gap-3">
                <UploadCloud className="w-6 h-6 text-teal-400" />
                <p className="text-sm text-gray-300">
                  {videoFile ? videoFile.name : 'Click to select a video file'}
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Frame Buffer Size: <span className="text-teal-400 font-semibold">{bufferSize}</span>
            </label>
            <input
              type="range"
              min="8"
              max="64"
              step="4"
              value={bufferSize}
              onChange={(e) => setBufferSize(parseInt(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>8</span>
              <span>64</span>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold
                        ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'} 
                        transition-all`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                Uploading...
              </>
            ) : (
              'Start Detection'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UploadScreen;
