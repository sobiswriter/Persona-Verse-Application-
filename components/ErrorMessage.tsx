
import React from 'react';

interface ErrorMessageProps {
  message: string;
  onClear?: () => void;
}
const IconWrapper: React.FC<{ iconName: string, isSolid?: boolean, className?: string }> = ({ iconName, isSolid, className="" }) => (
  <svg className={`heroicon h-5 w-5 ${className}`} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <use href={`https://unpkg.com/heroicons@2.1.3/24/${isSolid ? 'solid' : 'outline'}/${iconName}.svg#${iconName}`} />
  </svg>
);


const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onClear }) => {
  if (!message) return null;

  return (
    <div 
      className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative shadow-md flex items-start" 
      role="alert"
    >
      <IconWrapper iconName="exclamation-triangle" className="text-red-500 mr-3 mt-0.5 flex-shrink-0" isSolid/>
      <div>
        <strong className="font-medium text-red-600">Error: </strong>
        <span className="block sm:inline text-sm">{message}</span>
      </div>
      {onClear && (
        <button
          onClick={onClear}
          className="absolute top-2 right-2 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors duration-150"
          aria-label="Close error message"
        >
          <IconWrapper iconName="x-mark" className="h-4 w-4"/>
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
