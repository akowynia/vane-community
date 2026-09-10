'use client';

import React from 'react';
import {
  Waypoints,
  Compass,
  Code,
  Brain,
  Sparkles,
  GraduationCap,
  Briefcase,
  Palette,
  BookOpen,
  Terminal,
  Globe,
  Search,
  Cpu,
  Bookmark,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const AVAILABLE_WAYPOINT_ICONS: { id: string; icon: LucideIcon }[] = [
  { id: 'Waypoints', icon: Waypoints },
  { id: 'Compass', icon: Compass },
  { id: 'Brain', icon: Brain },
  { id: 'Code', icon: Code },
  { id: 'Terminal', icon: Terminal },
  { id: 'Cpu', icon: Cpu },
  { id: 'Sparkles', icon: Sparkles },
  { id: 'GraduationCap', icon: GraduationCap },
  { id: 'Briefcase', icon: Briefcase },
  { id: 'BookOpen', icon: BookOpen },
  { id: 'Palette', icon: Palette },
  { id: 'Globe', icon: Globe },
  { id: 'Zap', icon: Zap },
  { id: 'Bookmark', icon: Bookmark },
  { id: 'Search', icon: Search },
];

const iconMap: Record<string, LucideIcon> = {
  Waypoints,
  Compass,
  Code,
  Brain,
  Sparkles,
  GraduationCap,
  Briefcase,
  Palette,
  BookOpen,
  Terminal,
  Globe,
  Search,
  Cpu,
  Bookmark,
  Zap,
};

interface WaypointIconProps {
  name?: string | null;
  className?: string;
  size?: number;
}

const WaypointIcon = ({ name, className = 'w-5 h-5', size = 20 }: WaypointIconProps) => {
  const IconComponent = (name && iconMap[name]) || Waypoints;
  return <IconComponent size={size} className={className} />;
};

export default WaypointIcon;
