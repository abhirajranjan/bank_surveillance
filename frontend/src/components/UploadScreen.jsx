import React, { useState, useRef } from 'react';

function UploadScreen({ onVideoUploaded }) {
  const [videoFile, setVideoFile] = useState(null);
  const [bufferSize, setBufferSize] = useState(32); // Default buffer size
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    setVideoFile(event.target.files[0]);
    setError('');
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
      // Make sure your Flask server is running on port 5001
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-teal-400 mb-8">
          Bank Surveillance Mock Detector
        </h1>
        
        <div className="mb-6">
          <label htmlFor="videoFile" className="block mb-2 text-sm font-medium text-gray-300">
            Upload Video
          </label>
          <input
            type="file"
            id="videoFile"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0 file:text-sm file:font-semibold
                       file:bg-teal-500 file:text-white hover:file:bg-teal-600
                       cursor-pointer"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="bufferSize" className="block mb-2 text-sm font-medium text-gray-300">
            Frame Buffer Size: <span className="font-semibold text-teal-400">{bufferSize}</span>
          </label>
          <input
            type="range"
            id="bufferSize"
            min="8"
            max="64" // I3D typically trained on 16, 32, or 64 frames
            step="4" // Steps of 4 often make sense for video models
            value={bufferSize}
            onChange={(e) => setBufferSize(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
           <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>8</span>
            <span>64</span>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          onClick={handleUpload}
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors
                      ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`}
        >
          {isLoading ? 'Processing...' : 'Start Detection'}
        </button>
      </div>
    </div>
  );
}

export default UploadScreen;