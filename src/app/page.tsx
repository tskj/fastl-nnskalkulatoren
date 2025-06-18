'use client';

import { useState } from 'react';

export default function Home() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [yearlyIncomeDisplay, setYearlyIncomeDisplay] = useState<string>('');
  const [vacationPay, setVacationPay] = useState<number>(12);

  const formatNumber = (value: string): string => {
    // Remove all non-digits
    const numericValue = value.replace(/\D/g, '');
    
    // Add spaces as thousands separators
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const handleYearlyIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatNumber(value);
    setYearlyIncomeDisplay(formatted);
  };

  return (
    <div 
      className="min-h-screen px-8 py-16"
      style={{ background: 'var(--background)' }}
    >
      <div className="max-w-4xl mx-auto">
        <header className="mb-16 text-center">
          <h1 
            className="text-5xl font-medium mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            Fastlønnskalkulator
          </h1>
        </header>

        <div className="max-w-2xl mx-auto space-y-12">
          <div className="text-xl leading-relaxed text-justify">
            <p style={{ color: 'var(--text-primary)' }}>
              Min nominelle årslønn er{' '}
              <input
                type="text"
                value={yearlyIncomeDisplay}
                onChange={handleYearlyIncomeChange}
                className="inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '120px'
                }}
                placeholder="000 000"
              />
              {' '}kroner.
            </p>
          </div>

          <div className="text-xl leading-relaxed text-justify">
            <p style={{ color: 'var(--text-primary)' }}>
              Jeg har{' '}
              <input
                type="number"
                value={vacationPay || ''}
                onChange={(e) => setVacationPay(Number(e.target.value))}
                className="inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '40px'
                }}
                placeholder="12"
              />
              {' '}% feriepenger.
            </p>
          </div>

          <div className="text-xl leading-relaxed text-justify">
            <p style={{ color: 'var(--text-primary)' }}>
              Jeg vil beregne min totale lønn og timespris for{' '}
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '60px'
                }}
                placeholder="2025"
                min="2020"
                max="2030"
              />
              .
            </p>
          </div>
        </div>

        <footer className="mt-24 text-center">
          <p 
            className="text-sm italic"
            style={{ color: 'var(--text-secondary)' }}
          >
            Lønnskalkulator — bygget med Next.js
          </p>
        </footer>
      </div>
    </div>
  );
}