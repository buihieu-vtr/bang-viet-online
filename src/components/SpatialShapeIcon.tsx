import React from 'react';
import { SpatialShapeKind } from '../types/inkboard';

export const SpatialShapeIcon: React.FC<{ kind: SpatialShapeKind; className?: string }> = ({
  kind,
  className = 'w-5 h-5',
}) => {
  switch (kind) {
    case 'tetrahedron':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M11 3L3.5 17.5L11 21L20.5 16.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="11" y1="3" x2="11" y2="21" stroke="currentColor" strokeWidth="1.6" />
          <line x1="3.5" y1="17.5" x2="20.5" y2="16.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.2 2" />
        </svg>
      );
    case 'pyramidSquare':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3L3 20H16.5L21 14.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="12" y1="3" x2="16.5" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 20L7.5 14.5H21" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2" />
          <line x1="12" y1="3" x2="12" y2="17.2" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.8" />
          <path d="M12 15.2H14V17.2" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      );
    case 'pyramidConvex':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3L3 18.5L13 21.5L21 17.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="12" y1="3" x2="13" y2="21.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 18.5L7.5 14H16.5L21 17.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
          <line x1="12" y1="3" x2="7.5" y2="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
          <line x1="12" y1="3" x2="16.5" y2="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
        </svg>
      );
    case 'pyramidPerpEdge':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M6.5 3L3 20.5H16.5L21 14.5L6.5 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="6.5" y1="3" x2="16.5" y2="20.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 20.5L6.5 14.5H21" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2" />
          <line x1="6.5" y1="3" x2="6.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.8" />
          <path d="M6.5 12H9V14.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'pyramidPerpFace':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M10.5 3L3 20.5H16.5L21 14.5L10.5 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="10.5" y1="3" x2="16.5" y2="20.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 20.5L7 14.5H21" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2" />
          <line x1="10.5" y1="3" x2="7" y2="14.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
          <line x1="10.5" y1="3" x2="10.5" y2="14.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.6" />
          <path d="M10.5 12.2H12.8V14.5" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      );
    case 'prismTriRight':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="4,5 12,9 20,5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4 5V17.5L12 21.5L20 17.5V5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="12" y1="9" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.6" />
          <line x1="4" y1="17.5" x2="20" y2="17.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.2 2" />
        </svg>
      );
    case 'prismOblique':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="7.5,3.5 14.5,7 21.5,3.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M7.5 3.5L3 17.5L10 21L17 17.5L21.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="14.5" y1="7" x2="10" y2="21" stroke="currentColor" strokeWidth="1.6" />
          <line x1="3" y1="17.5" x2="17" y2="17.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.2 2" />
        </svg>
      );
    case 'cuboid3d':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="7.5,4 20.5,4 16.5,8.5 3.5,8.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M3.5 8.5V20.5H16.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16.5 20.5L20.5 16V4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.5 4V16H20.5M7.5 16L3.5 20.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
        </svg>
      );
    case 'cylinder3d':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <ellipse cx="12" cy="6" rx="7.5" ry="2.8" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4.5 6V18C4.5 19.55 7.86 20.8 12 20.8C16.14 20.8 19.5 19.55 19.5 18V6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4.5 18C4.5 16.45 7.86 15.2 12 15.2C16.14 15.2 19.5 16.45 19.5 18" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.8" />
          <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
        </svg>
      );
    case 'cone3d':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3L4.5 18C4.5 19.6 7.86 20.8 12 20.8C16.14 20.8 19.5 19.6 19.5 18L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4.5 18C4.5 16.4 7.86 15.2 12 15.2C16.14 15.2 19.5 16.4 19.5 18" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.8" />
          <line x1="12" y1="3" x2="12" y2="18" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
        </svg>
      );
    case 'sphere3d':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 12C3.5 13.8 7.3 15.2 12 15.2C16.7 15.2 20.5 13.8 20.5 12" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3.5 12C3.5 10.2 7.3 8.8 12 8.8C16.7 8.8 20.5 10.2 20.5 12" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'parallelogram':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="7,6 21,6 17,18 3,18" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case 'plane':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="6.5,5.5 21,5.5 17.5,18.5 3,18.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4.2 14.5C6.2 14.5 7.5 16 7.4 18.5" stroke="currentColor" strokeWidth="1.3" />
          <text x="7.8" y="16.5" fontSize="6" fontStyle="italic" fontWeight="700" fill="currentColor">P</text>
        </svg>
      );
    case 'crossSection':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="6,4.5 18.5,7 20.5,17.5 4,19.5" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="7.5" y1="18.5" x2="14" y2="6.2" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
          <line x1="12.5" y1="18" x2="18.5" y2="7.5" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
          <circle cx="6" cy="4.5" r="1.4" fill="currentColor" />
          <circle cx="18.5" cy="7" r="1.4" fill="currentColor" />
          <circle cx="20.5" cy="17.5" r="1.4" fill="currentColor" />
          <circle cx="4" cy="19.5" r="1.4" fill="currentColor" />
        </svg>
      );
  }
};
