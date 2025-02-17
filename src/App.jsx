import 'regenerator-runtime/runtime';
import React, { useRef, useState, useEffect } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import { Pose } from '@mediapipe/pose';
import './App.css';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const HeightDetector = () => {
  const videoRef = useRef(null);
  // Removed webcamRef because it was causing duplicate camera setups.
  const canvasRef = useRef(null);
  const [height, setHeight] = useState(null);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [error, setError] = useState('');
  const poseRef = useRef(null);
  const streamRef = useRef(null);
  const latestWorldLandmarks = useRef(null);
  const isMounted = useRef(true); // Add mount check
  const abortController = useRef(new AbortController());
  const voiceCaptureTimeout = useRef(null);

  const { transcript, browserSupportsSpeechRecognition, resetTranscript } = useSpeechRecognition();
  const [isListening, setIsListening] = useState(false);

  

  // 1. Initialize the Pose instance before starting the camera.
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

    pose.onResults((results) => {
      if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

        if (results.poseLandmarks) {
          drawLandmarks(ctx, results.poseLandmarks);
          latestWorldLandmarks.current = results.poseWorldLandmarks;
        }
    });

    poseRef.current = pose;
    return () => {
      isMounted.current = false;
      abortController.current.abort();
      if (poseRef.current) poseRef.current.close();
    };
  }, []);

  useEffect(() => {
    const startCameraAsync = async () => {
      try {
        if (!poseRef.current) return;

        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        // Handle video play with abort controller
        try {
          await videoRef.current.play({ signal: abortController.current.signal });
        } catch (err) {
          if (err.name !== 'AbortError') throw err;
        }

        if (!isMounted.current) return;

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            try {
              if (poseRef.current && videoRef.current) {
                await poseRef.current.send({ image: videoRef.current });
              }
            } catch (err) {
              console.error('Frame processing error:', err);
            }
          },
          width: 640,
          height: 480
        });

        camera.start();
        startVoiceRecognition();
      } catch (err) {
        if (isMounted.current) {
          console.error('Camera error:', err);
          setError(`Camera access denied. Please:
            1. Check browser permissions
            2. Ensure HTTPS/localhost
            3. Try a different camera
            4. Restart browser`);
        }
      }
    };

    startCameraAsync();

    return () => {
      abortController.current.abort();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      SpeechRecognition.stopListening();
    };
  }, []);

  // 2. Start the camera as soon as the component mounts.
  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      SpeechRecognition.stopListening();
    };
  }, []);

  // 3. Listen for the voice command "capture the height".
  useEffect(() => {
    if (transcript.toLowerCase().includes('capture the height')) {
      handleVoiceCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraStarted(false);
  };

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Try both 'user' and 'environment'
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      };

      if (!navigator.mediaDevices) {
        console.log('Sorry, getUserMedia is not supported');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      await new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = resolve;
        videoRef.current.onerror = reject;
        videoRef.current.play().catch(reject);
      });

      // Start the MediaPipe camera processing.
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          try {
            // Make sure the pose instance is ready before sending frames.
            if (poseRef.current) {
              await poseRef.current.send({ image: videoRef.current });
            }
          } catch (err) {
            console.error('Frame processing error:', err);
          }
        },
        width: 640,
        height: 480
      });

      camera.start();
      // Start voice recognition after the camera is running.
      startVoiceRecognition();
    } catch (err) {
      console.error('Camera error:', err);
      stopCamera();
    }
  };

  const startVoiceRecognition = () => {
    if (browserSupportsSpeechRecognition) {
      SpeechRecognition.startListening({
        continuous: true,
        language: 'en-US'
      });
      setIsListening(true);
    } else {
      setError('Speech recognition not supported in this browser');
    }
  };

  const handleVoiceCapture = () => {
    if (voiceCaptureTimeout.current) {
      clearTimeout(voiceCaptureTimeout.current);
    }
    voiceCaptureTimeout.current = setTimeout(()=>{
      setError('');
    const calculatedHeight = calculateHeight();
    if (calculatedHeight) {
      setHeight(calculatedHeight);
      // Optional: Provide audio feedback.
      const msg = new SpeechSynthesisUtterance(
        `Height measured: ${calculatedHeight} centimeters`
      );
      window.speechSynthesis.speak(msg);
    }
    resetTranscript();
    voiceCaptureTimeout.current=null;
    }, 1000);
  };

  const drawLandmarks = (ctx, landmarks) => {
    ctx.fillStyle = '#FF0000';
    landmarks.forEach((landmark) => {
      ctx.beginPath();
      ctx.arc(
        landmark.x * ctx.canvas.width,
        landmark.y * ctx.canvas.height,
        5,
        0,
        2 * Math.PI
      );
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
      Math.pow(nose.x - (leftHeel.x + rightHeel.x) / 2, 2) +
        Math.pow(verticalDistance, 2) +
        Math.pow(nose.z - averageHeelZ, 2)
    );

    return (heightMeters * 100).toFixed(1);
  };

  // Backup manual capture.
  const capture = () => {
    setError('');
    const calculatedHeight = calculateHeight();
    if (calculatedHeight) {
      setHeight(calculatedHeight);
    }
  };

  // (If needed for processing an image, this helper remains available.)
  const processImage = async (imageSrc) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = async () => {
      await poseRef.current.send({ image });
    };
  };

  // Removed the extra useEffect that was starting a camera on webcamRef
  // because it caused duplicate camera instances and errors.

  return (
    <div className="container">
      <h1>Auto Height Detector</h1>

      {error && (
        <div className="error">
          {error}
          {!browserSupportsSpeechRecognition && (
            <button onClick={capture} style={{ marginLeft: '10px' }}>
              Capture Manually
            </button>
          )}
        </div>
      )}

      <div className="camera-container" style={{ position: 'relative' }}>
        {/* Hidden video element used as the source for MediaPipe */}
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

        <button
          onClick={capture}
          style={{
            fontSize: '20px',
            padding: '15px 30px',
            position: 'absolute',
            bottom: '20px',
            right: '20px'
          }}
        >
          {isListening ? '🎤 Capture the Height' : 'Capture Manually'}
        </button>

        {isListening && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.5)',
              padding: '10px',
              borderRadius: '5px'
            }}
          >
            Say "Capture the height" to measure
          </div>
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
