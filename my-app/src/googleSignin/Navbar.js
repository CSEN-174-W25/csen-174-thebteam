import React, { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth } from "./config"; // Import auth from your Firebase config
import "./Navbar.css";

function Navbar() {
    const [userEmail, setUserEmail] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    useEffect(() => {
        // Get user email from localStorage
        const email = localStorage.getItem("email");
        setUserEmail(email || "");

        // Add click event listener to close dropdown when clicking outside
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleLogout = () => {
        // Sign out from Firebase
        auth.signOut()
            .then(() => {
                // Clear localStorage
                localStorage.removeItem("email");
                // Navigate to sign-in page
                navigate("/signin");
            })
            .catch((error) => {
                console.error("Error signing out:", error);
            });
    };

    const toggleDropdown = () => {
        setDropdownOpen(!dropdownOpen);
    };

    // Function to get user initials for avatar
    const getUserInitials = () => {
        if (!userEmail) return "?";

        // Get first letter of email
        return userEmail.charAt(0).toUpperCase();
    };

    return (
        <nav className="navbar">
            <div className="nav-links">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        isActive ? "nav-item active" : "nav-item"
                    }
                >
                    Ask for Help
                </NavLink>
                <NavLink
                    to="/four-year-plan"
                    className={({ isActive }) =>
                        isActive ? "nav-item active" : "nav-item"
                    }
                >
                    Planner
                </NavLink>
                <NavLink
                    to="/explorer"
                    className={({ isActive }) =>
                        isActive ? "nav-item active" : "nav-item"
                    }
                >
                    Course Explorer
                </NavLink>
            </div>

            {userEmail && (
                <div className="user-menu" ref={dropdownRef}>
                    <button
                        className="avatar-button"
                        onClick={toggleDropdown}
                        aria-label="User menu"
                    >
                        <div className="avatar">{getUserInitials()}</div>
                    </button>

                    {dropdownOpen && (
                        <div className="user-dropdown">
                            <div className="user-info">
                                <span className="email">{userEmail}</span>
                            </div>
                            <button
                                className="logout-button"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
}

export default Navbar;
