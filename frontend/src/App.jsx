import React, { useState } from 'react';
import './App.css'; 
import UploadScreen from './components/UploadScreen';
import ProcessingScreen from './components/ProcessingScreen';

function App() {
  const [currentView, setCurrentView] = useState('upload');
  const [sessionId, setSessionId] = useState(null);
  const [currentBufferSize, setCurrentBufferSize] = useState(32);
  // videoSrc is no longer needed to be passed to ProcessingScreen this way
  // const [videoSrc, setVideoSrc] = useState(''); 

  const handleVideoUploaded = (newSessionId, bufferSize /*, videoUrl was here */) => {
    setSessionId(newSessionId);
    setCurrentBufferSize(bufferSize);
    // setVideoSrc(videoUrl); // Not needed for the new ProcessingScreen
    setCurrentView('processing');
  };

  const handleReset = () => {
    setSessionId(null);
    // setVideoSrc(''); // Not needed
    setCurrentView('upload');
    // EventSource in ProcessingScreen will be closed by its useEffect cleanup
  };

  return (
    <div className="App">
      {currentView === 'upload' ? (
        <UploadScreen onVideoUploaded={handleVideoUploaded} />
      ) : (
        <ProcessingScreen
          sessionId={sessionId}
          initialBufferSize={currentBufferSize}
          // videoSrcUrl={videoSrc} // No longer passing this
          onReset={handleReset}
        />
      )}
    </div>
  );
}

export default App;