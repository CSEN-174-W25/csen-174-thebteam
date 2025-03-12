import React, { useState, useRef, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, getDoc, deleteDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import "./home.css";

function parseBold(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function Home() {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);

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
            const loadedMessages = data.messages.map((m) => ({
              type: m.role === "user" ? "user" : "bot",
              message: m.message || "",
            }));
            setChatHistory([defaultMessage, ...loadedMessages]);
          } else {
            setChatHistory([defaultMessage]);
          }
        } else {
          setChatHistory([defaultMessage]);
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
        setChatHistory([defaultMessage]);
      }
    }
    loadChatHistory();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleUserInput = (e) => {
    setUserInput(e.target.value);
  };

  // Auto-resize the textarea based on content with a max height (if desired)
  const handleResize = (e) => {
    const textArea = e.target;
    const MAX_HEIGHT = 200; // optional max height in pixels
    textArea.style.height = "auto";
    if (textArea.scrollHeight > MAX_HEIGHT) {
      textArea.style.height = `${MAX_HEIGHT}px`;
      textArea.style.overflowY = "auto";
    } else {
      textArea.style.height = `${textArea.scrollHeight}px`;
      textArea.style.overflowY = "hidden";
    }
  };

  const handleKeyPress = (event) => {
    // If Enter is pressed without Shift, send the message.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
    // Shift+Enter will allow a newline (auto-resize will occur on input)
  };

  const sendMessage = async () => {
    if (!userInput.trim()) return;
    setChatHistory((prev) => [...prev, { type: "user", message: userInput }]);
    const userMessage = userInput;
    setUserInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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
        { type: "bot", message: "Sorry, I encountered an error processing your request." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setChatHistory([defaultMessage]);
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("User not authenticated.");
      return;
    }
    const db = getFirestore();
    const chatDocRef = doc(db, "chat_histories", currentUser.uid);
    deleteDoc(chatDocRef)
      .then(() => {
        console.log("Chat history deleted from Firestore.");
      })
      .catch((error) => {
        console.error("Error deleting chat history:", error);
      });
  };

  return (
    <div className="discord-chat">
      <div className="chat-header">
        <h1>Advisor</h1>
      </div>

      <div className="chat-messages" ref={chatContainerRef}>
        {chatHistory.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            {msg.type === "bot" && <div className="bot-avatar">🎓</div>}
            {msg.type === "bot" ? (
              <div
                className="message-content"
                dangerouslySetInnerHTML={{ __html: parseBold(msg.message) }}
              ></div>
            ) : (
              <div className="message-content">{msg.message}</div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="bot-avatar">🎓</div>
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
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Type your message..."
            value={userInput}
            onChange={(e) => {
              handleUserInput(e);
              handleResize(e);
            }}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            rows={1}
          />
        </div>
        <div className="chat-input-buttons">
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
    </div>
  );
}

export default Home;