'use client';

import { useState } from 'react';

export default function Home() {
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(37.5);
  const [result, setResult] = useState<{
    weekly: number;
    monthly: number;
    yearly: number;
  } | null>(null);

  const calculateSalary = () => {
    const weeklyPay = hourlyRate * hoursPerWeek;
    const monthlyPay = weeklyPay * 4.33;
    const yearlyPay = monthlyPay * 12;
    
    setResult({
      weekly: weeklyPay,
      monthly: monthlyPay,
      yearly: yearlyPay
    });
  };

  return (
    <div 
      className="min-h-screen transition-all duration-500" 
      style={{ background: 'var(--bg-gradient)' }}
    >
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <header className="text-center mb-12">
          <div className="inline-block p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h1 
            className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            style={{ 
              background: 'linear-gradient(to right, #2563eb, #9333ea)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Fastlønnskalkulator
          </h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-lg">
            Beregn raskt din lønn basert på timelønn og arbeidstid
          </p>
        </header>

        <div 
          className="backdrop-blur-lg rounded-3xl shadow-2xl p-8 mb-8"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)'
          }}
        >
          <div className="space-y-8">
            <div className="space-y-2">
              <label htmlFor="hourlyRate" className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                💰 Timelønn (kr)
              </label>
              <input
                id="hourlyRate"
                type="number"
                value={hourlyRate || ''}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl focus:outline-none focus:ring-4 transition-all duration-200"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-primary)'
                }}
                placeholder="f.eks. 250"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="hoursPerWeek" className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                ⏰ Timer per uke
              </label>
              <input
                id="hoursPerWeek"
                type="number"
                value={hoursPerWeek || ''}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl focus:outline-none focus:ring-4 transition-all duration-200"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-primary)'
                }}
                placeholder="f.eks. 37.5"
              />
            </div>

            <button
              onClick={calculateSalary}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            >
              ✨ Beregn lønn
            </button>
          </div>
        </div>

        {result && (
          <div 
            className="backdrop-blur-lg rounded-3xl shadow-2xl p-8 transform transition-all duration-500 ease-out"
            style={{
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)'
            }}
          >
            <h3 className="font-bold mb-6 text-xl flex items-center" style={{ color: 'var(--success-text)' }}>
              <span className="mr-2">🎉</span>
              Dine beregnede lønninger
            </h3>
            <div className="grid gap-4">
              <div 
                className="rounded-2xl p-4"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--success-border)'
                }}
              >
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>📅 Ukelønn</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {result.weekly.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
                </div>
              </div>
              <div 
                className="rounded-2xl p-4"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--success-border)'
                }}
              >
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>📊 Månedslønn</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {result.monthly.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
                </div>
              </div>
              <div 
                className="rounded-2xl p-4"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--success-border)'
                }}
              >
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>🎯 Årslønn</div>
                <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {result.yearly.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-12 text-center">
          <div 
            className="inline-flex items-center space-x-2 text-sm backdrop-blur-sm rounded-full px-4 py-2"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-tertiary)'
            }}
          >
            <span>✨</span>
            <span>Pre-rendered med Next.js</span>
            <span>•</span>
            <span>Hydrated client-side</span>
            <span>•</span>
            <span>Static hosting</span>
          </div>
        </footer>
      </div>
    </div>
  );
}