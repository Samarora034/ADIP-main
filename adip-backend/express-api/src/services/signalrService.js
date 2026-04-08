// Socket.IO handles the actual frontend push via global.io in app.js
function broadcastDriftEvent(event) {
  if (!global.io) return
  const room = event.resourceGroup
    ? `${event.subscriptionId}:${event.resourceGroup}`
    : event.subscriptionId
  global.io.to(room).emit('driftEvent', event)
}

module.exports = { broadcastDriftEvent }
