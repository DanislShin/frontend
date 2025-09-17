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
  const [isSubmitting, setIsSubmitting] = useState(false); // 제출 중 상태
  const [submitProgress, setSubmitProgress] = useState(0); // 진행률

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

    // 이미 제출 중이면 중복 제출 방지
    if (isSubmitting) {
      return;
    }

    if (!session || !session.user?.email) {
      console.error("로그인 상태가 아닙니다");
      alert("로그인이 필요합니다. 다시 로그인해 주세요.");
      return;
    }

    // 빈 답안 체크
    const emptyAnswers = answers.filter((answer) => !answer.trim()).length;
    if (emptyAnswers > 0) {
      const confirmed = window.confirm(
        `${emptyAnswers}개의 답안이 비어있습니다. 계속 제출하시겠습니까?`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    setSubmitProgress(0);

    console.log("Submitting with language:", language);

    try {
      const totalQuestions = passage.questions.length;
      let completedRequests = 0;

      const reviewPromises = passage.questions.map((question, index) => {
        const requestBody = {
          user_id: session.user.email,
          module_code: testId,
          sentence: question,
          input: answers[index],
          language,
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
            completedRequests++;
            setSubmitProgress(
              Math.round((completedRequests / totalQuestions) * 100)
            );

            if (data.feedback && data.feedback["종합 평가"])
              return { index, feedback: data.feedback };
            throw new Error("응답 데이터 형식이 올바르지 않습니다.");
          })
          .catch((error) => {
            completedRequests++;
            setSubmitProgress(
              Math.round((completedRequests / totalQuestions) * 100)
            );
            throw { index, error: error.message };
          });
      });

      const results = await Promise.allSettled(reviewPromises);
      const newFeedbacks = [...aiFeedbacks];
      const newScores = [...scores];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const { feedback } = result.value;
          newFeedbacks[index] = feedback;
          newScores[index] = feedback["종합 평가"].스코어;
        } else {
          // 실패한 경우 오류 메시지 설정
          newFeedbacks[index] = "오류가 발생했습니다. 다시 시도해 주세요.";
          newScores[index] = null;
        }
      });

      setAiFeedbacks(newFeedbacks);
      setScores(newScores);

      // 성공/실패 건수 알림
      const successCount = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const failCount = results.filter((r) => r.status === "rejected").length;

      if (failCount > 0) {
        alert(`평가 완료! (성공: ${successCount}개, 실패: ${failCount}개)`);
      } else {
        alert("모든 문항 평가가 완료되었습니다!");
      }
    } catch (error) {
      console.error("API 호출 오류:", error);
      alert("평가 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setAiFeedbacks(
        passage.questions.map(
          () => "오류가 발생했습니다. 서버를 확인해 주세요."
        )
      );
      setScores(passage.questions.map(() => null));
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
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

  const getSubmitButtonText = () => {
    if (isSubmitting) {
      return `평가 중... (${submitProgress}%)`;
    }
    return "모든 문장 GPT 평가 요청";
  };

  const isSubmitDisabled = passage.questions.length === 0 || isSubmitting;

  return (
    <div className="test-container">
      <button onClick={onBack} className="back-button" disabled={isSubmitting}>
        뒤로 가기
      </button>
      <h2>📘 GPT 해석 평가</h2>

      {isSubmitting && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            backgroundColor: "#f0f8ff",
            border: "1px solid #0066cc",
            borderRadius: "5px",
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: "10px" }}>
            <strong>🤖 AI가 답안을 평가하고 있습니다...</strong>
          </div>
          <div
            style={{
              width: "100%",
              height: "20px",
              backgroundColor: "#e0e0e0",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${submitProgress}%`,
                height: "100%",
                backgroundColor: "#4caf50",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
            {submitProgress}% 완료 - 잠시만 기다려주세요
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {passage.questions.length > 0 ? (
          passage.questions.map((question, index) => (
            <div
              key={index}
              style={{
                marginBottom: "20px",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              <p>
                <strong>문제 {index + 1}:</strong> {question}
              </p>
              <textarea
                placeholder={`문제 ${index + 1} 한글 번역 입력`}
                value={answers[index] || ""}
                onChange={(e) => {
                  if (!isSubmitting) {
                    const newAnswers = [...answers];
                    newAnswers[index] = e.target.value;
                    setAnswers(newAnswers);
                  }
                }}
                rows={3}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              />
            </div>
          ))
        ) : (
          <p>지문이 로드되지 않았습니다. 콘솔을 확인하세요.</p>
        )}

        <button
          type="submit"
          disabled={isSubmitDisabled}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: "bold",
            borderRadius: "6px",
            border: "none",
            backgroundColor: isSubmitDisabled ? "#cccccc" : "#007bff",
            color: "white",
            cursor: isSubmitDisabled ? "not-allowed" : "pointer",
            transition: "background-color 0.3s ease",
          }}
        >
          {getSubmitButtonText()}
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
