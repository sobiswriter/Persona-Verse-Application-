import React from 'react';

interface AppLogoProps {
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className || "h-10 w-10"} // Parent sets text-color e.g. text-blue-500
      aria-label="PersonaVerse Logo"
    >
      <g transform="translate(5, 5) scale(0.9)">
        {/* Stylized 'P' */}
        <path 
          d="M20 10 H45 A20 20 0 1 1 45 50 H20 V10 Z" 
          fill="currentColor" // Inherits color from svg className (e.g., text-blue-500)
        />
        {/* Inner part of P - simulated cutout by matching sidebar background */}
        <path 
          d="M20 30 H35 A10 10 0 1 1 35 50" 
          fill="none"
          strokeWidth="6"
          className="stroke-slate-800" // Matches sidebar background for cutout effect
        />
         <circle cx="35" cy="30" r="7" fill="white"/> {/* Dot of P - white for contrast */}

        {/* Abstract chat bubble / persona element overlay */}
        <path 
          d="M55 45 
             C 50 40, 50 30, 58 25 
             A 20 20 0 1 1 75 65 
             L 60 75 Z"
          className="fill-sky-300 opacity-80" 
          transform="rotate(15 65 50)"
        />
         <path 
          d="M60 50 
             C 55 45, 55 35, 63 30 
             A 15 15 0 1 1 78 70 
             L 65 80 Z"
          className="fill-indigo-300 opacity-70"
          transform="translate(5, -5) rotate(-10 70 55)"
        />
      </g>
    </svg>
  );
};

export default AppLogo;