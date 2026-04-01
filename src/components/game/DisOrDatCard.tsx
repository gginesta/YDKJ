'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSocket } from '@/hooks/useSocket';
import Timer from './Timer';
import HostDialogue from './HostDialogue';

export default function DisOrDatCard() {
  const gameState = useGameStore((s) => s.gameState);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const questionEndsAt = useGameStore((s) => s.questionEndsAt);
  const answeredPlayerIds = useGameStore((s) => s.answeredPlayerIds);
  const disOrDatMyAnswers = useGameStore((s) => s.disOrDatMyAnswers);
  const disOrDatCorrectAnswers = useGameStore((s) => s.disOrDatCorrectAnswers);
  const setDisOrDatItemAnswer = useGameStore((s) => s.setDisOrDatItemAnswer);
  const playerResults = useGameStore((s) => s.playerResults);
  const myPlayer = useGameStore((s) => s.myPlayer);
  const room = useGameStore((s) => s.room);
  const questionIndex = useGameStore((s) => s.questionIndex);
  const currentRound = useGameStore((s) => s.currentRound);

  const { submitDisOrDat } = useSocket();

  // Which item is currently shown (0-6, advances every 6s)
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const submitted = useRef(false);
  const itemTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isIntro = gameState === 'question_intro';
  const isActive = gameState === 'question_active';
  const isReveal = gameState === 'question_reveal';

  const items = currentQuestion?.items ?? [];
  const totalItems = items.length;
  const ITEM_DURATION_S = 6; // seconds per item

  // Advance items every ITEM_DURATION_S seconds during active phase
  useEffect(() => {
    if (!isActive || totalItems === 0) {
      setCurrentItemIndex(0);
      return;
    }

    setCurrentItemIndex(0);
    submitted.current = false;

    itemTimerRef.current = setInterval(() => {
      setCurrentItemIndex((prev) => {
        const next = prev + 1;
        if (next >= totalItems) {
          if (itemTimerRef.current) clearInterval(itemTimerRef.current);
          return totalItems - 1; // stay on last
        }
        return next;
      });
    }, ITEM_DURATION_S * 1000);

    return () => {
      if (itemTimerRef.current) clearInterval(itemTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, totalItems]);

  // Submit when all items have been seen (or timer runs out — handled by server)
  useEffect(() => {
    if (!isActive || submitted.current) return;
    if (currentItemIndex === totalItems - 1 && totalItems > 0) {
      // Give the player a moment to answer the last item, then auto-submit
      const timeout = setTimeout(() => {
        if (!submitted.current) {
          submitted.current = true;
          const answers = Array.from(
            { length: totalItems },
            (_, i) => disOrDatMyAnswers[i] ?? null
          );
          submitDisOrDat(currentQuestion!.id, answers);
        }
      }, ITEM_DURATION_S * 1000);
      return () => clearTimeout(timeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemIndex, isActive]);

  if (!currentQuestion) return null;

  const handleAnswer = (choice: 'A' | 'B') => {
    if (!isActive) return;
    setDisOrDatItemAnswer(currentItemIndex, choice);
  };

  const formatValue = (val: number) => '$' + val.toLocaleString('en-US');
  const displayQuestionNum = questionIndex + 1;
  const currentItem = items[currentItemIndex];

  // Show answer color for current item (A = cyan, B = yellow)
  const myAnswerForCurrent = disOrDatMyAnswers[currentItemIndex];

  return (
    <main className="flex flex-1 flex-col min-h-screen">
      <div className="flex flex-col flex-1 items-center px-4 py-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-3 w-full">
          <p className="text-text-muted text-xs mb-1 uppercase tracking-wider">
            Round {currentRound} &mdash; Dis or Dat
          </p>
          <p className="text-accent-yellow text-base font-bold">
            Question {displayQuestionNum} &mdash; {formatValue(currentQuestion.value)}
          </p>
        </div>

        {/* Overall timer bar */}
        {isActive && questionEndsAt && (
          <div className="w-full mb-3">
            <Timer endsAt={questionEndsAt} totalDuration={currentQuestion.timeLimit} />
          </div>
        )}

        {/* Host dialogue */}
        {(isIntro || isReveal) && <HostDialogue />}

        {/* Intro: show categories */}
        {isIntro && (
          <div className="flex flex-1 items-center justify-center w-full">
            <div className="text-center animate-scale-in w-full">
              <p className="text-text-muted text-sm uppercase tracking-wider mb-6">
                Sort each item into one of two categories
              </p>
              <div className="flex gap-4 justify-center">
                <div className="flex-1 max-w-[140px] px-4 py-4 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-center">
                  <p className="text-accent-cyan text-xs uppercase tracking-wider mb-1">This</p>
                  <p className="text-text-primary text-lg font-bold leading-snug">
                    {currentQuestion.categoryA}
                  </p>
                </div>
                <div className="flex items-center">
                  <p className="text-text-muted text-2xl font-bold">or</p>
                </div>
                <div className="flex-1 max-w-[140px] px-4 py-4 rounded-xl bg-accent-yellow/10 border border-accent-yellow/30 text-center">
                  <p className="text-accent-yellow text-xs uppercase tracking-wider mb-1">Dat</p>
                  <p className="text-text-primary text-lg font-bold leading-snug">
                    {currentQuestion.categoryB}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active: show current item + A/B buttons */}
        {isActive && currentItem && (
          <>
            {/* Item counter */}
            <div className="flex gap-1.5 mb-4">
              {items.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < currentItemIndex
                      ? disOrDatMyAnswers[i] != null
                        ? 'bg-accent-cyan'
                        : 'bg-bg-secondary'
                      : i === currentItemIndex
                        ? 'bg-accent-yellow'
                        : 'bg-bg-secondary'
                  }`}
                />
              ))}
            </div>

            {/* Category labels */}
            <div className="flex gap-3 w-full mb-3 text-center">
              <p className="flex-1 text-accent-cyan text-sm font-bold uppercase tracking-wide">
                {currentQuestion.categoryA}
              </p>
              <p className="flex-1 text-accent-yellow text-sm font-bold uppercase tracking-wide">
                {currentQuestion.categoryB}
              </p>
            </div>

            {/* Current item */}
            <div className="w-full mb-5 px-6 py-8 rounded-xl bg-bg-card border-2 border-border-default text-center">
              <p className="text-text-primary text-2xl sm:text-3xl font-extrabold">
                {currentItem.text}
              </p>
              {myAnswerForCurrent && (
                <p className={`text-sm font-bold mt-2 ${myAnswerForCurrent === 'A' ? 'text-accent-cyan' : 'text-accent-yellow'}`}>
                  You picked: {myAnswerForCurrent === 'A' ? currentQuestion.categoryA : currentQuestion.categoryB}
                </p>
              )}
            </div>

            {/* A / B tap buttons */}
            <div className="flex gap-3 w-full">
              <button
                onClick={() => handleAnswer('A')}
                className={`flex-1 py-5 rounded-xl font-extrabold text-lg uppercase tracking-wider transition-all active:scale-95 ${
                  myAnswerForCurrent === 'A'
                    ? 'bg-accent-cyan text-bg-primary ring-4 ring-accent-cyan/30'
                    : 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                }`}
              >
                THIS
                <span className="block text-xs font-normal mt-0.5 truncate px-2">
                  {currentQuestion.categoryA}
                </span>
              </button>
              <button
                onClick={() => handleAnswer('B')}
                className={`flex-1 py-5 rounded-xl font-extrabold text-lg uppercase tracking-wider transition-all active:scale-95 ${
                  myAnswerForCurrent === 'B'
                    ? 'bg-accent-yellow text-bg-primary ring-4 ring-accent-yellow/30'
                    : 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30'
                }`}
              >
                DAT
                <span className="block text-xs font-normal mt-0.5 truncate px-2">
                  {currentQuestion.categoryB}
                </span>
              </button>
            </div>

            {/* Who's submitted */}
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {room?.players.map((p) => {
                const done = answeredPlayerIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      done ? 'bg-accent-cyan/15 text-accent-cyan' : 'bg-bg-card text-text-muted'
                    }`}
                  >
                    {p.name} {done ? '\u2713' : '...'}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Reveal: show all items with correct/wrong */}
        {isReveal && disOrDatCorrectAnswers && (
          <div className="w-full mt-2">
            <div className="flex gap-3 w-full mb-4 text-center">
              <p className="flex-1 text-accent-cyan text-sm font-bold uppercase tracking-wide">
                {currentQuestion.categoryA}
              </p>
              <p className="flex-1 text-accent-yellow text-sm font-bold uppercase tracking-wide">
                {currentQuestion.categoryB}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item, i) => {
                const correct = disOrDatCorrectAnswers[i];
                const myAnswer = disOrDatMyAnswers[i];
                const isCorrect = myAnswer === correct;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
                      isCorrect ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'
                    }`}
                  >
                    <span className={`text-sm ${isCorrect ? 'text-success' : 'text-error'}`}>
                      {isCorrect ? '\u2713' : '\u2717'}
                    </span>
                    <span className="text-text-primary text-sm font-medium flex-1 mx-3">
                      {item.text}
                    </span>
                    <span className={`text-xs font-bold ${correct === 'A' ? 'text-accent-cyan' : 'text-accent-yellow'}`}>
                      {correct === 'A' ? currentQuestion.categoryA : currentQuestion.categoryB}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Player results */}
            {playerResults.length > 0 && (
              <div className="mt-4">
                <p className="text-text-muted text-xs uppercase tracking-wider text-center mb-3">
                  Results
                </p>
                <div className="flex flex-col gap-2">
                  {playerResults.map((result) => {
                    const isMe = result.playerId === myPlayer?.id;
                    const r = result as typeof result & { correctItems?: number; totalItems?: number };
                    return (
                      <div
                        key={result.playerId}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                          result.isCorrect ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'
                        } ${isMe ? 'ring-1 ring-accent-cyan' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-text-primary text-sm font-medium">
                            {result.name}
                            {isMe && <span className="text-accent-cyan ml-1 text-xs">(you)</span>}
                          </span>
                          {r.correctItems != null && (
                            <span className="text-text-muted text-xs">
                              {r.correctItems}/{r.totalItems ?? totalItems}
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-bold ${result.moneyEarned >= 0 ? 'text-success' : 'text-error'}`}>
                          +{formatValue(result.moneyEarned)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
