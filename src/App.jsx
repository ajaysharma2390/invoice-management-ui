import { useEffect, useState } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import InvoiceCreatePage from './components/create/InvoiceCreatePage.jsx'
import InvoiceDetailPage from './components/detail/InvoiceDetailPage.jsx'
import SchemaDocument from './components/document/SchemaDocument.jsx'
import './App.css'

function currentRoute() {
  if (/^\/invoice-new\/?$/.test(window.location.pathname)) {
    return { type: 'invoice-create' }
  }

  const match = window.location.pathname.match(/^\/invoice-document\/([^/]+)\/?$/)
  if (!match) return { type: 'listing' }

  try {
    return { type: 'invoice', recordId: decodeURIComponent(match[1]) }
  } catch {
    return { type: 'not-found' }
  }
}

function App() {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const handlePopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#176b5b',
          borderRadius: 8,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <AntApp>
        {route.type === 'invoice-create' ? (
          <InvoiceCreatePage />
        ) : route.type === 'invoice' ? (
          <InvoiceDetailPage
            key={route.recordId}
            recordId={route.recordId}
          />
        ) : route.type === 'not-found' ? (
          <main className="page-shell">
            <h1>Invoice not found</h1>
            <a href="/">Return to invoices</a>
          </main>
        ) : (
          <SchemaDocument />
        )}
      </AntApp>
    </ConfigProvider>
  )
}

export default App
