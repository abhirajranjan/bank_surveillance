import React, { useState, useEffect, useRef } from 'react';
import { Siren } from 'lucide-react';

function ProcessingScreen({ sessionId, initialBufferSize, onReset }) {
  const [currentFrameData, setCurrentFrameData] = useState(null); 
  const [detection, setDetection] = useState({ className: 'Waiting for data...', confidence: 0 });
  const [streamError, setStreamError] = useState('');
  const [isStreamEnded, setIsStreamEnded] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!sessionId || !initialBufferSize) return;

    setDetection({ className: 'Initializing stream...', confidence: 0 }); 
    setCurrentFrameData(null);
    setStreamError('');
    setIsStreamEnded(false);

    const streamUrl = `https://zvuwzqzix3g0qd-16439.proxy.runpod.net/process_video_stream/${sessionId}?buffer_size=${initialBufferSize}`;
    console.log("Connecting to EventSource:", streamUrl);

    eventSourceRef.current = new EventSource(streamUrl);

    // Handler for frame updates
    eventSourceRef.current.addEventListener('frame_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("recv frame")
        setCurrentFrameData(`data:image/jpeg;base64,${data.image_data}`);
      } catch (e) {
        console.error("Failed to parse frame data:", event.data, e);
      }
    });

    // Handler for detection updates
    eventSourceRef.current.addEventListener('detection_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        // console.log("Received detection:", data);
        setDetection({
          className: data.class_name,
          confidence: data.confidence * 100, 
        });
        setStreamError(''); 
      } catch (e) {
        console.error("Failed to parse detection data:", event.data, e);
        setStreamError('Error processing detection data.');
      }
    });

    // Handler for stream end signal
    eventSourceRef.current.addEventListener('stream_end', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Stream ended:", data.message);
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
    
    // Handler for server-sent errors
    eventSourceRef.current.addEventListener('error', (event) => { // SSE 'error' event from server
      if (event.target.readyState === EventSource.CLOSED) {
        console.log('EventSource closed by server or network error.');
        if (!isStreamEnded) { // Avoid showing error if stream ended gracefully
            setStreamError('Connection to server lost or stream ended unexpectedly.');
            setDetection({ className: 'Connection Error', confidence: 0 });
        }
      } else if (event.target.readyState === EventSource.OPEN) {
        // This can happen if the server sends an 'error' event type
        try {
            const data = JSON.parse(event.data); // Assuming server sends JSON for its custom errors
            console.error("Server-side error event:", data.message);
            setStreamError(`Server error: ${data.message}`);
            setDetection({ className: 'Server Error', confidence: 0 });
        } catch(e) {
            console.error("Received non-JSON error event or malformed error from server:", event);
            setStreamError('An unspecified error occurred with the stream.');
        }
      }
    });

    // EventSource's own onerror for network issues etc.
    eventSourceRef.current.onerror = (err) => {
      // This onerror is for actual EventSource object failures, not for 'error' type events from server
      console.error("EventSource native error:", err);
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
        console.log("Closing EventSource (cleanup)");
        eventSourceRef.current.close();
      }
      setCurrentFrameData(null); // Clear frame on dismount/reset
    };
  }, [sessionId, initialBufferSize]); // Re-establish connection if sessionId or bufferSize changes


  const getBoxColor = (confidenceVal) => {
    if (confidenceVal > 90) return 'border-red-600 bg-red-600 bg-opacity-20';
    if (confidenceVal > 60) return 'border-yellow-500 bg-yellow-500 bg-opacity-20';
    return 'border-gray-600';
  };

  const confidenceValue = parseFloat(detection.confidence);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-900 p-4 space-y-6">
      <div className="w-full flex justify-between items-center px-4 pt-4">
        <h1 className="text-2xl font-bold text-teal-400">
          Bank Surveillance - Synchronized Analysis
        </h1>
        <button
          onClick={onReset}
          disabled={!isStreamEnded && sessionId != null} // Disable reset if stream is active
          className={`font-semibold py-2 px-4 rounded-lg transition-colors
                      ${(!isStreamEnded && sessionId != null) ? 'bg-gray-500 text-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
        >
          Reset
        </button>
      </div>

      {streamError && <p className="text-red-300 bg-red-700 bg-opacity-50 p-3 rounded-md w-full max-w-4xl text-center">{streamError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl h-[calc(100vh-150px)] md:h-[70vh]"> {/* Adjusted height */}
        {/* Video Feed Part (Image Display) */}
        <div className="md:col-span-2 bg-black rounded-lg shadow-xl overflow-hidden flex justify-center items-center">
          {currentFrameData ? (
            <img 
                src={currentFrameData} 
                alt="Live video feed" 
                className="w-full h-full object-contain" // 'object-contain' to see whole frame
            />
          ) : (
            <div className="text-gray-700 p-4 text-center">
                { sessionId ? "Initializing video stream..." : "Upload a video to start."}
            </div>
          )}
        </div>

        {/* Detection Part */}
        <div className={`flex flex-col justify-center items-center p-6 bg-gray-800 rounded-lg shadow-xl border-2 ${getBoxColor(confidenceValue)}`}>
          <h2 className="text-xl font-semibold text-grey-300 mb-2">Current Detection</h2>
          <p className="text-4xl font-bold text-teal-400 mb-1 truncate max-w-full px-2" title={detection.className}>
            {
              confidenceValue < 50 ? "Neutral" : detection.className
            }
          </p>
          <p className="text-lg text-gray-800 mb-4">
            Confidence: {confidenceValue.toFixed(2)}%
          </p>
          <div className="w-full bg-gray-800 rounded-full h-6 mb-1 overflow-hidden">
            <div
              className={`h-6 rounded-full transition-all duration-300 ease-out 
                          ${confidenceValue > 90 ? 'bg-red-500' : confidenceValue > 60 ? 'bg-yellow-500' : 'bg-teal-500'}`}
              style={{ width: `${Math.max(0, Math.min(100, confidenceValue))}%` }}
            ></div>
          </div>
           <div className="text-xs text-black mt-3 space-y-1">
             <p><span className="inline-block w-3 h-3 bg-green-500 mr-1 rounded-sm"></span> Normal / Low (&lt;=60%)</p>
             <p><span className="inline-block w-3 h-3 bg-yellow-500 mr-1 rounded-sm"></span> Medium (&gt;60%)</p>
             <p><span className="inline-block w-3 h-3 bg-red-500 mr-1 rounded-sm"></span> High (&gt;90%)</p>
           </div>
        </div>
      </div>
    </div>
  );
}

export default ProcessingScreen;