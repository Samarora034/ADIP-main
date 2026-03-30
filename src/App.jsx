import { Routes, Route } from 'react-router-dom'
import { DashboardProvider } from './context/DashboardContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ComparisonPage from './pages/ComparisonPage'

function App() {
  return (
    <DashboardProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/comparison" element={<ComparisonPage />} />
      </Routes>
    </DashboardProvider>
  )
}

export default App
