import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import './FaceAuth.css';
import mySvg from '../assets/mySvg.svg';
import { raggedGather } from '@tensorflow/tfjs';

const FaceAuth = ({ onAuthSuccess }) => {
  // stage: "choose" (select mode) or "capture" (show webcam for capture)
  const [stage, setStage] = useState("choose");
  // false: Login; true: Sign Up
  const [isSignUp, setIsSignUp] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const webcamRef = useRef(null);

  // When user clicks the SVG after choosing mode, proceed to capture stage.
  const startAuth = () => {
    setAuthStatus('');
    setStage("capture");
  };

  // Capture the photo and send to backend.
  const capturePhoto = async () => {
    setIsProcessing(true);
    setAuthStatus('Processing...');

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      const blob = await fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => new Blob([blob], { type: 'image/jpeg' }));

      if (blob.size < 1024) {
        throw new Error('Image capture too small');
      }

      const formData = new FormData();
      formData.append('file', blob, 'face_capture.jpg');

      const endpoint = isSignUp ? '/signup' : '/signin';
      const response = await axios.post(`http://localhost:5000/${endpoint}`, formData);

      if (response.data.userId) {
        setAuthStatus(isSignUp ? 'Registration successful!' : 'Authentication successful!');
        onAuthSuccess(response.data.userId);
      }
    } catch (error) {
      const errMsg =
        error.response?.data?.error ||
        (isSignUp
          ? 'Registration failed. Please try again.'
          : 'Authentication failed. Please try again.');
      setAuthStatus(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Go back from capture stage to the mode selection screen.
  const goBack = () => {
    setStage("choose");
    setAuthStatus('');
  };

  // Stage 1: Mode selection screen
  if (stage === "choose") {
    return (
      <div className="faceauth-container">
        <div className="auth-box">
          <h1 className="auth-title">Height Detection App</h1>
          <p className="auth-subtitle">
            {isSignUp ? "Sign up with face" : "Login with face"}
          </p>
          <div className="button-group">
            <button
              className={`auth-btn login-btn ${!isSignUp ? "selected" : ""}`}
              onClick={() => setIsSignUp(false)}
              disabled={isProcessing}
            >
              Login
            </button>
            <button
              className={`auth-btn signup-btn ${isSignUp ? "selected" : ""}`}
              onClick={() => setIsSignUp(true)}
              disabled={isProcessing}
            >
              Sign Up
            </button>
          </div>
          <div
            className="svg-container"
            onClick={startAuth}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', marginTop: '20px' }}
          >
            <img
              src={mySvg}
              alt="Proceed"
              style={{
                height: '6rem',
                borderRadius: '50%',
                background: 'rgb(139, 69, 19)',
                padding: '2rem'
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Stage 2: Capture screen with webcam.
  if (stage === "capture") {
    return (
      <div className="faceauth-container">
        <div className="auth-box">
          <h1 className="auth-title">{isSignUp ? "Sign Up" : "Sign In"}</h1>
          <p className="auth-subtitle">Please capture your face</p>
          <div className="webcam-container">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              mirrored
              className="webcam-feed"
            />
          </div>
          <button className="auth-btn capture-btn" onClick={capturePhoto} disabled={isProcessing}>
            Capture
          </button>
          <button className="auth-btn back-btn" onClick={goBack} disabled={isProcessing}>
            Back
          </button>
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
