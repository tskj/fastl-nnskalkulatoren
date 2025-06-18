'use client';

import { useState } from 'react';

export default function Home() {
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(37.5);
  const [result, setResult] = useState<string>('');

  const calculateSalary = () => {
    const weeklyPay = hourlyRate * hoursPerWeek;
    const monthlyPay = weeklyPay * 4.33;
    const yearlyPay = monthlyPay * 12;
    
    setResult(`
      Ukelønn: ${weeklyPay.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
      Månedslønn: ${monthlyPay.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
      Årslønn: ${yearlyPay.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
    `);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Fastlønnskalkulator
          </h1>
          <p className="text-gray-600">
            Beregn raskt din lønn basert på timelønn og arbeidstid
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700 mb-2">
                Timelønn (kr)
              </label>
              <input
                id="hourlyRate"
                type="number"
                value={hourlyRate || ''}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Skriv inn din timelønn"
              />
            </div>

            <div>
              <label htmlFor="hoursPerWeek" className="block text-sm font-medium text-gray-700 mb-2">
                Timer per uke
              </label>
              <input
                id="hoursPerWeek"
                type="number"
                value={hoursPerWeek || ''}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Timer per uke"
              />
            </div>

            <button
              onClick={calculateSalary}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Beregn lønn
            </button>

            {result && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <h3 className="font-semibold text-green-800 mb-2">Resultat:</h3>
                <pre className="text-green-700 whitespace-pre-line">{result}</pre>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>Pre-rendered med Next.js • Hydrated client-side • Static hosting</p>
        </footer>
      </div>
    </div>
  );
}
