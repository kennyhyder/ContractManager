# Contract Management System - Frontend

React-based frontend application for the Contract Management System.

## Features

- **Contract Management**: Create, edit, and manage contracts
- **Real-time Collaboration**: Multiple users can work on contracts simultaneously
- **Template Marketplace**: Share and reuse contract templates
- **Approval Workflows**: Multi-level approval processes
- **Analytics Dashboard**: Contract metrics and insights
- **Rich Text Editor**: Advanced contract editing capabilities
- **Version Control**: Track all contract changes
- **Digital Signatures**: Secure contract signing

## Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running on port 5000

## Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm start


Available Scripts

npm start - Start development server
npm build - Build for production
npm test - Run tests
npm run lint - Lint code
npm run format - Format code with Prettier

Project Structure
src/
├── components/     # Reusable UI components
├── hooks/         # Custom React hooks
├── services/      # API and external services
├── store/         # Redux store configuration
├── styles/        # Global styles and CSS
├── utils/         # Helper functions
├── App.js         # Main application component
└── index.js       # Application entry point
Configuration
Environment variables can be configured in .env.local:

REACT_APP_API_URL - Backend API URL
REACT_APP_WS_URL - WebSocket server URL
REACT_APP_ENABLE_WEBSOCKETS - Enable real-time features
REACT_APP_ENABLE_2FA - Enable two-factor authentication

Development
Code Style
We use ESLint and Prettier for code formatting. Run npm run lint:fix to auto-fix issues.
Testing
bash# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
Building
bash# Create production build
npm run build

# Analyze bundle size
npm run build -- --stats
Deployment
The application can be deployed to any static hosting service:
bash# Build the application
npm run build

# Deploy the build folder
# Example with Netlify
netlify deploy --prod --dir=build
Contributing

Create a feature branch
Make your changes
Run tests and linting
Submit a pull request

License
MIT License - see LICENSE file for details