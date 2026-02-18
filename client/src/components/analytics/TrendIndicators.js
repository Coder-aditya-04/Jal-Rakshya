import React from 'react';
import { motion } from 'framer-motion';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

function TrendBadge({ label, current, previous, unit = '', invert = false, icon }) {
  if (current === undefined || previous === undefined || previous === undefined) return null;
  if (previous === 0) return null; // Can't calculate % change from zero
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const isUp = change > 0;
  const isNeutral = Math.abs(change) < 1;
  // For depletion, up is bad => invert color
  const isGood = invert ? !isUp : isUp;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.04 }}
      className="glass-card-sm p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 group cursor-default"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg shadow-sm ${isNeutral
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
            : isGood
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
              : 'bg-red-100 dark:bg-red-900/30 text-red-500'
          }`}>
          {icon || (isNeutral ? <FiMinus /> : isUp ? <FiTrendingUp /> : <FiTrendingDown />)}
        </div>
        <div>
          <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold truncate max-w-[100px] sm:max-w-none">{label}</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
              {typeof current === 'number' ? current.toFixed(1) : current}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-400 font-medium">{unit}</span>
          </div>
        </div>
      </div>

      <div className={`flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50 pt-2 sm:pt-0 mt-1 sm:mt-0 ${isNeutral ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-500'
        }`}>
        <div className="flex items-center gap-1 text-sm font-bold bg-white/50 dark:bg-slate-800/50 sm:bg-transparent px-2 py-0.5 sm:p-0 rounded-md sm:rounded-none">
          {isNeutral ? '—' : isUp ? '↑' : '↓'}
          {!isNeutral && <span>{Math.abs(change).toFixed(1)}%</span>}
        </div>
        <p className="text-[10px] text-gray-400 font-medium">vs last year</p>
      </div>
    </motion.div>
  );
}

export default function TrendIndicators({ data = [] }) {
  if (data.length < 2) return null;
  const curr = data[data.length - 1];
  const prev = data[data.length - 2];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <TrendBadge label="Water Level" current={curr.groundwaterLevel} previous={prev.groundwaterLevel} unit="m" invert />
      <TrendBadge label="Rainfall" current={curr.rainfall} previous={prev.rainfall} unit="mm" />
      <TrendBadge label="Depletion Rate" current={curr.depletionRate} previous={prev.depletionRate} unit="%" invert />
      <TrendBadge label="pH Level" current={curr.ph} previous={prev.ph} unit="" />
    </div>
  );
}
