'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSocket } from '@/hooks/useSocket';

export default function JackAttackCard() {
  const gameState = useGameStore((s) => s.gameState);
  const jackAttack = useGameStore((s) => s.jackAttack);
  const jackAttackCurrentWord = useGameStore((s) => s.jackAttackCurrentWord);
  const jackAttackBuzzResults = useGameStore((s) => s.jackAttackBuzzResults);
  const jackAttackFinalScores = useGameStore((s) => s.jackAttackFinalScores);
  const myPlayer = useGameStore((s) => s.myPlayer);
  const hostDialogue = useGameStore((s) => s.hostDialogue);

  const { submitJackAttackBuzz } = useSocket();

  const isIntro = gameState === 'jack_attack_intro';
  const isActive = gameState === 'jack_attack_active';
  const isResults = gameState === 'jack_attack_results';

  // Flash animation when word changes
  const [wordFlash, setWordFlash] = useState(false);
  const prevWordRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      jackAttackCurrentWord &&
      jackAttackCurrentWord.wordId !== prevWordRef.current
    ) {
      prevWordRef.current = jackAttackCurrentWord.wordId;
      setWordFlash(true);
      const t = setTimeout(() => setWordFlash(false), 200);
      return () => clearTimeout(t);
    }
  }, [jackAttackCurrentWord]);

  // My last buzz result for the current word
  const myLastBuzz =
    jackAttackCurrentWord &&
    jackAttackBuzzResults.findLast(
      (r) => r.wordId === jackAttackCurrentWord.wordId
    );

  const formatMoney = (n: number) =>
    (n >= 0 ? '+' : '') + '$' + Math.abs(n).toLocaleString('en-US');

  return (
    <main className="flex flex-1 flex-col min-h-screen">
      <div className="flex flex-col flex-1 items-center px-4 py-4 max-w-lg mx-auto w-full">

        {/* ---- INTRO ---- */}
        {isIntro && jackAttack && (
          <div className="flex flex-col flex-1 items-center justify-center text-center animate-scale-in">
            <p className="text-accent-yellow text-xs uppercase tracking-widest mb-4 font-bold">
              Final Round
            </p>
            <p className="text-4xl sm:text-5xl font-extrabold text-accent-pink mb-3">
              JACK ATTACK!
            </p>
            <p className="text-text-muted text-sm uppercase tracking-wider mb-6">
              {jackAttack.theme}
            </p>
            <div className="px-8 py-5 rounded-2xl bg-bg-card border border-border-default mb-6">
              <p className="text-text-muted text-xs uppercase tracking-wider mb-2">The Clue</p>
              <p className="text-accent-cyan text-3xl sm:text-4xl font-extrabold">
                {jackAttack.clue}
              </p>
            </div>
            {hostDialogue && (
              <p className="text-text-secondary text-sm italic max-w-sm leading-relaxed">
                &ldquo;{hostDialogue}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* ---- ACTIVE ---- */}
        {isActive && jackAttack && (
          <div className="flex flex-col flex-1 items-center justify-center w-full">
            {/* Theme + Clue bar */}
            <div className="w-full flex items-center justify-between mb-6">
              <p className="text-text-muted text-xs uppercase tracking-wider">
                {jackAttack.theme}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-text-muted text-xs uppercase tracking-wider">Clue:</p>
                <p className="text-accent-cyan font-extrabold text-base">{jackAttack.clue}</p>
              </div>
            </div>

            {/* Current word */}
            <div
              className={`w-full text-center mb-8 transition-opacity duration-150 ${
                wordFlash ? 'opacity-50' : 'opacity-100'
              }`}
            >
              {jackAttackCurrentWord ? (
                <p className="text-text-primary text-4xl sm:text-5xl font-extrabold">
                  {jackAttackCurrentWord.word}
                </p>
              ) : (
                <p className="text-text-muted text-2xl font-bold animate-pulse">
                  Get ready...
                </p>
              )}
            </div>

            {/* Buzz result flash */}
            {myLastBuzz && (
              <div
                className={`mb-4 px-6 py-2 rounded-full text-sm font-bold ${
                  myLastBuzz.correct
                    ? 'bg-success/15 text-success'
                    : 'bg-error/15 text-error'
                }`}
              >
                {myLastBuzz.correct
                  ? `\u2713 Correct! +$${myLastBuzz.moneyDelta.toLocaleString()}`
                  : `\u2717 Wrong! -$${Math.abs(myLastBuzz.moneyDelta).toLocaleString()}`}
              </div>
            )}

            {/* BUZZ button */}
            <button
              onClick={() => {
                if (jackAttackCurrentWord) {
                  submitJackAttackBuzz(jackAttackCurrentWord.wordId);
                }
              }}
              disabled={!jackAttackCurrentWord}
              className="w-full py-8 rounded-2xl bg-accent-pink text-white text-3xl font-extrabold uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
            >
              BUZZ!
            </button>

            <p className="text-text-muted text-xs text-center mt-4">
              Buzz when the word connects to <strong className="text-accent-cyan">{jackAttack.clue}</strong>
            </p>

            {/* Running score changes */}
            {jackAttackBuzzResults.length > 0 && (
              <div className="mt-4 flex gap-2 flex-wrap justify-center">
                {jackAttackBuzzResults.slice(-5).map((r, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      r.correct ? 'text-success bg-success/10' : 'text-error bg-error/10'
                    }`}
                  >
                    {formatMoney(r.moneyDelta)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- RESULTS ---- */}
        {isResults && (
          <div className="flex flex-col flex-1 items-center justify-center w-full animate-scale-in">
            <p className="text-accent-pink text-2xl font-extrabold mb-2">Jack Attack Over!</p>
            <p className="text-text-muted text-sm mb-6">Here&rsquo;s where everyone stands</p>

            {jackAttackFinalScores.length > 0 && (
              <div className="w-full flex flex-col gap-2">
                {jackAttackFinalScores.map((s, rank) => {
                  const isMe = s.playerId === myPlayer?.id;
                  return (
                    <div
                      key={s.playerId}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                        rank === 0
                          ? 'border-accent-yellow/40 bg-accent-yellow/5'
                          : 'border-border-default bg-bg-card'
                      } ${isMe ? 'ring-1 ring-accent-cyan' : ''}`}
                    >
                      <span className={`text-sm font-bold w-6 ${rank === 0 ? 'text-accent-yellow' : 'text-text-muted'}`}>
                        #{rank + 1}
                      </span>
                      <span className="text-text-primary text-sm font-medium flex-1">
                        {s.name}
                        {isMe && <span className="text-accent-cyan ml-1 text-xs">(you)</span>}
                      </span>
                      <span className={`text-sm font-bold ${s.money >= 0 ? 'text-success' : 'text-error'}`}>
                        ${s.money.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
