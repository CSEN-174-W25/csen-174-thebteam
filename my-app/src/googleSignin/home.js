import React, { useState, useRef, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import "./home.css";

function Home() {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);

  const functions = getFunctions();
  const ragFunction = httpsCallable(functions, "rag");

  // Default welcome message (type = "bot" so it appears on the left)
  const defaultMessage = {
    type: "bot",
    message:
      "Hello! How can I help you with information about these courses? For example, are you interested in: * Finding out if a specific course has prerequisites? * Comparing courses from different departments? * Knowing which courses belong to a certain department? Just let me know what you'd like to know!",
  };

  useEffect(() => {
    async function loadChatHistory() {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error("User not authenticated.");
        // Just show the default message if not authenticated
        setChatHistory([defaultMessage]);
        return;
      }

      const db = getFirestore();
      const chatDocRef = doc(db, "chat_histories", currentUser.uid);

      try {
        const docSnap = await getDoc(chatDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.messages && Array.isArray(data.messages)) {
            // Convert Firestore role to "bot"/"user" for the UI
            const loadedMessages = data.messages.map((m) => ({
              type: m.role === "user" ? "user" : "bot",
              message: m.message || "",
            }));
            // Put the default message first, then Firestore messages
            setChatHistory([defaultMessage, ...loadedMessages]);
          } else {
            // If no messages field, just show the default
            setChatHistory([defaultMessage]);
          }
        } else {
          // If no document, just show the default
          setChatHistory([defaultMessage]);
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
        setChatHistory([defaultMessage]);
      }
    }

    loadChatHistory();
  }, []);

  // Scroll to bottom when chatHistory changes
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

  // Send user message
  const sendMessage = async () => {
    if (!userInput.trim()) return;

    setChatHistory((prev) => [...prev, { type: "user", message: userInput }]);

    const userMessage = userInput;
    setUserInput("");
    setIsLoading(true);

    try {
      const result = await ragFunction({ query: userMessage });
      const chatbotResponse = result.data.response;

      setChatHistory((prev) => [
        ...prev,
        { type: "bot", message: chatbotResponse },
      ]);
    } catch (error) {
      console.error("Error calling RAG function:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          type: "bot",
          message: "Sorry, I encountered an error processing your request.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear chat (locally)
  const clearChat = () => {
    setChatHistory([defaultMessage]);
  };

  return (
    <div className="discord-chat">
      <div className="chat-header">
        <h1>Advisor</h1>
      </div>

      <div className="chat-messages" ref={chatContainerRef}>
        {chatHistory.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            {msg.type === "bot" && <div className="bot-avatar">🤖</div>}
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