
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const root = createRoot(document.getElementById('root'))

if (!PUBLISHABLE_KEY) {
  root.render(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', padding: '24px', textAlign: 'center', backgroundColor: '#f9fafb' }}>
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxWidth: '480px', width: '100%' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1f2937', marginBottom: '12px' }}>Nexora AI — Configuration Required</h1>
        <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
          <code>VITE_CLERK_PUBLISHABLE_KEY</code> is not configured.
        </p>
        <p style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.5 }}>
          Create <code>client/.env</code> with your Clerk publishable key:
        </p>
        <pre style={{ background: '#f3f4f6', padding: '10px', borderRadius: '6px', fontSize: '12px', textAlign: 'left', marginTop: '12px', overflowX: 'auto' }}>
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_BASE_URL=http://localhost:3000
        </pre>
      </div>
    </div>
  )
} else {
  root.render(
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl='/'>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  )
}
