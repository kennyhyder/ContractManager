import React from 'react';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>Contract Management System</h4>
          <p>Streamline your contract lifecycle</p>
        </div>
        
        <div className="footer-section">
          <h5>Quick Links</h5>
          <ul>
            <li><a href="/help">Help Center</a></li>
            <li><a href="/docs">Documentation</a></li>
            <li><a href="/api">API Reference</a></li>
            <li><a href="/support">Support</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h5>Legal</h5>
          <ul>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/security">Security</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h5>Connect</h5>
          <div className="social-links">
            <a href="#" aria-label="Twitter">🐦</a>
            <a href="#" aria-label="LinkedIn">💼</a>
            <a href="#" aria-label="GitHub">🐙</a>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} Contract Management System. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;