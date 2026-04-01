'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSocket } from '@/hooks/useSocket';
import Timer from './Timer';
import HostDialogue from './HostDialogue';

const CHOICE_COLORS = [
  { ring: 'border-accent-cyan', text: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
  { ring: 'border-accent-yellow', text: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
  { ring: 'border-accent-pink', text: 'text-accent-pink', bg: 'bg-accent-pink/10' },
];

const CORRECT_LABELS = ['A', 'B', 'C'];

export default function ThreeWayCard() {
  const gameState = useGameStore((s) => s.gameState);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const questionEndsAt = useGameStore((s) => s.questionEndsAt);
  const myAnswerIndex = useGameStore((s) => s.myAnswerIndex);
  const answeredPlayerIds = useGameStore((s) => s.answeredPlayerIds);
  const correctAnswerIndex = useGameStore((s) => s.correctAnswerIndex);
  const playerResults = useGameStore((s) => s.playerResults);
  const myPlayer = useGameStore((s) => s.myPlayer);
  const room = useGameStore((s) => s.room);
  const questionIndex = useGameStore((s) => s.questionIndex);
  const currentRound = useGameStore((s) => s.currentRound);

  const { submitAnswer } = useSocket();

  // Cycling highlight: index 0, 1, 2, 0, 1, 2...
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isIntro = gameState === 'question_intro';
  const isActive = gameState === 'question_active';
  const isReveal = gameState === 'question_reveal';
  const hasAnswered = myAnswerIndex !== null;

  useEffect(() => {
    if (isActive && !hasAnswered && (currentQuestion?.choices?.length ?? 0) > 0) {
      cycleRef.current = setInterval(() => {
        setHighlightedIndex((i) => (i + 1) % (currentQuestion?.choices?.length ?? 3));
      }, 1800);
      return () => {
        if (cycleRef.current) clearInterval(cycleRef.current);
      };
    } else {
      if (cycleRef.current) {
        clearInterval(cycleRef.current);
        cycleRef.current = null;
      }
    }
  }, [isActive, hasAnswered, currentQuestion]);

  if (!currentQuestion) return null;

  const handleBuzz = () => {
    if (hasAnswered || !isActive) return;
    submitAnswer(currentQuestion.id, highlightedIndex);
  };

  const formatValue = (val: number) => '$' + val.toLocaleString('en-US');
  const displayQuestionNum = questionIndex + 1;

  const getCardClass = (index: number) => {
    if (isReveal) {
      if (index === correctAnswerIndex) return 'answer-card correct';
      if (index === myAnswerIndex && index !== correctAnswerIndex) return 'answer-card wrong';
      return 'answer-card dimmed';
    }
    if (isActive) {
      if (hasAnswered) {
        return index === myAnswerIndex ? 'answer-card selected' : 'answer-card dimmed';
      }
      // Highlight the cycling one
      return index === highlightedIndex ? 'answer-card' : 'answer-card dimmed';
    }
    return 'answer-card dimmed';
  };

  return (
    <main className="flex flex-1 flex-col min-h-screen">
      <div className="flex flex-col flex-1 items-center px-4 py-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-3 w-full">
          <p className="text-text-muted text-xs mb-1 uppercase tracking-wider">
            Round {currentRound} &mdash; Three Way
          </p>
          <p className="text-accent-yellow text-base font-bold">
            Question {displayQuestionNum} &mdash; {formatValue(currentQuestion.value)}
          </p>
        </div>

        {/* Timer */}
        {isActive && questionEndsAt && (
          <div className="w-full mb-4">
            <Timer endsAt={questionEndsAt} totalDuration={currentQuestion.timeLimit} />
          </div>
        )}

        {/* Host dialogue */}
        {(isIntro || isReveal) && <HostDialogue />}

        {/* Prompt */}
        {(isActive || isReveal || isIntro) && currentQuestion.prompt && (
          <div className="w-full mb-5">
            <p className="text-text-primary text-xl sm:text-2xl font-bold leading-snug text-center">
              {currentQuestion.prompt}
            </p>
          </div>
        )}

        {/* Intro: category banner */}
        {isIntro && !currentQuestion.prompt && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center animate-scale-in">
              <p className="text-text-muted text-sm uppercase tracking-wider mb-3">Category</p>
              <p className="text-accent-purple text-3xl sm:text-4xl font-extrabold">
                {currentQuestion.category}
              </p>
            </div>
          </div>
        )}

        {/* Choices — 3 large cards */}
        {(isActive || isReveal) && currentQuestion.choices && (
          <>
            <div className="w-full flex flex-col gap-3 mb-4">
              {currentQuestion.choices.map((choice, index) => {
                const color = CHOICE_COLORS[index] || CHOICE_COLORS[0];
                const cardClass = getCardClass(index);
                return (
                  <div
                    key={index}
                    className={`${cardClass} ${
                      isActive && !hasAnswered && index === highlightedIndex
                        ? `ring-2 ${color.ring} ${color.bg}`
                        : ''
                    }`}
                  >
                    <span className={`text-base font-bold shrink-0 w-7 ${color.text}`}>
                      {CORRECT_LABELS[index]}
                    </span>
                    <span className="text-text-primary text-base sm:text-lg font-medium leading-snug flex-1">
                      {choice}
                    </span>
                    {isReveal && index === correctAnswerIndex && (
                      <span className="text-success text-lg shrink-0">&#10003;</span>
                    )}
                    {isReveal && index === myAnswerIndex && index !== correctAnswerIndex && (
                      <span className="text-error text-lg shrink-0">&#10007;</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Big BUZZ button during active phase */}
            {isActive && !hasAnswered && (
              <button
                onClick={handleBuzz}
                className="w-full py-5 rounded-xl bg-accent-yellow text-bg-primary text-xl font-extrabold uppercase tracking-wider active:scale-95 transition-transform"
              >
                BUZZ!
              </button>
            )}
            {isActive && hasAnswered && (
              <p className="text-accent-cyan text-sm font-bold animate-pulse-glow">
                Buzzed on {currentQuestion.choices[myAnswerIndex]} — locked in!
              </p>
            )}
          </>
        )}

        {/* Who has answered */}
        {isActive && (
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            {room?.players.map((p) => {
              const answered = answeredPlayerIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    answered ? 'bg-accent-cyan/15 text-accent-cyan' : 'bg-bg-card text-text-muted'
                  }`}
                >
                  {p.name} {answered ? '\u2713' : '...'}
                </div>
              );
            })}
          </div>
        )}

        {/* Reveal results */}
        {isReveal && playerResults.length > 0 && (
          <div className="w-full mt-2">
            <p className="text-text-muted text-xs uppercase tracking-wider text-center mb-3">
              Results
            </p>
            <div className="flex flex-col gap-2">
              {playerResults.map((result) => {
                const isMe = result.playerId === myPlayer?.id;
                return (
                  <div
                    key={result.playerId}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                      result.isCorrect ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'
                    } ${isMe ? 'ring-1 ring-accent-cyan' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-base ${result.isCorrect ? 'text-success' : 'text-error'}`}>
                        {result.isCorrect ? '\u2713' : '\u2717'}
                      </span>
                      <span className="text-text-primary text-sm font-medium">
                        {result.name}
                        {isMe && <span className="text-accent-cyan ml-1 text-xs">(you)</span>}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${result.moneyEarned >= 0 ? 'text-success' : 'text-error'}`}>
                      {result.moneyEarned >= 0 ? '+' : ''}{formatValue(result.moneyEarned)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
