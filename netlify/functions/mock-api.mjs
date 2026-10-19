import { Readable } from 'node:stream'
import { handleMockApiRequest } from '../../vite/invoiceMockApi.js'

function getRequestUrl(request) {
  const url = new URL(request.url)
  const functionPrefix = '/.netlify/functions/mock-api'

  if (url.pathname.startsWith(`${functionPrefix}/`)) {
    url.pathname = url.pathname.slice(functionPrefix.length)
  }

  if (!url.pathname.startsWith('/api/')) {
    throw new Error(`Unexpected mock API path: ${url.pathname}`)
  }

  return url
}

export default async function handler(incomingRequest) {
  const request = incomingRequest.body
    ? Readable.fromWeb(incomingRequest.body)
    : Readable.from([])
  request.method = incomingRequest.method
  request.headers = Object.fromEntries(incomingRequest.headers.entries())

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
    await handleMockApiRequest(
      request,
      response,
      getRequestUrl(incomingRequest),
    )
  } catch (error) {
    console.error('Netlify mock API request failed:', error)
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The mock API request failed.',
        },
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    )
  }

  return new Response(response.body, {
    status: response.statusCode,
    headers: response.headers,
  })
}
