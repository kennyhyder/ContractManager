import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import './CursorTracker.css';

function CursorTracker({ contractId, containerRef }) {
  const { user } = useSelector((state) => state.auth);
  const { socket, connected } = useWebSocket();
  
  const [cursors, setCursors] = useState({});
  const [selections, setSelections] = useState({});
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const throttleTimerRef = useRef(null);

  useEffect(() => {
    if (!connected || !socket || !containerRef?.current) return;

    // Listen for cursor events
    socket.on('cursor:move', handleCursorMove);
    socket.on('cursor:selection', handleCursorSelection);
    socket.on('cursor:hide', handleCursorHide);

    // Track mouse movement
    const handleMouseMove = (e) => {
      throttledEmitCursorPosition(e);
    };

    // Track text selection
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        emitSelection(range);
      } else {
        emitSelection(null);
      }
    };

    const container = containerRef.current;
    container.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('selectionchange', handleSelectionChange);
      socket.off('cursor:move');
      socket.off('cursor:selection');
      socket.off('cursor:hide');
      
      // Clear throttle timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [connected, socket, containerRef, contractId]);

  const throttledEmitCursorPosition = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Only emit if position changed significantly
    const distance = Math.sqrt(
      Math.pow(x - lastPositionRef.current.x, 2) +
      Math.pow(y - lastPositionRef.current.y, 2)
    );

    if (distance < 5) return;

    lastPositionRef.current = { x, y };

    // Throttle emissions
    if (throttleTimerRef.current) return;

    throttleTimerRef.current = setTimeout(() => {
      socket.emit('cursor:move', {
        contractId,
        x: x / rect.width, // Normalize to percentage
        y: y / rect.height,
        userId: user._id,
      });
      throttleTimerRef.current = null;
    }, 50); // Emit at most every 50ms
  };

  const emitSelection = (range) => {
    if (!range) {
      socket.emit('cursor:selection', {
        contractId,
        selection: null,
        userId: user._id,
      });
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const startRect = range.getBoundingClientRect();
    
    socket.emit('cursor:selection', {
      contractId,
      selection: {
        startX: (startRect.left - rect.left) / rect.width,
        startY: (startRect.top - rect.top) / rect.height,
        width: startRect.width / rect.width,
        height: startRect.height / rect.height,
      },
      userId: user._id,
    });
  };

  const handleCursorMove = ({ userId, x, y }) => {
    if (userId === user._id) return;

    setCursors(prev => ({
      ...prev,
      [userId]: { x, y, lastUpdate: Date.now() }
    }));

    // Hide cursor after inactivity
    setTimeout(() => {
      setCursors(prev => {
        const cursor = prev[userId];
        if (cursor && Date.now() - cursor.lastUpdate > 3000) {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        }
        return prev;
      });
    }, 3000);
  };

  const handleCursorSelection = ({ userId, selection }) => {
    if (userId === user._id) return;

    if (selection) {
      setSelections(prev => ({
        ...prev,
        [userId]: selection
      }));
    } else {
      setSelections(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    }
  };

  const handleCursorHide = ({ userId }) => {
    setCursors(prev => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
    
    setSelections(prev => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  };

  const getUserColor = (userId) => {
    // Generate consistent color from user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FECA57', '#FF9FF3', '#54A0FF', '#48DBFB'
    ];
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  if (!containerRef?.current) return null;

  const rect = containerRef.current.getBoundingClientRect();

  return (
    <div className="cursor-tracker">
      {/* Render cursors */}
      {Object.entries(cursors).map(([userId, position]) => {
        const userColor = getUserColor(userId);
        const x = position.x * rect.width;
        const y = position.y * rect.height;

        return (
          <div
            key={userId}
            className="remote-cursor"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              '--cursor-color': userColor,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="cursor-icon"
            >
              <path
                d="M5.5 3.5L5.5 16.5L12.5 12.5L17.5 12.5L5.5 3.5Z"
                fill={userColor}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span className="cursor-label" style={{ backgroundColor: userColor }}>
              User {userId.slice(-4)}
            </span>
          </div>
        );
      })}

      {/* Render selections */}
      {Object.entries(selections).map(([userId, selection]) => {
        const userColor = getUserColor(userId);
        const x = selection.startX * rect.width;
        const y = selection.startY * rect.height;
        const width = selection.width * rect.width;
        const height = selection.height * rect.height;

        return (
          <div
            key={`selection-${userId}`}
            className="remote-selection"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`,
              backgroundColor: userColor,
              opacity: 0.2,
            }}
          />
        );
      })}
    </div>
  );
}

export default CursorTracker;