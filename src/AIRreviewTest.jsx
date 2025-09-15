import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function AIRreviewTest({ module, testId, day, onBack, session, language }) {
  const [passage, setPassage] = useState({ text: "", questions: [] });
  const [answers, setAnswers] = useState([]);
  const [aiFeedbacks, setAiFeedbacks] = useState([]);
  const [scores, setScores] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("Query params:", { module, testId, day, language });
        const { data, error } = await supabase
          .from("test_content")
          .select("content")
          .eq("language", language)
          .eq("module_id", module)
          .eq("test_id", testId)
          .eq("mode", "review")
          .single();
        if (error) throw new Error(`지문 데이터 조회 실패: ${error.message}`);
        const dayData = data.content[day] || [];
        const questions = dayData.map((item) => item.question_text);
        setPassage({
          text: questions.join(" "),
          questions,
        });
        setAnswers(new Array(questions.length).fill(""));
        setAiFeedbacks(new Array(questions.length).fill(""));
        setScores(new Array(questions.length).fill(null));
      } catch (err) {
        console.error("지문 로드 오류:", err);
        setPassage({ text: "", questions: [] });
        setAnswers([]);
        setAiFeedbacks([]);
        setScores([]);
      }
    };
    loadData();
  }, [module, testId, day, language]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session || !session.user?.email) {
      console.error("로그인 상태가 아닙니다");
      alert("로그인이 필요합니다. 다시 로그인해 주세요.");
      return;
    }

    console.log("Submitting with language:", language);
    const reviewPromises = passage.questions.map((question, index) => {
      const requestBody = {
        user_id: session.user.email,
        module_code: testId,
        sentence: question,
        input: answers[index],
        language, // language 추가
      };
      console.log("Request body:", requestBody);
      return fetch("https://backend-lurm.onrender.com/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP 오류: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.feedback && data.feedback["종합 평가"])
            return { index, feedback: data.feedback };
          throw new Error("응답 데이터 형식이 올바르지 않습니다.");
        });
    });

    try {
      const results = await Promise.all(reviewPromises);
      const newFeedbacks = [...aiFeedbacks];
      const newScores = [...scores];

      results.forEach(({ index, feedback }) => {
        newFeedbacks[index] = feedback;
        newScores[index] = feedback["종합 평가"].스코어;
      });

      setAiFeedbacks(newFeedbacks);
      setScores(newScores);
    } catch (error) {
      console.error("API 호출 오류:", error);
      setAiFeedbacks(
        passage.questions.map(
          () => "오류가 발생했습니다. 서버를 확인해 주세요."
        )
      );
      setScores(passage.questions.map(() => null));
    }
  };

  const isValidFeedback = (feedback) => {
    return (
      feedback &&
      typeof feedback === "object" &&
      feedback["종합 평가"] &&
      typeof feedback["종합 평가"].스코어 === "number" &&
      feedback["종합 평가"].피드백
    );
  };

  return (
    <div className="test-container">
      <button onClick={onBack} className="back-button">
        뒤로 가기
      </button>
      <h2>📘 GPT 해석 평가</h2>

      <form onSubmit={handleSubmit}>
        {passage.questions.length > 0 ? (
          passage.questions.map((question, index) => (
            <div key={index}>
              <p>
                <strong>문제 {index + 1}:</strong> {question}
              </p>
              <textarea
                placeholder={`문제 ${index + 1} 한글 번역 입력`}
                value={answers[index] || ""}
                onChange={(e) => {
                  const newAnswers = [...answers];
                  newAnswers[index] = e.target.value;
                  setAnswers(newAnswers);
                }}
                rows={3}
              />
            </div>
          ))
        ) : (
          <p>지문이 로드되지 않았습니다. 콘솔을 확인하세요.</p>
        )}
        <button type="submit" disabled={passage.questions.length === 0}>
          모든 문장 GPT 평가 요청
        </button>
      </form>

      {aiFeedbacks.some((f) => f) && (
        <div>
          <h4>🧠 AI 피드백</h4>
          {passage.questions.map((_, index) => {
            const feedback = aiFeedbacks[index];
            if (!isValidFeedback(feedback)) {
              return (
                <div key={index}>
                  <h5>문제 {index + 1} 피드백</h5>
                  <p>피드백을 불러오는 데 실패했습니다.</p>
                </div>
              );
            }

            return (
              <div
                key={index}
                style={{
                  marginBottom: "20px",
                  border: "1px solid #ddd",
                  padding: "10px",
                  borderRadius: "5px",
                }}
              >
                <h5>문제 {index + 1} 피드백</h5>
                <div
                  style={{
                    marginBottom: "10px",
                    backgroundColor: "#f5f5f5",
                    padding: "8px",
                  }}
                >
                  <strong>
                    ⭐ 종합 평가 ({feedback["종합 평가"].스코어 || 0}/100):
                  </strong>
                  <p>{feedback["종합 평가"].피드백 || "피드백 없음"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AIRreviewTest;
