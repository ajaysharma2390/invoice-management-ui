import { useEffect, useState } from 'react'
import { Alert, Button, Result, Spin } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import invoiceEnvelope from '../../data/invoice_list_envelope.json'
import DocumentEnvelope from './DocumentEnvelope.jsx'
import { requestApi } from '../../services/xhr.js'

function isRenderableEnvelope(envelope) {
  return (
    envelope &&
    envelope.template &&
    Array.isArray(envelope.template.zones?.body)
  )
}

function SchemaDocument() {
  const endpoint = invoiceEnvelope.page.endpoints?.envelope
  const [envelope, setEnvelope] = useState(() =>
    endpoint ? null : invoiceEnvelope,
  )
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!endpoint) return undefined

    const controller = new AbortController()

    requestApi(endpoint, { signal: controller.signal })
      .then((response) => {
        if (!isRenderableEnvelope(response)) {
          throw new Error('The page template is missing its body definition.')
        }
        setEnvelope(response)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError)
      })

    return () => controller.abort()
  }, [attempt, endpoint])

  if (error) {
    return (
      <main className="page-shell page-shell--error">
        <Result
          status="error"
          title="Unable to load invoices"
          subTitle={error.message}
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => {
                setEnvelope(null)
                setError(null)
                setAttempt((current) => current + 1)
              }}
            >
              Try again
            </Button>
          }
        />
        <Alert
          showIcon
          type="info"
          message="The invoice service is expected at this app's /api route."
        />
      </main>
    )
  }

  if (!envelope) {
    return (
      <main className="page-shell page-shell--loading">
        <Spin size="large" description="Loading invoice workspace…" />
      </main>
    )
  }

  return <DocumentEnvelope envelope={envelope} />
}

export default SchemaDocument
