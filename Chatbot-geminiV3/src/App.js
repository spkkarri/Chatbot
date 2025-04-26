// client/src/App.js
import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CircularProgress } from '@mui/material';

// Lazy load components to reduce initial bundle size
const AuthPage = React.lazy(() => import('./components/AuthPage'));
const ChatPage = React.lazy(() => import('./components/ChatPage'));

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
    },
    primary: {
      main: '#90caf9',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#2d2d2d',
          color: '#ffffff',
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2d2d2d',
          color: '#ffffff',
        }
      }
    }
  }
});

const LoadingFallback = () => (
    <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#121212'
    }}>
        <CircularProgress />
    </div>
);

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('userId'));

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'userId') {
                const hasUserId = !!event.newValue;
                console.log("App Storage Listener: userId changed, setting isAuthenticated to", hasUserId);
                setIsAuthenticated(hasUserId);
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    return (
        <ThemeProvider theme={darkTheme}>
            <Router>
                <div style={{ 
                    minHeight: '100vh',
                    backgroundColor: '#1a1a1a',
                    color: '#ffffff',
                    padding: '20px'
                }}>
                    <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                            <Route
                                path="/login"
                                element={
                                    !isAuthenticated ? (
                                        <AuthPage setIsAuthenticated={setIsAuthenticated} />
                                    ) : (
                                        <Navigate to="/chat" replace />
                                    )
                                }
                            />

                            <Route
                                path="/chat"
                                element={
                                    isAuthenticated ? (
                                        <ChatPage setIsAuthenticated={setIsAuthenticated} />
                                    ) : (
                                        <Navigate to="/login" replace />
                                    )
                                }
                            />

                            <Route
                                path="/"
                                element={
                                    isAuthenticated ? (
                                        <Navigate to="/chat" replace />
                                    ) : (
                                        <Navigate to="/login" replace />
                                    )
                                }
                            />

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                </div>
            </Router>
        </ThemeProvider>
    );
}

export default App;
