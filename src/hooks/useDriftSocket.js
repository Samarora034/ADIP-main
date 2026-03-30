import { useState, useEffect, useRef, useCallback } from 'react'

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  import.meta.env.VITE_API_BASE_URL?.replace('/api', '') ??
  null

export function useDriftSocket(scope, isMonitoring = false) {
  const [changeEvents, setChangeEvents]       = useState([])
  const [socketConnected, setSocketConnected] = useState(false)
  const socketRef  = useRef(null)
  const mountedRef = useRef(true)

  const addEvent = useCallback((event) => {
    setChangeEvents(prev =>
      [{
        ...event,
        _clientId:   `${event.eventId ?? Date.now()}-${Math.random()}`,
        _receivedAt: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 200)
    )
  }, [])

  const connectSocket = useCallback(() => {
    if (!SOCKET_URL || !scope?.subscriptionId) return
    import('socket.io-client')
      .then(({ io }) => {
        if (!mountedRef.current) return
        socketRef.current?.disconnect()
        const socket = io(SOCKET_URL, { transports: ['websocket'], reconnectionAttempts: 5 })
        socketRef.current = socket

        socket.on('connect', () => {
          if (!mountedRef.current) return
          setSocketConnected(true)
          // Subscribe to the selected scope room
          socket.emit('subscribe', {
            subscriptionId: scope.subscriptionId,
            resourceGroup:  scope.resourceGroup ?? null,
          })
        })

        socket.on('disconnect', () => { if (mountedRef.current) setSocketConnected(false) })
        socket.on('connect_error', () => { if (mountedRef.current) setSocketConnected(false) })

        // Real-time resource change events from Event Grid → Queue → Express → Socket.IO
        socket.on('resourceChange', (event) => {
          if (!mountedRef.current) return
          // Filter to selected scope
          const matchesSub = event.subscriptionId === scope.subscriptionId
          const matchesRG  = !scope.resourceGroup || event.resourceGroup === scope.resourceGroup
          if (matchesSub && matchesRG) addEvent(event)
        })
      })
      .catch(() => {})
  }, [scope?.subscriptionId, scope?.resourceGroup, addEvent])

  useEffect(() => {
    mountedRef.current = true
    connectSocket()
    return () => {
      mountedRef.current = false
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [connectSocket])

  const clearChangeEvents = useCallback(() => setChangeEvents([]), [])

  return { driftEvents: changeEvents, socketConnected, clearDriftEvents: clearChangeEvents }
}
