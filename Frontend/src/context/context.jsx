
import { createContext, useEffect, useState } from "react";

export const Context = createContext();

const STORAGE_KEY = "dextra_chat_history_v1";
const THEME_KEY = "dextra_theme_v1";

// Production: URL comes from Vercel environment variables.
// Development: use the local Express backend.
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

  // Save chat history
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error("Failed to save chat history:", error);
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

  // Generate chat title
  const createTitle = (text) => {
    const clean = text.trim();

    return clean.length > 28
      ? `${clean.slice(0, 28)}...`
      : clean;
  };

  // Create new chat
  const newChat = () => {
    setCurrentChatId(null);
    setInput("");
    setLoading(false);
  };

  // Select existing chat
  const selectChat = (id) => {
    setCurrentChatId(id);
    setInput("");
    setLoading(false);
  };

  // Clear chat history
  const clearHistory = () => {
    setChats([]);
    setCurrentChatId(null);
    setInput("");
    setLoading(false);

    localStorage.removeItem(STORAGE_KEY);
  };

  // Toggle dark/light mode
  const toggleTheme = () => {
    setTheme((prev) =>
      prev === "light" ? "dark" : "light"
    );
  };

  // Send message to Dextra backend
  const onSent = async (prompt = input) => {
    const finalPrompt = prompt.trim();

    if (!finalPrompt || loading) return;

    // Prevent production from attempting localhost requests
    if (!API_URL) {
      console.error("VITE_API_URL is missing.");

      setInput(finalPrompt);
      return;
    }

    setLoading(true);
    setInput("");

    let chatId = currentChatId;

    try {
      // Create new chat if required
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
        // Add user message to existing chat
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

      // Connect to deployed Render backend
      console.log("Dextra API:", `${API_URL}/chat`);

      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPrompt,
        }),
      });

      // Read response safely
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || `Server error: ${response.status}`
        );
      }

      if (!data.text) {
        throw new Error("The backend returned an empty response.");
      }

      // Add Gemini response to chat
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

      // Display error in chat
      if (chatId) {
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
      }
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
