import React from 'react';
import { motion } from 'framer-motion';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

function TrendBadge({ label, current, previous, unit = '', invert = false, icon }) {
  if (current == null || previous == null) return null;
  if (previous === 0) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const isUp = change > 0;
  const isNeutral = Math.abs(change) < 1;
  const isGood = invert ? !isUp : isUp;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card-sm p-3 flex flex-col gap-1.5 group cursor-default"
    >
      {/* Row 1: Icon + Label */}
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-sm ${isNeutral
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
            : isGood
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
              : 'bg-red-100 dark:bg-red-900/30 text-red-500'
          }`}>
          {icon || (isNeutral ? <FiMinus /> : isUp ? <FiTrendingUp /> : <FiTrendingDown />)}
        </div>
        <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{label}</span>
      </div>

      {/* Row 2: Value + Change */}
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {typeof current === 'number' ? current.toFixed(1) : current}
          </span>
          <span className="text-[10px] text-gray-400">{unit}</span>
        </div>
        <div className={`text-right ${isNeutral ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-500'}`}>
          <span className="text-xs font-bold">
            {isNeutral ? '—' : isUp ? '↑' : '↓'}
            {!isNeutral && ` ${Math.abs(change).toFixed(1)}%`}
          </span>
          <p className="text-[9px] text-gray-400">vs prev year</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function TrendIndicators({ data = [] }) {
  if (data.length < 2) return null;
  const curr = data[data.length - 1];
  const prev = data[data.length - 2];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <TrendBadge label="Water Level" current={curr.groundwaterLevel} previous={prev.groundwaterLevel} unit="m" invert />
      <TrendBadge label="Rainfall" current={curr.rainfall} previous={prev.rainfall} unit="mm" />
      <TrendBadge label="Depletion" current={curr.depletionRate} previous={prev.depletionRate} unit="%" invert />
      <TrendBadge label="pH Level" current={curr.ph} previous={prev.ph} unit="" />
    </div>
  );
}
