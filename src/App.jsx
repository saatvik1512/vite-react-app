import React, { useRef, useState, useEffect } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import { Pose } from '@mediapipe/pose';

const HeightDetector = () => {
  const videoRef = useRef(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [height, setHeight] = useState(null);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [error, setError] = useState('');
  const poseRef = useRef(null);
  const streamRef = useRef(null);
  const latestWorldLandmarks = useRef(null);


  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // pose.onResults(handlePoseResults);
    pose.onResults((results) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawLandmarks(ctx, results.poseLandmarks);
        // Store latest landmarks without calculating height
        latestWorldLandmarks.current = results.poseWorldLandmarks;
      }
    });
    poseRef.current = pose;

    return () => {
      pose.close()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraStarted(false);
  };

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: {ideal : "environment"}, // Try both 'user' and 'environment'
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!navigator.mediaDevices) {
        console.log("Sorry, getUserMedia is not supported");
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      await new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = resolve;
        videoRef.current.onerror = reject;
        videoRef.current.play().catch(reject);
      });

      // Start MediaPipe camera
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          try {
            await poseRef.current.send({ image: videoRef.current });
          } catch (err) {
            console.error('Frame processing error:', err);
          }
        },
        width: 640,
        height: 480
      });

      camera.start();
      setIsCameraStarted(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError(`Camera access denied. Please: 
        1. Check browser permissions
        2. Ensure HTTPS/localhost
        3. Try different camera (front/back)
        4. Restart browser`);
      stopCamera();
    }
  };

  // const handlePoseResults = (results) => {
  //   const canvas = canvasRef.current;
  //   const ctx = canvas.getContext('2d');
    
  //   ctx.clearRect(0, 0, canvas.width, canvas.height);
  //   ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  //   if (results.poseLandmarks) {
  //     drawLandmarks(ctx, results.poseLandmarks);
  //     calculateHeight(results.poseWorldLandmarks);
  //   }
  // };

  const drawLandmarks = (ctx, landmarks) => {
    ctx.fillStyle = '#FF0000';
    landmarks.forEach(landmark => {
      ctx.beginPath();
      ctx.arc(landmark.x * ctx.canvas.width, landmark.y * ctx.canvas.height, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const calculateHeight = () => {
    if (!latestWorldLandmarks.current) {
      setError('No person detected. Please ensure full body is visible.');
      return null;
    }

    const worldLandmarks = latestWorldLandmarks.current;
    const nose = worldLandmarks[0];
    const leftHeel = worldLandmarks[29];
    const rightHeel = worldLandmarks[30];

    if (!nose || !leftHeel || !rightHeel) {
      setError('Key points not detected');
      return null;
    }

    const averageHeelZ = (leftHeel.z + rightHeel.z) / 2;
    const verticalDistance = Math.abs(nose.y - (leftHeel.y + rightHeel.y) / 2);
    
    const heightMeters = Math.sqrt(
      Math.pow(nose.x - (leftHeel.x + rightHeel.x)/2, 2) +
      Math.pow(verticalDistance, 2) +
      Math.pow(nose.z - averageHeelZ, 2)
    );

    return (heightMeters * 100).toFixed(1);
  };

  const capture = () => {
    setError('');
    const calculatedHeight = calculateHeight();
    if (calculatedHeight) {
      setHeight(calculatedHeight);
    }
  };

  const processImage = async (imageSrc) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = async () => {
      await poseRef.current.send({ image });
    };
  };

  useEffect(() => {
    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current.video.readyState >= 2) {
            await poseRef.current.send({ image: webcamRef.current.video });
          }
        },
        width: 1280,
        height: 720
      });
      camera.start();
    }
  }, []);

  return (
    <div className="container">
      <h1>Auto Height Detector</h1>
      
      {error && (
        <div className="error">
          {error}
          <button onClick={startCamera} style={{ marginLeft: '10px' }}>
            Retry
          </button>
        </div>
      )}
      
      <div className="camera-container">
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          style={{ 
            width: '100%',
            height: 'auto',
            backgroundColor: '#000',
            maxWidth: '640px',
            maxHeight: '480px'
          }}
          width={640}
          height={480}
        />
        
        {!isCameraStarted ? (
          <button 
            onClick={startCamera}
            style={{ fontSize: '20px', padding: '15px 30px' }}
          >
            Start Camera
          </button>
        ) : (
          <button // voice recognition part 1. add microphone button for ... 2. user speaks upfront 3. 
            onClick={capture}
            style={{ fontSize: '20px', padding: '15px 30px' }}
          >
            Capture & Measure
          </button>
        )}
      </div>

      {height && (
        <div className="result" style={{ fontSize: '50px' }}>
          Estimated Height: {height} cm
        </div>
      )}
    </div>
  );
};

export default HeightDetector;