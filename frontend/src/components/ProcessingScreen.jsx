import React, { useState, useEffect, useRef } from 'react';
import { Siren } from 'lucide-react';

function ProcessingScreen({ sessionId, initialBufferSize, onReset }) {
  const [currentFrameData, setCurrentFrameData] = useState(null); 
  const [detection, setDetection] = useState({ className: 'Waiting for data...', confidence: 0 });
  const [streamError, setStreamError] = useState('');
  const [isStreamEnded, setIsStreamEnded] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    setDetection({ className: 'Initializing stream...', confidence: 0 }); 
    setCurrentFrameData(null);
    setStreamError('');
    setIsStreamEnded(false);

    const streamUrl = `https://zvuwzqzix3g0qd-16439.proxy.runpod.net/process_video_stream/${sessionId}?buffer_size=16`;
    eventSourceRef.current = new EventSource(streamUrl);

    eventSourceRef.current.addEventListener('frame_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        setCurrentFrameData(`data:image/jpeg;base64,${data.image_data}`);
      } catch (e) {
        console.error("Failed to parse frame data:", e);
      }
    });

    eventSourceRef.current.addEventListener('detection_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        setDetection({
          className: data.class_name,
          confidence: data.confidence * 100,
        });
        setStreamError('');
      } catch (e) {
        console.error("Failed to parse detection data:", e);
        setStreamError('Error processing detection data.');
      }
    });

    eventSourceRef.current.addEventListener('stream_end', (event) => {
      try {
        const data = JSON.parse(event.data);
        setDetection(prev => ({ ...prev, className: 'Finished' }));
        setIsStreamEnded(true);
        setStreamError('');
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      } catch (e) {
        console.error("Failed to parse stream_end data", e);
      }
    });

    eventSourceRef.current.addEventListener('error', (event) => {
      if (event.target.readyState === EventSource.CLOSED) {
        if (!isStreamEnded) {
          setStreamError('Connection to server lost or stream ended unexpectedly.');
          setDetection({ className: 'Connection Error', confidence: 0 });
        }
      } else if (event.target.readyState === EventSource.OPEN) {
        try {
          const data = JSON.parse(event.data);
          setStreamError(`Server error: ${data.message}`);
          setDetection({ className: 'Server Error', confidence: 0 });
        } catch (e) {
          setStreamError('An unspecified error occurred with the stream.');
        }
      }
    });

    eventSourceRef.current.onerror = (err) => {
      if (!isStreamEnded) {
        setStreamError('Critical connection error with the server.');
        setDetection({ className: 'Connection Failed', confidence: 0 });
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setCurrentFrameData(null);
    };
  }, [sessionId, initialBufferSize]);

  const confidenceValue = parseFloat(detection.confidence);

  const getBoxColor = (val) => {
    if (val > 90) return 'border-red-600 bg-red-600 bg-opacity-20';
    if (val > 60) return 'border-yellow-500 bg-yellow-500 bg-opacity-20';
    return 'border-gray-600 bg-gray-700 bg-opacity-20';
  };

  const getConfidenceColor = (val) => {
    if (val > 90) return 'text-red-400';
    if (val > 60) return 'text-yellow-400';
    return 'text-teal-400';
  };

  const getBoxShadow = (val) => {
    if (val > 90) return 'shadow-red-500/40';
    if (val > 60) return 'shadow-yellow-500/40';
    return 'shadow-teal-500/30';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-900 p-4 space-y-6">
      <div className="w-full flex justify-between items-center px-4 pt-4">
        <h1 className="text-2xl font-bold text-teal-400">
          Bank Surveillance - Synchronized Analysis
        </h1>
        <button
          onClick={onReset}
          disabled={!isStreamEnded && sessionId != null}
          className={`font-semibold py-2 px-4 rounded-lg transition-colors
                      ${(!isStreamEnded && sessionId != null) ? 'bg-gray-500 text-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
        >
          Reset
        </button>
      </div>

      {streamError && (
        <p className="text-red-300 bg-red-700 bg-opacity-50 p-3 rounded-md w-full max-w-4xl text-center">
          {streamError}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl h-[calc(100vh-150px)] md:h-[70vh]">
        <div className="md:col-span-2 bg-black rounded-lg shadow-xl overflow-hidden flex justify-center items-center">
          {currentFrameData ? (
            <img 
              src={currentFrameData} 
              alt="Live video feed" 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-gray-400 p-4 text-center">
              {sessionId ? "Initializing video stream..." : "Upload a video to start."}
            </div>
          )}
        </div>

        <div className={`flex flex-col justify-center items-center p-6 rounded-lg border-2 shadow-xl transition-all duration-300 ease-in-out
                         ${getBoxColor(confidenceValue)} ${getBoxShadow(confidenceValue)}`}>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Current Detection</h2>
          <p className="text-4xl font-bold text-teal-400 mb-1 truncate max-w-full px-2" title={detection.className}>
            {confidenceValue < 50 ? "Neutral" : detection.className}
          </p>
          <p className={`text-lg mb-4 ${getConfidenceColor(confidenceValue)}`}>
            Confidence: {confidenceValue.toFixed(2)}%
          </p>

          <div className="w-full bg-gray-800 rounded-full h-6 mb-1 overflow-hidden">
            <div
              className={`h-6 rounded-full transition-all duration-300 ease-out 
                          ${confidenceValue > 90 ? 'bg-red-500' : confidenceValue > 60 ? 'bg-yellow-500' : 'bg-teal-500'}`}
              style={{ width: `${Math.max(0, Math.min(100, confidenceValue))}%` }}
            ></div>
          </div>

          {confidenceValue > 90 && (
            <Siren className="w-8 h-8 text-red-500 animate-pulse mt-3" />
          )}

          <div className="text-xs text-black mt-4 space-y-1">
            <p><span className="inline-block w-3 h-3 bg-teal-500 mr-1 rounded-sm"></span> Normal / Low (≤60%)</p>
            <p><span className="inline-block w-3 h-3 bg-yellow-500 mr-1 rounded-sm"></span> Medium (&gt;60%)</p>
            <p><span className="inline-block w-3 h-3 bg-red-500 mr-1 rounded-sm"></span> High (&gt;90%)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProcessingScreen;
