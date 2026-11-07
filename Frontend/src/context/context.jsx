import { createContext, useEffect, useState } from "react";

export const Context = createContext();

const STORAGE_KEY = "dextra_chat_history_v1";
const THEME_KEY = "dextra_theme_v1";
const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

const loadChats = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const currentChat = chats.find((chat) => chat.id === currentChatId) || null;
  const messages = currentChat?.messages || [];

  const createTitle = (text) => {
    const clean = text.trim();
    return clean.length > 28 ? `${clean.slice(0, 28)}...` : clean;
  };

  const newChat = () => {
    setCurrentChatId(null);
    setInput("");
    setLoading(false);
  };

  const selectChat = (id) => {
    setCurrentChatId(id);
    setInput("");
    setLoading(false);
  };

  const clearHistory = () => {
    setChats([]);
    setCurrentChatId(null);
    setInput("");
    setLoading(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const onSent = async (prompt = input) => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt || loading) return;

    setLoading(true);
    setInput("");

    let chatId = currentChatId;

    try {
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
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [
                    ...chat.messages,
                    { role: "user", content: finalPrompt },
                  ],
                }
              : chat
          )
        );
      }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: finalPrompt }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  { role: "assistant", content: data.text },
                ],
              }
            : chat
        )
      );
    } catch (error) {
      console.error(error);

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
