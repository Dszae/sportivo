import React from 'react';
import Svg, { Path, Circle, Rect, Polygon, Polyline } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  fill?: string;
  style?: any;
}

export function GridIcon({ size = 20, color = '#cbd5e1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FootballIcon({ size = 20, color = '#cbd5e1', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <Polygon points="12 7.5 15.5 10 14 14.5 10 14.5 8.5 10" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.3" />
        <Path d="M12 3v4.5M15.5 10l4-1.5M14 14.5l2.5 3.5M10 14.5l-2.5 3.5M8.5 10l-4-1.5" stroke={color} strokeWidth="1.5" />
      </Svg>
    </ViewWrapper>
  );
}

export function TrophyIcon({ size = 20, color = '#ef4444', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M4 5h16v4a8 8 0 0 1-16 0V5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 17v4M8 21h8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function FlameIcon({ size = 20, color = '#ef4444', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={color}
          fillOpacity="0.25"
        />
      </Svg>
    </ViewWrapper>
  );
}

export function CricketIcon({ size = 20, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* Cricket Bat */}
        <Path d="M18.5 3.5L20.5 5.5L9.5 16.5L6.5 16L6 13.5L18.5 3.5Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.2" />
        <Path d="M6 13.5L3.5 16L2 14.5L4.5 12L6 13.5Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9.5 16.5L8 18L10 20L11.5 18.5L9.5 16.5Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Seam Ball */}
        <Circle cx="17.5" cy="17.5" r="3.5" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.3" />
        <Path d="M16 15.5C17.5 17 17.5 18 19 19.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function BookmarkIcon({ size = 20, color = '#fbbf24', fill, style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={fill || 'none'}
        />
      </Svg>
    </ViewWrapper>
  );
}

export function BellIcon({ size = 20, color = '#cbd5e1', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function ArrowForwardIcon({ size = 16, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function ArrowBackIcon({ size = 18, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function ChevronForwardIcon({ size = 16, color = '#64748b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function ClockIcon({ size = 14, color = '#94a3b8', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <Polyline points="12 6 12 12 16 14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function LocationIcon({ size = 14, color = '#94a3b8', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={color} strokeWidth="2" />
        <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth="2" />
      </Svg>
    </ViewWrapper>
  );
}

export function CalendarIcon({ size = 14, color = '#94a3b8', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
        <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function ShareIcon({ size = 18, color = '#cbd5e1', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth="2" />
        <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth="2" />
        <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth="2" />
        <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke={color} strokeWidth="2" />
      </Svg>
    </ViewWrapper>
  );
}

export function InfoIcon({ size = 20, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <Path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function AlertCircleIcon({ size = 24, color = '#fbbf24', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <Path d="M12 8v4M12 16h.01" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function RefreshIcon({ size = 16, color = '#080a0b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M23 4v6h-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function ExternalLinkIcon({ size = 16, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function GlobeIcon({ size = 18, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <Path d="M3.6 9h16.8M3.6 15h16.8" stroke={color} strokeWidth="1.5" />
        <Path d="M11.5 3a14 14 0 0 1 0 18M12.5 3a14 14 0 0 0 0 18" stroke={color} strokeWidth="1.5" />
      </Svg>
    </ViewWrapper>
  );
}

export function MailIcon({ size = 18, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth="2" />
        <Path d="M22 6l-10 7L2 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function GithubIcon({ size = 18, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </ViewWrapper>
  );
}

export function LinkedinIcon({ size = 18, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="2" y="9" width="4" height="12" stroke={color} strokeWidth="2" />
        <Circle cx="4" cy="4" r="2" stroke={color} strokeWidth="2" />
      </Svg>
    </ViewWrapper>
  );
}

export function CheckCircleIcon({ size = 14, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <Polyline points="8 12 11 15 16 9" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </ViewWrapper>
  );
}

export function RadioIcon({ size = 16, color = '#c9f36b', style }: IconProps) {
  return (
    <ViewWrapper style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <Circle cx="12" cy="12" r="3" fill={color} />
      </Svg>
    </ViewWrapper>
  );
}

import { View } from 'react-native';

function ViewWrapper({ children, style }: { children: React.ReactNode; style?: any }) {
  if (!style) return <>{children}</>;
  return <View style={style}>{children}</View>;
}

