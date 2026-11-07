
import { createContext, useEffect, useState } from "react";

export const Context = createContext();

const STORAGE_KEY = "dextra_chat_history_v1";
const THEME_KEY = "dextra_theme_v1";

// Backend URL configuration
const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "")
).replace(/\/$/, "");

// Load saved chats
const loadChats = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

// Load saved theme
const loadTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const ContextProvider = (props) => {
  const [chats, setChats] = useState(loadChats);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(loadTheme);

  // Save chats
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error("Failed to save chats:", error);
    }
  }, [chats]);

  // Save theme
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
  }, [theme]);

  const currentChat =
    chats.find((chat) => chat.id === currentChatId) || null;

  const messages = currentChat?.messages || [];

  // Create chat title
  const createTitle = (text) => {
    const clean = text.trim();

    return clean.length > 28
      ? `${clean.slice(0, 28)}...`
      : clean;
  };

  // Start new chat
  const newChat = () => {
    setCurrentChatId(null);
    setInput("");
    setLoading(false);
  };

  // Select chat
  const selectChat = (id) => {
    setCurrentChatId(id);
    setInput("");
    setLoading(false);
  };

  // Clear history
  const clearHistory = () => {
    setChats([]);
    setCurrentChatId(null);
    setInput("");
    setLoading(false);

    localStorage.removeItem(STORAGE_KEY);
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme((prev) =>
      prev === "light" ? "dark" : "light"
    );
  };

  // Send message
  const onSent = async (prompt = input) => {
    const finalPrompt = prompt.trim();

    if (!finalPrompt || loading) return;

    if (!API_URL) {
      console.error(
        "VITE_API_URL is missing. Configure it in Vercel."
      );
      return;
    }

    setLoading(true);
    setInput("");

    let chatId = currentChatId;

    try {
      // Create a new chat
      if (!chatId) {
        chatId = Date.now().toString();

        const newChatObj = {
          id: chatId,
          title: createTitle(finalPrompt),
          messages: [
            {
              role: "user",
              content: finalPrompt,
            },
          ],
        };

        setChats((prev) => [newChatObj, ...prev]);
        setCurrentChatId(chatId);
      } else {
        // Add message to existing chat
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [
                    ...chat.messages,
                    {
                      role: "user",
                      content: finalPrompt,
                    },
                  ],
                }
              : chat
          )
        );
      }

      // Send request to Render backend
      const endpoint = `${API_URL}/chat`;

      console.log("Dextra backend endpoint:", endpoint);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPrompt,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || `Backend error: ${response.status}`
        );
      }

      if (!data.text) {
        throw new Error("Backend returned an empty response.");
      }

      // Add assistant response
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    role: "assistant",
                    content: data.text,
                  },
                ],
              }
            : chat
        )
      );

    } catch (error) {
      console.error("Dextra API Error:", error);

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    role: "assistant",
                    content: `Error: ${error.message}`,
                  },
                ],
              }
            : chat
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const contextValue = {
    chats,
    currentChatId,
    currentChat,
    messages,
    input,
    setInput,
    loading,
    onSent,
    newChat,
    selectChat,
    clearHistory,
    theme,
    toggleTheme,
  };

  return (
    <Context.Provider value={contextValue}>
      {props.children}
    </Context.Provider>
  );
};

export default ContextProvider;
