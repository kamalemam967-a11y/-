import React from 'react';
import {
  Activity,
  Baby,
  Cross,
  Droplets,
  HeartHandshake,
  Pill,
  Smile,
  Sparkles,
  Stethoscope,
  Wind,
} from 'lucide-react';
import { Category } from '../types/pharmacy';

interface CategoryIconProps {
  name: Category['iconName'];
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-5 h-5' }) => {
  switch (name) {
    case 'Pill':
      return <Pill className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Activity':
      return <Activity className={className} />;
    case 'Droplets':
      return <Droplets className={className} />;
    case 'HeartHandshake':
      return <HeartHandshake className={className} />;
    case 'Baby':
      return <Baby className={className} />;
    case 'Stethoscope':
      return <Stethoscope className={className} />;
    case 'Cross':
      return <Cross className={className} />;
    case 'Smile':
      return <Smile className={className} />;
    case 'Wind':
      return <Wind className={className} />;
    default:
      return <Pill className={className} />;
  }
};
