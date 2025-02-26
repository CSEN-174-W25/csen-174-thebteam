import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import Home from "../googleSignin/home";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Mocking the GoogleGenerativeAI module
jest.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: "Hello! How can I help you today?",
          },
        }),
      }),
    })),
  };
});

describe("Chatbot functionality in Home component", () => {
  it("should send user input and display chatbot response", async () => {
    const { getByPlaceholderText, getByText, findByText } = render(<Home />);

    const inputField = getByPlaceholderText("Type your message here...");
    const sendButton = getByText("Send");

    fireEvent.change(inputField, { target: { value: "Hello" } });
    fireEvent.click(sendButton);

    await waitFor(() => expect(findByText("Hello! How can I help you today?"))); // Checking chatbot response
  });
});