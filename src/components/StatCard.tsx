import React from 'react';

interface StatCardProps {
  id?: string;
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  id,
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  onClick,
}) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-4 shadow-xs transition-all ${
        onClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {title}
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">
            {value}
          </div>
          {subtitle && (
            <div className="text-xs text-gray-500 mt-0.5 font-medium">{subtitle}</div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
};
