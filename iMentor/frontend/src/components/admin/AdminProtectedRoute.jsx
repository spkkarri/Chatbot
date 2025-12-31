// frontend/src/components/admin/AdminProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext.jsx'; // Using AppStateContext
import toast from 'react-hot-toast'; // Optional: for a message if redirecting

function AdminProtectedRoute({ children }) { // Accept children for different react-router-dom versions
    const { isAdminSessionActive } = useAppState(); // Get the admin session flag
    const location = useLocation();

    if (!isAdminSessionActive) {
        // If admin session is not active, redirect the user.
        // Redirecting to the main page ('/') is a common approach.
        // The main App component's logic will then likely show the AuthModal
        // if no regular user is logged in either.
        console.log("AdminProtectedRoute: Admin session not active. Redirecting from", location.pathname);
        toast.error("Admin access required. Please log in as admin."); // Optional feedback
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // If admin session is active, render the child components (the protected route's content)
    return children ? children : <Outlet />; // Outlet is for v6 nested routes, children for direct wrapping
}

export default AdminProtectedRoute;