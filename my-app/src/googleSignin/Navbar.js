import React from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.css"; // Import styles

function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="nav-item">Ask for Help</NavLink>
      <NavLink to="/four-year-plan" className="nav-item">Planner</NavLink>
    </nav>
  );
}

export default Navbar;