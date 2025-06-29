
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Persona, PlaygroundMessage } from '../types';
import { generatePlaygroundResponse } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import { DEFAULT_PERSONA_IMAGE } from '../constants'; 
import AppLogo from './AppLogo';

const PLAYGROUND_TYPING_SPEED_MS = 8; // Milliseconds per character - Increased speed

interface PlaygroundViewProps {
  personas: Persona[];
}

const IconWrapper: React.FC<{ iconName: string, isSolid?: boolean, className?: string }> = ({ iconName, isSolid, className="" }) => (
  <svg className={`heroicon ${className || 'h-5 w-5'}`} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <use href={`https://unpkg.com/heroicons@2.1.3/24/${isSolid ? 'solid' : 'outline'}/${iconName}.svg#${iconName}`} />
  </svg>
);

const PlaygroundView: React.FC<PlaygroundViewProps> = ({ personas }) => {
  const [persona1Id, setPersona1Id] = useState<string | null>(null);
  const [persona2Id, setPersona2Id] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'chat' | 'topic'>('chat');
  const [topic, setTopic] = useState('');
  const [scenario, setScenario] = useState('');
  const [maxTurnsInput, setMaxTurnsInput] = useState<string>('');
  const [conversation, setConversation] = useState<PlaygroundMessage[]>([]);
  const [isLoadingNextTurn, setIsLoadingNextTurn] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const interactionAbortController = useRef<AbortController | null>(null);
  
  const [activeTypingMessageId, setActiveTypingMessageId] = useState<string | null>(null);
  const typingIntervalRef = useRef<number | null>(null); 
  const currentFullTextForTyping = useRef<string>(''); 
  const displayedTextLengthRef = useRef<number>(0);

  const [currentTurnCount, setCurrentTurnCount] = useState<number>(0);
  const logicalTurnRef = useRef<number>(0); // Ref for logical turn counting
  const [interactionPausedByTurns, setInteractionPausedByTurns] = useState<boolean>(false);


  const persona1 = personas.find(p => p.id === persona1Id);
  const persona2 = personas.find(p => p.id === persona2Id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [conversation, activeTypingMessageId, interactionPausedByTurns]);
  
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      if (interactionAbortController.current) {
        interactionAbortController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (persona1Id && !personas.find(p => p.id === persona1Id)) {
        setPersona1Id(null);
        setConversation([]); 
        setCurrentTurnCount(0);
        logicalTurnRef.current = 0;
        setInteractionPausedByTurns(false);
    }
    if (persona2Id && !personas.find(p => p.id === persona2Id)) {
        setPersona2Id(null);
        setConversation([]); 
        setCurrentTurnCount(0);
        logicalTurnRef.current = 0;
        setInteractionPausedByTurns(false);
    }
  }, [personas, persona1Id, persona2Id]);

  const clearTypingAnimationState = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setActiveTypingMessageId(null);
    currentFullTextForTyping.current = '';
    displayedTextLengthRef.current = 0;
  }, []);

  const handleFullResetInteraction = useCallback(() => {
    setPersona1Id(null);
    setPersona2Id(null);
    setTopic('');
    setScenario('');
    setMaxTurnsInput('');
    setConversation([]);
    setError(null);
    setIsLoadingNextTurn(false);
    clearTypingAnimationState();
    if (interactionAbortController.current) {
        interactionAbortController.current.abort(); 
        interactionAbortController.current = null; 
    }
    setCurrentTurnCount(0);
    logicalTurnRef.current = 0;
    setInteractionPausedByTurns(false);
  }, [clearTypingAnimationState]);

  const startPlaygroundTypingAnimation = useCallback((messageId: string, fullText: string, signal: AbortSignal): Promise<void> => {
    return new Promise((resolve) => {
      currentFullTextForTyping.current = fullText;
      displayedTextLengthRef.current = 0;
      setActiveTypingMessageId(messageId); 

      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      const animationIntervalId = window.setInterval(() => {
        if (signal.aborted) {
          clearInterval(animationIntervalId);
          if (typingIntervalRef.current === animationIntervalId) typingIntervalRef.current = null;
          setConversation(prevMsgs => prevMsgs.map(msg =>
            msg.id === messageId ? { ...msg, text: currentFullTextForTyping.current } : msg
          ));
          resolve(); 
          return;
        }

        if (displayedTextLengthRef.current < currentFullTextForTyping.current.length) {
          displayedTextLengthRef.current++;
          const newDisplayedText = currentFullTextForTyping.current.substring(0, displayedTextLengthRef.current);
          setConversation(prevMsgs => prevMsgs.map(msg =>
            msg.id === messageId ? { ...msg, text: newDisplayedText } : msg
          ));
        } else { 
          clearInterval(animationIntervalId);
          if (typingIntervalRef.current === animationIntervalId) typingIntervalRef.current = null;
          setConversation(prevMsgs => prevMsgs.map(msg =>
            msg.id === messageId ? { ...msg, text: fullText } : msg 
          ));
          if (activeTypingMessageId === messageId) {
             setActiveTypingMessageId(null);
          }
          resolve();
        }
      }, PLAYGROUND_TYPING_SPEED_MS);
      typingIntervalRef.current = animationIntervalId;
    });
  }, [setConversation, activeTypingMessageId]); 

  const processTurns = useCallback(async (signal: AbortSignal) => {
    if (!persona1 || !persona2) return;

    // historyForApi will accumulate actual dialog messages for the LLM
    let historyForApi = conversation.filter(
        msg => (!msg.isSystem && !msg.isError) || (msg.isSystem && msg.text.startsWith("Interaction paused")) 
    ).filter(msg => !(msg.isSystem && msg.text.startsWith("Interaction paused"))); // Start with existing non-system, non-error messages, remove pause message

    try {
        while(true) {
            if (signal.aborted) throw new Error("Interaction aborted");

            const parsedMaxTurns = parseInt(maxTurnsInput, 10);
            const isFiniteTurns = !isNaN(parsedMaxTurns) && parsedMaxTurns > 0;
            const turnsCompletedForThisLogicCycle = logicalTurnRef.current; // Use ref for turn logic

            if (isFiniteTurns && turnsCompletedForThisLogicCycle >= parsedMaxTurns) {
                if (!signal.aborted) {
                    setConversation(prev => [...prev, {
                        id: `paused-${Date.now()}`,
                        speakerPersona: { id: 'system', name: 'System' },
                        text: `Interaction paused after ${parsedMaxTurns} turn${parsedMaxTurns !== 1 ? 's' : ''}. Adjust Max Turns or Continue below.`,
                        timestamp: new Date().toISOString(),
                        isSystem: true,
                    }]);
                    setInteractionPausedByTurns(true);
                }
                break;
            }

            const speakingPersona = turnsCompletedForThisLogicCycle % 2 === 0 ? persona1 : persona2;
            const listeningPersona = turnsCompletedForThisLogicCycle % 2 === 0 ? persona2 : persona1;
            
            const thinkingMsgId = `thinking-${Date.now()}`;
            if (!signal.aborted) {
                setConversation(prev => [...prev, {
                    id: thinkingMsgId,
                    speakerPersona: { id: speakingPersona.id, name: speakingPersona.name, imageUrl: speakingPersona.imageUrl || DEFAULT_PERSONA_IMAGE.replace('defaultpersona', speakingPersona.name) },
                    text: `${speakingPersona.name} is thinking...`,
                    timestamp: new Date().toISOString(),
                    isSystem: true,
                }]);
            }
            
            if (signal.aborted) throw new Error("Interaction aborted before API call");
            setIsLoadingNextTurn(true); 
            const result = await generatePlaygroundResponse(
                speakingPersona, 
                listeningPersona, 
                historyForApi, // Pass current actual dialog history 
                interactionMode === 'topic' ? topic : undefined,
                scenario.trim() || undefined
            );
            
            if (signal.aborted) throw new Error("Interaction aborted after API call");

            setConversation(prev => prev.filter(m => m.id !== thinkingMsgId)); 

            const newMsgId = `${Date.now()}-${speakingPersona.id}`;
            const newMsgShell: PlaygroundMessage = {
              id: newMsgId,
              speakerPersona: { id: speakingPersona.id, name: speakingPersona.name, imageUrl: speakingPersona.imageUrl || DEFAULT_PERSONA_IMAGE.replace('defaultpersona', speakingPersona.name) },
              text: '', 
              timestamp: new Date().toISOString(),
              isError: result.text.startsWith("(Error"),
            };
            
            if (!signal.aborted) {
                setConversation(prev => [...prev, newMsgShell]);
                await startPlaygroundTypingAnimation(newMsgId, result.text, signal);
            }
            
            if (signal.aborted) throw new Error("Interaction aborted during/after typing");
            
            historyForApi.push({ ...newMsgShell, text: result.text }); // Add successful message to API history

            if (result.text.startsWith("(Error")) {
                setError(`An error occurred with ${speakingPersona.name}'s response. Interaction stopped. Details: ${result.text}`);
                if (!signal.aborted) setInteractionPausedByTurns(false); 
                break; 
            }
            if (!signal.aborted) {
                logicalTurnRef.current += 1; // Increment logical turn counter
                setCurrentTurnCount(logicalTurnRef.current); // Sync state for UI
            }
        }
    } catch (e: any) {
      if (e.name !== 'AbortError' && !(e instanceof DOMException && e.name === 'AbortError')) { 
        setError(e.message || "An unexpected error occurred during interaction.");
        setConversation(prev => [...prev.filter(m => !m.text.endsWith("is thinking...")), { 
            id: `error-${Date.now()}`,
            speakerPersona: { id: 'system', name: 'System Error' },
            text: `Interaction failed: ${e.message}`,
            timestamp: new Date().toISOString(),
            isError: true,
            isSystem: true,
        }]);
        setInteractionPausedByTurns(false); 
      }
    } finally {
      setIsLoadingNextTurn(false);
    }
  }, [persona1, persona2, interactionMode, topic, scenario, maxTurnsInput, startPlaygroundTypingAnimation, conversation]);


  const handleStartInteraction = useCallback(async () => {
    if (!persona1 || !persona2) {
      setError("Please select two different personas.");
      return;
    }
    if (persona1.id === persona2.id) {
      setError("Personas must be different.");
      return;
    }
    if (interactionMode === 'topic' && !topic.trim()) {
      setError("Please enter a topic for discussion.");
      return;
    }

    setError(null);
    setConversation([]); 
    logicalTurnRef.current = 0; // Reset logical turn counter
    setCurrentTurnCount(0); // Reset state turn counter
    setInteractionPausedByTurns(false);
    clearTypingAnimationState(); 
    
    if (interactionAbortController.current) {
        interactionAbortController.current.abort(); 
    }
    interactionAbortController.current = new AbortController();
    
    await processTurns(interactionAbortController.current.signal);

  }, [persona1, persona2, interactionMode, topic, scenario, clearTypingAnimationState, processTurns]);

  const handleContinueInteraction = useCallback(async () => {
    if (!persona1 || !persona2 || !interactionPausedByTurns) return;

    setError(null);
    setInteractionPausedByTurns(false);
    // Remove the "Interaction paused" system message before continuing
    setConversation(prev => prev.filter(msg => !(msg.isSystem && msg.text.startsWith("Interaction paused"))));
    
    // Ensure logicalTurnRef is synced with currentTurnCount state when continuing
    logicalTurnRef.current = currentTurnCount; 
    
    clearTypingAnimationState();

    if (interactionAbortController.current) {
        interactionAbortController.current.abort();
    }
    interactionAbortController.current = new AbortController();

    await processTurns(interactionAbortController.current.signal);

  }, [persona1, persona2, interactionPausedByTurns, clearTypingAnimationState, processTurns, currentTurnCount]);


  const handleExportPlaygroundChat = useCallback(() => {
    if (!persona1 || !persona2) {
      alert("Personas are not fully selected or available for export. Please ensure both Persona 1 and Persona 2 are chosen.");
      return;
    }
    if (conversation.length === 0) {
      alert("No conversation to export.");
      return;
    }

    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; 

    let content = `Persona Playground Chat\n`;
    content += `Participants: ${persona1.name} and ${persona2.name}\n`;
    if (topic && interactionMode === 'topic') content += `Topic: ${topic}\n`;
    if (scenario) content += `Scenario: ${scenario}\n`;
    content += `Exported on: ${today.toLocaleDateString()} ${today.toLocaleTimeString()}\n\n`;

    conversation.forEach(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const speakerName = msg.speakerPersona.name;
      let messagePrefix = `[${timestamp}] ${speakerName}: `;
      if (msg.isSystem) {
        messagePrefix = `[${timestamp}] --- System Message (${speakerName}) --- : `;
      }
      content += `${messagePrefix}${msg.text}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const p1NameSanitized = persona1.name.replace(/\s/g, '_');
    const p2NameSanitized = persona2.name.replace(/\s/g, '_');
    link.download = `Playground_Chat_${p1NameSanitized}_vs_${p2NameSanitized}_${dateString}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  }, [conversation, persona1, persona2, topic, scenario, interactionMode]);


  if (personas.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
        <IconWrapper iconName="users" className="w-16 h-16 text-slate-400 mb-6" />
        <h2 className="text-2xl font-semibold text-slate-700 mb-2">Persona Playground Needs More Actors!</h2>
        <p className="text-slate-500 max-w-md">
          The Playground feature allows two personas to interact. You currently have {personas.length} persona(s).
          Please create at least two personas to use this feature.
        </p>
      </div>
    );
  }

  const renderPersonaSelector = (
    personaNum: 1 | 2,
    selectedId: string | null,
    onChange: (id: string | null) => void,
    otherSelectedId: string | null
  ) => {
    const currentPersona = personas.find(p => p.id === selectedId);
    return (
      <div className="p-4 bg-white rounded-lg shadow border border-slate-200 flex-1 min-w-[280px]">
        <h3 className="text-lg font-semibold text-slate-700 mb-3">Select Persona {personaNum}</h3>
        <select
          value={selectedId || ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full p-2.5 bg-white border border-slate-300 text-slate-800 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm mb-3 disabled:bg-slate-100 disabled:text-slate-500"
          disabled={isLoadingNextTurn || !!activeTypingMessageId || interactionPausedByTurns}
        >
          <option value="">-- Choose Persona {personaNum} --</option>
          {personas.map(p => (
            <option key={p.id} value={p.id} disabled={p.id === otherSelectedId}>
              {p.name}
            </option>
          ))}
        </select>
        {currentPersona && (
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-md">
            <img 
                src={currentPersona.imageUrl || DEFAULT_PERSONA_IMAGE.replace('defaultpersona', currentPersona.name)} 
                alt={currentPersona.name} 
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow" 
            />
            <div>
              <p className="font-medium text-slate-800">{currentPersona.name}</p>
              <p className="text-xs text-slate-500 truncate" title={currentPersona.characterDescription}>
                {(currentPersona.characterDescription || "No character summary.").substring(0,50)}...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const isInteractionEffectivelyRunning = isLoadingNextTurn || !!activeTypingMessageId;
  const isCurrentlyFetchingFromApiOnly = isLoadingNextTurn && !activeTypingMessageId; 

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-semibold text-slate-800 flex items-center">
            <IconWrapper iconName="puzzle-piece" isSolid className="mr-2 h-6 w-6 text-blue-500" />
            Persona Playground
        </h1>
      </header>

      <div className="p-4 md:p-6 space-y-6 bg-slate-100 border-b border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {renderPersonaSelector(1, persona1Id, setPersona1Id, persona2Id)}
          {renderPersonaSelector(2, persona2Id, setPersona2Id, persona1Id)}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Interaction Mode:</label>
                <div className="flex space-x-4">
                    {(['chat', 'topic'] as const).map(mode => (
                    <label key={mode} className="flex items-center space-x-2 cursor-pointer">
                        <input
                        type="radio"
                        name="interactionMode"
                        value={mode}
                        checked={interactionMode === mode}
                        onChange={() => setInteractionMode(mode)}
                        className="form-radio h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        disabled={isInteractionEffectivelyRunning || interactionPausedByTurns}
                        />
                        <span className="text-sm text-slate-700">{mode === 'chat' ? 'Open Chat' : 'Discuss Topic'}</span>
                    </label>
                    ))}
                </div>
            </div>
            <div>
                <label htmlFor="maxTurns" className="block text-sm font-medium text-slate-700 mb-1.5">Max Turns (optional):</label>
                <input
                type="number"
                id="maxTurns"
                value={maxTurnsInput}
                onChange={(e) => setMaxTurnsInput(e.target.value)}
                placeholder="e.g., 5, 10 (blank for continuous)"
                min="0"
                className="w-full p-2.5 bg-white border border-slate-300 text-slate-800 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                disabled={isInteractionEffectivelyRunning && !interactionPausedByTurns} 
                />
            </div>
        </div>

        {interactionMode === 'topic' && (
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-slate-700 mb-1.5">Discussion Topic:</label>
            <input
              type="text"
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="E.g., The meaning of life, Favorite travel destinations"
              className="w-full p-2.5 bg-white border border-slate-300 text-slate-800 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
              disabled={isInteractionEffectivelyRunning || interactionPausedByTurns}
            />
          </div>
        )}
        
        <div>
            <label htmlFor="scenario" className="block text-sm font-medium text-slate-700 mb-1.5">Set the Scene (Optional):</label>
            <textarea
              id="scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="E.g., Two detectives at a crime scene, Stranded on a desert island..."
              rows={2}
              className="w-full p-2.5 bg-white border border-slate-300 text-slate-800 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder-slate-400 custom-scrollbar disabled:bg-slate-100 disabled:text-slate-400"
              disabled={isInteractionEffectivelyRunning || interactionPausedByTurns}
            />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <button
            onClick={handleStartInteraction}
            disabled={isInteractionEffectivelyRunning || interactionPausedByTurns || !persona1Id || !persona2Id || (interactionMode === 'topic' && !topic.trim())}
            className="px-6 py-3 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50"
          >
            {isCurrentlyFetchingFromApiOnly ? <LoadingSpinner size="sm" color="text-blue-600"/> : <><IconWrapper iconName="play" isSolid className="mr-2"/> Start Interaction</>}
          </button>
          
          <button
            onClick={() => {
              if (isInteractionEffectivelyRunning) { 
                if (interactionAbortController.current) {
                  interactionAbortController.current.abort(); 
                }
                setInteractionPausedByTurns(false); // Ensure interaction can be reset if stopped mid-way
                setIsLoadingNextTurn(false); // Clear loading state
                clearTypingAnimationState(); // Clear typing animation
              } else { 
                handleFullResetInteraction(); 
              }
            }}
            className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
           {isInteractionEffectivelyRunning ? 
            <><IconWrapper iconName="stop-circle" isSolid className="mr-2 text-red-600"/> Stop Interaction</> : 
            <><IconWrapper iconName="arrow-path" className="mr-2"/> Reset All</>}
          </button>
          <button
            onClick={handleExportPlaygroundChat}
            disabled={isInteractionEffectivelyRunning || conversation.length === 0 || !persona1Id || !persona2Id}
            className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-400"
            title="Export Playground Chat"
            aria-label="Export playground chat log"
          >
            <span className="font-semibold text-lg leading-none mr-2">[~]</span> Export Chat
          </button>
        </div>
        {error && <ErrorMessage message={error} onClear={() => setError(null)} />}
      </div>
      
      <div className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto custom-scrollbar bg-slate-50">
        {conversation.length === 0 && !isInteractionEffectivelyRunning && !interactionPausedByTurns && (
          <div className="text-center text-slate-500 pt-10">
            <AppLogo className="w-16 h-16 text-blue-400/70 mx-auto mb-4" />
            <p>Select two personas and start an interaction to see their conversation here.</p>
          </div>
        )}
        {conversation.map((msg) => {
          const isP1 = msg.speakerPersona.id === persona1Id;
          const speakerImage = msg.speakerPersona.imageUrl || DEFAULT_PERSONA_IMAGE.replace('defaultpersona', msg.speakerPersona.name);

          if (msg.isSystem) {
             return (
                <div key={msg.id} className={`flex items-center ${msg.isError ? 'justify-center' : (msg.speakerPersona.id === 'system' || isP1 ? 'justify-start' : 'justify-end')} my-2 opacity-90`}>
                    {msg.isError && <IconWrapper iconName="exclamation-triangle" className="text-red-500 mr-2" isSolid/>}
                    {(isP1 || msg.speakerPersona.id === 'system') && !msg.isError && msg.speakerPersona.id !== 'system' && <img src={speakerImage} alt={msg.speakerPersona.name} className="w-8 h-8 rounded-full mr-2 self-start object-cover shadow-sm" />}
                     {(isP1 || msg.speakerPersona.id === 'system') && !msg.isError && msg.speakerPersona.id === 'system' && <IconWrapper iconName="information-circle" className="text-slate-500 mr-2 h-7 w-7"/>}
                    <div className={`px-3 py-2 rounded-lg text-sm italic ${msg.isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-500'}`}>
                        {msg.text}
                    </div>
                    {(!isP1 && msg.speakerPersona.id !== 'system') && !msg.isError && <img src={speakerImage} alt={msg.speakerPersona.name} className="w-8 h-8 rounded-full ml-2 self-start object-cover shadow-sm" />}
                </div>
             );
          }

          return (
            <div key={msg.id} className={`flex ${isP1 ? 'justify-start' : 'justify-end'}`}>
              {isP1 && <img src={speakerImage} alt={msg.speakerPersona.name} className="w-10 h-10 rounded-full mr-3 self-end object-cover shadow" />}
              <div
                className={`max-w-[75%] md:max-w-[65%] px-4 py-2.5 rounded-xl shadow-md ${
                  isP1 
                    ? 'bg-sky-50 text-sky-800 rounded-bl-none' 
                    : 'bg-violet-50 text-violet-800 rounded-br-none'
                }`}
              >
                <p className="font-semibold text-xs mb-0.5 opacity-80">{msg.speakerPersona.name}</p>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.text}
                  {msg.id === activeTypingMessageId && <span className="typing-cursor">_</span>}
                </p>
                <p className={`text-xs mt-1.5 opacity-70 ${isP1 ? 'text-sky-600 text-left' : 'text-violet-600 text-right'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!isP1 && <img src={speakerImage} alt={msg.speakerPersona.name} className="w-10 h-10 rounded-full ml-3 self-end object-cover shadow" />}
            </div>
          );
        })}

        {interactionPausedByTurns && !isInteractionEffectivelyRunning && (
            <div className="flex justify-center py-4">
            <button
                onClick={handleContinueInteraction}
                disabled={!persona1Id || !persona2Id || (interactionMode === 'topic' && !topic.trim())}
                className="px-6 py-3 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-opacity-50"
            >
                <IconWrapper iconName="play-pause" isSolid className="mr-2"/> 
                Continue ({currentTurnCount} done. Target: {maxTurnsInput || 'Continuous'})
            </button>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default PlaygroundView;
