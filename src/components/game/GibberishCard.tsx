'use client';

import { useGameStore } from '@/stores/gameStore';
import { useSocket } from '@/hooks/useSocket';
import Timer from './Timer';
import HostDialogue from './HostDialogue';

const ANSWER_LABELS = ['1', '2', '3', '4'];
const ANSWER_COLORS = ['text-accent-cyan', 'text-accent-yellow', 'text-accent-pink', 'text-accent-green'];

export default function GibberishCard() {
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

  const handleAnswer = (index: number) => {
    if (hasAnswered || !isActive) return;
    submitAnswer(currentQuestion.id, index);
  };

  const formatValue = (val: number) => '$' + val.toLocaleString('en-US');
  const displayQuestionNum = questionIndex + 1;

  const getCardClass = (index: number) => {
    if (isReveal) {
      const isCorrect = index === correctAnswerIndex;
      const wasMyPick = index === myAnswerIndex;
      if (isCorrect) return 'answer-card correct';
      if (wasMyPick && !isCorrect) return 'answer-card wrong';
      return 'answer-card dimmed';
    }
    if (isActive) {
      if (hasAnswered) {
        return index === myAnswerIndex ? 'answer-card selected' : 'answer-card dimmed';
      }
      return 'answer-card';
    }
    return 'answer-card dimmed';
  };

  return (
    <main className="flex flex-1 flex-col min-h-screen">
      <div className="flex flex-col flex-1 items-center px-4 py-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-3 w-full">
          <p className="text-text-muted text-xs mb-1 uppercase tracking-wider">
            Round {currentRound} &mdash; Gibberish
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

        {/* Host dialogue during intro/reveal */}
        {(isIntro || isReveal) && <HostDialogue />}

        {/* The gibberish phrase — prominent during intro and active */}
        {(isIntro || isActive || isReveal) && currentQuestion.gibberishPhrase && (
          <div className="w-full mb-5 px-4 py-5 rounded-xl bg-bg-card border-2 border-accent-purple/40 text-center">
            <p className="text-text-muted text-xs uppercase tracking-widest mb-2">
              Say it out loud...
            </p>
            <p className="text-accent-purple text-2xl sm:text-3xl font-extrabold leading-snug tracking-wide">
              &ldquo;{currentQuestion.gibberishPhrase}&rdquo;
            </p>
          </div>
        )}

        {/* Intro: just show the gibberish phrase — no choices yet */}
        {isIntro && (
          <p className="text-text-muted text-sm text-center mt-2">
            What phrase does this sound like?
          </p>
        )}

        {/* Active/Reveal: show choices */}
        {(isActive || isReveal) && currentQuestion.choices && (
          <div className="w-full flex flex-col gap-3 mb-6">
            {currentQuestion.choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={hasAnswered || !isActive}
                className={getCardClass(index)}
              >
                <span className={`text-base font-bold shrink-0 w-7 ${ANSWER_COLORS[index] || 'text-accent-cyan'}`}>
                  {ANSWER_LABELS[index]}
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
              </button>
            ))}
          </div>
        )}

        {/* Answer status */}
        {isActive && (
          <div className="w-full text-center">
            {hasAnswered ? (
              <p className="text-accent-cyan text-sm font-bold animate-pulse-glow">
                Answer Locked In
              </p>
            ) : (
              <p className="text-text-muted text-sm">Pick the real phrase!</p>
            )}
            <div className="flex justify-center gap-2 mt-3 flex-wrap">
              {room?.players.map((p) => {
                const answered = answeredPlayerIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      answered
                        ? 'bg-accent-cyan/15 text-accent-cyan'
                        : 'bg-bg-card text-text-muted'
                    }`}
                  >
                    {p.name} {answered ? '\u2713' : '...'}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reveal: player results */}
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
                      result.isCorrect
                        ? 'border-success/30 bg-success/5'
                        : 'border-error/30 bg-error/5'
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
