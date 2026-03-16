import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { ActivityReport } from './ActivityReport';

interface ActivitySectionProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  dozentId?: string;
  onShowActivityDialog: () => void;
  showSecondExam?: boolean;
}

export function ActivitySection({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  dozentId,
  onShowActivityDialog,
  showSecondExam = true
}: ActivitySectionProps) {
  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  return (
    <div className="space-y-6">
      {/* 1. Staatsexamen Panel */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {/* Header */}
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: Section Name */}
            <h3 className="text-lg font-medium text-gray-900">
              Tätigkeitsbericht (1. Staatsexamen)
            </h3>
            
            {/* Right: Month/Year Selection + Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 sm:ml-auto">
              {/* Month/Year Selection */}
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monat</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => onMonthChange(parseInt(e.target.value))}
                    className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getMonthName(i + 1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Jahr</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => onYearChange(parseInt(e.target.value))}
                    className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={onShowActivityDialog}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Tätigkeit hinzufügen
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <ActivityReport
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={onMonthChange}
            onYearChange={onYearChange}
            onShowActivityDialog={onShowActivityDialog}
            dozentId={dozentId}
            examType="1. Staatsexamen"
          />
        </div>
      </div>

      {/* 2. Staatsexamen Panel - Only show if showSecondExam is true */}
      {showSecondExam && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border-2 border-amber-200">
          {/* Header */}
          <div className="px-4 py-5 border-b border-amber-200 sm:px-6 bg-amber-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left: Section Name */}
              <h3 className="text-lg font-medium text-gray-900">
                Tätigkeitsbericht (2. Staatsexamen)
              </h3>
              
              {/* Right: Month/Year Selection + Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 sm:ml-auto">
                {/* Month/Year Selection */}
                <div className="flex items-center gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Monat</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => onMonthChange(parseInt(e.target.value))}
                      className="text-sm rounded-md border-gray-300 shadow-sm focus:border-amber-600 focus:ring focus:ring-amber-600/20"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {getMonthName(i + 1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Jahr</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => onYearChange(parseInt(e.target.value))}
                      className="text-sm rounded-md border-gray-300 shadow-sm focus:border-amber-600 focus:ring focus:ring-amber-600/20"
                    >
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i;
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={onShowActivityDialog}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Tätigkeit hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <ActivityReport
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onMonthChange={onMonthChange}
              onYearChange={onYearChange}
              onShowActivityDialog={onShowActivityDialog}
              dozentId={dozentId}
              examType="2. Staatsexamen"
            />
          </div>
        </div>
      )}
    </div>
  );
}