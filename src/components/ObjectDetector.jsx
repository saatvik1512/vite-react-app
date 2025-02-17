import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const ObjectDetector = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [objectInfo, setObjectInfo] = useState('');
  const [selectedObject, setSelectedObject] = useState('');
  const [synth, setSynth] = useState(null);
  const [utterance, setUtterance] = useState(null);
  const abortController = useRef(new AbortController());


  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setSynth(window.speechSynthesis);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (synth && synth.speaking) {
        synth.cancel();
      }
    };
  }, [synth]);

  const videoConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

  // Function to fetch info from backend for a given object label.
  const fetchObjectInfo = async (objectLabel) => {
    try {
      abortController.current.abort();
      abortController.current = new AbortController();
      const response = await axios.post('http://localhost:5000/get-object-info', {
        object: objectLabel
      }, {
        signal: abortController.current.signal
      });
      if (response.data.info) {
        setObjectInfo(response.data.info);
        speakText(response.data.info);  // Speak the description
      }
    } catch (err) {
      if (err.name !== 'CanceledError') {
        setError('Failed to fetch object information');
      }
    }
  };

  const speakText = (text) => {
    if (!synth) {
      setError('Text-to-speech not supported');
      return;
    }

    // Stop current speech
    if (synth.speaking) {
      synth.cancel();
    }

    // Create and speak new utterance
    const newUtterance = new SpeechSynthesisUtterance(text);
    newUtterance.voice = synth.getVoices()[0]; // Choose preferred voice
    setUtterance(newUtterance);
    synth.speak(newUtterance);

    // Handle speech errors
    newUtterance.onerror = (event) => {
      console.error('Speech error:', event.error);
      setError('Error speaking description');
    };
  };

  // onClick handler for the canvas.
  const handleCanvasClick = (event) => {
    // Get canvas bounding rectangle.
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Compute click coordinates relative to canvas.
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Iterate over detections to see if click falls inside any bbox.
    for (let detection of detections) {
      const [x1, y1, x2, y2] = detection.bbox;
      if (clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2) {
        if (synth && synth.speaking) {
          synth.cancel();
        }
        setSelectedObject(detection.label);
        // Fetch object information from backend.
        fetchObjectInfo(detection.label);
        return; // Only process the first detection that matches.
      }
    }
  };

  // Drawing function: draw detection boxes on the canvas.
  const drawBoxes = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous drawings.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get video element dimensions.
    const video = webcamRef.current.video;
    if (!video) return;
    
    // Ensure the canvas size matches the video size.
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw each detection.
    detections.forEach(detection => {
      const [x1, y1, x2, y2] = detection.bbox;
      const label = detection.label;
      
      ctx.strokeStyle = getColorForLabel(label);
      ctx.lineWidth = 3;
      ctx.font = '16px Arial';
      
      // Draw bounding box.
      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.stroke();
      
      // Draw label background.
      ctx.fillStyle = getColorForLabel(label);
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x1, y1 - 20, textWidth + 10, 20);
      
      // Draw label text.
      ctx.fillStyle = 'white';
      ctx.fillText(label, x1 + 5, y1 - 5);
    });
  };

  // Utility: get color for a given label.
  const getColorForLabel = (label) => {
    const colors = {
      person: '#FF0000',
      book: '#00FF00',
      bottle: '#0000FF',
      default: '#FFFF00'
    };
    return colors[label.toLowerCase()] || colors.default;
  };

  // Capture objects using YOLO.
  const captureMeasurement = async () => {
    setIsProcessing(true);
    setError('');
    setObjectInfo('');
    
    try {
        const imageSrc = webcamRef.current.getScreenshot();
        const blob = await fetch(imageSrc).then(r => r.blob());
        
        const formData = new FormData();
        formData.append('file', blob, 'object.jpg');

        const response = await axios.post(
            'http://localhost:5000/detect-objects', 
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        );
        
        if (response.data.error) throw new Error(response.data.error);
        if (!response.data.results?.length) throw new Error('No objects detected');
        
        setDetections(response.data.results);
    } catch (err) {
        setError(err.response?.data?.error || err.message);
    } finally {
        setIsProcessing(false);
    }
};

  // Redraw boxes whenever detections change.
  useEffect(() => {
    drawBoxes();
  }, [detections]);

  // Handle window resize.
  useEffect(() => {
    const handleResize = () => {
      if (webcamRef.current && webcamRef.current.video) {
        // Redraw the canvas if necessary.
        drawBoxes();
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
        
        {/* Canvas with click handling */}
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'pointer'
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
        
        {/* Info overlay: display object info if available */}
        {objectInfo && (
          <div 
            className="object-info-overlay" 
            style={{
              position: 'absolute',
              bottom: '70px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#00ff88',
              padding: '10px 20px',
              borderRadius: '8px'
            }}
          >
            <h4 style={{ margin: 0 }}>About {selectedObject}:</h4>
            <p style={{ margin: 0 }}>{objectInfo}</p>
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default ObjectDetector;
