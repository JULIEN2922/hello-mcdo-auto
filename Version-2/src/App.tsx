import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { RestaurantsPage } from './pages/RestaurantsPage'
import RestaurantConfigPage from './pages/RestaurantConfigPage'
import { PlanningsPage } from './pages/PlanningsPage'
import { LogsPage } from './pages/LogsPage'
import { UsersPage } from './pages/UsersPage'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/restaurants" element={<ProtectedRoute><RestaurantsPage /></ProtectedRoute>} />
            <Route path="/restaurants/:id/config" element={<ProtectedRoute><RestaurantConfigPage /></ProtectedRoute>} />
            <Route path="/plannings" element={<ProtectedRoute><PlanningsPage /></ProtectedRoute>} />
            <Route path="/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
