
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Persona, ChatMessage } from '../types';
import { createChatInstance, sendMessageToChatStream } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import { Chat } from '@google/genai';
import { DEFAULT_PERSONA_IMAGE } from '../constants';

const TYPING_SPEED_MS =13; // Milliseconds per character

const IconWrapper: React.FC<{ iconName: string, isSolid?: boolean, className?: string }> = ({ iconName, isSolid, className="" }) => (
  <svg className={`heroicon h-5 w-5 ${className}`} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <use href={`https://unpkg.com/heroicons@2.1.3/24/${isSolid ? 'solid' : 'outline'}/${iconName}.svg#${iconName}`} />
  </svg>
);

interface ChatViewProps {
  persona: Persona;
  onBack: () => void; // For closing chat view or similar action
  initialChatHistory: ChatMessage[];
  onSaveChatHistory: (messages: ChatMessage[]) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ persona, onBack, initialChatHistory, onSaveChatHistory }) => {
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatHistory || []);
  const [userInput, setUserInput] = useState('');
  const [isPersonaTyping, setIsPersonaTyping] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePersonaMessageIdForTyping, setActivePersonaMessageIdForTyping] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);
  const typingIntervalRef = useRef<number | null>(null);
  const fullStreamedTextRef = useRef<string>('');
  const displayedTextLengthRef = useRef<number>(0);

  const personaImageUrl = persona.imageUrl || DEFAULT_PERSONA_IMAGE.replace('defaultpersona', persona.name.toLowerCase().replace(/\s+/g, '') || 'random');
  const userProfileImageUrl = `https://ui-avatars.com/api/?name=User&background=random&color=fff&size=40`;

  useEffect(() => {
    isMounted.current = true;
    return () => { 
      isMounted.current = false; 
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  const initializeChat = useCallback((history: ChatMessage[]) => {
    setIsInitializing(true);
    setError(null);
    setMessages(history); 

    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }
    fullStreamedTextRef.current = '';
    displayedTextLengthRef.current = 0;
    setActivePersonaMessageIdForTyping(null); 

    try {
      const newChat = createChatInstance(persona, history);
      if (isMounted.current) {
        setChatInstance(newChat);
      }
    } catch (e: any) {
      if (isMounted.current) {
        console.error("Error initializing chat:", e); 
        setError(e.message || "Failed to initialize chat. The AI context might be stale if you continue. Try starting a new chat again or check configurations.");
        setChatInstance(null); 
      }
    } finally {
      if (isMounted.current) {
        setIsInitializing(false);
      }
    }
  }, [persona]);


  useEffect(() => {
    initializeChat(initialChatHistory || []);
  }, [persona, initialChatHistory, initializeChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const startTypingAnimation = (personaMsgId: string) => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    typingIntervalRef.current = window.setInterval(() => {
      if (!isMounted.current) {
        clearInterval(typingIntervalRef.current!);
        return;
      }

      if (displayedTextLengthRef.current < fullStreamedTextRef.current.length) {
        displayedTextLengthRef.current++;
        const newDisplayedText = fullStreamedTextRef.current.substring(0, displayedTextLengthRef.current);
        setMessages(prevMsgs => prevMsgs.map(msg => 
          msg.id === personaMsgId ? { ...msg, text: newDisplayedText } : msg
        ));
      } else {
         if (!isPersonaTyping || displayedTextLengthRef.current === fullStreamedTextRef.current.length) {
            clearInterval(typingIntervalRef.current!);
            typingIntervalRef.current = null;
             if (activePersonaMessageIdForTyping === personaMsgId && !isPersonaTyping) {
                 setActivePersonaMessageIdForTyping(null);
             }
        }
      }
    }, TYPING_SPEED_MS);
  };


  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || !chatInstance || isPersonaTyping || isInitializing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString() + '_user',
      sender: 'user',
      text: userInput.trim(),
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    
    const currentInput = userInput.trim();
    setUserInput('');
    setIsPersonaTyping(true);
    setError(null);

    const personaMessageId = Date.now().toString() + '_persona';
    setActivePersonaMessageIdForTyping(personaMessageId);
    fullStreamedTextRef.current = '';
    displayedTextLengthRef.current = 0;

    setMessages(prevMessages => [...prevMessages, { 
        id: personaMessageId, 
        sender: 'persona', 
        text: '', 
        timestamp: new Date().toISOString() 
    }]);

    try {
      const stream = await sendMessageToChatStream(chatInstance, currentInput);
      
      for await (const chunk of stream) {
        if (!isMounted.current) break; 
        fullStreamedTextRef.current += chunk.text;
        if (!typingIntervalRef.current && isMounted.current) {
          startTypingAnimation(personaMessageId);
        }
      }
      
      if (typingIntervalRef.current) {
        await new Promise<void>(resolve => {
          const checkCompletion = () => {
            if (!typingIntervalRef.current || displayedTextLengthRef.current === fullStreamedTextRef.current.length) {
              resolve();
            } else {
              setTimeout(checkCompletion, TYPING_SPEED_MS * 2);
            }
          };
          checkCompletion();
        });
      }
      if (isMounted.current) {
         const finalResponseText = fullStreamedTextRef.current.trim() || "I'm not quite sure how to respond to that.";
         setMessages(prevMsgs => {
            const finalMessages = prevMsgs.map(msg => 
                msg.id === personaMessageId ? { ...msg, text: finalResponseText } : msg
            );
            const finalPersonaMessage: ChatMessage = {
                id: personaMessageId, 
                sender: 'persona', 
                text: finalResponseText, 
                timestamp: new Date().toISOString()
            };
            const historyToSave: ChatMessage[] = [...prevMsgs.filter(m => m.id !== userMessage.id && m.id !== personaMessageId), userMessage, finalPersonaMessage];
            onSaveChatHistory(historyToSave);
            return finalMessages;
        });
      }

    } catch (e: any) {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      if (isMounted.current) {
        let errorText = `Sorry, an error occurred: ${e.message || "Unknown error"}`;
        if (e && e.error && (e.error.code === 429 || e.error.status === 'RESOURCE_EXHAUSTED')) {
            errorText = `API Quota Exceeded. Please check your Google Cloud plan and billing details. Cannot send more messages at this time. (${e.error.message || ''})`;
        }

        setMessages(prevMsgs => {
            const msgIndex = prevMsgs.findIndex(m => m.id === personaMessageId);
            let finalMessagesWithError;
            const errorPersonaMessage: ChatMessage = {
                id: personaMessageId, 
                sender: 'persona', 
                text: errorText, 
                timestamp: new Date().toISOString()
            };

            if (msgIndex !== -1) {
                finalMessagesWithError = prevMsgs.map(msg => 
                    msg.id === personaMessageId ? { ...msg, text: errorText } : msg
                );
            } else { 
                finalMessagesWithError = [...prevMsgs, errorPersonaMessage];
            }
            const historyToSave: ChatMessage[] = [...prevMsgs.filter(m => m.id !== userMessage.id && m.id !== personaMessageId), userMessage, errorPersonaMessage];
            onSaveChatHistory(historyToSave);
            return finalMessagesWithError;
        });
        setError(errorText); 
      }
    } finally {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      if (isMounted.current) {
        setIsPersonaTyping(false);
        setActivePersonaMessageIdForTyping(null);
        if (fullStreamedTextRef.current && displayedTextLengthRef.current < fullStreamedTextRef.current.length) {
             setMessages(prevMsgs => prevMsgs.map(msg => 
                msg.id === personaMessageId ? { ...msg, text: fullStreamedTextRef.current.trim() } : msg
            ));
        }
      }
    }
  }, [userInput, chatInstance, isInitializing, isPersonaTyping, onSaveChatHistory, persona.name, startTypingAnimation]);

  const handleExportChat = useCallback(() => {
    if (messages.length === 0) {
      alert("Chat is empty. Nothing to export.");
      return;
    }

    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

    let content = `Chat with ${persona.name}\n`;
    content += `Exported on: ${today.toLocaleDateString()} ${today.toLocaleTimeString()}\n\n`;

    messages.forEach(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const senderName = msg.sender === 'user' ? 'User' : persona.name;
      content += `[${timestamp}] ${senderName}: ${msg.text}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Chat_with_${persona.name.replace(/\s/g, '_')}_${dateString}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  }, [messages, persona.name]);

  const handleResetChat = useCallback(() => {
    if (messages.length === 0 && !isPersonaTyping && !isInitializing) {
        alert("Chat is already empty.");
        return;
    }

    if (window.confirm(`Are you sure you want to reset the chat with ${persona.name}? All current messages will be cleared.`)) {
      if (isMounted.current) {
        setMessages([]);
        setUserInput('');
        setIsPersonaTyping(false);
        setError(null); 
        setActivePersonaMessageIdForTyping(null); 
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        onSaveChatHistory([]);
      }
    }
  }, [persona.name, onSaveChatHistory, messages.length, isPersonaTyping, isInitializing]);


  return (
    <div className="flex flex-col h-full bg-white shadow-lg">
      {/* Chat Header */}
      <header className="p-4 border-b border-slate-200 flex items-center space-x-3 sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <button onClick={onBack} title="Back to Persona List" className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full sm:hidden">
            <IconWrapper iconName="arrow-left" />
        </button>
        <img src={personaImageUrl} alt={persona.name} className="w-10 h-10 rounded-full object-cover"/>
        <div>
            <h2 className="text-lg font-semibold text-slate-800">{persona.name}</h2>
            <p className="text-xs text-slate-500">{isPersonaTyping ? 'Typing...' : (isInitializing ? 'Initializing...' : (chatInstance ? 'Online' : 'Offline - Error'))}</p>
        </div>
        <div className="flex-grow"></div>
        <button
          onClick={handleResetChat}
          title="Reset Chat"
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={isInitializing || (messages.length === 0 && !isPersonaTyping)}
          aria-label="Reset chat with persona"
          style={{ minWidth: '40px', minHeight: '40px' }} 
        >
          <span className="font-semibold text-lg leading-none select-none">[+]</span>
        </button>
        <button 
          onClick={handleExportChat}
          title="Export Chat"
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={messages.length === 0 || isInitializing || isPersonaTyping}
          aria-label="Export chat log"
          style={{ minWidth: '40px', minHeight: '40px' }} 
        >
          <span className="font-semibold text-lg leading-none select-none">[~]</span>
        </button>
        <img 
            src={userProfileImageUrl} 
            alt="User Profile" 
            className="w-8 h-8 rounded-full object-cover ml-2" 
            title="Current User (Placeholder)"
        />
      </header>

      {error && !isInitializing && <div className="p-3 border-b border-slate-200"><ErrorMessage message={error} onClear={() => setError(null)} /></div>}
      
      {isInitializing && (
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <LoadingSpinner size="md" color="text-blue-500"/>
          <span className="mt-3 text-slate-500">Initializing chat...</span>
        </div>
      )}

      {!isInitializing && (
        <div className="flex-grow p-4 md:p-6 space-y-3 overflow-y-auto custom-scrollbar bg-slate-50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] md:max-w-[65%] px-4 py-2.5 rounded-xl shadow-sm ${
                  msg.sender === 'user' 
                    ? 'bg-blue-500 text-white rounded-br-none' 
                    : 'bg-slate-200 text-slate-800 rounded-bl-none'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.text}
                  {msg.sender === 'persona' && msg.id === activePersonaMessageIdForTyping && isPersonaTyping && (
                    <span className="typing-cursor">_</span>
                  )}
                </p>
                <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-100/90 text-right' : 'text-slate-500 text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
      
      {/* Chat Input Footer */}
      <footer className="p-3 md:p-4 border-t border-slate-200 bg-slate-100 sticky bottom-0">
        <div className="flex items-end space-x-2">
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Message ${persona.name}...`}
            className="flex-grow p-3 bg-white border border-slate-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder-slate-500 custom-scrollbar text-sm"
            rows={Math.min(3, userInput.split('\n').length || 1)}
            style={{maxHeight: '120px'}}
            disabled={!chatInstance || isPersonaTyping || isInitializing}
            aria-label={`Message to ${persona.name}`}
          />
          <button
            onClick={handleSendMessage}
            disabled={!chatInstance || !userInput.trim() || isPersonaTyping || isInitializing}
            className="p-2 text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow hover:shadow-md transition-colors duration-200 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Send message"
            style={{ width: '48px', height: '48px' }}
          >
            <span className="font-semibold text-base whitespace-nowrap select-none">[->]</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatView;
