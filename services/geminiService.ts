
import { GoogleGenAI, Chat, GenerateContentResponse, GroundingChunk, Content, GenerateContentParameters } from "@google/genai";
import { Persona, ChatMessage, PlaygroundMessage, Memory } from '../types';
import { GEMINI_CHAT_MODEL, GEMINI_TEXT_MODEL } from '../constants';

if (!process.env.API_KEY) {
  console.error("API_KEY environment variable not set. Please set it before running the application.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "MISSING_API_KEY" });

const formatMemoriesForPrompt = (memories?: Memory[]): string => {
  if (!memories || memories.length === 0) {
    return "No specific significant memories provided.";
  }
  return "\nKey Memories that significantly shaped you:\n" + memories.map(mem => 
    `- Title: ${mem.title} (Occurred: ${mem.date || 'N/A'}, Impact: ${mem.impact}, Sentiment: ${mem.sentiment}). Description: ${mem.description}`
  ).join("\n");
};

const generatePersonaSystemPrompt = (persona: Persona): string => {
  return `You are ${persona.name}. Embody this persona fully.
  Your biography: ${persona.biography}
  Your key character traits and personality: ${persona.characterDescription}
  Excerpts from your writings (diaries, letters, etc.): ${persona.writings || "No specific writings provided, rely on bio and character."}
  A sample of how you speak or your thoughts (from voice recordings, etc.): ${persona.voiceSampleTranscript || "No specific voice sample, rely on bio and character."}
  ${formatMemoriesForPrompt(persona.memories)}
  ---
  Respond naturally as this persona, as if you are speaking directly in a conversation. Do not break character. Do not mention you are an AI.
  Your responses should typically be concise, like spoken dialogue – often a few sentences at most. While you can elaborate if it's truly in character and the moment calls for it, actively avoid long, unbroken paragraphs or essay-like responses. The goal is genuine, human-like interaction, not robotic brevity or lengthy monologues.
  If asked about your origin or how you were created, you can be vague or interpret it through your persona's lens, but do not reveal you are an AI construct.
  If the user asks for information that would be outside your persona's knowledge (e.g., real-time stock prices, future events beyond your persona's timeline), politely state that it's beyond your scope or knowledge in a way that fits your character.
  `;
};

export const testPersonaResponse = async (
  persona: Persona,
  userPrompt: string
): Promise<{text: string; groundingChunks?: GroundingChunk[]}> => {
  const fullPrompt = `
CONTEXT: You are role-playing as a specific persona. Do not break character.
--- START PERSONA DEFINITION ---
Name: ${persona.name}
Biography: ${persona.biography}
Character Description: ${persona.characterDescription}
Writings/Source Material Excerpts: ${persona.writings}
Voice/Thought Patterns Sample: ${persona.voiceSampleTranscript}
${formatMemoriesForPrompt(persona.memories)}
--- END PERSONA DEFINITION ---

Based ONLY on the persona defined above, provide a concise and in-character response to the following user query. Aim for a natural, conversational style, as if you were speaking directly to the user. Your responses should be brief, like spoken dialogue (typically a few sentences), and avoid long, unbroken paragraphs or essay-like answers unless truly essential for your persona. Do not offer to do things outside the persona's capabilities (e.g., browsing the internet unless it's explicitly part of the persona).

User Query: "${userPrompt}"

Persona (${persona.name}) Response:`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: fullPrompt,
      config: {
        temperature: 0.7, 
        topP: 0.9,
        topK: 40,
      }
    });
    return { text: response.text, groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks };
  } catch (error: any) {
    console.error("Error generating test response:", error);
    let errorMessage = "An unknown error occurred while generating the response.";
    if (error && error.error && (error.error.code === 429 || error.error.status === 'RESOURCE_EXHAUSTED')) {
        errorMessage = `API Quota Exceeded. Please check your Google Cloud plan and billing details. Cannot get test response at this time. (${error.error.message || ''})`;
    } else if (error instanceof Error) {
        if (error.message.includes("not found") || error.message.includes("Invalid model name")) {
            errorMessage = `Error: The AI model (${GEMINI_TEXT_MODEL}) configured for testing could not be accessed. It might be unavailable or incorrectly named.`;
        } else {
             errorMessage = `Error: ${error.message}`;
        }
    }
    return { text: errorMessage };
  }
};

const convertChatMessagesToGeminiHistory = (messages: ChatMessage[]): Content[] => {
  return messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model', 
    parts: [{ text: msg.text }],
  }));
};

export const createChatInstance = (persona: Persona, initialHistory?: ChatMessage[]): Chat => {
  const systemInstruction = generatePersonaSystemPrompt(persona);
  const geminiHistory = initialHistory ? convertChatMessagesToGeminiHistory(initialHistory) : [];
  
  return ai.chats.create({
    model: GEMINI_CHAT_MODEL,
    history: geminiHistory,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.85,
      topP: 0.9,
      topK: 50,
    },
  });
};

export const sendMessageToChatStream = async (
  chat: Chat,
  message: string
): Promise<AsyncGenerator<GenerateContentResponse>> => {
  try {
    return await chat.sendMessageStream({ message });
  } catch (error) {
    console.error("Error sending message to chat (stream):", error);
    throw error; 
  }
};

export const generatePlaygroundResponse = async (
  speakingPersona: Persona,
  listeningPersona: Persona,
  conversationHistory: PlaygroundMessage[],
  topic?: string,
  scenario?: string // Added scenario parameter
): Promise<{ text: string }> => {
  let historyLines: string[] = [];
  const recentHistory = conversationHistory.slice(-4);
  for (const msg of recentHistory) {
      historyLines.push(`${msg.speakerPersona.name}: ${msg.text}`);
  }
  const historyStr = historyLines.join('\n');

  const basePrompt = `You are ${speakingPersona.name}. Embody this persona fully.
Your Biography: ${speakingPersona.biography}
Your Character Description: ${speakingPersona.characterDescription}
Relevant Writings/Excerpts: ${speakingPersona.writings || "Not specified."}
Your Voice/Thought Patterns: ${speakingPersona.voiceSampleTranscript || "Not specified."}
${formatMemoriesForPrompt(speakingPersona.memories)}

You are currently in a conversation with ${listeningPersona.name}.
About ${listeningPersona.name}:
Their Biography: ${listeningPersona.biography}
Their Character Description: ${listeningPersona.characterDescription}
${formatMemoriesForPrompt(listeningPersona.memories)}

${scenario ? `The current scenario or setting for your conversation is: "${scenario}"\n` : ''}
General Instruction for this conversation: Engage with ${listeningPersona.name} in a natural and dynamic way. Express your unique viewpoint and character, ${speakingPersona.name}, but aim for a lively and believable exchange of concise, spoken-like dialogue. Your responses should typically be brief – a few sentences is ideal. Actively avoid long, unbroken monologues or essay-like replies. The goal is a back-and-forth conversation, not a series of speeches. Even when discussing a specific topic or within a scenario, maintain this concise and conversational style.

Conversation History (you are ${speakingPersona.name}):
${historyStr || "This is the beginning of your conversation."}
---
`;

  let instruction: string;
  const lastMessageByOther = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length-1] : null;

  if (conversationHistory.length === 0) { 
    if (topic) {
      instruction = `The specific topic for this discussion is: "${topic}". ${scenario ? `You are in the scenario: "${scenario}".` : ''} As ${speakingPersona.name}, you MUST initiate the conversation with ${listeningPersona.name} by directly addressing this topic within the given scenario (if provided). Ask a question about it, state your initial position, or make an observation related to "${topic}" and the scenario. Begin the discussion with a concise, conversational opening remark or question. Keep your opening brief.`;
    } else if (scenario) {
      instruction = `This is the start of a free chat with ${listeningPersona.name} within the scenario: "${scenario}". Greet them or begin the conversation in a way that is natural for your character, ${speakingPersona.name}, keeping the scenario in mind.`;
    }
     else {
      instruction = `This is the start of a free chat with ${listeningPersona.name}. Greet them or begin the conversation in a way that is natural for your character, ${speakingPersona.name}.`;
    }
  } else if (lastMessageByOther && lastMessageByOther.speakerPersona.id === listeningPersona.id) { 
    if (topic) {
      instruction = `The ongoing discussion topic is "${topic}" ${scenario ? `within the scenario: "${scenario}"` : ''}. ${listeningPersona.name} just said: "${lastMessageByOther.text}". As ${speakingPersona.name}, your response MUST be relevant to this statement AND keep the conversation focused on "${topic}" and the scenario (if provided). Remember to keep your response conversational and relatively brief.`;
    } else {
      instruction = `${listeningPersona.name} just said: "${lastMessageByOther.text}". As ${speakingPersona.name}, respond to ${listeningPersona.name} in character ${scenario ? `(remember you are in the scenario: "${scenario}")` : ''}.`;
    }
  } else { 
     instruction = `Continue the conversation naturally as ${speakingPersona.name}.`;
     if (topic) instruction += ` Your primary focus should remain on the topic: "${topic}".`;
     else if (scenario) instruction += ` Keep the scenario: "${scenario}" in mind as you respond.`;
  }
  
  const fullPrompt = basePrompt + instruction + `\n${speakingPersona.name}:`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: fullPrompt,
      config: {
        temperature: 0.9, 
        topP: 0.9,
        topK: 45, 
      }
    });
    
    let textContent = response.text || ""; 
    if (textContent.trim() === "") {
        textContent = `${speakingPersona.name} seems to be lost in thought...`; 
    }
    return { text: textContent };
  } catch (error: any) {
    console.error("Error in generatePlaygroundResponse:", error);
    let errorMessage = `(An error occurred with ${speakingPersona.name} generating response.)`;
    if (error && error.error && (error.error.code === 429 || error.error.status === 'RESOURCE_EXHAUSTED')) {
        errorMessage = `(API Quota Exceeded for ${speakingPersona.name}. Please check your Google Cloud plan and billing details. Interaction stopped. Message: ${error.error.message || ''})`;
    } else if (error instanceof Error) {
        if (error.message.includes("not found") || error.message.includes("Invalid model name")) {
             errorMessage = `(Error as ${speakingPersona.name}: The AI model (${GEMINI_TEXT_MODEL}) could not be accessed.)`;
        } else {
            errorMessage = `(Error as ${speakingPersona.name}: ${error.message})`;
        }
    }
    return { text: errorMessage };
  }
};