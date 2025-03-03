
// import React, { useState, useRef } from "react";
// import { useNavigate } from "react-router-dom";
// import { getFunctions, httpsCallable } from "firebase/functions"; // For calling Cloud Functions
// import "./home.css";

// function Home() {
//     const [userInput, setUserInput] = useState("");
//     const [chatHistory, setChatHistory] = useState([]);
//     const [isLoading, setIsLoading] = useState(false);
//     const chatContainerRef = useRef(null);
//     const navigate = useNavigate(); // React Router for navigation

//     // Get a reference to the Cloud Functions service.
//     // If you have a custom firebase.js, you can import your "functions" instance directly.
//     const functions = getFunctions();
//     // Reference your callable function named "rag".
//     const ragFunction = httpsCallable(functions, "rag");

//     // Handle user input
//     const handleUserInput = (e) => {
//         setUserInput(e.target.value);
//     };

//     // Handle Enter key
//     const handleKeyPress = (event) => {
//         if (event.key === "Enter") {
//             event.preventDefault();
//             sendMessage();
//         }
//     };

//     // Send user message to the "rag" Cloud Function
//     const sendMessage = async () => {
//         if (!userInput.trim()) return;
//         setIsLoading(true);

//         try {
//             // Call the rag function with the user's query
//             console.log("Calling RAG function with query:", userInput);
//             const result = await ragFunction({ query: userInput });
//             // The response from your function should be in result.data.response
//             const chatbotResponse = result.data.response;

//             // Update chat history
//             setChatHistory((prevHistory) => [
//                 ...prevHistory,
//                 { type: "user", message: userInput },
//                 { type: "bot", message: chatbotResponse },
//             ]);
//         } catch (error) {
//             console.error("Error calling RAG function:", error);
//         } finally {
//             setUserInput("");
//             setIsLoading(false);
//         }
//     };

//     // Clear chat history
//     const clearChat = () => {
//         setChatHistory([]);
//     };

//     return (
//         <div>
//             <div className="container">
//                 <h1>Chatbot</h1>
//                 <div className="chat-box" ref={chatContainerRef}>
//                     {chatHistory.length === 0 ? (
//                         <p className="placeholder-text">Start a conversation...</p>
//                     ) : (
//                         chatHistory.map((msg, index) => (
//                             <div key={index} className={`message ${msg.type}`}>
//                                 <strong>{msg.type === "user" ? "You:" : "Bot:"}</strong> {msg.message}
//                             </div>
//                         ))
//                     )}
//                 </div>
//                 <input
//                     type="text"
//                     placeholder="Type your message..."
//                     value={userInput}
//                     onChange={handleUserInput}
//                     onKeyDown={handleKeyPress}
//                     disabled={isLoading}
//                 />
//                 <button onClick={sendMessage} disabled={isLoading}>
//                     Send
//                 </button>
//                 <button className="clear-btn" onClick={clearChat}>
//                     Clear Chat
//                 </button>
//             </div>
//         </div>
//     );
// }

// export default Home;

import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions"; // For calling Cloud Functions
import "./home.css";

function Home() {
    const [userInput, setUserInput] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef(null);
    const navigate = useNavigate(); // React Router for navigation

    // Get a reference to the Cloud Functions service.
    // If you have a custom firebase.js, you can import your "functions" instance directly.
    const functions = getFunctions();
    // Reference your callable function named "rag".
    const ragFunction = httpsCallable(functions, "rag");

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

    // Function to bold '*' or '**' text from bot responses
    const formatBotMessage = (message) => {
        return message
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<strong>$1</strong>");
    };

    // Send user message to the "rag" Cloud Function
    const sendMessage = async () => {
        if (!userInput.trim()) return;
        setIsLoading(true);

        try {
            // Call the rag function with the user's query
            console.log("Calling RAG function with query:", userInput);
            const result = await ragFunction({ query: userInput });
            // The response from your function should be in result.data.response
            const chatbotResponse = result.data.response;

            // Update chat history
            setChatHistory((prevHistory) => [
                ...prevHistory,
                { type: "user", message: userInput },
                { type: "bot", message: formatBotMessage(chatbotResponse) },
            ]);
        } catch (error) {
            console.error("Error calling RAG function:", error);
        } finally {
            setUserInput("");
            setIsLoading(false);
        }
    };

    // Clear chat history
    const clearChat = () => {
        setChatHistory([]);
    };

    return (
        <div>
            <div className="container">
                <h1>Chatbot</h1>
                <div className="chat-box" ref={chatContainerRef}>
                    {chatHistory.length === 0 ? (
                        <p className="placeholder-text">Start a conversation...</p>
                    ) : (
                        chatHistory.map((msg, index) => (
                            <div key={index} className={`message ${msg.type}`}>
                                <strong>{msg.type === "user" ? "You:" : "Bot:"}</strong>{" "}
                                <span dangerouslySetInnerHTML={{ __html: msg.message }} />
                            </div>
                        ))
                    )}
                </div>
                <input
                    type="text"
                    placeholder="Type your message..."
                    value={userInput}
                    onChange={handleUserInput}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading}
                />
                <button onClick={sendMessage} disabled={isLoading}>
                    Send
                </button>
                <button className="clear-btn" onClick={clearChat}>
                    Clear Chat
                </button>
            </div>
        </div>
    );
}

export default Home;
