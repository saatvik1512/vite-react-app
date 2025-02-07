import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import './FaceAuth.css'; // Import the CSS file for styling

const FaceAuth = ({ onAuthSuccess }) => {
  const webcamRef = useRef(null);
  const [authStatus, setAuthStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const capturePhoto = async () => {
    setIsProcessing(true);
    setAuthStatus('Processing...');

    try {
      // Capture the image from the webcam as a data URL
      const imageSrc = webcamRef.current.getScreenshot();

      // Convert the data URL to a blob (ensuring JPEG type)
      const blob = await fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => new Blob([blob], { type: 'image/jpeg' }));

      if (blob.size < 1024) {
        throw new Error('Image capture too small');
      }

      // Prepare FormData to send to the backend
      const formData = new FormData();
      formData.append('file', blob, 'face_capture.jpg');
      console.log('Sending file:', formData.get('file'));

      // Determine endpoint based on whether we're signing up or signing in
      const endpoint = isSignUp ? '/signup' : '/signin';
      const response = await axios.post(`http://localhost:5000/${endpoint}`, formData);

      console.log('Response from server:', response.data);

      // Check for userId in the response data
      if (response.data.userId) {
        setAuthStatus(isSignUp ? 'Registration successful!' : 'Authentication successful!');
        onAuthSuccess(response.data.userId);
      } else {
        setAuthStatus('Unexpected error: no userId returned.');
      }
    } catch (error) {
      // Customize error messages based on the response from the backend
      const errMsg =
        error.response?.data?.error ||
        (isSignUp
          ? 'You are an existing user. Just sign in.'
          : 'Face not recognized. Please sign in first.');
      setAuthStatus(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="face-auth-container">
      <h2>Face Authentication</h2>

      <div className="webcam-container">
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          mirrored
          className="webcam-view"
        />

        <div className="auth-controls">
          <div className="mode-selector">
            <button 
              onClick={() => setIsSignUp(false)}
              className={!isSignUp ? 'active' : ''}
            >
              Sign In
            </button>
            <button 
              onClick={() => setIsSignUp(true)}
              className={isSignUp ? 'active' : ''}
            >
              Sign Up
            </button>
          </div>

          <button 
            onClick={capturePhoto}
            disabled={isProcessing}
            className="capture-button"
          >
            {isSignUp ? 'Register Face' : 'Authenticate'}
          </button>
        </div>
      </div>

      {authStatus && (
        <div className={`auth-status ${authStatus.includes('successful') ? 'success' : 'error'}`}>
          {authStatus}
        </div>
      )}
    </div>
  );
};

export default FaceAuth;
