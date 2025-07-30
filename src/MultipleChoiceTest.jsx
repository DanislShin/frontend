import React, { useState, useEffect } from "react";

function MultipleChoiceTest({ module, testId, day, onBack, session }) {
  // session prop 추가
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const jsonFilePath = `/data/${module}-${testId}-questions.json`;
    fetch(jsonFilePath)
      .then((response) => {
        if (!response.ok) throw new Error("파일을 찾을 수 없습니다.");
        return response.json();
      })
      .then((data) => {
        setQuestions(data[day] || []);
      })
      .catch((error) =>
        console.error(`데이터 로드 오류 (${jsonFilePath}):`, error)
      );
  }, [day, module, testId]);

  const handleAnswerChange = (qId, value) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session) {
      alert("로그인이 필요합니다. 먼저 로그인해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const newResults = questions.map((q) => {
        const userAnswerIndex = parseInt(answers[q.id]);
        const correctIndex = q.correct;
        const userAnswer = q.options[userAnswerIndex];
        const correctAnswer = q.options[correctIndex];
        const isCorrect = userAnswerIndex === correctIndex;
        return {
          question: q.question,
          userAnswer,
          correctAnswer,
          score: isCorrect ? 100 / questions.length : 0,
          feedback: isCorrect ? "정답!" : `오답 (정답: ${correctAnswer})`,
        };
      });

      const totalScore = newResults.reduce((sum, r) => sum + r.score, 0);
      setResults(newResults);

      const response = await fetch(
        "https://backend-lurm.onrender.com/api/save-result",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: session.user.email, // session 사용
            module_code: `${testId}-${day}`,
            results: newResults.map((r, index) => ({
              question_text: `${questions[index].word}: ${r.question}`,
              user_answer: r.userAnswer,
              score: r.score,
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const saveResult = await response.json();
      console.log("저장 결과:", saveResult);
    } catch (error) {
      console.error("결과 저장 중 오류:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="test-container">
      <button onClick={onBack} className="back-button">
        뒤로 가기
      </button>
      <h1>EBS 필수 영단어 {testId} 뜻맞추기 퀴즈</h1>
      <h4>
        {day}일차 - {questions.length}개 문제
      </h4>

      {questions.length === 0 ? (
        <p>문제를 로딩 중입니다...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {questions.map((q) => (
            <div key={q.id} className="question">
              <p>
                {q.word}: {q.question}
              </p>
              {q.options.map((option, index) => (
                <div key={index}>
                  <input
                    type="radio"
                    id={`${q.id}-${index}`}
                    name={q.id}
                    value={index}
                    onChange={() => handleAnswerChange(q.id, index)}
                    required
                  />
                  <label htmlFor={`${q.id}-${index}`}>{option}</label>
                </div>
              ))}
            </div>
          ))}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "제출 중..." : "제출"}
          </button>
        </form>
      )}

      {results && (
        <div className="result">
          <h2>채점 결과</h2>
          <p>
            총점: {Math.round(results.reduce((sum, r) => sum + r.score, 0))}/100
          </p>
          {results.map((r, index) => (
            <p key={index}>
              {r.question}: {r.feedback} (점수: {Math.round(r.score)}/100)
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default MultipleChoiceTest;
