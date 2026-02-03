'use client';

import { memo } from 'react';

interface LoadingSkeletonProps {
  type?: 'dashboard' | 'table' | 'form' | 'page';
  lines?: number;
}

const LoadingSkeleton = memo(function LoadingSkeleton({ type = 'page', lines = 3 }: LoadingSkeletonProps) {
  if (type === 'dashboard') {
    return (
      <div className="animate-pulse space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-slate-700/50 rounded-xl"></div>
            <div>
              <div className="h-8 w-48 bg-slate-700/50 rounded-lg mb-2"></div>
              <div className="h-4 w-32 bg-slate-700/30 rounded"></div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-slate-700/50 rounded-xl"></div>
            <div className="h-10 w-24 bg-slate-700/50 rounded-xl"></div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2 bg-slate-800/30 p-1.5 rounded-xl">
          <div className="h-12 flex-1 bg-slate-700/50 rounded-lg"></div>
          <div className="h-12 flex-1 bg-slate-700/30 rounded-lg"></div>
          <div className="h-12 flex-1 bg-slate-700/30 rounded-lg"></div>
        </div>

        {/* Cards grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800/50 rounded-2xl p-4 border border-slate-600/20">
              <div className="h-4 w-20 bg-slate-700/50 rounded mb-2"></div>
              <div className="h-8 w-16 bg-slate-700/30 rounded mb-2"></div>
              <div className="h-2 w-full bg-slate-700/20 rounded-full"></div>
            </div>
          ))}
        </div>

        {/* Content panels skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-600/20">
            <div className="h-6 w-40 bg-slate-700/50 rounded mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-700/30 rounded-xl"></div>
              ))}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-600/20">
            <div className="h-6 w-40 bg-slate-700/50 rounded mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-700/30 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="animate-pulse">
        {/* Table header */}
        <div className="flex gap-4 p-4 border-b border-slate-600/30">
          <div className="h-4 w-1/4 bg-slate-700/50 rounded"></div>
          <div className="h-4 w-1/4 bg-slate-700/50 rounded"></div>
          <div className="h-4 w-1/4 bg-slate-700/50 rounded"></div>
          <div className="h-4 w-1/4 bg-slate-700/50 rounded"></div>
        </div>
        {/* Table rows */}
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-b border-slate-600/20">
            <div className="h-4 w-1/4 bg-slate-700/30 rounded"></div>
            <div className="h-4 w-1/4 bg-slate-700/30 rounded"></div>
            <div className="h-4 w-1/4 bg-slate-700/30 rounded"></div>
            <div className="h-4 w-1/4 bg-slate-700/30 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'form') {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i}>
            <div className="h-4 w-24 bg-slate-700/50 rounded mb-2"></div>
            <div className="h-12 w-full bg-slate-700/30 rounded-xl"></div>
          </div>
        ))}
        <div className="h-12 w-full bg-slate-600/50 rounded-xl mt-6"></div>
      </div>
    );
  }

  // Default page skeleton
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-slate-700/50 rounded-xl"></div>
        <div className="h-8 w-48 bg-slate-700/50 rounded-lg"></div>
      </div>
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-600/20 space-y-4">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-700/30 rounded" style={{ width: `${100 - i * 15}%` }}></div>
        ))}
      </div>
    </div>
  );
});

export default LoadingSkeleton;
