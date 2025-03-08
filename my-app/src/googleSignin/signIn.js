import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, provider } from "./config";
import { signInWithPopup, signOut, GoogleAuthProvider } from "firebase/auth";
import "./SignIn.css";

function SignIn() {
    const [value, setValue] = useState("");
    const [error, setError] = useState("");
    const [invalidEmail, setInvalidEmail] = useState("");
    const navigate = useNavigate();

    // Create a customized provider to force account selection
    const getProviderWithPrompt = () => {
        const newProvider = new GoogleAuthProvider();
        // This parameter forces the account chooser to appear
        newProvider.setCustomParameters({
            prompt: "select_account",
        });
        return newProvider;
    };

    const handleSignIn = () => {
        setError(""); // Clear any previous errors
        setInvalidEmail(""); // Clear any previous invalid email

        // Use the regular provider for the first login attempt
        signInWithPopup(auth, provider)
            .then((result) => {
                const email = result.user.email;

                // Check if the email ends with @scu.edu
                if (email.endsWith("@scu.edu")) {
                    setValue(email);
                    localStorage.setItem("email", email);
                    navigate("/"); // Redirect to home page after successful login
                } else {
                    // If not an SCU email, sign out and show error
                    setInvalidEmail(email);
                    signOut(auth).then(() => {
                        setError(
                            "Please use an @scu.edu email address to sign in."
                        );
                    });
                }
            })
            .catch((error) => {
                if (error.code === "auth/popup-closed-by-user") {
                    console.log("Sign-in popup closed by user");
                } else {
                    setError("Authentication failed. Please try again.");
                    console.error("Authentication error:", error);
                }
            });
    };

    const tryAgainWithDifferentAccount = () => {
        setError(""); // Clear error message

        // First sign out to clear any existing session
        signOut(auth).then(() => {
            // Then sign in with a provider that forces account selection
            signInWithPopup(auth, getProviderWithPrompt())
                .then((result) => {
                    const email = result.user.email;

                    if (email.endsWith("@scu.edu")) {
                        setValue(email);
                        localStorage.setItem("email", email);
                        navigate("/");
                    } else {
                        setInvalidEmail(email);
                        signOut(auth).then(() => {
                            setError(
                                "Please use an @scu.edu email address to sign in."
                            );
                        });
                    }
                })
                .catch((error) => {
                    if (error.code === "auth/popup-closed-by-user") {
                        console.log("Sign-in popup closed by user");
                    } else {
                        setError("Authentication failed. Please try again.");
                        console.error("Authentication error:", error);
                    }
                });
        });
    };

    useEffect(() => {
        const email = localStorage.getItem("email");

        // Only consider valid SCU emails for auto-login
        if (email && email.endsWith("@scu.edu")) {
            setValue(email);
            navigate("/");
        } else if (email) {
            // Clear non-SCU emails from localStorage
            localStorage.removeItem("email");
        }
    }, [navigate]);

    return (
        <div className="signin-container">
            <div className="signin-card">
                <h1 className="signin-title">Welcome to CourseSense</h1>
                <p className="signin-subtitle">
                    Sign in with your SCU account to continue
                </p>

                {error && (
                    <div className="signin-error">
                        <p>{error}</p>
                        {invalidEmail && (
                            <p className="invalid-email">
                                You tried to sign in with:{" "}
                                <strong>{invalidEmail}</strong>
                            </p>
                        )}
                        <button
                            onClick={tryAgainWithDifferentAccount}
                            className="try-again-button"
                        >
                            Try again with a different account
                        </button>
                    </div>
                )}

                {!error && (
                    <button
                        onClick={handleSignIn}
                        className="google-signin-button"
                    >
                        <img
                            src="https://www.vectorlogo.zone/logos/google/google-icon.svg"
                            alt="Google logo"
                        />
                        Sign in with Google
                    </button>
                )}

                <div className="signin-note">
                    Only @scu.edu email addresses are accepted
                </div>
            </div>
        </div>
    );
}

export default SignIn;
