import React, { useState, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Shield, AlertCircle, Loader2 } from "lucide-react";

function BankSurveillance({ onVideoUploaded }) {
  const [videoFile, setVideoFile] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
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

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      setVideoFile(file);
      setError('');
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
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
      if (onVideoUploaded) {
        onVideoUploaded(data.session_id, bufferSize, `http://localhost:5001${data.video_url}?buffer_size=${bufferSize}`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || 'Failed to upload video.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-2">
            <Shield className="h-10 w-10 text-gray-700" />
          </div>
          <CardTitle className="text-3xl font-bold">Bank Surveillance</CardTitle>
          <CardDescription className="text-lg">
            Upload surveillance footage for analysis and threat detection. Adjust parameters to fine-tune detection
            sensitivity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Upload Section */}
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <Upload className="h-12 w-12 text-gray-500" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Upload Surveillance Video</p>
                <p className="text-sm text-gray-500">
                  {videoFile ? videoFile.name : "Drag and drop your video file here, or click to browse"}
                </p>
                <p className="text-xs text-gray-400">Supports: MP4, AVI, MOV (Max size: 500MB)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Configuration Section */}
          <div className="space-y-6 pt-4">
            <h3 className="text-lg font-medium">Detection Configuration</h3>

            <div className="space-y-8">
              {/* Confidence Percentage Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label htmlFor="confidence" className="text-sm font-medium">
                    Confidence Threshold
                  </label>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">{confidenceThreshold}%</span>
                </div>
                <Slider 
                  id="confidence" 
                  value={[confidenceThreshold]} 
                  max={100} 
                  step={1} 
                  className="py-2" 
                  onValueChange={(value) => setConfidenceThreshold(value[0])}
                />
                <p className="text-xs text-gray-500">
                  Higher values reduce false positives but may miss subtle threats
                </p>
              </div>

              {/* Buffer Size Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label htmlFor="buffer" className="text-sm font-medium">
                    Buffer Size
                  </label>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">{bufferSize} frames</span>
                </div>
                <Slider 
                  id="buffer" 
                  value={[bufferSize]} 
                  min={8} 
                  max={64} 
                  step={4} 
                  className="py-2" 
                  onValueChange={(value) => setBufferSize(value[0])}
                />
                <p className="text-xs text-gray-500">
                  Larger buffer improves detection accuracy but requires more processing power
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <p className="text-sm text-amber-800">
              This system processes video footage to detect potential security threats. Results should be verified by security personnel.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full"
            size="lg" 
            onClick={handleUpload}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            ) : (
              "Process Surveillance Footage"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default BankSurveillance;