import React from "react";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import Home from "./googleSignin/home";
import SignIn from "./googleSignin/signIn";
import FourYearPlan from "./googleSignin/FourYearPlan";
import CourseExplorer from "./googleSignin/CourseExplorer";
import Navbar from "./googleSignin/Navbar";
import ProtectedRoute from "./googleSignin/ProtectedRoute";

function App() {
    return (
        <Router>
            <Routes>
                {/* Public route */}
                <Route path="/signin" element={<SignIn />} />

                {/* Protected routes */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <>
                                <Navbar />
                                <Home />
                            </>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/four-year-plan"
                    element={
                        <ProtectedRoute>
                            <>
                                <Navbar />
                                <FourYearPlan />
                            </>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/explorer"
                    element={
                        <ProtectedRoute>
                            <>
                                <Navbar />
                                <CourseExplorer />
                            </>
                        </ProtectedRoute>
                    }
                />

                {/* Catch-all route redirects to signin */}
                <Route path="*" element={<Navigate to="/signin" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
