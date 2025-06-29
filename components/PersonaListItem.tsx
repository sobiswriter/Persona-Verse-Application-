
import React, { useState } from 'react';
import { Persona } from '../types';
import { DEFAULT_PERSONA_IMAGE } from '../constants';

interface PersonaListItemProps {
  persona: Persona;
  isSelected: boolean;
  onSelect: () => void;
  onChat: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const IconWrapperSmall: React.FC<{ iconName: string, isSolid?: boolean,  className?: string}> = ({ iconName, isSolid, className = "" }) => (
  <svg className={`heroicon h-5 w-5 ${className}`} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <use href={`https://unpkg.com/heroicons@2.1.3/24/${isSolid ? 'solid' : 'outline'}/${iconName}.svg#${iconName}`} />
  </svg>
);


const PersonaListItem: React.FC<PersonaListItemProps> = ({ persona, isSelected, onSelect, onChat, onTest, onEdit, onDelete }) => {
  const imageUrl = persona.imageUrl || DEFAULT_PERSONA_IMAGE.replace('defaultpersona', persona.name.toLowerCase().replace(/\s+/g, '') || 'random');
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Define actions for cleaner mapping
  const actions = [
    { label: 'Chat', action: onChat, icon: 'chat-bubble-left-ellipsis', style: 'text-slate-700 hover:bg-slate-200 focus-visible:bg-slate-200', iconColor: 'text-slate-500' },
    { label: 'Test', action: onTest, icon: 'beaker', style: 'text-slate-700 hover:bg-slate-200 focus-visible:bg-slate-200', iconColor: 'text-slate-500' },
    { label: 'Edit', action: onEdit, icon: 'pencil-square', style: 'text-slate-700 hover:bg-slate-200 focus-visible:bg-slate-200', iconColor: 'text-slate-500' },
    { label: 'Delete', action: onDelete, icon: 'trash', style: 'text-red-600 hover:bg-red-100 focus-visible:bg-red-100', iconColor: 'text-red-500' }
  ];

  return (
    <div
      onMouseEnter={() => setIsMenuVisible(true)}
      onMouseLeave={() => setIsMenuVisible(false)}
      className={`rounded-lg shadow-md transition-shadow duration-200 ease-in-out ${isSelected && !isMenuVisible ? 'ring-2 ring-blue-500 ring-offset-1' : ''} bg-white hover:shadow-lg`}
    >
      {/* Card Content (always visible) */}
      <div
        onClick={onSelect}
        className={`p-3 cursor-pointer group rounded-t-lg
                    ${isSelected ? 'bg-blue-500 text-white' : 'bg-white text-slate-800'}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        aria-pressed={isSelected}
        aria-label={`Select persona ${persona.name}`}
      >
        <div className="flex items-start space-x-3">
          <img
            src={imageUrl}
            alt={persona.name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_PERSONA_IMAGE.replace('defaultpersona', 'errorfallback');
            }}
          />
          <div className="flex-grow min-w-0">
            <h3 
              className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-700 group-hover:text-slate-800'}`}
              title={persona.name}
            >
              {persona.name}
            </h3>
            <p 
              className={`text-xs truncate ${isSelected ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-600'}`}
              title={persona.characterDescription || "No description"}
            >
              {persona.characterDescription || "A persona of few words."}
            </p>
          </div>
        </div>
      </div>

      {/* Action Menu (conditionally visible below card content) */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden rounded-b-lg
                    ${isMenuVisible ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="border-t border-slate-200 bg-slate-50 p-1.5 space-y-1">
          {actions.map(item => (
            <button
              key={item.label}
              onClick={(e) => { e.stopPropagation(); item.action(); }}
              title={item.label}
              className={`w-full flex items-center text-sm py-2 px-3 rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${item.style}`}
            >
              <IconWrapperSmall iconName={item.icon} className={`mr-2.5 ${item.iconColor}`} isSolid={item.label === 'Delete'} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonaListItem;
