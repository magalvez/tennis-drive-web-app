import React from 'react';
import { col } from '../config/environment';

export const DevBanner: React.FC = () => {
  // Check if current collection is 'dev_users'
  const isDev = col('users') === 'dev_users';

  if (!isDev) return null;

  return (
    <div style={{
      backgroundColor: '#FF6F00',
      color: 'white',
      padding: '4px 0',
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: 'bold',
      letterSpacing: '1px',
      zIndex: 9999,
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
      textTransform: 'uppercase'
    }}>
      <span role="img" aria-label="warning">⚠️</span>
      DEV MODE — DEVELOPMENT
    </div>
  );
}; 
