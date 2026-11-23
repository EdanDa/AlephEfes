import { applyDocumentLanguage, direction, t } from './i18n/locale.js';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fallback-tailwind.css';
import App from './App';
import { isChunkLoadError, reloadForChunkError } from './core/chunkRecovery';

window.addEventListener('vite:preloadError', (event) => {
  if (reloadForChunkError(event.payload || event.reason)) event.preventDefault();
});

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown error',
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error, info) {
    if (reloadForChunkError(error)) return;
    console.error('App crashed during render:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.isChunkError;
      return (
        <div dir={direction} style={{ minHeight: '100vh', padding: 'clamp(1rem, 5vw, 2rem)', fontFamily: 'sans-serif', background: '#f8fafc', color: '#0f172a' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            {isChunkError ? t('הגרסה החדשה של האפליקציה עדיין לא נטענה') : t('אירעה שגיאה בטעינת האפליקציה')}
          </h1>
          <p style={{ marginBottom: '0.5rem', lineHeight: 1.6 }}>
            {isChunkError
              ? t('הדפדפן ביקש קובץ מגרסה קודמת. ניסינו לרענן את הדף פעם אחת באופן אוטומטי, אך הקובץ עדיין אינו זמין.')
              : t('המסך הלבן הוחלף בהודעת שגיאה כדי לאפשר זיהוי הבעיה.')}
          </p>
          <code style={{ display: 'block', whiteSpace: 'pre-wrap', background: '#e2e8f0', padding: '0.75rem', borderRadius: '0.5rem' }}>
            {this.state.errorMessage}
          </code>
          <p style={{ marginTop: '1rem', lineHeight: 1.6 }}>
            {isChunkError
              ? t('אפשר לנסות לסגור את הלשונית ולפתוח מחדש את האתר. אין צורך לנקות את הטקסט השמור באפליקציה.')
              : t('נסה לרענן את הדף. אם השגיאה חוזרת ונראה שהיא קשורה למצב שנשמר באפליקציה, ייתכן שניקוי נתוני האתר יעזור.')}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

applyDocumentLanguage();
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
