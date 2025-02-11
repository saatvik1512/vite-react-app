import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const ObjectDetector = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const videoConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

  // Drawing function
  const drawBoxes = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get video element dimensions
    const video = webcamRef.current.video;
    if (!video) return;

    // Match canvas to video display size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw each detection
    detections.forEach(detection => {
      const [x1, y1, x2, y2] = detection.bbox;
      const label = detection.label;
      
      // Set box style
      ctx.strokeStyle = getColorForLabel(label);
      ctx.lineWidth = 3;
      ctx.font = '16px Arial';
      
      // Draw bounding box
      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.stroke();
      
      // Draw label background
      ctx.fillStyle = getColorForLabel(label);
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x1, y1 - 20, textWidth + 10, 20);
      
      // Draw label text
      ctx.fillStyle = 'white';
      ctx.fillText(label, x1 + 5, y1 - 5);
    });
  };

  // Generate color based on label
  const getColorForLabel = (label) => {
    const colors = {
      person: '#FF0000',
      book: '#00FF00',
      bottle: '#0000FF',
      default: '#FFFF00'
    };
    return colors[label.toLowerCase()] || colors.default;
  };

  const captureMeasurement = async () => {
    setIsProcessing(true);
    setError('');
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      const blob = await fetch(imageSrc).then(r => r.blob());
      
      const formData = new FormData();
      formData.append('file', blob, 'object.jpg');

      const response = await axios.post('http://localhost:5000/detect-objects', formData);
      
      if (response.data.error) throw new Error(response.data.error);
      if (!response.data.results.length) throw new Error('No objects detected');
      
      setDetections(response.data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Redraw boxes when detections change
  useEffect(() => {
    drawBoxes();
  }, [detections]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (webcamRef.current && webcamRef.current.video) {
        setDimensions({
          width: webcamRef.current.video.videoWidth,
          height: webcamRef.current.video.videoHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="container">
      <h2>Object Dimension Detection</h2>
      
      <div className="camera-container" style={{ position: 'relative' }}>
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="webcam-view"
          style={{ width: '100%', height: 'auto' }}
        />
        
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        />

        <button
          onClick={captureMeasurement}
          disabled={isProcessing}
          className="capture-button"
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        >
          {isProcessing ? 'Analyzing...' : 'Measure Objects'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {detections.length > 0 && (
        <div className="results">
          <h3>Detection Results:</h3>
          {detections.map((obj, i) => (
            <div key={i} className="detection-item">
              <strong style={{ color: getColorForLabel(obj.label) }}>
                {obj.label}
              </strong>
              <p>Width: {obj.width} cm</p>
              <p>Height: {obj.height} cm</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ObjectDetector;