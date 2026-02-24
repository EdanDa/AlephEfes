import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('App crashed during render:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" style={{ minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif', background: '#f8fafc', color: '#0f172a' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>אירעה שגיאה בטעינת האפליקציה</h1>
          <p style={{ marginBottom: '0.5rem' }}>המסך הלבן הוחלף בהודעת שגיאה כדי לאפשר זיהוי הבעיה.</p>
          <code style={{ display: 'block', whiteSpace: 'pre-wrap', background: '#e2e8f0', padding: '0.75rem', borderRadius: '0.5rem' }}>
            {this.state.errorMessage}
          </code>
          <p style={{ marginTop: '1rem' }}>נסה לרענן את הדף, ובמידת הצורך לנקות Local Storage עבור האתר.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element (#root) was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
