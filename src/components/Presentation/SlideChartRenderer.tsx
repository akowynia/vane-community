'use client';

import React, { useState } from 'react';
import {
  BarChart2,
  TrendingUp,
  PieChart,
  ShieldCheck,
  Quote,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface GroundedDataPoint {
  label: string;
  value: number;
  sourceIndex?: number;
  exactQuote?: string;
  color?: string;
}

export interface GroundedChartSeries {
  name: string;
  data: GroundedDataPoint[];
}

export interface GroundedChartData {
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  series: GroundedChartSeries[];
  sourceCitations?: number[];
  verifiedFromSearch?: boolean;
}

interface SlideChartRendererProps {
  chartData: GroundedChartData;
  sources?: any[];
  onHoverSource?: (index: number | null) => void;
  accentColor?: string;
}

const DEFAULT_COLORS = [
  '#38bdf8', // sky
  '#34d399', // emerald
  '#fbbf24', // amber
  '#a78bfa', // purple
  '#f87171', // red
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#818cf8', // indigo
];

export const SlideChartRenderer: React.FC<SlideChartRendererProps> = ({
  chartData,
  sources = [],
  onHoverSource,
  accentColor = '#38bdf8',
}) => {
  const { t } = useTranslation();
  const [activeTooltip, setActiveTooltip] = useState<{
    point: GroundedDataPoint;
    seriesName: string;
    x: number;
    y: number;
  } | null>(null);

  const series = chartData.series || [];
  const primarySeries = series[0]?.data || [];

  if (primarySeries.length === 0) {
    return null;
  }

  if (primarySeries.length === 1) {
    const single = primarySeries[0];
    const source = single.sourceIndex && Array.isArray(sources) && single.sourceIndex <= sources.length
      ? sources[single.sourceIndex - 1]
      : null;

    return (
      <div className="my-3 p-4 rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 shadow-lg text-stone-100 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
              {chartData.title || t('presentation.chartKeyMetricFallback') || 'Key Metric'}
            </h4>
          </div>
          {chartData.verifiedFromSearch && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
              <ShieldCheck className="w-3 h-3" />
              <span>{t('presentation.chartVerifiedBadge') || 'Verified from Research'}</span>
            </div>
          )}
        </div>

        <div className="my-2 p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-xs sm:text-sm font-semibold text-stone-200 block">{single.label}</span>
            {chartData.yAxisLabel && (
              <span className="text-[11px] text-stone-400 font-mono block mt-0.5">{chartData.yAxisLabel}</span>
            )}
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400">
              {single.value >= 1000 ? `${(single.value / 1000).toFixed(1)}k` : single.value}
            </span>
            {single.sourceIndex && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                [{single.sourceIndex}]
              </span>
            )}
          </div>
        </div>

        {single.exactQuote && (
          <p className="text-[11px] text-stone-300 italic flex items-start space-x-1.5 pt-2 border-t border-white/10">
            <Quote className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <span>„{single.exactQuote}”</span>
          </p>
        )}
      </div>
    );
  }

  const maxValue = Math.max(...primarySeries.map((d) => d.value), 1);
  const totalValue = primarySeries.reduce((acc, curr) => acc + curr.value, 0);

  const handlePointMouseEnter = (
    point: GroundedDataPoint,
    seriesName: string,
    e: React.MouseEvent,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      point,
      seriesName,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    if (point.sourceIndex && onHoverSource) {
      onHoverSource(point.sourceIndex);
    }
  };

  const handlePointMouseLeave = () => {
    setActiveTooltip(null);
    if (onHoverSource) {
      onHoverSource(null);
    }
  };

  const getSourceInfo = (index?: number) => {
    if (!index || !Array.isArray(sources) || index > sources.length) return null;
    return sources[index - 1];
  };

  return (
    <div className="relative my-4 p-5 rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 shadow-lg text-stone-100 flex flex-col justify-between overflow-hidden">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {chartData.type === 'bar' && <BarChart2 className="w-4 h-4 text-amber-400" />}
          {chartData.type === 'line' && <TrendingUp className="w-4 h-4 text-amber-400" />}
          {(chartData.type === 'pie' || chartData.type === 'doughnut') && (
            <PieChart className="w-4 h-4 text-amber-400" />
          )}
          <h4 className="text-sm font-bold text-white tracking-wide">
            {chartData.title || t('presentation.chartDataVisualizationFallback') || 'Data Visualization'}
          </h4>
        </div>

        {chartData.verifiedFromSearch && (
          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
            <ShieldCheck className="w-3 h-3" />
            <span>{t('presentation.chartVerifiedBadge') || 'Verified from Research'}</span>
          </div>
        )}
      </div>

      {/* Chart Rendering Area */}
      <div className="w-full min-h-[180px] flex items-end justify-center py-2 px-1">
        {/* BAR CHART */}
        {chartData.type === 'bar' && (
          <div className="w-full flex items-end justify-around gap-2 sm:gap-4 h-44 pt-6 pb-2">
            {primarySeries.map((point, idx) => {
              const heightPercent = Math.max(Math.round((point.value / maxValue) * 100), 8);
              const color = point.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              const source = getSourceInfo(point.sourceIndex);

              return (
                <div
                  key={idx}
                  className="flex-1 max-w-[80px] flex flex-col items-center group relative cursor-pointer"
                  onMouseEnter={(e) => handlePointMouseEnter(point, series[0]?.name || '', e)}
                  onMouseLeave={handlePointMouseLeave}
                >
                  {/* Top value and Citation Badge */}
                  <div className="flex items-center space-x-1 mb-1.5 transition-transform group-hover:scale-110">
                    <span className="text-[11px] font-mono font-bold text-stone-200">
                      {point.value >= 1000 ? `${(point.value / 1000).toFixed(1)}k` : point.value}
                    </span>
                    {point.sourceIndex && (
                      <span className="px-1 py-0.2 rounded bg-amber-500/30 border border-amber-500/50 text-amber-300 font-mono text-[9px] font-bold">
                        [{point.sourceIndex}]
                      </span>
                    )}
                  </div>

                  {/* The Bar */}
                  <div className="w-full bg-white/5 rounded-t-xl overflow-hidden flex items-end h-32 p-0.5">
                    <div
                      className="w-full rounded-t-lg transition-all duration-500 group-hover:brightness-125 group-hover:shadow-lg"
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: color,
                        boxShadow: `0 0 12px ${color}40`,
                      }}
                    />
                  </div>

                  {/* Label */}
                  <span className="text-[10px] text-stone-400 mt-2 text-center line-clamp-2 font-medium">
                    {point.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* PIE / DOUGHNUT CHART */}
        {(chartData.type === 'pie' || chartData.type === 'doughnut') && (
          <div className="w-full flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
            {/* SVG Pie Representation */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {(() => {
                  let accumulatedPercent = 0;
                  return primarySeries.map((point, idx) => {
                    const percent = (point.value / totalValue) * 100;
                    const strokeDasharray = `${percent} ${100 - percent}`;
                    const strokeDashoffset = -accumulatedPercent;
                    accumulatedPercent += percent;
                    const color = point.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

                    return (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="35"
                        fill="transparent"
                        stroke={color}
                        strokeWidth={chartData.type === 'doughnut' ? '18' : '35'}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        pathLength="100"
                        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        onMouseEnter={(e) => handlePointMouseEnter(point, series[0]?.name || '', e)}
                        onMouseLeave={handlePointMouseLeave}
                      />
                    );
                  });
                })()}
              </svg>
              {chartData.type === 'doughnut' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-xs font-mono font-bold text-white">
                    {totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}k` : totalValue}
                  </span>
                  <span className="text-[9px] text-stone-400 uppercase tracking-widest">Suma</span>
                </div>
              )}
            </div>

            {/* Legend List with Citations */}
            <div className="flex flex-col space-y-1.5 max-w-xs">
              {primarySeries.map((point, idx) => {
                const percent = Math.round((point.value / totalValue) * 100);
                const color = point.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs space-x-3 p-1.5 rounded-lg hover:bg-white/5 transition cursor-pointer"
                    onMouseEnter={(e) => handlePointMouseEnter(point, series[0]?.name || '', e)}
                    onMouseLeave={handlePointMouseLeave}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-stone-300 text-[11px] truncate">{point.label}</span>
                    </div>
                    <div className="flex items-center space-x-1 font-mono text-[11px]">
                      <span className="text-white font-bold">{percent}%</span>
                      {point.sourceIndex && (
                        <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                          [{point.sourceIndex}]
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LINE CHART */}
        {chartData.type === 'line' && (
          <div className="w-full flex flex-col items-center py-2">
            <svg viewBox="0 0 400 120" className="w-full h-32 overflow-visible">
              {/* Grid lines */}
              <line x1="0" y1="20" x2="400" y2="20" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              <line x1="0" y1="60" x2="400" y2="60" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />

              {/* Path Line */}
              {(() => {
                const step = 400 / Math.max(primarySeries.length - 1, 1);
                const points = primarySeries.map((pt, i) => {
                  const x = i * step;
                  const y = 100 - (pt.value / maxValue) * 80;
                  return { x, y, pt };
                });

                const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                return (
                  <>
                    <path d={d} fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" />
                    {points.map((p, idx) => (
                      <g
                        key={idx}
                        className="cursor-pointer group"
                        onMouseEnter={(e) => handlePointMouseEnter(p.pt, series[0]?.name || '', e)}
                        onMouseLeave={handlePointMouseLeave}
                      >
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="5"
                          fill="#0f172a"
                          stroke={accentColor}
                          strokeWidth="2.5"
                          className="transition-transform duration-200 group-hover:scale-150"
                        />
                        <text
                          x={p.x}
                          y={p.y - 10}
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {p.pt.value}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
            {/* X Axis Labels */}
            <div className="w-full flex justify-between text-[10px] text-stone-400 mt-2 font-medium">
              {primarySeries.map((p, i) => (
                <span key={i} className="text-center truncate max-w-[80px]">
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Grounded Tooltip */}
      {activeTooltip && (
        <div
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2 pointer-events-none transition-all"
          style={{ left: `${activeTooltip.x}px`, top: `${activeTooltip.y - 10}px` }}
        >
          <div className="p-3 rounded-xl bg-[#1e1b18] border border-amber-500/40 shadow-2xl text-left max-w-xs text-xs text-stone-200 backdrop-blur-md">
            <div className="flex items-center justify-between font-bold text-white mb-1">
              <span>{activeTooltip.point.label}</span>
              <span className="font-mono text-amber-400">{activeTooltip.point.value}</span>
            </div>

            {activeTooltip.point.exactQuote && (
              <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-stone-300 flex items-start space-x-1.5">
                <Quote className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="italic leading-relaxed">
                  "{activeTooltip.point.exactQuote}"
                </p>
              </div>
            )}

            {activeTooltip.point.sourceIndex && (
              <div className="mt-2 flex items-center justify-between text-[10px] text-amber-400 font-semibold">
                <span>{(t('presentation.chartSourceNumber') || 'Source [{index}]').replace('{index}', String(activeTooltip.point.sourceIndex))}</span>
                {getSourceInfo(activeTooltip.point.sourceIndex)?.metadata?.url && (
                  <span className="text-stone-400 font-mono truncate max-w-[120px]">
                    {new URL(getSourceInfo(activeTooltip.point.sourceIndex).metadata.url).hostname}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Sources */}
      {chartData.sourceCitations && chartData.sourceCitations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-stone-300">
              {t('presentation.chartSourceFooter') || 'Data Source:'}
            </span>
            <div className="flex items-center space-x-1.5">
              {chartData.sourceCitations.map((idx) => {
                const src = getSourceInfo(idx);
                return (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold cursor-pointer hover:bg-amber-500/30 transition"
                    onMouseEnter={() => onHoverSource && onHoverSource(idx)}
                    onMouseLeave={() => onHoverSource && onHoverSource(null)}
                    title={src?.metadata?.title || (t('presentation.chartSourceNumber') || 'Source [{index}]').replace('{index}', String(idx))}
                  >
                    [{idx}] {src?.metadata?.url ? new URL(src.metadata.url).hostname : ''}
                  </span>
                );
              })}
            </div>
          </div>

          <span className="text-[10px] text-stone-400 hidden sm:inline">
            {t('presentation.chartHoverHint') || 'Hover over a bar or point to see the exact quote'}
          </span>
        </div>
      )}
    </div>
  );
};

export default SlideChartRenderer;
