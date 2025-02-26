import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import './FaceAuth.css';
import { auth, provider } from '../../firebaseConfig';
import { signInWithPopup } from 'firebase/auth';

const FaceScanOverlay = () => (
  <div className="face-scan-overlay">
    <div className="scan-line"></div>
    <div className="scan-glow"></div>
  </div>
);

const FaceAuth = ({ onAuthSuccess }) => {
  const [stage, setStage] = useState("choose");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const webcamRef = useRef(null);
  const scanTimeout = useRef(null);

  useEffect(() => {
    return () => {
      if (scanTimeout.current) clearTimeout(scanTimeout.current);
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsScanning(true);
      const result = await signInWithPopup(auth, provider);
      onAuthSuccess(result.user.uid);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setAuthStatus("Google Sign-In failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  // Capture the photo and send to backend.
  const capturePhoto = async () => {
    setIsProcessing(true);
    setIsScanning(true);
    setAuthStatus('');

    scanTimeout.current = setTimeout(() => {
      setIsScanning(false);
    }, 5000);

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      const blob = await fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => new Blob([blob], { type: 'image/jpeg' }));

      if (blob.size < 1024) throw new Error('Image capture too small');

      const formData = new FormData();
      formData.append('file', blob, 'face_capture.jpg');
      const endpoint = isSignUp ? '/signup' : '/signin';
      const response = await axios.post(`http://localhost:5000/${endpoint}`, formData);

      if (response.data.userId) {
        setAuthStatus(isSignUp ? 'Registration successful!' : 'Authentication successful!');
        onAuthSuccess(response.data.userId);
      }
    } catch (error) {
      const errMsg = error.response?.data?.error || 
        (isSignUp ? 'Registration failed.' : 'Authentication failed.');
      setAuthStatus(errMsg);
    } finally {
      setIsProcessing(false);
      scanTimeout.current && clearTimeout(scanTimeout.current);
      setIsScanning(false);
    }
  };

  // Stage 1: Initial authentication screen
  if (stage === "choose") {
    return (
      <div className="faceauth-container">
        <div className="auth-box">
          <h1 className="auth-title">Face Authentication</h1>
          <p className="welcome-message" style={{color:'rgb(139 69 19)', fontWeight:'700', fontSize:'1.2rem'}}>Welcome</p>
          <p className="auth-subtitle " style={{color:'rgb(139 69 19)'}}>Authenticate using facial recognition</p>

          <button 
            className="auth-btn face-id-btn"
            onClick={() => setStage("capture")}
            disabled={isProcessing}
          >
            {isSignUp ? "SignUp" : "Login"}
          </button>

          <div className="auth-divider">
            <span style={{color:'rgb(139 69 19)'}}>or</span>
          </div>

          <button
            className="auth-btn google-btn"
            onClick={handleGoogleSignIn}
            disabled={isProcessing}
          >
            Continue with Google
          </button>

          <div className="auth-footer" style={{color:'rgb(139 69 19)'}}>
            {isSignUp ? 
              "Already have an account? " : 
              "Don't have an account? "
            }
            <button
              style={{color:'white'}}
              className="toggle-auth-mode"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Login" : "Sign up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stage 2: Face capture screen
  if (stage === "capture") {
    return (
      <div className="faceauth-container">
        <div className="auth-box">
          <h1 className="auth-title">
            {isSignUp ? "Create Face ID" : "Authenticate Face"}
          </h1>
          <p className="auth-subtitle">Position your face in the frame</p>

          <div className="webcam-container">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              mirrored
              className="webcam-feed"
            />
            {isScanning && <FaceScanOverlay />}
            <div className="face-guide-frame"></div>
          </div>

          <div className="capture-controls">
            <button 
              className="auth-btn secondary-btn"
              onClick={() => setStage("choose")}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button 
              className="auth-btn primary-btn"
              onClick={capturePhoto} 
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Capture"}
            </button>
          </div>

          {authStatus && (
            <div className={`auth-status ${authStatus.includes('successful') ? 'success' : 'error'}`}>
              {authStatus}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};
export default FaceAuth;