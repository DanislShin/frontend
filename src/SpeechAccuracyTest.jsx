// src/SpeechAccuracyTest.jsx
import React, { useState, useEffect, useRef } from "react";

function SpeechAccuracyTest({ module, testId, day, onBack }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const recognitionRef = useRef(null);

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

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [day, module, testId]);

  const testAccuracy = (questionId) => async () => {
    const recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setAnswers((prev) => ({ ...prev, [questionId]: transcript }));
    };

    recognition.onerror = (event) => {
      console.error("음성 인식 오류:", event.error);
    };

    recognition.start();
  };

  const levenshteinDistance = (s, t) => {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= s.length; i++) {
      arr[i] = [i];
      for (let j = 1; j <= t.length; j++) {
        arr[i][j] =
          i === 0
            ? j
            : Math.min(
                arr[i - 1][j] + 1,
                arr[i][j - 1] + 1,
                arr[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1)
              );
      }
    }
    return arr[s.length][t.length];
  };

  const cleanText = (text) => {
    return text.replace(/[.,!?]/g, "").trim(); // 특수문자 제거
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newResults = questions.map((q) => {
      const userAnswer = answers[q.id] || "";
      const cleanUserAnswer = cleanText(userAnswer);
      const cleanCorrectText = cleanText(q.correct_text);
      const distance = levenshteinDistance(
        cleanUserAnswer.toLowerCase(),
        cleanCorrectText.toLowerCase()
      );
      const maxLength = Math.max(
        cleanUserAnswer.length,
        cleanCorrectText.length
      );
      const score =
        maxLength > 0 ? Math.max(0, 100 - (distance / maxLength) * 100) : 0;
      return {
        question_text: q.question_text,
        user_answer: userAnswer,
        score: score,
      };
    });
    setResults(newResults);

    try {
      const response = await fetch(
        "https://english-review-backend.onrender.com/api/save-result",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: "test-user",
            module_code: `${testId}-${day}`,
            results: newResults,
          }),
        }
      );
      if (!response.ok)
        throw new Error("서버 응답 오류: " + response.statusText);
      const data = await response.json();
      console.log("Supabase 저장 성공:", data);
    } catch (error) {
      console.error("Supabase 저장 실패:", error);
    }
  };

  return (
    <div className="test-container">
      <button onClick={onBack} className="back-button">
        뒤로 가기
      </button>
      <h1>발음 정확도 테스트</h1>
      <p>⚠️ 마이크 접근 권한이 필요합니다</p>
      <ol>
        <li>아래 버튼을 클릭하면 권한 요청이 표시됩니다</li>
        <li>"허용"을 선택해주세요</li>
        <li>한 번 허용하면 다음부터는 자동으로 인식됩니다</li>
      </ol>
      {questions.map((q) => (
        <div key={q.id} className="question">
          <p>{q.question_text}</p>
          <button onClick={testAccuracy(q.id)}>정확도 테스트</button>
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <button type="submit">제출</button>
      </form>
      {results && (
        <div className="result">
          <h2>채점 결과</h2>
          {results.map((r, index) => (
            <p key={index}>
              {r.question_text}: 점수 {r.score.toFixed(2)}%
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default SpeechAccuracyTest;
