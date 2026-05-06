import { useEffect, useMemo, useState } from "react";

interface MoneyFact {
  title: string;
  question: string;
  choices: string[];
  correctIndex: number;
  fact: string;
  tip: string;
}

const MONEY_FACTS: MoneyFact[] = [
  {
    title: "Small leaks add up",
    question: "A recurring 25 ILS monthly charge becomes how much over one year?",
    choices: ["150 ILS", "300 ILS", "600 ILS"],
    correctIndex: 1,
    fact: "Small recurring charges are easy to ignore because each single payment feels low.",
    tip: "After processing finishes, check top merchants for subscriptions you no longer use.",
  },
  {
    title: "Categories reveal habits",
    question: "What is usually faster for spotting spending patterns?",
    choices: ["Reading every row", "Sorting by category", "Only checking the total"],
    correctIndex: 1,
    fact: "Categories turn raw statements into patterns, so the biggest spending areas stand out quickly.",
    tip: "Open the largest category first and inspect the merchants inside it.",
  },
  {
    title: "Timing matters",
    question: "When do many people spend more freely?",
    choices: ["Right after payday", "Only on Mondays", "Only at month end"],
    correctIndex: 0,
    fact: "A fresh account balance can make spending feel safer even before fixed bills arrive.",
    tip: "Compare early-month purchases with late-month purchases in your report.",
  },
  {
    title: "Merchants can hide trends",
    question: "Why can a favorite merchant be hard to notice?",
    choices: ["Amounts are hidden", "It can appear under several names", "Dates are removed"],
    correctIndex: 1,
    fact: "Payment apps, delivery services, and terminals can make the same merchant appear in different ways.",
    tip: "Scan top merchants for similar names before deciding what changed.",
  },
  {
    title: "Budgets work best as ranges",
    question: "Which budget style is usually easier to keep?",
    choices: ["A flexible range", "A random number", "No baseline at all"],
    correctIndex: 0,
    fact: "Flexible ranges handle normal life changes better than one strict number.",
    tip: "Use your previous month as the baseline before setting a new target.",
  },
  {
    title: "Cash flow beats guesses",
    question: "What reduces guessing about where money went?",
    choices: ["Actual transaction history", "Memory only", "Merchant logos"],
    correctIndex: 0,
    fact: "Real transaction history shows the details that memory usually misses.",
    tip: "Use the dashboard totals before making a spending decision.",
  },
];

interface Props {
  compact?: boolean;
}

export function MoneyFactsLoader({ compact = false }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const challenge = MONEY_FACTS[activeIndex];
  const answered = selectedIndex !== null;
  const isCorrect = selectedIndex === challenge.correctIndex;

  const progress = useMemo(
    () => Math.round(((activeIndex + 1) / MONEY_FACTS.length) * 100),
    [activeIndex],
  );

  useEffect(() => {
    const nextTimer = window.setTimeout(() => {
      goToNextChallenge();
    }, answered ? 5200 : 9000);

    return () => {
      window.clearTimeout(nextTimer);
    };
  }, [activeIndex, answered]);

  const moveChallenge = (direction: 1 | -1) => {
    setActiveIndex((current) => (
      current + direction + MONEY_FACTS.length
    ) % MONEY_FACTS.length);
    setSelectedIndex(null);
  };

  const goToNextChallenge = () => {
    moveChallenge(1);
  };

  const chooseAnswer = (choiceIndex: number) => {
    if (answered) return;
    setSelectedIndex(choiceIndex);
    if (choiceIndex === challenge.correctIndex) {
      setScore((current) => current + 10);
      setStreak((current) => current + 1);
    } else {
      setStreak(0);
    }
  };

  return (
    <section className={`money-facts ${compact ? "compact" : ""}`} aria-live="polite">
      <div className="money-facts-header">
        <div>
          <div className="money-facts-kicker">Money Challenge</div>
          <h3>{challenge.title}</h3>
        </div>
        <div className="money-facts-score" aria-label="Money game score">
          <span>{score}</span>
          <small>points</small>
        </div>
      </div>

      <div className="money-facts-game">
        <div className="money-facts-orbit" aria-hidden="true">
          <span className="money-coin coin-one">ILS</span>
          <span className="money-coin coin-two">%</span>
          <span className="money-coin coin-three">+</span>
          <div className="money-loader-ring" />
        </div>

        <div className="money-facts-play">
          <div className="money-facts-meta">
            <span>Question {activeIndex + 1}/{MONEY_FACTS.length}</span>
            <span>{streak > 0 ? `${streak} correct streak` : "Build a streak"}</span>
          </div>

          <p className="money-facts-question">{challenge.question}</p>

          <div className="money-facts-choices" role="group" aria-label="Money challenge answers">
            {challenge.choices.map((choice, index) => {
              const isSelected = selectedIndex === index;
              const isAnswer = challenge.correctIndex === index;
              const resultClass = answered
                ? isAnswer
                  ? "correct"
                  : isSelected
                    ? "wrong"
                    : ""
                : "";

              return (
                <button
                  key={choice}
                  type="button"
                  className={`money-choice ${resultClass}`}
                  onClick={() => chooseAnswer(index)}
                  disabled={answered}
                  aria-pressed={isSelected}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {choice}
                </button>
              );
            })}
          </div>

          <div className={`money-facts-result ${answered ? "shown" : ""}`}>
            {answered ? (
              <>
                <strong>{isCorrect ? "Correct. +10 points" : "Not quite. Good to know."}</strong>
                <span>{challenge.fact}</span>
                <em>{challenge.tip}</em>
              </>
            ) : (
              <>
                <strong>Pick an answer while the report is processing.</strong>
                <span>Spendo will move to the next challenge automatically.</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="money-facts-footer">
        <div className="money-facts-controls" aria-label="Money challenge controls">
          <button type="button" onClick={() => moveChallenge(-1)} aria-label="Previous money challenge">
            {"<"}
          </button>
          <button type="button" onClick={goToNextChallenge} aria-label="Next money challenge">
            {">"}
          </button>
        </div>

        <div className="money-facts-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}
