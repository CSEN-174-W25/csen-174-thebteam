import React, { useState, useRef, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import "./home.css";

function Home() {
    const [userInput, setUserInput] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef(null);
    const functions = getFunctions();
    const ragFunction = httpsCallable(functions, "rag");

    // Initial welcome message
    useEffect(() => {
        setChatHistory([
            {
                type: "bot",
                message:
                    "Hello! How can I help you with information about these courses? For example, are you interested in: * Finding out if a specific course has prerequisites? * Comparing courses from different departments? * Knowing which courses belong to a certain department? Just let me know what you'd like to know!",
            },
        ]);
    }, []);

    // Scroll to bottom of chat when messages are added
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop =
                chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Handle user input
    const handleUserInput = (e) => {
        setUserInput(e.target.value);
    };

    // Handle Enter key
    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    };

    // Send user message to the "rag" Cloud Function
    const sendMessage = async () => {
        if (!userInput.trim()) return;

        // Add user message to chat immediately
        setChatHistory((prevHistory) => [
            ...prevHistory,
            { type: "user", message: userInput },
        ]);

        const userMessage = userInput;
        setUserInput("");
        setIsLoading(true);

        try {
            console.log("Calling RAG function with query:", userMessage);
            const result = await ragFunction({ query: userMessage });
            const chatbotResponse = result.data.response;

            // Add bot response to chat
            setChatHistory((prevHistory) => [
                ...prevHistory,
                { type: "bot", message: chatbotResponse },
            ]);
        } catch (error) {
            console.error("Error calling RAG function:", error);
            // Add error message to chat
            setChatHistory((prevHistory) => [
                ...prevHistory,
                {
                    type: "bot",
                    message:
                        "Sorry, I encountered an error processing your request.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // Clear chat history
    const clearChat = () => {
        setChatHistory([
            {
                type: "bot",
                message:
                    "Hello! How can I help you with information about these courses? For example, are you interested in: * Finding out if a specific course has prerequisites? * Comparing courses from different departments? * Knowing which courses belong to a certain department? Just let me know what you'd like to know!",
            },
        ]);
    };

    return (
        <div className="discord-chat">
            {/* Chat header */}
            <div className="chat-header">
                <h1>Advisor</h1>
            </div>

            {/* Chat messages area */}
            <div className="chat-messages" ref={chatContainerRef}>
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`message ${msg.type}`}>
                        {msg.type === "bot" && (
                            <div className="bot-avatar">🤖</div>
                        )}
                        <div className="message-content">{msg.message}</div>
                    </div>
                ))}
                {isLoading && (
                    <div className="message bot">
                        <div className="bot-avatar">🤖</div>
                        <div className="message-content">
                            <span className="typing-indicator">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Chat input area */}
            <div className="chat-input-area">
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Type your message..."
                    value={userInput}
                    onChange={handleUserInput}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading}
                />
                <button
                    className="send-button"
                    onClick={sendMessage}
                    disabled={isLoading || !userInput.trim()}
                >
                    Send
                </button>
                <button className="clear-button" onClick={clearChat}>
                    Clear
                </button>
            </div>
        </div>
    );
}

export default Home;
