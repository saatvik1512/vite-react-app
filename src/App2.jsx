import React, { useState, useEffect } from 'react';
import FaceAuth from "./components/FaceAuth";
import HeightDetector from "./App"; // Ensure this import path is correct
import ObjectDetector from './components/ObjectDetector';


function App2() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('height');

  // Log whenever currentUser changes
  useEffect(() => {
    console.log("Current user updated:", currentUser);
  }, [currentUser]);

  const handleAuthSuccess = (userId) => {
    console.log("Authentication successful with userId:", userId);
    setCurrentUser(userId);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="App">
      {!currentUser ? (
        <FaceAuth onAuthSuccess={handleAuthSuccess} />
      ) : (
        <div className="app-container">
          <div className="user-header">
            <div className="user-greeting">
              Welcome User #{currentUser.slice(0, 8)}
            </div>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
            <nav className="nav-buttons">
              <button onClick={() => setCurrentView('height')}>Height Detection</button>
              <button onClick={() => setCurrentView('object')}>Object Detection</button>
            </nav>
          </div>
          {currentView === 'height' ? <HeightDetector /> : <ObjectDetector />}
        </div>
      )}
    </div>
  );
}

export default App2;
