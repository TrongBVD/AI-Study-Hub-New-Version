import { useState } from "react";
import "./AIChatPage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function AIChatPage() {
  const [message, setMessage] = useState("");
  const [selectedChatId, setSelectedChatId] = useState("new-chat");

const [chatHistory, setChatHistory] = useState(() => []);

  const suggestions = [
    "Summarize this document",
    "Explain this concept",
    "Create study questions",
    "Find key points",
  ];

  const selectedChat = chatHistory.find((chat) => chat.id === selectedChatId);
  const isDefaultChat = selectedChatId === "new-chat";

  function handleNewChat() {
    setSelectedChatId("new-chat");
    setMessage("");
  }

  function handleSelectChat(chatId) {
    setSelectedChatId(chatId);
    setMessage("");
  }
function createChatTitle(text) {
  const trimmedText = text.trim();

  if (trimmedText.length <= 32) {
    return trimmedText;
  }

  return `${trimmedText.slice(0, 32)}...`;
}

function createAssistantReply(text) {
  return `I received your question: "${text}". I can help you summarize, explain, or turn it into study notes.`;
}

function handleSendMessage() {
  const trimmedMessage = message.trim();

  if (trimmedMessage === "") return;

  const currentTime = "Just now";

  if (isDefaultChat) {
    const newChatId = `chat-${Date.now()}`;

    const newChat = {
      id: newChatId,
      title: createChatTitle(trimmedMessage),
      time: currentTime,
      messages: [
        {
          id: `${newChatId}-user-1`,
          sender: "user",
          text: trimmedMessage,
        },
        {
          id: `${newChatId}-assistant-1`,
          sender: "assistant",
          text: createAssistantReply(trimmedMessage),
        },
      ],
    };

    setChatHistory((currentChats) => [newChat, ...currentChats]);
    setSelectedChatId(newChatId);
    setMessage("");
    return;
  }

  const userMessage = {
    id: `msg-user-${Date.now()}`,
    sender: "user",
    text: trimmedMessage,
  };

  const assistantMessage = {
    id: `msg-assistant-${Date.now()}`,
    sender: "assistant",
    text: createAssistantReply(trimmedMessage),
  };

  setChatHistory((currentChats) =>
    currentChats.map((chat) =>
      chat.id === selectedChatId
        ? {
            ...chat,
            time: currentTime,
            messages: [...chat.messages, userMessage, assistantMessage],
          }
        : chat
    )
  );

  setMessage("");
}

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  return (
    <main className="ai_chat_page">
      <aside className="ai_chat_sidebar">
        <div className="ai_chat_brand">
          <div className="ai_chat_logo">
            <i className="ti-book"></i>
          </div>

          <div>
            <h2>AI Study Hub</h2>
            <p>Academic Assistant</p>
          </div>
        </div>

        <button className="ai_chat_new_btn" type="button" onClick={handleNewChat}>
          <i className="ti-plus"></i>
          New Chat
        </button>

        <section className="ai_chat_history">
          <p>Recent Chats</p>

          {chatHistory.map((chat) => (
            <button
              type="button"
              className={`ai_chat_history_item ${
                selectedChatId === chat.id ? "active" : ""
              }`}
              key={chat.id}
              onClick={() => handleSelectChat(chat.id)}
            >
              <i className="ti-comment-alt"></i>

              <span>
                <strong>{chat.title}</strong>
              </span>
            </button>
          ))}
        </section>

        <div className="ai_chat_sidebar_bottom">
          <button type="button">
            <i className="ti-settings"></i>
            Settings
          </button>

          <button type="button">
            <i className="ti-help-alt"></i>
            Help
          </button>
        </div>
      </aside>

      <section className="ai_chat_main">
        <section className="ai_chat_content">
          <div className="ai_chat_intro">
            <span>AI Research Assistant</span>
            <h1>
              {isDefaultChat
                ? "How can I help you study today?"
                : selectedChat?.title}
            </h1>
            <p>
              {isDefaultChat
                ? "Ask questions, summarize documents, create flashcards, or get help understanding difficult academic concepts."
                : "Continue this conversation or ask follow-up questions based on your previous study session."}
            </p>
          </div>

          <section className="ai_chat_workspace">
            <div className="ai_chat_conversation">
              {isDefaultChat ? (
                <section className="ai_chat_default_state">
                  <div className="ai_chat_default_icon">
                    <i className="ti-wand"></i>
                  </div>

                  <h2>Start a new AI study chat</h2>
                  <p>
                    Choose a quick prompt or type your own question below. You can
                    ask the AI to summarize notes, explain concepts, generate
                    flashcards, or prepare exam questions.
                  </p>

                  <div className="ai_chat_default_prompts">
                    {suggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        onClick={() => setMessage(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                selectedChat?.messages.map((chatMessage) => (
                  <article
                    className={`ai_message ${chatMessage.sender}`}
                    key={chatMessage.id}
                  >
                    {chatMessage.sender === "assistant" && (
                      <div className="ai_message_avatar">
                        <i className="ti-wand"></i>
                      </div>
                    )}

                    <div className="ai_message_bubble">
                      {chatMessage.sender === "assistant" && <h3>AI Assistant</h3>}
                      <p>{chatMessage.text}</p>
                    </div>
                  </article>
                ))
              )}
            </div>

            <aside className="ai_chat_panel">
              <div className="ai_chat_panel_card">
                <div className="ai_chat_panel_title">
                  <i className="ti-light-bulb"></i>
                  <h3>Quick Prompts</h3>
                </div>

                <div className="ai_chat_suggestion_list">
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ai_chat_panel_note">
                <h3>Study Tip</h3>
                <p>
                  For better answers, include the subject, file context, and what
                  kind of output you want.
                </p>
              </div>
            </aside>
          </section>

          <section className="ai_chat_composer">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI anything about your study materials..."
            />

            <div className="ai_chat_composer_actions">
              <div>
                <button type="button" title="Attach file">
                  <i className="ti-clip"></i>
                </button>

                <button type="button" title="Use prompt">
                  <i className="ti-layout-list-thumb"></i>
                </button>
              </div>

              <button
                type="button"
                className="ai_chat_send_btn"
                onClick={handleSendMessage}
              >
                <i className="ti-location-arrow"></i>
                Send
              </button>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

export default AIChatPage;
