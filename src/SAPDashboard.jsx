import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Menu,
  Search,
  Bell,
  Settings,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

const SAPDashboard = ({ reportData, profileData, onBack, language = "en" }) => {
  const [selectedModule, setSelectedModule] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState("30days");
  const [selectedView, setSelectedView] = useState("overview");

  const processReportData = () => {
    if (!reportData || !reportData.progress || !reportData.results) {
      console.warn("리포트 데이터가 비어 있거나 정의되지 않음");
      return {
        kpiData: {
          totalTests: { value: "0", goal: "100", status: "neutral" },
          completedTests: { value: "0", goal: "80", status: "neutral" },
          averageScore: { value: "0%", goal: "85%", status: "neutral" },
          studyDays: { value: "0", goal: "30", status: "neutral" },
          improvement: { value: "0%", goal: "10%", status: "neutral" },
        },
        moduleDistribution: [],
        scoreByModule: [],
        progressOverTime: [],
        topMissedQuestions: [],
      };
    }

    // KPI 계산
    const totalTests = reportData.results.length;
    const completedTests = reportData.progress.filter(
      (p) => p.completed
    ).length;
    const validFeedback = reportData.results
      .map((r) => {
        let feedbackValue;
        try {
          feedbackValue = JSON.parse(r.ai_feedback).score;
        } catch (e) {
          feedbackValue = 0;
        }
        return isNaN(feedbackValue) ? null : feedbackValue;
      })
      .filter((value) => value !== null);
    const averageScore =
      validFeedback.length > 0
        ? (
            validFeedback.reduce((sum, v) => sum + v, 0) / validFeedback.length
          ).toFixed(1)
        : 0;

    const uniqueDays = new Set(
      reportData.progress
        .filter((p) => p.completed_at)
        .map((p) => new Date(p.completed_at).toDateString())
    ).size;

    // 모듈 분포
    const moduleCount = reportData.progress.reduce((acc, p) => {
      const module = p.module_code.split("-")[0];
      const moduleName =
        {
          100: "발음",
          200: "문법",
          300: "단어",
          400: "시험",
          700: "읽기",
        }[module] || `모듈 ${module}`;
      acc[moduleName] = (acc[moduleName] || 0) + 1;
      return acc;
    }, {});

    const moduleDistribution = Object.entries(moduleCount).map(
      ([name, value], index) => ({
        name,
        value,
        percentage:
          completedTests > 0 ? ((value / completedTests) * 100).toFixed(1) : 0,
        color: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF"][
          index % 5
        ],
      })
    );

    // 모듈별 점수
    const moduleFeedback = reportData.results.reduce((acc, r) => {
      let feedbackValue;
      try {
        feedbackValue = JSON.parse(r.ai_feedback).score;
      } catch (e) {
        feedbackValue = 0;
      }
      if (isNaN(feedbackValue)) return acc;
      const module = r.module_code.split("-")[0];
      const moduleName =
        {
          100: "발음",
          200: "문법",
          300: "단어",
          400: "시험",
          700: "읽기",
        }[module] || `모듈 ${module}`;
      if (!acc[moduleName]) acc[moduleName] = { total: 0, count: 0 };
      acc[moduleName].total += feedbackValue;
      acc[moduleName].count += 1;
      return acc;
    }, {});

    const scoreByModule = Object.entries(moduleFeedback).map(
      ([name, data]) => ({
        module: name,
        score: data.count > 0 ? (data.total / data.count).toFixed(1) : 0,
      })
    );

    // 시간별 진행 상황
    const progressOverTime = reportData.results
      .filter((r) => {
        let feedbackValue;
        try {
          feedbackValue = JSON.parse(r.ai_feedback).score;
        } catch (e) {
          feedbackValue = 0;
        }
        return !isNaN(feedbackValue);
      })
      .map((r) => {
        let feedbackValue;
        try {
          feedbackValue = JSON.parse(r.ai_feedback).score;
        } catch (e) {
          feedbackValue = 0;
        }
        return {
          date: new Date(r.timestamp).toLocaleDateString(),
          score: feedbackValue,
          timestamp: new Date(r.timestamp),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-30);

    // 많이 틀린 문제
    const questionStats = reportData.results.reduce((acc, r) => {
      let feedbackValue;
      try {
        feedbackValue = JSON.parse(r.ai_feedback).score;
      } catch (e) {
        feedbackValue = 0;
      }
      if (isNaN(feedbackValue)) return acc;
      const question = r.question_text || "Unknown";
      if (!acc[question]) acc[question] = { correct: 0, total: 0 };
      acc[question].total += 1;
      if (feedbackValue > 0) acc[question].correct += 1;
      return acc;
    }, {});

    const topMissedQuestions = Object.entries(questionStats)
      .map(([question, stats]) => ({
        question:
          question.length > 30 ? question.substring(0, 30) + "..." : question,
        missRate:
          stats.total > 0
            ? (((stats.total - stats.correct) / stats.total) * 100).toFixed(1)
            : 0,
        total: stats.total,
      }))
      .sort((a, b) => b.missRate - a.missRate)
      .slice(0, 10);

    return {
      kpiData: {
        totalTests: {
          value: totalTests.toString(),
          goal: "100",
          status: totalTests >= 50 ? "positive" : "neutral",
        },
        completedTests: {
          value: completedTests.toString(),
          goal: "80",
          status: completedTests >= 40 ? "positive" : "neutral",
        },
        averageScore: {
          value: `${averageScore}%`,
          goal: "85%",
          status:
            averageScore >= 85
              ? "positive"
              : averageScore >= 70
              ? "warning"
              : "negative",
        },
        studyDays: {
          value: uniqueDays.toString(),
          goal: "30",
          status: uniqueDays >= 20 ? "positive" : "neutral",
        },
        improvement: {
          value:
            progressOverTime.length >= 2
              ? `${(
                  ((progressOverTime[progressOverTime.length - 1].score -
                    progressOverTime[0].score) /
                    progressOverTime[0].score) *
                  100
                ).toFixed(1)}%`
              : "0%",
          goal: "10%",
          status: "neutral",
        },
      },
      moduleDistribution,
      scoreByModule,
      progressOverTime,
      topMissedQuestions,
    };
  };

  const {
    kpiData,
    moduleDistribution,
    scoreByModule,
    progressOverTime,
    topMissedQuestions,
  } = processReportData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Menu className="w-5 h-5 text-gray-600" />
              <span className="text-lg font-semibold text-gray-900">
                베스티온 폴리로그
              </span>
              <span className="text-gray-500">|</span>
              <span className="text-blue-600 font-medium">
                학습 분석 대시보드
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Search className="w-5 h-5 text-gray-600 cursor-pointer" />
            <RefreshCw className="w-5 h-5 text-gray-600 cursor-pointer" />
            <Bell className="w-5 h-5 text-gray-600 cursor-pointer" />
            <Settings className="w-5 h-5 text-gray-600 cursor-pointer" />
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">돌아가기</span>
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {profileData?.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 내비게이션 탭 */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8">
          <button
            className={`py-4 px-1 border-b-2 font-medium ${
              selectedView === "overview"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setSelectedView("overview")}
          >
            학습 개요
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium ${
              selectedView === "progress"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setSelectedView("progress")}
          >
            진도 분석
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium ${
              selectedView === "performance"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setSelectedView("performance")}
          >
            성과 분석
          </button>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="px-6 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            학습 분석 대시보드
          </h1>
          <div className="text-sm text-gray-500">
            마지막 업데이트: {new Date().toLocaleString("ko-KR")}
          </div>
        </div>

        {/* 사용자 정보 */}
        {profileData && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-semibold">
                  {profileData.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {profileData.first_name} {profileData.last_name}
                </h3>
                <p className="text-gray-600">{profileData.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="flex space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">
              모듈 선택
            </label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              <option value="All">전체</option>
              <option value="100">발음</option>
              <option value="200">문법</option>
              <option value="300">단어</option>
              <option value="400">시험</option>
              <option value="700">읽기</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">
              기간 선택
            </label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="7days">최근 7일</option>
              <option value="30days">최근 30일</option>
              <option value="90days">최근 90일</option>
              <option value="all">전체 기간</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">언어</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              value={language}
              onChange={() => {}}
            >
              <option value="en">영어</option>
              <option value="ja">일본어</option>
            </select>
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            핵심 학습 지표
          </h2>
          <div className="grid grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  총 테스트 수
                </h3>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {kpiData.totalTests.value}
                </div>
                <div className="text-xs text-gray-500">
                  목표: {kpiData.totalTests.goal}
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  완료된 테스트
                </h3>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {kpiData.completedTests.value}
                </div>
                <div className="text-xs text-gray-500">
                  목표: {kpiData.completedTests.goal}
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  평균 점수
                </h3>
                <div
                  className={`text-3xl font-bold mb-2 ${
                    kpiData.averageScore.status === "positive"
                      ? "text-green-600"
                      : kpiData.averageScore.status === "warning"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {kpiData.averageScore.value}
                </div>
                <div className="text-xs text-gray-500">
                  목표: {kpiData.averageScore.goal}
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  학습 일수
                </h3>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {kpiData.studyDays.value}
                </div>
                <div className="text-xs text-gray-500">
                  목표: {kpiData.studyDays.goal}일
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  성과 향상률
                </h3>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {kpiData.improvement.value}
                </div>
                <div className="text-xs text-gray-500">
                  목표: {kpiData.improvement.goal}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 차트 그리드 */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* 모듈 분포 */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              모듈별 학습 분포
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={moduleDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {moduleDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {moduleDistribution.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span>{item.name}</span>
                  </div>
                  <span className="text-gray-600">
                    {item.value} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 모듈별 점수 */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              모듈별 평균 점수
            </h3>
            {scoreByModule.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreByModule}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="module" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="score" fill="#5899DA" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500">데이터가 부족합니다.</p>
            )}
          </div>
        </div>

        {/* 하단 차트 그리드 */}
        <div className="grid grid-cols-3 gap-6">
          {/* 시간별 점수 추이 */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              시간별 점수 추이
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#5899DA"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 많이 틀린 문제 */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              가장 많이 틀린 문제
            </h3>
            <div className="h-48 overflow-y-auto">
              <div className="space-y-3">
                {topMissedQuestions.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-900 truncate">
                        {item.question}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${Math.min(item.missRate, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="ml-4 text-sm font-medium text-red-600">
                      {item.missRate}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 최근 활동 */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              최근 활동
            </h3>
            <div className="h-48 overflow-y-auto">
              <div className="space-y-3">
                {reportData && reportData.results ? (
                  reportData.results.slice(0, 10).map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {result.module_code.split("-")[0]} 모듈
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(result.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-medium px-2 py-1 rounded ${
                          result.ai_feedback &&
                          parseFloat(result.ai_feedback) >= 80
                            ? "bg-green-100 text-green-800"
                            : result.ai_feedback &&
                              parseFloat(result.ai_feedback) >= 60
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {result.ai_feedback || "N/A"}점
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">
                    활동 데이터가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SAPDashboard;
