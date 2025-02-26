import React, { useState, useEffect } from 'react';
import FaceAuth from "./components/FaceAuth";
import ObjectDetector from './components/ObjectDetector';
import HeightDetector from './App';


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
          <div className="user-header" style={{display:'grid', gridTemplateRows:'1fr 1fr', justifyContent:'center', alignItems:'center'}} >
            <div className="user-greeting" style={{ color: 'rgb(139 69 19)', textAlign:'center', marginBottom:'1.8rem', fontSize:'2.9rem'}}>
              Welcome User #{currentUser.slice(0, 8)}
            </div>
            <nav className="nav-buttons" style={{display:'flex', gap:'1.29'}}>
              <button onClick={() => setCurrentView('height')} style={{ color: 'white', margin:'0 1.2rem', fontSize:'1.3rem' }}>
                Height Detection
              </button>
              <button onClick={() => setCurrentView('object')} style={{ color: 'white', margin:'0 1.2rem', fontSize:'1.3rem' }}>
                Object Detection 
              </button>
            </nav>
          </div>
          <div className="main-content">
            {currentView === 'height' ? <HeightDetector /> : <ObjectDetector />}
          </div>
          <div className="footer" style={{display:'flex', justifyContent:'flex-end', marginTop:'20px'}}>
            <button onClick={handleLogout} className="logout-button" style={{ color: 'white' }}>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App2;