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
  const [askAbortController] = useState(new AbortController());


  const [isListening, setIsListening] = useState(false);
  const recognition = useRef(null); 


  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);


  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      
      // Configuration
      recognition.current.continuous = true;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';
  
      // Event handlers
      recognition.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        if (transcript.includes('detect object')) {
          captureMeasurement();
        }
      };
  
      recognition.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        // Restart on error
        setTimeout(() => {
          if (recognition.current) recognition.current.start();
        }, 1000);
      };
  
      recognition.current.onend = () => {
        // Automatically restart recognition
        recognition.current.start();
      };
  
      // Start initial listening
      const startRecognition = () => {
        try {
          recognition.current.start();
          setIsListening(true);
        } catch (err) {
          console.error('Speech recognition start failed:', err);
          setTimeout(startRecognition, 1000);
        }
      };
  
      startRecognition();
  
      // Cleanup
      return () => {
        if (recognition.current) {
          recognition.current.stop();
          recognition.current = null;
        }
      };
    } else {
      console.warn('Speech recognition not supported');
      setError('Voice commands not supported in this browser');
    }
  }, []);










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
    height: { ideal: 720 },
    aspectRatio: 16/9
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
    askAbortController.abort();
    setShowQuestionInput(false);
    setQuestion('');
    setAnswer('');
    // Get canvas bounding rectangle.
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Compute click coordinates relative to canvas.

    // const clickX = event.clientX - rect.left;
    // const clickY = event.clientY - rect.top;
    
    const clickX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (event.clientY - rect.top) * (canvas.height / rect.height);

    for (let i = detections.length - 1; i >= 0; i--) {
      const detection = detections[i];
      const [x1, y1, x2, y2] = detection.bbox;
      
      // Check if click is inside the bounding box
      if (clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2) {
        if (synth && synth.speaking) {
          synth.cancel();
        }
        setSelectedObject(detection.label);
        fetchObjectInfo(detection.label);
        return;
      }
    }

  };


  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setIsAsking(true);
    try {
      const response = await axios.post('http://localhost:5000/ask-about-image', {
        question: question
      });
      setAnswer(response.data.answer);
      // speakText(response.data.answer);
    } catch (err) {
      if (err.name !== 'CanceledError') {
        setError('Failed to get answer: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setIsAsking(false);
    }
  };






  // Drawing function: draw detection boxes on the canvas.
  const drawBoxes = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || !webcamRef.current || !webcamRef.current.video) return;
  
    // Get actual video dimensions
    const video = webcamRef.current.video;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    // Set canvas dimensions to match video stream
    canvas.width = videoWidth;
    canvas.height = videoHeight;
  
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // Get display dimensions (CSS dimensions)
    const displayWidth = video.offsetWidth;
    const displayHeight = video.offsetHeight;
  
    // Calculate scale factors
    const scaleX = videoWidth / displayWidth;
    const scaleY = videoHeight / displayHeight;

    detections.forEach(detection => {
      const [x1, y1, x2, y2] = detection.bbox;
      // No flipping
      const drawX1 = x1;
      const drawX2 = x2;
      // Draw bounding box
      ctx.strokeStyle = getColorForLabel(detection.label);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(drawX1, y1, drawX2 - drawX1, y2 - y1);
      ctx.stroke();
      // Draw label (adjust as needed)
      ctx.fillStyle = getColorForLabel(detection.label);
      ctx.fillRect(drawX1, y1 - 20, ctx.measureText(detection.label).width + 10, 20);
      ctx.fillStyle = 'white';
      ctx.fillText(detection.label, drawX1 + 5, y1 - 5);
    });
  };

  // Utility: get color for a given label.
  const getColorForLabel = (label) => {
    const colors = {
      person: '#FF0000',      // Red
      book: '#00FF00',        // Green
      bottle: '#0000FF',      // Blue
      car: '#FFA500',         // Orange
      chair: '#800080',       // Purple
      'cell phone': '#FF1493',// Deep Pink
      cup: '#00FFFF',         // Cyan
      laptop: '#4B0082',      // Indigo
      dog: '#8B4513',         // Saddle Brown
      cat: '#FF69B4',         // Hot Pink
      keyboard: '#808000',    // Olive
      mouse: '#008080',       // Teal
      default: '#FFFF00'
    };
    return colors[label.toLowerCase()] || colors.default;
  };

  // Capture objects using YOLO.
  const captureMeasurement = async () => {
    setIsProcessing(true);
    setError('');
    setObjectInfo('');
    setShowQuestionInput(false);
    
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


        const filtered = response.data.results.filter(d => d.confidence > 0.6).sort((a, b) => b.confidence - a.confidence);

        const finalDetections = [];
        filtered.forEach(current => {
          if (!finalDetections.some(existing => 
            calculateIOU(current.bbox, existing.bbox) > 0.5
          )) {
            finalDetections.push(current);
          }
        });
        
        if (response.data.error) throw new Error(response.data.error);
        if (!response.data.results?.length) throw new Error('No objects detected');
        
        setDetections(response.data.results);
        setShowQuestionInput(true);
        setAnswer('');
        setQuestion('');
    } catch (err) {
        setError(err.response?.data?.error || err.message);
    } finally {
        setIsProcessing(false);
    }
};

const calculateIOU = (boxA, boxB) => {
  const [ax1, ay1, ax2, ay2] = boxA;
  const [bx1, by1, bx2, by2] = boxB;
  
  const intersection = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1)) * Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const union = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - intersection
  return intersection / union;
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
      <div className="camera-container" style={{ position: 'relative' }}>
      <Webcam ref={webcamRef} screenshotFormat="image/jpeg"
      videoConstraints={videoConstraints}
      className="webcam-view"
      style={{ 
      width: '100%', 
      height: 'auto'// Mirror the video feed
      }}
/>
        
        {/* Canvas with click handling */}
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '640px',
            height: '480px',
            cursor: 'pointer'
          }}
        />
        
        <button
          onClick={captureMeasurement}
          disabled={isProcessing}
          className="capture-button"
          style={{
            color:'white',
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#4d6bfe',
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
      <div className="voice-status" style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        backgroundColor: isListening ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)',
        padding: '8px 15px',
        borderRadius: '20px',
        color: 'white',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: isListening ? '#00ff00' : '#ff0000',
          animation: isListening ? 'pulse 1.5s infinite' : 'none'
        }} />
        {isListening ? 'Listening for "detect object"' : 'Microphone disabled'}
        
      </div>

      {showQuestionInput && (
  <div style={{
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80%',
    maxWidth: '600px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: '20px',
    borderRadius: '10px',
    zIndex: 1000
  }}>
    <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '10px' }}>
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about the detected objects..."
        style={{
          flex: 1,
          padding: '10px',
          borderRadius: '5px',
          border: 'none',
          background: '#333',
          color: 'white'
        }}
      />
      <button
        type="submit"
        disabled={isAsking}
        style={{
          padding: '10px 20px',
          borderRadius: '5px',
          border: 'none',
          background: '#4d6bfe',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        {isAsking ? 'Asking...' : 'Ask'}
      </button>
    </form>
    
    {answer && (
      <div style={{
        marginTop: '15px',
        padding: '10px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: '5px',
        color: '#00ff88'
      }}>
        {answer}
      </div>
    )}
  </div>
)}
    </div>
  );
};
export default ObjectDetector;