import React from 'react';
import './Loading.css';

function Loading({ 
  size = 'medium', 
  text = 'Loading...', 
  fullscreen = false,
  overlay = false 
}) {
  const className = `loading-container ${size} ${fullscreen ? 'fullscreen' : ''} ${overlay ? 'overlay' : ''}`;

  return (
    <div className={className}>
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
}

export default Loading;