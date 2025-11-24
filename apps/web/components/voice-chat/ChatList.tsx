"use client";

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatListProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  isLoading?: boolean;
}

export function ChatList({ chats, currentChatId, onSelectChat, isLoading = false }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <div className="absolute left-4 top-16 z-30 w-64 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 max-h-96 overflow-y-auto">
        <div className="text-sm text-gray-400 px-3 py-2">No chats yet</div>
      </div>
    );
  }

  return (
    <div
      className="absolute left-4 top-16 z-30 w-64 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 max-h-96 overflow-y-auto"
      role="listbox"
      aria-label="Chat list"
    >
      <div className="space-y-1" role="list">
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full text-left px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
              currentChatId === chat.id ? "bg-gray-800 border border-gray-600" : ""
            }`}
            role="option"
            aria-selected={currentChatId === chat.id}
            aria-label={`Chat: ${chat.title}, ${chat.messageCount} messages`}
            disabled={isLoading}
          >
            <div className="text-sm font-medium text-gray-200 truncate">{chat.title}</div>
            <div className="text-xs text-gray-400">
              {chat.messageCount} message{chat.messageCount !== 1 ? "s" : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

