'use client';

import { useGameStore } from '@/stores/gameStore';
import { useSocket } from '@/hooks/useSocket';
import Timer from './Timer';
import HostDialogue from './HostDialogue';

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function QuestionCard() {
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

  if (!currentQuestion) return null;

  const isIntro = gameState === 'question_intro';
  const isActive = gameState === 'question_active';
  const isReveal = gameState === 'question_reveal';
  const hasAnswered = myAnswerIndex !== null;
  const totalPlayers = room?.players.length ?? 0;
  const answeredCount = answeredPlayerIds.length;

  const handleAnswer = (index: number) => {
    if (hasAnswered || !isActive || !currentQuestion) return;
    submitAnswer(currentQuestion.id, index);
  };

  const formatValue = (val: number) =>
    '$' + val.toLocaleString('en-US');

  // Determine display question number (1-indexed)
  const displayQuestionNum = questionIndex + 1;

  // Get answer button styles based on state
  const getButtonStyle = (index: number) => {
    const base =
      'w-full min-h-[56px] p-4 text-left border-3 transition-all duration-200 flex items-center gap-3';

    if (isReveal) {
      const isCorrect = index === correctAnswerIndex;
      const wasMyPick = index === myAnswerIndex;
      if (isCorrect) {
        return `${base} border-success bg-success/20 shadow-[0_0_15px_var(--color-success)]`;
      }
      if (wasMyPick && !isCorrect) {
        return `${base} border-error bg-error/20 shadow-[0_0_15px_var(--color-error)]`;
      }
      return `${base} border-border-default bg-bg-card opacity-50`;
    }

    if (isActive) {
      if (hasAnswered) {
        const isSelected = index === myAnswerIndex;
        if (isSelected) {
          return `${base} border-neon-cyan bg-neon-cyan/15 shadow-[0_0_10px_var(--color-neon-cyan)]`;
        }
        return `${base} border-border-default bg-bg-card opacity-50 cursor-not-allowed`;
      }
      return `${base} border-border-default bg-bg-card hover:border-neon-cyan hover:bg-neon-cyan/5 active:border-neon-cyan active:bg-neon-cyan/10 cursor-pointer`;
    }

    return `${base} border-border-default bg-bg-card opacity-40`;
  };

  // Find results for reveal phase
  const getResultForPlayer = (playerId: string) =>
    playerResults.find((r) => r.playerId === playerId);

  return (
    <main className="flex flex-1 flex-col min-h-screen">
      {/* Host dialogue at top */}
      {(isIntro || isReveal) && <HostDialogue />}

      <div className="flex flex-col flex-1 items-center px-4 py-6 max-w-lg mx-auto w-full">
        {/* Question header */}
        <div className="text-center mb-4 w-full">
          <p className="text-text-muted text-[8px] mb-1">
            ROUND {currentRound}
          </p>
          <p className="text-neon-yellow text-xs">
            Question {displayQuestionNum} &mdash; {formatValue(currentQuestion.value)}
          </p>
        </div>

        {/* Timer (only during active) */}
        {isActive && questionEndsAt && (
          <div className="w-full mb-4">
            <Timer endsAt={questionEndsAt} totalDuration={currentQuestion.timeLimit} />
          </div>
        )}

        {/* Question prompt */}
        {(isActive || isReveal) && currentQuestion.prompt && (
          <div className="w-full mb-6 p-4 bg-bg-card border-2 border-border-default">
            <p className="text-text-primary text-xs sm:text-sm leading-relaxed text-center">
              {currentQuestion.prompt}
            </p>
          </div>
        )}

        {/* Intro state: show category or just host dialogue */}
        {isIntro && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-text-muted text-[8px] mb-2">CATEGORY</p>
              <p className="text-neon-magenta text-sm sm:text-base text-glow-magenta">
                {currentQuestion.category}
              </p>
            </div>
          </div>
        )}

        {/* Answer buttons (active + reveal) */}
        {(isActive || isReveal) && currentQuestion.choices && (
          <div className="w-full flex flex-col gap-3 mb-6">
            {currentQuestion.choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={hasAnswered || !isActive}
                className={getButtonStyle(index)}
              >
                <span className="text-neon-yellow text-[10px] font-bold shrink-0 w-6">
                  {ANSWER_LABELS[index]}
                </span>
                <span className="text-text-primary text-[10px] sm:text-xs leading-relaxed flex-1">
                  {choice}
                </span>
                {/* Reveal indicators */}
                {isReveal && index === correctAnswerIndex && (
                  <span className="text-success text-sm shrink-0">&#10003;</span>
                )}
                {isReveal && index === myAnswerIndex && index !== correctAnswerIndex && (
                  <span className="text-error text-sm shrink-0">&#10007;</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Answer status during active phase */}
        {isActive && (
          <div className="w-full text-center">
            {hasAnswered ? (
              <p className="text-neon-cyan text-[10px] animate-pulse-glow">
                ANSWER LOCKED IN
              </p>
            ) : (
              <p className="text-text-muted text-[8px]">
                Pick your answer!
              </p>
            )}
            {/* Who has answered indicators */}
            <div className="flex justify-center gap-2 mt-3 flex-wrap">
              {room?.players.map((p) => {
                const answered = answeredPlayerIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`text-[8px] px-2 py-1 border ${
                      answered
                        ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
                        : 'border-border-default text-text-muted'
                    }`}
                  >
                    {p.name} {answered ? '\u2713' : '...'}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reveal: show player results */}
        {isReveal && playerResults.length > 0 && (
          <div className="w-full mt-2">
            <p className="text-text-muted text-[8px] text-center mb-3">RESULTS</p>
            <div className="flex flex-col gap-2">
              {playerResults.map((result) => {
                const isMe = result.playerId === myPlayer?.id;
                return (
                  <div
                    key={result.playerId}
                    className={`flex items-center justify-between p-2 border ${
                      result.isCorrect
                        ? 'border-success/50 bg-success/5'
                        : 'border-error/50 bg-error/5'
                    } ${isMe ? 'ring-1 ring-neon-cyan' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${
                          result.isCorrect ? 'text-success' : 'text-error'
                        }`}
                      >
                        {result.isCorrect ? '\u2713' : '\u2717'}
                      </span>
                      <span className="text-text-primary text-[10px]">
                        {result.name}
                        {isMe && (
                          <span className="text-neon-cyan ml-1">(you)</span>
                        )}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] ${
                        result.moneyEarned >= 0 ? 'text-success' : 'text-error'
                      }`}
                    >
                      {result.moneyEarned >= 0 ? '+' : ''}
                      {formatValue(result.moneyEarned)}
                      {result.speedBonus > 0 && (
                        <span className="text-neon-yellow ml-1">
                          (+{formatValue(result.speedBonus)} speed)
                        </span>
                      )}
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
