import { Readable } from 'node:stream'
import { handleMockApiRequest } from '../../vite/invoiceMockApi.js'

function getRequestUrl(event) {
  const url = new URL(event.rawUrl)
  const functionPrefix = '/.netlify/functions/mock-api'

  if (url.pathname.startsWith(`${functionPrefix}/`)) {
    url.pathname = url.pathname.slice(functionPrefix.length)
  }

  if (!url.pathname.startsWith('/api/')) {
    throw new Error(`Unexpected mock API path: ${url.pathname}`)
  }

  return url
}

export default async function handler(event) {
  const body = event.body
    ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
    : Buffer.alloc(0)
  const request = Readable.from(body.length ? [body] : [])
  request.method = event.httpMethod ?? 'GET'
  request.headers = Object.fromEntries(
    Object.entries(event.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  )

  const response = {
    statusCode: 200,
    headers: {},
    body: '',
    headersSent: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    end(payload = '') {
      this.body = payload
      this.headersSent = true
    },
  }

  try {
    await handleMockApiRequest(request, response, getRequestUrl(event))
  } catch (error) {
    console.error('Netlify mock API request failed:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'The mock API request failed.' },
      }),
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  }

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
  }
}
