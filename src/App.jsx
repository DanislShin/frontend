import React, { useState, useEffect } from "react";
import "./App.css";
import { createClient } from "@supabase/supabase-js";
import MultipleChoiceTest from "./MultipleChoiceTest";
import SpeechAccuracyTest from "./SpeechAccuracyTest";
import SubjectiveTest from "./SubjectiveTest";
import AIRreviewTest from "./AIRreviewTest";
import ListeningComprehensionTest from "./ListeningComprehensionTest";
import WritingAccuracyTest from "./WritingAccuracyTest";
import LearningMode from "./LearningMode";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ChevronDown,
  Menu,
  Search,
  Bell,
  Settings,
  User,
  Filter,
  Download,
  RefreshCw,
  ArrowLeft,
  X,
} from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// SAP Dashboard Component
const SAPDashboard = ({ reportData, profileData, onBack, language = "en" }) => {
  const [selectedModule, setSelectedModule] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState("30days");
  const [selectedView, setSelectedView] = useState("overview");

  const processReportData = () => {
    if (!reportData || !reportData.progress || !reportData.results) {
      console.warn("Report data is empty or undefined");
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

    // Calculate KPIs
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
          feedbackValue = 0; // 파싱 실패 시 0으로 처리
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

    // Module distribution
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

    // Score by module (ai_feedback 사용)
    const moduleFeedback = reportData.results.reduce((acc, r) => {
      let feedbackValue;
      try {
        feedbackValue = JSON.parse(r.ai_feedback).score;
      } catch (e) {
        feedbackValue = 0; // 파싱 실패 시 0으로 처리
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

    // Progress over time
    const progressOverTime = reportData.results
      .filter((r) => {
        let feedbackValue;
        try {
          feedbackValue = JSON.parse(r.ai_feedback).score;
        } catch (e) {
          feedbackValue = 0; // 파싱 실패 시 0으로 처리
        }
        return !isNaN(feedbackValue);
      })
      .map((r) => {
        let feedbackValue;
        try {
          feedbackValue = JSON.parse(r.ai_feedback).score;
        } catch (e) {
          feedbackValue = 0; // 파싱 실패 시 0으로 처리
        }
        return {
          date: new Date(r.timestamp).toLocaleDateString(),
          score: feedbackValue,
          timestamp: new Date(r.timestamp),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-30);

    // Top missed questions
    const questionStats = reportData.results.reduce((acc, r) => {
      let feedbackValue;
      try {
        feedbackValue = JSON.parse(r.ai_feedback).score;
      } catch (e) {
        feedbackValue = 0; // 파싱 실패 시 0으로 처리
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
      {/* Header */}
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

      {/* Navigation Tabs */}
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

      {/* Main Content */}
      <main className="px-6 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            학습 분석 대시보드
          </h1>
          <div className="text-sm text-gray-500">
            마지막 업데이트: {new Date().toLocaleString("ko-KR")}
          </div>
        </div>

        {/* User Info */}
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

        {/* Filters */}
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
              onChange={() => {}} // Read-only for now
            >
              <option value="en">영어</option>
              <option value="ja">일본어</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
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

        {/* Charts Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Module Distribution */}
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

          {/* Score by Module */}
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

        {/* Bottom Charts Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Progress Over Time */}
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

          {/* Top Missed Questions */}
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

          {/* Recent Activity */}
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

// Main App Component - 모바일 메뉴 기능 추가
function App() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [tests, setTests] = useState({});
  const [availableDays, setAvailableDays] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // 모바일 메뉴 상태 추가
  const [maps, setMaps] = useState({
    topicMaps: {},
    typeMap: {},
    difficultyMap: {},
  });
  const [session, setSession] = useState(null);
  const [learnMode, setLearnMode] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [language, setLanguage] = useState("en");
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [reportData, setReportData] = useState({ progress: [], results: [] });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Initial session:", session);
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed, session:", session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    let inactivityTimer;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        supabase.auth.signOut();
        alert("30분 간 활동이 없어 로그아웃됩니다.");
      }, 1800000);
    };

    const events = ["mousemove", "keydown", "click"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [session]);

  const loadLearnData = async () => {
    try {
      setLoadError(null);
      console.log(`Fetching learn data for language=${language}, mode=learn`);
      const { data, error } = await supabase
        .from("modules")
        .select("module_id, tests")
        .eq("language", language)
        .eq("mode", "learn");
      if (error) {
        console.error("Supabase error (learn):", error);
        throw new Error(`학습 모듈 조회 실패: ${error.message}`);
      }
      console.log("Learn data:", data);
      const updatedTests = {};
      data.forEach(({ module_id, tests }) => {
        updatedTests[module_id] = tests.filter((test) => test.id);
      });
      setTests(updatedTests);
      setAvailableDays({});
    } catch (error) {
      console.error("학습 데이터 로드 실패:", error);
      setLoadError("학습 데이터 로드 실패");
      setTests({});
      setAvailableDays({});
    }
  };

  const loadReviewData = async () => {
    try {
      setLoadError(null);
      console.log(
        `Fetching review data for language=${language}, user=${session.user.email}`
      );
      const [modulesResponse, mappingsResponse, completedResponse] =
        await Promise.all([
          supabase
            .from("modules")
            .select("module_id, tests")
            .eq("language", language)
            .eq("mode", "review"),
          supabase
            .from("mappings")
            .select("type, key, value")
            .eq("language", language),
          supabase
            .from("learning_progress")
            .select("module_code")
            .eq("user_id", session.user.email)
            .eq("completed", true)
            .eq("language", language),
        ]);

      if (modulesResponse.error) {
        console.error("Modules query error:", modulesResponse.error);
        throw new Error(`Modules 조회 실패: ${modulesResponse.error.message}`);
      }
      if (mappingsResponse.error) {
        console.error("Mappings query error:", mappingsResponse.error);
        throw new Error(
          `Mappings 조회 실패: ${mappingsResponse.error.message}`
        );
      }
      if (completedResponse.error) {
        console.error(
          "Learning_progress query error:",
          completedResponse.error
        );
        throw new Error(
          `Learning_progress 조회 실패: ${completedResponse.error.message}`
        );
      }

      console.log("Modules data:", modulesResponse.data);
      console.log("Mappings data:", mappingsResponse.data);
      console.log("Completed data:", completedResponse.data);

      const topicMap = mappingsResponse.data
        .filter((m) => m.type === "topic")
        .reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
      const typeMap = mappingsResponse.data
        .filter((m) => m.type === "test_type")
        .reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
      const difficultyMap = mappingsResponse.data
        .filter((m) => m.type === "difficulty")
        .reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});

      setMaps({ topicMaps: topicMap, typeMap, difficultyMap });

      const completedBaseIds = new Set(
        completedResponse.data.map(
          ({ module_code }) => module_code.split("-")[0]
        )
      );
      console.log("Completed base IDs:", Array.from(completedBaseIds));

      const updatedTests = {};
      const dayMap = {};

      for (const { module_id, tests } of modulesResponse.data) {
        updatedTests[module_id] = [];
        for (const test of tests) {
          const baseTestId = test.id.split("-")[0];
          console.log(
            "Processing test:",
            test.id,
            "Base ID:",
            baseTestId,
            "Included:",
            completedBaseIds.has(baseTestId)
          );
          if (completedBaseIds.has(baseTestId)) {
            const [categoryCode, topicCode, , difficulty] = test.id
              .split("-")
              .concat([null, null, null]);
            const topic =
              topicMap[categoryCode] || `주제 ${topicCode || "없음"}`;
            const diff =
              difficultyMap[difficulty] || (difficulty ? difficulty : "없음");
            const testType = typeMap[test.type] || test.type || "알 수 없음";

            const updatedTest = {
              ...test,
              name: `${
                {
                  100: "발음",
                  201: "문법",
                  301: "단어",
                  401: "시험",
                  701: "읽기",
                }[categoryCode] || `모듈 ${categoryCode}`
              } - 주제 ${topicCode || "없음"} - ${
                test.skill || "알 수 없음"
              } - ${testType} (${diff})`,
            };

            try {
              const { data, error } = await supabase
                .from("test_content")
                .select("content")
                .eq("language", language)
                .eq("module_id", module_id)
                .eq("test_id", test.id)
                .eq("mode", "review")
                .single();
              if (error) {
                console.error(`Test content error for ${test.id}:`, error);
                throw new Error(`질문 데이터 조회 실패: ${error.message}`);
              }
              const days = Object.keys(data.content)
                .map(Number)
                .sort((a, b) => a - b);
              dayMap[test.id] = days;
              updatedTests[module_id].push(updatedTest);
            } catch (error) {
              console.warn(
                `Error loading ${module_id}-${test.id} content:`,
                error
              );
              dayMap[test.id] = [];
            }
          }
        }
      }

      setTests(updatedTests);
      setAvailableDays(dayMap);
      console.log("Updated tests:", updatedTests);
      console.log("Available days:", dayMap);
    } catch (error) {
      console.error("복습 데이터 로드 실패:", error);
      setLoadError(`복습 데이터 로드 실패: ${error.message}`);
      setTests({});
      setAvailableDays({});
    }
  };

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const loadProfileData = async () => {
    try {
      if (!session) return;
      setLoadError(null);
      setIsLoadingProfile(true);
      console.log(
        `Fetching profile data for user=${session.user.email}, language=${language}`
      );

      // profiles 테이블이 없으므로 auth.users에서 email 사용
      setProfileData({
        email: session.user.email,
        first_name: "이름 없음",
        last_name: "",
      });

      // 리포트 데이터 가져오기
      const [progressResponse, resultsResponse] = await Promise.all([
        supabase
          .from("learning_progress")
          .select("module_code, completed, completed_at, day")
          .eq("user_id", session.user.email)
          .eq("language", language)
          .order("completed_at", { ascending: false }),
        supabase
          .from("practice_results")
          .select("module_code, ai_feedback, timestamp, question_text") // score 대신 ai_feedback 사용
          .eq("user_id", session.user.email)
          .eq("language", language)
          .order("timestamp", { ascending: false }),
      ]);

      console.log("Progress data:", progressResponse.data);
      console.log("Results data:", resultsResponse.data);

      if (progressResponse.error) {
        console.error("Learning_progress fetch error:", progressResponse.error);
        throw new Error(
          `리포트 데이터 조회 실패: ${progressResponse.error.message}`
        );
      }
      if (resultsResponse.error) {
        console.error("Practice_results fetch error:", resultsResponse.error);
        throw new Error(
          `리포트 데이터 조회 실패: ${resultsResponse.error.message}`
        );
      }

      const report = {
        progress: progressResponse.data || [],
        results: resultsResponse.data || [],
      };
      setReportData(report);
      console.log("Report data structure:", JSON.stringify(report, null, 2));
    } catch (error) {
      console.error("프로필 데이터 로드 실패:", error);
      setLoadError(`프로필 데이터 로드 실패: ${error.message}`);
      setProfileData(null);
      setReportData({ progress: [], results: [] });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // useEffect 수정
  useEffect(() => {
    console.log("showProfile state changed:", showProfile);
    if (learnMode) {
      loadLearnData();
    } else if (session) {
      loadReviewData();
    }
    if (session && showProfile) {
      loadProfileData();
    }
  }, [session, learnMode, language, showProfile]);

  const modules = [
    { id: "100", name: "100번 발음" },
    { id: "200", name: "200번 문법" },
    { id: "300", name: "300번 단어" },
    { id: "400", name: "400번 시험" },
    { id: "700", name: "700번 읽기" },
  ];

  const testComponentMap = {
    "speech-accuracy": SpeechAccuracyTest,
    "multiple-choice": MultipleChoiceTest,
    subjective: SubjectiveTest,
    "ai-review": AIRreviewTest,
    "listening-comprehension": ListeningComprehensionTest,
    "writing-accuracy": WritingAccuracyTest,
  };

  const Auth = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      console.log("Logging in with:", email);
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw new Error(signInError.message);
      } catch (error) {
        console.error("Login error:", error);
        setError(error.message);
      }
      setLoading(false);
    };

    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>로그인</h2>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // 모바일 메뉴 토글 함수
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // 오버레이 클릭 시 메뉴 닫기
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // renderContent 내 SAPDashboard 부분 수정
  const renderContent = () => {
    if (!session) return <Auth />;

    if (showProfile) {
      return (
        <SAPDashboard
          reportData={reportData}
          profileData={profileData}
          onBack={() => setShowProfile(false)}
          language={language}
        />
      );
    }
    return (
      <div>
        <div className="mode-toggle flex gap-2 mb-4">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="p-2 rounded"
          >
            <option value="en">영어</option>
            <option value="ja">일본어</option>
          </select>
          <button
            onClick={() => setLearnMode(true)}
            disabled={learnMode}
            className="p-2 bg-blue-500 text-white rounded disabled:bg-gray-500"
          >
            학습하기
          </button>
          <button
            onClick={() => setLearnMode(false)}
            disabled={!learnMode}
            className="p-2 bg-blue-500 text-white rounded disabled:bg-gray-500"
          >
            복습하기
          </button>
        </div>

        {loadError && <p className="text-red-500 mb-4">{loadError}</p>}

        {!selectedModule ? (
          <div className="content-center">
            <img
              src="images/7FAD324E-0348-474A-95E1-D4805ED44035-removebg-preview.PNG"
              alt="BESTION LANGUAGE INSTITUTE"
              className="max-w-[80%] max-h-[60vh] object-contain"
            />
            <h2 className="text-2xl mt-4">모듈을 선택해주세요</h2>
            {!learnMode &&
              Object.keys(tests).every((mod) => tests[mod].length === 0) && (
                <p className="mt-2">
                  완료된 학습이 없습니다. 학습 모드에서 먼저 학습을
                  완료해주세요.
                </p>
              )}
          </div>
        ) : !selectedTest ? (
          <div className="content-center">
            <h1 className="text-3xl">
              {modules.find((mod) => mod.id === selectedModule).name}
            </h1>
            <h2 className="text-2xl mt-4">테스트를 선택해주세요</h2>
            {!learnMode && tests[selectedModule]?.length === 0 && (
              <p className="mt-2">
                완료된 학습이 없습니다. 학습 모드에서 먼저 학습을 완료해주세요.
              </p>
            )}
          </div>
        ) : !learnMode &&
          !selectedDay &&
          tests[selectedModule]?.find((t) => t.id === selectedTest) ? (
          <div className="content-center">
            <h1 className="text-3xl">
              {tests[selectedModule].find((t) => t.id === selectedTest).name}
            </h1>
            <h2 className="text-2xl mt-4">일자를 선택해주세요</h2>
          </div>
        ) : (
          <div>
            {learnMode ? (
              <LearningMode
                module={selectedModule}
                testId={selectedTest}
                day={null}
                onBack={() => setSelectedTest(null)}
                session={session}
                language={language}
              />
            ) : (
              <div>
                {tests[selectedModule]?.find((t) => t.id === selectedTest) ? (
                  (() => {
                    const currentTest = tests[selectedModule].find(
                      (t) => t.id === selectedTest
                    );
                    const TestComponent =
                      testComponentMap[currentTest.type] || MultipleChoiceTest;
                    return (
                      <TestComponent
                        module={selectedModule}
                        testId={selectedTest}
                        day={selectedDay}
                        onBack={() => setSelectedDay(null)}
                        session={session}
                        language={language}
                      />
                    );
                  })()
                ) : (
                  <p>선택한 테스트를 찾을 수 없습니다.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* 모바일 햄버거 메뉴 버튼 */}
      {session && !showProfile && (
        <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* 모바일 오버레이 */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay active" onClick={closeMobileMenu} />
      )}

      {session && !showProfile && (
        <div
          className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""} ${
            isMobileMenuOpen ? "mobile-open" : ""
          }`}
        >
          {/* 데스크톱 사이드바 토글 버튼 */}
          <button
            className="absolute top-2 right-[-15px] bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center hidden md:flex"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            {isSidebarCollapsed ? "▶" : "◀"}
          </button>

          {/* 모바일 닫기 버튼 */}
          <button
            className="absolute top-4 right-4 text-white md:hidden"
            onClick={closeMobileMenu}
          >
            <X className="w-6 h-6" />
          </button>

          {!isSidebarCollapsed && (
            <>
              <div className="sidebar-header">
                <h2>베스티온 폴리로그</h2>
                <button
                  className="sidebar-btn"
                  onClick={() => {
                    console.log(
                      "Profile button clicked, setting showProfile to true"
                    );
                    setShowProfile(true);
                    setIsMobileMenuOpen(false); // 모바일에서 메뉴 닫기
                  }}
                >
                  프로필
                </button>
                <button
                  className="logout-btn"
                  onClick={() => supabase.auth.signOut()}
                >
                  로그아웃
                </button>
              </div>

              <div className="sidebar-menu">
                {!selectedModule ? (
                  <ul>
                    {modules
                      .filter((mod) => learnMode || tests[mod.id]?.length > 0)
                      .map((mod) => (
                        <li key={mod.id}>
                          <button
                            className="sidebar-btn"
                            onClick={() => {
                              setSelectedModule(mod.id);
                              setIsMobileMenuOpen(false); // 모바일에서 메뉴 닫기
                            }}
                          >
                            {mod.name}
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : !selectedTest ? (
                  <>
                    <button
                      className="sidebar-back-btn"
                      onClick={() => {
                        setSelectedModule(null);
                        setIsMobileMenuOpen(false); // 모바일에서 메뉴 닫기
                      }}
                    >
                      ← 모듈 선택
                    </button>
                    <ul>
                      {tests[selectedModule]?.map((test) => (
                        <li key={test.id}>
                          <button
                            className="sidebar-btn"
                            onClick={() => {
                              setSelectedTest(test.id);
                              setIsMobileMenuOpen(false); // 모바일에서 메뉴 닫기
                            }}
                          >
                            {test.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <button
                      className="sidebar-back-btn"
                      onClick={() => {
                        setSelectedTest(null);
                        setIsMobileMenuOpen(false); // 모바일에서 메뉴 닫기
                      }}
                    >
                      ← 테스트 선택
                    </button>
                    {!learnMode && (
                      <ul>
                        {Array.from(
                          {
                            length: availableDays[selectedTest]?.length || 0,
                          },
                          (_, i) => availableDays[selectedTest][i]
                        ).map((day) => (
                          <li key={day}>
                            <button
                              className="sidebar-btn"
                              onClick={() => {
                                setSelectedDay(day);
                                setIsMobileMenuOpen(false); // 모바일에서 메뉴 닫기
                              }}
                            >
                              {day}일차
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="main-content">{renderContent()}</div>
    </div>
  );
}

export default App;
