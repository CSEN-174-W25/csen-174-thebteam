import React from "react";
import { Navigate } from "react-router-dom";

// Protected route component that checks for authentication
const ProtectedRoute = ({ children }) => {
    const email = localStorage.getItem("email");

    if (!email) {
        // Redirect to signin page if not authenticated
        return <Navigate to="/signin" replace />;
    }

    return children;
};

export default ProtectedRoute;
