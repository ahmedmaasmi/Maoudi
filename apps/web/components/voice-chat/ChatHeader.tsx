"use client";

import { MessageSquare, Plus, Radio, Mic } from "lucide-react";

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatHeaderProps {
  onToggleChatList: () => void;
  onCreateNewChat: () => void;
  useLiveVoiceAgent: boolean;
  voiceAgentConnected: boolean;
  onToggleLiveAgent: () => void;
  isLoading?: boolean;
}

export function ChatHeader({
  onToggleChatList,
  onCreateNewChat,
  useLiveVoiceAgent,
  voiceAgentConnected,
  onToggleLiveAgent,
  isLoading = false,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleChatList}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 transition-colors"
          aria-label="Toggle chat list"
          disabled={isLoading}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm">Chats</span>
        </button>
        <button
          onClick={onCreateNewChat}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 transition-colors"
          aria-label="Create new chat"
          disabled={isLoading}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">New Chat</span>
        </button>
        <button
          onClick={onToggleLiveAgent}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            useLiveVoiceAgent
              ? voiceAgentConnected
                ? "bg-green-600/50 hover:bg-green-700/50 text-white"
                : "bg-yellow-600/50 hover:bg-yellow-700/50 text-white"
              : "bg-gray-800/50 hover:bg-gray-700/50 text-gray-300"
          }`}
          title={
            useLiveVoiceAgent
              ? voiceAgentConnected
                ? "Live Voice Agent (MCP) - Connected"
                : "Live Voice Agent (MCP) - Connecting..."
              : "Using Browser Speech API"
          }
          aria-label={
            useLiveVoiceAgent
              ? voiceAgentConnected
                ? "Live Voice Agent connected"
                : "Live Voice Agent connecting"
              : "Browser Speech API mode"
          }
          disabled={isLoading}
        >
          {useLiveVoiceAgent ? (
            <>
              <Radio className="w-4 h-4" />
              <span className="text-sm">
                Live Agent {voiceAgentConnected ? "✓" : "..."}
              </span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span className="text-sm">Browser STT</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

