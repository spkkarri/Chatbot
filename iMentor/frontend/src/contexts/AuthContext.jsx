// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js'; 
import toast from 'react-hot-toast';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setTokenState] = useState(localStorage.getItem('authToken'));
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);

    const setToken = (newToken) => {
        if (newToken) localStorage.setItem('authToken', newToken);
        else localStorage.removeItem('authToken');
        setTokenState(newToken);
    };

    const setUser = (newUser) => setUserState(newUser);
    
    const processAuthData = useCallback((authApiResponse) => {
        if (authApiResponse && authApiResponse.token && authApiResponse._id && authApiResponse.email) {
            setToken(authApiResponse.token);
            const userObject = { 
                id: authApiResponse._id, 
                email: authApiResponse.email, 
                username: authApiResponse.username,
                hasCompletedOnboarding: authApiResponse.hasCompletedOnboarding
            };
            setUser(userObject);
             console.log("AuthContext: User and Token set.", userObject);
            return authApiResponse; 
        } else {
            setToken(null);
            setUser(null);
            console.error("AuthContext: processAuthData received incomplete data for a regular user.", authApiResponse);
            throw new Error("Authentication response from server was incomplete for a regular user.");
        }
    }, []);

    useEffect(() => {
        const verifyTokenAndLoadUser = async () => {
            const storedToken = localStorage.getItem('authToken');
            if (storedToken) {
                setTokenState(storedToken);
                try {
                    const userDataFromMe = await api.getMe();
                    if (userDataFromMe && userDataFromMe._id && userDataFromMe.email) {
                        setUser({ 
                            id: userDataFromMe._id, 
                            email: userDataFromMe.email, 
                            username: userDataFromMe.username,
                            hasCompletedOnboarding: userDataFromMe.hasCompletedOnboarding
                        });
                    } else {
                        setToken(null);
                        setUser(null);
                    }
                } catch (error) {
                    setToken(null);
                    setUser(null);
                    throw error;
                }
            }
            setLoading(false);
        };
        verifyTokenAndLoadUser();
    }, []);

    const login = async (credentials) => {
        setLoading(true);
        try {
            const data = await api.login(credentials);
            if (data && data.isAdminLogin && data.token) {
                setToken(data.token); 
            return data; 
            }

            return processAuthData(data);
        } catch (error) {
            setToken(null); 
            setUser(null);
            throw error; 
        } finally {
            setLoading(false);
        }
    };
    
    const signup = async (signupData) => {
        setLoading(true);
        try {
            const data = await api.signup(signupData);
            return processAuthData(data); 
        } catch (error) {
            setToken(null);
            setUser(null);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        console.log("AuthContext: Logging out user.");
        setToken(null); 
        setUser(null);
        toast.success("You have been logged out.");
    };

    return (
        <AuthContext.Provider value={{ token, user, loading, login, signup, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};