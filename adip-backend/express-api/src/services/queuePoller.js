const { QueueServiceClient } = require('@azure/storage-queue')

let queueClient = null

function getQueueClient() {
  if (!queueClient) {
    const svc = QueueServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING)
    queueClient = svc.getQueueClient(process.env.STORAGE_QUEUE_NAME || 'resource-changes')
  }
  return queueClient
}

// Parse Event Grid message from queue (base64 encoded)
function parseMessage(msg) {
  try {
    const decoded = Buffer.from(msg.messageText, 'base64').toString('utf-8')
    const parsed  = JSON.parse(decoded)
    // Event Grid wraps in array
    const event   = Array.isArray(parsed) ? parsed[0] : parsed
    return {
      eventId:        event.id,
      eventType:      event.eventType,
      subject:        event.subject,
      eventTime:      event.eventTime,
      resourceId:     event.data?.resourceUri || event.subject,
      subscriptionId: event.data?.subscriptionId || '',
      resourceGroup:  event.data?.resourceUri?.split('/')[4] || '',
      operationName:  event.data?.operationName || event.eventType,
      status:         event.data?.status || 'Succeeded',
      caller:         event.data?.claims?.name || event.data?.caller || 'unknown',
    }
  } catch {
    return null
  }
}

// Start polling the queue and emit change events via Socket.IO
function startQueuePoller() {
  const interval = parseInt(process.env.QUEUE_POLL_INTERVAL_MS || '5000', 10)
  const client   = getQueueClient()

  setInterval(async () => {
    try {
      // Dequeue up to 32 messages at once
      const response = await client.receiveMessages({ numberOfMessages: 32, visibilityTimeout: 30 })
      for (const msg of response.receivedMessageItems) {
        const event = parseMessage(msg)
        if (event) {
          // Broadcast to all rooms matching subscriptionId or resourceGroup
          if (global.io) {
            const rooms = [event.subscriptionId, `${event.subscriptionId}:${event.resourceGroup}`].filter(Boolean)
            rooms.forEach(room => global.io.to(room).emit('resourceChange', event))
          }
          // Delete processed message from queue
          await client.deleteMessage(msg.messageId, msg.popReceipt)
        }
      }
    } catch (err) {
      // Queue not ready yet or connection issue — retry next interval
    }
  }, interval)

  console.log(`Queue poller started — polling every ${interval}ms`)
}

module.exports = { startQueuePoller }
