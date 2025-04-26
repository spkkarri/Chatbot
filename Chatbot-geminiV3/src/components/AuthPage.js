// client/src/components/AuthPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signinUser, signupUser } from '../services/api';

const AuthPage = ({ setIsAuthenticated }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleAuth = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);

        if (!username.trim() || !password.trim()) {
            setError('Username and password cannot be empty.');
            setLoading(false); return;
        }

        try {
            let response;
            const userData = { username, password };
            if (isLogin) {
                response = await signinUser(userData);
            } else {
                 if (password.length < 6) {
                     setError('Password must be at least 6 characters long.');
                     setLoading(false); return;
                 }
                response = await signupUser(userData);
            }

            const { sessionId, username: loggedInUsername, _id: userId } = response.data;

            if (!userId || !sessionId || !loggedInUsername) {
                 throw new Error("Incomplete authentication data received from server.");
            }

            // Store user info in localStorage
            localStorage.setItem('sessionId', sessionId);
            localStorage.setItem('username', loggedInUsername);
            localStorage.setItem('userId', userId); // Store userId

            setIsAuthenticated(true); // Update App state
            navigate('/chat', { replace: true }); // Redirect to chat page

        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || `An error occurred during ${isLogin ? 'sign in' : 'sign up'}.`;
            setError(errorMessage);
            console.error("Auth Error:", err.response || err);
            // Clear potentially invalid items on auth error
            localStorage.removeItem('sessionId');
            localStorage.removeItem('username');
            localStorage.removeItem('userId');
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setUsername(''); setPassword(''); setError('');
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
                <form onSubmit={handleAuth}>
                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text" id="username" value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required autoComplete="username"
                            disabled={loading}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password" id="password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required autoComplete={isLogin ? "current-password" : "new-password"}
                            disabled={loading}
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>
                <button onClick={toggleMode} className="toggle-button" disabled={loading}>
                    {isLogin ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
                </button>
            </div>
        </div>
    );
};

// --- CSS for AuthPage (included directly) ---
const AuthPageCSS = `
.auth-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f0f2f5; }
.auth-box { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); width: 100%; max-width: 400px; text-align: center; }
.auth-box h2 { margin-bottom: 25px; color: #333; }
.input-group { margin-bottom: 20px; text-align: left; }
.input-group label { display: block; margin-bottom: 8px; color: #555; font-weight: bold; }
.input-group input { width: 100%; padding: 12px 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1rem; }
.input-group input:focus { outline: none; border-color: #007bff; box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25); }
.input-group input:disabled { background-color: #e9ecef; cursor: not-allowed; }
.auth-button { width: 100%; padding: 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; transition: background-color 0.3s ease; margin-top: 10px; }
.auth-button:hover:not(:disabled) { background-color: #0056b3; }
.auth-button:disabled { background-color: #cccccc; cursor: not-allowed; }
.toggle-button { background: none; border: none; color: #007bff; cursor: pointer; margin-top: 20px; font-size: 0.9rem; }
.toggle-button:hover:not(:disabled) { text-decoration: underline; }
.toggle-button:disabled { color: #999; cursor: not-allowed; }
.error-message { color: #dc3545; margin-top: 15px; margin-bottom: 0; font-size: 0.9rem; }
`;
// --- Inject CSS ---
const styleTagAuthId = 'auth-page-styles';
if (!document.getElementById(styleTagAuthId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagAuthId;
    styleTag.type = "text/css";
    styleTag.innerText = AuthPageCSS;
    document.head.appendChild(styleTag);
}
// --- End CSS Injection ---

export default AuthPage;
