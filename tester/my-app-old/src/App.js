import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./googleSignin/home";
import SignIn from "./googleSignin/signIn";
import FourYearPlan from "./googleSignin/FourYearPlan";
import Navbar from "./googleSignin/Navbar"; // Correct path based on your folder structure

function App() {
  return (
    <Router>
      <Navbar /> {/* Add Navigation Bar */}
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/" element={<Home />} />
        <Route path="/four-year-plan" element={<FourYearPlan />} />
        <Route path="*" element={<SignIn />} />
      </Routes>
    </Router>
  );
}

export default App;
