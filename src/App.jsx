import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Trophy, Dumbbell, Activity, Check, X, Zap,
  Share2, Clock, Calendar as CalendarIcon, Settings, Plus, Trash2, Save,
  BarChart2, List
} from 'lucide-react';

// html2canvasをCDNから読み込む関数
const loadHtml2Canvas = () => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve(window.html2canvas);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

// デフォルトメニュー定義（初期値）
const DEFAULT_MENUS = {
  A: {
    id: 'A',
    title: 'メニュー A',
    color: 'bg-red-500',
    borderColor: 'border-red-500',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    items: [
      { name: 'レッグプレス', detail: '60kg × 10回', sets: 3 },
      { name: 'チェストプレス', detail: '35kg × 10回', sets: 3 },
      { name: 'アブダクション(外)', detail: '35kg × 15回', sets: 2 },
      { name: 'プランク', detail: '30秒', sets: 2 },
    ],
    isActive: true
  },
  B: {
    id: 'B',
    title: 'メニュー B',
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    items: [
      { name: 'ラットプルダウン', detail: '30kg × 12回', sets: 3 },
      { name: 'アダクション(内)', detail: '30kg × 15回', sets: 2 },
      { name: 'ショルダープレス', detail: '20kg × 10回', sets: 3 },
      { name: '腹筋', detail: '10回', sets: 2 },
    ],
    isActive: true
  },
  C: {
    id: 'C',
    title: 'メニュー C',
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    items: [
      { name: 'バイク', detail: '15分', sets: 1 },
      { name: 'トレッドミル', detail: '15分', sets: 1 },
    ],
    isActive: false
  },
  D: {
    id: 'D',
    title: 'メニュー D',
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
    items: [
      { name: '自由メニュー', detail: '自由に設定', sets: 3 },
    ],
    isActive: false
  }
};

export default function App() {
  const [history, setHistory] = useState({});
  const [squatHistory, setSquatHistory] = useState({});
  const [reservations, setReservations] = useState({});
  // メニューデータをStateで管理
  const [menus, setMenus] = useState(DEFAULT_MENUS);
  // ジム外メニュー設定
  const [squatSettings, setSquatSettings] = useState({
    name: '自重スクワット',
    defaultReps: 30,
    defaultSets: 1,
    unit: '回',
    countCondition: 'conditional',
    conditionValue: 100
  });

  const [currentView, setCurrentView] = useState('home');
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [squatInput, setSquatInput] = useState({ reps: 30, sets: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const calendarRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);

  // スクワット画面の表示モード（'list' or 'chart'）
  const [squatViewMode, setSquatViewMode] = useState('list');

  // 初期ロード
  useEffect(() => {
    const savedHistory = localStorage.getItem('workoutHistory');
    const savedSquatHistory = localStorage.getItem('workoutSquatHistory');
    const savedReservations = localStorage.getItem('workoutReservations');
    const savedMenus = localStorage.getItem('workoutMenus');
    const savedSquatSettings = localStorage.getItem('workoutSquatSettings');

    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedSquatHistory) setSquatHistory(JSON.parse(savedSquatHistory));
    if (savedReservations) setReservations(JSON.parse(savedReservations));
    if (savedMenus) setMenus(JSON.parse(savedMenus));
    if (savedSquatSettings) {
      const settings = JSON.parse(savedSquatSettings);
      setSquatSettings({
        name: '自重スクワット',
        defaultReps: 30,
        defaultSets: 1,
        unit: '回',
        countCondition: 'conditional',
        conditionValue: 100,
        ...settings
      });
      setSquatInput({ reps: settings.defaultReps, sets: settings.defaultSets });
    }
  }, []);

  // データ保存
  useEffect(() => { localStorage.setItem('workoutHistory', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('workoutSquatHistory', JSON.stringify(squatHistory)); }, [squatHistory]);
  useEffect(() => { localStorage.setItem('workoutReservations', JSON.stringify(reservations)); }, [reservations]);
  useEffect(() => { localStorage.setItem('workoutMenus', JSON.stringify(menus)); }, [menus]);
  useEffect(() => { localStorage.setItem('workoutSquatSettings', JSON.stringify(squatSettings)); }, [squatSettings]);

  // 日付関連ユーティリティ
  const getTodayString = () => formatDateString(new Date());
  const formatDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const isFutureOrToday = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return target >= today;
  };
  const getDayLabel = (date) => ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

  // データ計算
  const getDailySquatTotal = (dateStr) => {
    const records = squatHistory[dateStr] || [];
    return records.reduce((total, record) => total + (record.reps * record.sets), 0);
  };

  // ペース計算（新ロジック：月間予測）
  const calculatePaceInfo = () => {
    const today = new Date();
    const currentDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate(); // 今月の日数
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    // 1. 活動日数のカウント（ジムに行った日のみカウント）
    const recordDates = new Set([
      ...Object.keys(history).filter(d => d.startsWith(prefix))
    ]);
    const activeDays = recordDates.size;

    // 2. スクワットボーナスの計算（今月の総回数 / 100）
    let monthlySquatTotal = 0;
    Object.keys(squatHistory).filter(d => d.startsWith(prefix)).forEach(d => {
      monthlySquatTotal += getDailySquatTotal(d);
    });
    // 100回ごとに+1ポイント（設定値依存）
    const bonusPoints = Math.floor(monthlySquatTotal / 100);

    // 3. 実績合計 = 活動日数 + ボーナス
    const currentTotalScore = activeDays + bonusPoints;

    // 4. 予測計算: (実績 / 経過日数) * 今月の日数
    // 経過日数が0の場合は0除算回避
    const paceValue = currentDay > 0
      ? (currentTotalScore / currentDay) * daysInMonth
      : 0;

    // 表示用（小数点第1位まで）
    const predictedTotalDisplay = paceValue.toFixed(1);
    const predictedTotalNum = paceValue; // ランク判定用

    // ランク判定（予測回数に基づく）
    let rank = "圏外";
    let colorClass = "bg-[#969696]/10 text-[#969696]"; // デフォルト（圏外）
    let rankColor = "text-[#969696]";

    if (predictedTotalNum >= 15) {
      rank = "SS";
      colorClass = "bg-[#FF00FF]/10 text-[#FF00FF]";
      rankColor = "text-[#FF00FF]";
    } else if (predictedTotalNum >= 13) {
      rank = "S++";
      colorClass = "bg-[#FFFF00]/20 text-[#D4D400]";
      rankColor = "text-[#E6E600] drop-shadow-sm";
    } else if (predictedTotalNum >= 12) {
      rank = "S+";
      colorClass = "bg-[#00FF00]/10 text-[#00CC00]";
      rankColor = "text-[#00CC00]";
    } else if (predictedTotalNum >= 10) {
      rank = "S";
      colorClass = "bg-[#00ba00]/10 text-[#00ba00]";
      rankColor = "text-[#00ba00]";
    } else if (predictedTotalNum >= 7) {
      rank = "A";
      colorClass = "bg-[#ff0000]/10 text-[#ff0000]";
      rankColor = "text-[#ff0000]";
    } else if (predictedTotalNum >= 5) {
      rank = "B";
      colorClass = "bg-[#0095d9]/10 text-[#0095d9]";
      rankColor = "text-[#0095d9]";
    } else if (predictedTotalNum >= 1) {
      rank = "C";
      colorClass = "bg-[#eecd73]/10 text-[#cbb063]";
      rankColor = "text-[#eecd73]";
    }

    return {
      pace: predictedTotalDisplay, // 文字列（小数1位）
      rank,
      colorClass,
      rankColor,
      currentDay,
      currentTotalScore, // 現在の実績（カレンダー表示用）
      monthlySquatTotal  // 今月のスクワット合計
    };
  };

  // 先月の実績（確定値）
  const calculateLastMonthPace = () => {
    const today = new Date();
    const lastMonthFirstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const year = lastMonthFirstDay.getFullYear();
    const month = lastMonthFirstDay.getMonth() + 1;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    // 1. 活動日数のカウント
    const recordDates = new Set([
      ...Object.keys(history).filter(d => d.startsWith(prefix))
    ]);
    const activeDays = recordDates.size;

    // 2. ボーナス計算
    let monthlySquatTotal = 0;
    Object.keys(squatHistory).filter(d => d.startsWith(prefix)).forEach(d => {
      monthlySquatTotal += getDailySquatTotal(d);
    });
    const bonusPoints = Math.floor(monthlySquatTotal / 100);

    // 実績 = 日数 + ボーナス
    return activeDays + bonusPoints;
  };

  // シェア機能
  const handleShare = async () => {
    setIsSharing(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const prefix = `${year}-${String(month).padStart(2, '0')}`;

      const recordDates = new Set([
        ...Object.keys(history).filter(d => d.startsWith(prefix))
      ]);

      const sortedDates = Array.from(recordDates).sort();
      let shareText = `【運動・筋トレ記録】\n`;
      let dayCount = 1;

      sortedDates.forEach(dateStr => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayLabel = getDayLabel(dateObj);

        const type = history[dateStr];
        const squatTotal = getDailySquatTotal(dateStr);

        let content = [];
        if (type) content.push(`メニュー${type}`);
        if (squatTotal > 0) content.push(`${squatSettings.name}(${squatTotal}${squatSettings.unit})`);

        if (content.length > 0) {
          shareText += `day${dayCount}：${m}/${d}(${dayLabel}) ${content.join(' & ')}\n`;
          dayCount++;
        }
      });

      // 月間集計情報
      const paceData = calculatePaceInfo();
      shareText += `\n今月の予測: ${paceData.pace}回 (Rank: ${paceData.rank})\n`;
      shareText += `今月の貯筋: ${paceData.monthlySquatTotal}${squatSettings.unit}\n`;

      let imageFile = null;
      if (calendarRef.current) {
        const html2canvas = await loadHtml2Canvas();
        const canvas = await html2canvas(calendarRef.current, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const element = clonedDoc.querySelector('.calendar-container');
            if (element) {
              element.style.padding = '20px';
              element.style.borderRadius = '0px';
              element.style.boxShadow = 'none';
            }
          }
        });
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        imageFile = new File([blob], 'workout_calendar.png', { type: 'image/png' });
      }

      if (navigator.share) {
        const shareData = { text: shareText };
        if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
          shareData.files = [imageFile];
        }
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('共有テキストをクリップボードにコピーしました！');
      }
    } catch (error) {
      if (error.name !== 'AbortError') alert('シェア機能エラー: ' + error.message);
    } finally {
      setIsSharing(false);
    }
  };

  // ワークアウト関連アクション
  const addSquatRecord = (targetDateStr) => {
    // 日付指定がない場合は今日
    const dateToUse = (typeof targetDateStr === 'string') ? targetDateStr : getTodayString();

    const newRecord = { ...squatInput, id: Date.now() };
    setSquatHistory(prev => ({ ...prev, [dateToUse]: [...(prev[dateToUse] || []), newRecord] }));
    alert(`${squatSettings.name} ${squatInput.reps}${squatSettings.unit} × ${squatInput.sets}セット を追加しました！`);
  };

  const removeSquatRecord = (dateStr, recordId) => {
    setSquatHistory(prev => ({ ...prev, [dateStr]: prev[dateStr].filter(r => r.id !== recordId) }));
  };

  const startWorkout = (id) => { setSelectedMenuId(id); setCheckedItems({}); setCurrentView('workout'); };
  const toggleSetCheck = (itemIndex, setIndex) => { const key = `${itemIndex}-${setIndex}`; setCheckedItems(prev => ({ ...prev, [key]: !prev[key] })); };

  const isAllChecked = () => {
    if (!selectedMenuId) return false;
    const items = menus[selectedMenuId].items;
    for (let i = 0; i < items.length; i++) {
      for (let s = 0; s < items[i].sets; s++) { if (!checkedItems[`${i}-${s}`]) return false; }
    }
    return true;
  };

  const finishWorkout = () => {
    const today = getTodayString();
    setHistory(prev => ({ ...prev, [today]: selectedMenuId }));
    if (reservations[today]) {
      const newReservations = { ...reservations };
      delete newReservations[today];
      setReservations(newReservations);
    }
    setCurrentView('home');
    setSelectedMenuId(null);
    alert('お疲れ様でした！本日の記録を保存しました。');
  };

  // 履歴更新・予約
  const handleHistoryUpdate = (type) => {
    if (!editingDate) return;
    const dateStr = formatDateString(editingDate);
    if (type === null) {
      const newHistory = { ...history };
      delete newHistory[dateStr];
      setHistory(newHistory);
    } else {
      setHistory(prev => ({ ...prev, [dateStr]: type }));
      if (reservations[dateStr]) {
        const newReservations = { ...reservations };
        delete newReservations[dateStr];
        setReservations(newReservations);
      }
    }
    setIsModalOpen(false);
  };

  const toggleReservation = () => {
    if (!editingDate) return;
    const dateStr = formatDateString(editingDate);
    setReservations(prev => {
      const newRes = { ...prev };
      if (newRes[dateStr]) delete newRes[dateStr];
      else newRes[dateStr] = true;
      return newRes;
    });
    setIsModalOpen(false);
  };

  // --- カレンダー描画 ---
  const changeMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));

    const yearMonth = `${year}年 ${month + 1}月`;
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    // 月間集計（Rate計算ロジックと同じ：日数＋ボーナス）
    const recordDates = new Set([
      ...Object.keys(history).filter(d => d.startsWith(prefix))
    ]);
    const activeDays = recordDates.size;

    let monthlySquatTotal = 0;
    Object.keys(squatHistory).filter(d => d.startsWith(prefix)).forEach(d => {
      monthlySquatTotal += getDailySquatTotal(d);
    });
    const bonusPoints = Math.floor(monthlySquatTotal / 100);
    const totalScore = activeDays + bonusPoints;

    return (
      <div ref={calendarRef} className="calendar-container bg-white rounded-2xl shadow-sm p-5 mb-6 relative z-0">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full" data-html2canvas-ignore><ChevronLeft size={20} className="text-gray-400" /></button>
          <div className="flex-1 flex justify-between items-center px-2">
            <h2 className="font-bold text-xl text-gray-800 tracking-tight">{yearMonth}</h2>
            <div className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
              実績: <span className="text-gray-700 font-bold text-sm">{totalScore}</span> 回
            </div>
          </div>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full" data-html2canvas-ignore><ChevronRight size={20} className="text-gray-400" /></button>
        </div>

        <div className="grid grid-cols-7 gap-y-4 mb-2">
          {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
            <div key={i} className={`text-xs font-bold text-center ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-2 gap-x-1">
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="aspect-square"></div>;

            const dateStr = formatDateString(day);
            const recordId = history[dateStr];
            const menu = menus[recordId];
            const isReserved = reservations[dateStr];
            const isToday = dateStr === getTodayString();
            const squatTotal = getDailySquatTotal(dateStr);
            const isSquatDone = squatTotal > 0;

            let bgClass = "bg-transparent";
            let textClass = "text-gray-700";
            let borderClass = "";
            let Content = null;
            let squatDecoration = "";

            if (menu) {
              // ジムに行っている場合：丸囲み
              bgClass = menu.bgColor.replace('50', '100');
              textClass = menu.textColor;
              Content = <div className={`w-full h-full rounded-full ${menu.color} opacity-20`}></div>;
            } else if (isReserved) {
              bgClass = "bg-yellow-50";
              textClass = "text-yellow-600";
            }

            // スクワット実施日：数字の下に緑のライン（シンプル化：太さ2px, 角なし直線）
            if (isSquatDone) {
              squatDecoration = "border-b-2 border-green-500 pb-0.5";
            }

            return (
              <div
                key={dateStr}
                onClick={() => { setEditingDate(day); setIsModalOpen(true); }}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all ${isReserved ? 'hover:bg-yellow-100' : 'hover:bg-gray-50'}`}
              >
                <div className={`absolute inset-1 rounded-full flex items-center justify-center ${bgClass} ${borderClass}`}>
                  {Content}
                </div>
                {/* 日付数字：下線処理を追加 */}
                <span className={`relative z-10 text-sm font-medium leading-none ${textClass} ${squatDecoration} ${isToday ? 'underline decoration-2 decoration-gray-400 underline-offset-8' : ''}`}>
                  {day.getDate()}
                </span>
                {isReserved && !menu && !isSquatDone && (
                  <div className="absolute bottom-1 z-10"><Clock size={10} className="text-yellow-500/70" /></div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center items-center gap-4 flex-wrap text-[10px] text-gray-400">
          {Object.values(menus).filter(m => m.isActive).map(m => (
            <div key={m.id} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${m.color.replace('bg-', 'bg-').replace('500', '200')}`}></div>
              {m.title.replace('メニュー ', '')}
            </div>
          ))}
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-green-500"></div> {squatSettings.name}</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-200 opacity-50 relative flex items-center justify-center"><div className="w-2 h-0.5 bg-green-500 absolute bottom-0.5"></div></div> ダブル達成</div>
        </div>

        <button
          onClick={handleShare}
          disabled={isSharing}
          className="absolute -bottom-4 right-4 bg-indigo-600 text-white p-3 rounded-full shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all z-20 flex items-center justify-center active:scale-95"
          data-html2canvas-ignore
        >
          {isSharing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Share2 size={20} />}
        </button>
      </div>
    );
  };

  // --- 編集モーダル ---
  const renderEditModal = () => {
    if (!isModalOpen || !editingDate) return null;
    const dateStr = formatDateString(editingDate);
    const canReserve = isFutureOrToday(editingDate);
    const currentRecord = history[dateStr];
    const isReserved = reservations[dateStr];

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl transform transition-all" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800">{editingDate.getMonth() + 1}月{editingDate.getDate()}日</h3>
            <button onClick={() => setIsModalOpen(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
          </div>

          {/* ジム外メニュー（スクワット）入力エリア */}
          <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500 font-bold">{squatSettings.name}</span>
              <span className="text-xl font-black text-gray-800">{getDailySquatTotal(formatDateString(editingDate))}<span className="text-sm font-normal text-gray-400 ml-1">{squatSettings.unit}</span></span>
            </div>

            {/* 履歴リスト */}
            <div className="space-y-1 mb-3">
              {(squatHistory[formatDateString(editingDate)] || []).map((record) => (
                <div key={record.id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-gray-200">
                  <span className="text-gray-600 font-bold">{record.reps}{squatSettings.unit} × {record.sets}set</span>
                  <button onClick={() => removeSquatRecord(formatDateString(editingDate), record.id)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>

            {/* 入力フォーム */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 bg-white border border-gray-200 rounded-lg flex items-center px-2">
                <input className="w-full py-2 text-center font-bold text-gray-700 outline-none" type="number" value={squatInput.reps} onChange={e => setSquatInput({ ...squatInput, reps: Number(e.target.value) })} />
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{squatSettings.unit}</span>
              </div>
              <span className="text-gray-300 text-xs">×</span>
              <div className="w-16 bg-white border border-gray-200 rounded-lg flex items-center px-2">
                <input className="w-full py-2 text-center font-bold text-gray-700 outline-none" type="number" value={squatInput.sets} onChange={e => setSquatInput({ ...squatInput, sets: Number(e.target.value) })} />
                <span className="text-[10px] text-gray-400 whitespace-nowrap">set</span>
              </div>
              <button onClick={() => addSquatRecord(formatDateString(editingDate))} className="bg-green-500 text-white p-2 rounded-lg shadow-sm hover:bg-green-600"><Plus size={18} /></button>
            </div>
          </div>

          {canReserve && !currentRecord ? (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm font-medium text-center">この日の予定を設定しますか？</p>
              <button
                onClick={toggleReservation}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${reservations[formatDateString(editingDate)] ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
              >
                {reservations[formatDateString(editingDate)] ? <>予約を取り消す</> : <><Clock size={18} /> 行く予約をする</>}
              </button>

              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-xs text-gray-400 text-center mb-2">または実績を入力</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(menus).filter(m => m.isActive).map(m => (
                    <button key={m.id} onClick={() => handleHistoryUpdate(m.id)} className={`py-3 rounded-xl font-bold border-2 bg-white ${m.textColor} ${m.borderColor.replace('500', '100')} hover:${m.borderColor.replace('500', '200')} text-sm`}>{m.title}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm font-medium text-center mb-4">実績を記録・修正</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(menus).filter(m => m.isActive).map(m => (
                  <button key={m.id} onClick={() => handleHistoryUpdate(m.id)} className={`py-4 rounded-2xl font-bold border-2 transition-all ${history[formatDateString(editingDate)] === m.id ? `${m.color} text-white ${m.borderColor}` : `bg-white ${m.textColor} ${m.borderColor.replace('500', '100')}`}`}>{m.title}</button>
                ))}
              </div>
              <button onClick={() => handleHistoryUpdate(null)} className="w-full py-3 text-gray-400 font-medium text-sm hover:text-gray-600 mt-2">記録を削除する</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- 設定画面 ---
  const SettingsView = () => {
    // 編集中のタブID（A, B, C, D, squat）
    const [editingTabId, setEditingTabId] = useState('A');
    const [localMenus, setLocalMenus] = useState(menus);
    const [localSquat, setLocalSquat] = useState(squatSettings);

    const isSquatTab = editingTabId === 'squat';
    const activeMenu = !isSquatTab ? localMenus[editingTabId] : null;

    const toggleMenuActive = (id) => {
      setLocalMenus(prev => ({ ...prev, [id]: { ...prev[id], isActive: !prev[id].isActive } }));
    };

    const updateMenuItem = (index, field, value) => {
      const newItems = [...activeMenu.items];
      newItems[index] = { ...newItems[index], [field]: value };
      setLocalMenus(prev => ({ ...prev, [editingTabId]: { ...prev[editingTabId], items: newItems } }));
    };

    const addItem = () => {
      const newItems = [...activeMenu.items, { name: '新規種目', detail: '', sets: 1 }];
      setLocalMenus(prev => ({ ...prev, [editingTabId]: { ...prev[editingTabId], items: newItems } }));
    };

    const removeItem = (index) => {
      const newItems = activeMenu.items.filter((_, i) => i !== index);
      setLocalMenus(prev => ({ ...prev, [editingTabId]: { ...prev[editingTabId], items: newItems } }));
    };

    const saveAll = () => {
      setMenus(localMenus);
      setSquatSettings(localSquat);
      setSquatInput({ reps: localSquat.defaultReps, sets: localSquat.defaultSets });
      setCurrentView('home');
      alert('設定を保存しました');
    };

    return (
      <div className="min-h-screen bg-gray-50 p-4 font-sans pb-20">
        <header className="mb-6 flex items-center gap-2 pt-2">
          <button onClick={() => setCurrentView('home')} className="bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 p-2 rounded-full shadow-sm"><ChevronLeft size={20} /></button>
          <h1 className="text-lg font-bold text-gray-800">設定</h1>
        </header>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2"><Settings size={16} /> メニュー設定</h2>

          {/* タブ */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
            {Object.values(localMenus).map(m => (
              <button
                key={m.id}
                onClick={() => setEditingTabId(m.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border-2 ${editingTabId === m.id ? `${m.borderColor} ${m.bgColor} ${m.textColor}` : 'border-transparent bg-gray-100 text-gray-400'}`}
              >
                {m.title}
              </button>
            ))}
            <button
              onClick={() => setEditingTabId('squat')}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border-2 ${editingTabId === 'squat' ? 'border-green-500 bg-green-50 text-green-600' : 'border-transparent bg-gray-100 text-gray-400'}`}
            >
              ジム外メニュー
            </button>
          </div>

          {/* 編集エリア */}
          {isSquatTab ? (
            <div className="border-2 rounded-2xl p-4 border-green-500 bg-green-50 bg-opacity-20">
              <h3 className="font-bold text-green-800 mb-4">ジム外アクティビティ設定</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-green-600 font-bold block mb-1">メニュー名（例：自重スクワット、宅トレ）</label>
                  <input
                    value={localSquat.name}
                    onChange={(e) => setLocalSquat({ ...localSquat, name: e.target.value })}
                    className="w-full p-2 rounded-lg border border-green-200 font-bold"
                    placeholder="自重スクワット"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-green-600 font-bold block mb-1">デフォルト回数</label>
                    <input
                      type="number"
                      value={localSquat.defaultReps}
                      onChange={(e) => setLocalSquat({ ...localSquat, defaultReps: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-green-200 text-center font-bold"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-green-600 font-bold block mb-1">デフォルトセット数</label>
                    <input
                      type="number"
                      value={localSquat.defaultSets}
                      onChange={(e) => setLocalSquat({ ...localSquat, defaultSets: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-green-200 text-center font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-green-600 font-bold block mb-1">単位（例：回、分、秒）</label>
                  <input
                    value={localSquat.unit}
                    onChange={(e) => setLocalSquat({ ...localSquat, unit: e.target.value })}
                    className="w-16 p-2 rounded-lg border border-green-200 text-center font-bold"
                    placeholder="回"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className={`border-2 rounded-2xl p-4 ${activeMenu.borderColor} ${activeMenu.bgColor} bg-opacity-20`}>
              <div className="flex justify-between items-center mb-4">
                <span className={`font-bold ${activeMenu.textColor}`}>このメニューを使用する</span>
                <button
                  onClick={() => toggleMenuActive(editingTabId)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${activeMenu.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${activeMenu.isActive ? 'translate-x-6' : ''}`}></div>
                </button>
              </div>

              {activeMenu.isActive && (
                <div className="space-y-3">
                  {/* フォントサイズ調整箇所 */}
                  {activeMenu.items.map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <input
                          value={item.name}
                          onChange={(e) => updateMenuItem(idx, 'name', e.target.value)}
                          className="w-full text-sm font-bold border-b border-gray-200 focus:border-green-500 outline-none pb-1"
                          placeholder="種目名"
                        />
                        <div className="flex gap-2">
                          <input
                            value={item.detail}
                            onChange={(e) => updateMenuItem(idx, 'detail', e.target.value)}
                            className="flex-1 text-xs text-gray-500 border-b border-gray-200 focus:border-green-500 outline-none pb-1"
                            placeholder="重さ・回数など"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={item.sets}
                              onChange={(e) => updateMenuItem(idx, 'sets', Number(e.target.value))}
                              className="w-10 text-xs text-center border-b border-gray-200 focus:border-green-500 outline-none pb-1"
                            />
                            <span className="text-xs text-gray-400">set</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  <button onClick={addItem} className="w-full py-3 bg-white border-2 border-dashed border-gray-300 text-gray-400 rounded-xl font-bold text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
                    <Plus size={16} /> 種目を追加
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
          <button onClick={saveAll} className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-200 hover:bg-green-600 flex items-center justify-center gap-2">
            <Save size={20} /> 設定を保存する
          </button>
        </div>
      </div>
    );
  };

  // --- ビューの切り替え ---
  if (currentView === 'settings') return <SettingsView />;

  if (currentView === 'workout') {
    const menu = menus[selectedMenuId];
    const isComplete = isAllChecked();
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-20 font-sans">
        <header className="mb-6 flex items-center gap-2 pt-2">
          <button onClick={() => setCurrentView('home')} className="bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 p-2 rounded-full shadow-sm"><ChevronLeft size={20} /></button>
          <h1 className="text-lg font-bold text-gray-800">トレーニング記録</h1>
        </header>
        <div className={`bg-white rounded-3xl p-6 shadow-sm border-t-4 ${menu.borderColor} mb-6`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-black ${menu.textColor}`}>{menu.title}</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${menu.bgColor} ${menu.textColor}`}>Today's Menu</span>
          </div>
          <div className="space-y-4">
            {menu.items.map((item, itemIndex) => {
              let isItemComplete = true;
              for (let s = 0; s < item.sets; s++) { if (!checkedItems[`${itemIndex}-${s}`]) isItemComplete = false; }
              return (
                <div key={itemIndex} className={`p-4 rounded-2xl border-2 transition-all duration-300 ${isItemComplete ? 'border-green-400 bg-green-50/50' : 'border-gray-100 bg-white'}`}>
                  <div className="mb-4">
                    <div className={`font-bold text-lg flex items-center justify-between ${isItemComplete ? 'text-green-700' : 'text-gray-800'}`}>{item.name} {isItemComplete && <Check className="text-green-500" size={20} />}</div>
                    <div className="text-sm text-gray-500">{item.detail}</div>
                  </div>
                  <div className="flex gap-6 flex-wrap justify-center sm:justify-start">
                    {Array.from({ length: item.sets }).map((_, setIndex) => {
                      const isChecked = checkedItems[`${itemIndex}-${setIndex}`];
                      return (
                        <button
                          key={setIndex}
                          onClick={() => toggleSetCheck(itemIndex, setIndex)}
                          className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-xl font-bold transition-all duration-200 ${isChecked ? 'bg-green-500 border-green-500 text-white shadow-lg transform scale-110' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'}`}
                        >
                          {setIndex + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={finishWorkout} disabled={!isComplete} className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${isComplete ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-200 transform hover:-translate-y-1' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}><Trophy size={24} />{isComplete ? 'トレーニング完了！' : '未完了の項目があります'}</button>
      </div>
    );
  }

  // スクワット画面
  if (currentView === 'squat') {
    const paceData = calculatePaceInfo();
    const monthlyTotal = paceData.monthlySquatTotal;
    const nextBonus = (Math.floor(monthlyTotal / 100) + 1) * 100;
    const toNextBonus = nextBonus - monthlyTotal;

    // グラフ用データ生成（今月分）
    const getChartData = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();

      const data = [];
      let maxVal = 10; // 最小のMax値

      for (let i = 1; i <= daysInMonth; i++) {
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const val = getDailySquatTotal(dStr);
        if (val > maxVal) maxVal = val;
        data.push({ day: i, value: val, dateStr: dStr });
      }
      return { data, maxVal };
    };

    const { data: chartData, maxVal: chartMax } = getChartData();

    return (
      <div className="min-h-screen bg-gray-50 p-4 font-sans flex flex-col">
        <header className="mb-4 flex items-center gap-2 pt-2">
          <button onClick={() => setCurrentView('home')} className="bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 p-2 rounded-full shadow-sm"><ChevronLeft size={20} /></button>
          <h1 className="text-lg font-bold text-gray-800">{squatSettings.name}</h1>
        </header>

        {/* 今月の貯筋（積み上げ） */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border-t-4 border-green-500 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="text-xl font-black text-green-700">今月の貯筋</h2><p className="text-xs text-gray-400 mt-1">積み上げこそが最強の筋トレ</p></div>
            <div className="text-right">
              <span className="text-4xl font-black tracking-tight text-green-600">{monthlyTotal}</span>
              <span className="text-sm text-gray-400 font-bold">{squatSettings.unit}</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
            <div className="bg-green-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, (monthlyTotal % 100) / 100 * 100)}%` }}></div>
          </div>
          <p className="text-xs text-gray-500 text-right">
            次のジム回数ボーナスまで あと <span className="font-bold text-green-600">{toNextBonus}</span> {squatSettings.unit}
          </p>
        </div>

        {/* タブ切り替え */}
        <div className="flex p-1 bg-gray-200 rounded-xl mb-4">
          <button
            onClick={() => setSquatViewMode('list')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${squatViewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >
            <List size={14} /> 記録入力
          </button>
          <button
            onClick={() => setSquatViewMode('chart')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${squatViewMode === 'chart' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >
            <BarChart2 size={14} /> グラフ・履歴
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1">
          {squatViewMode === 'list' ? (
            <>
              <div className="bg-green-50 rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-2 mb-3"><Zap size={18} className="text-green-600" /><span className="font-bold text-green-800 text-sm">今日の記録を追加</span></div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><label className="text-[10px] text-green-600 font-bold block mb-1 ml-1">{squatSettings.unit}</label><input type="number" value={squatInput.reps} onChange={(e) => setSquatInput({ ...squatInput, reps: Number(e.target.value) })} className="w-full p-3 rounded-xl border border-green-200 bg-white font-bold text-xl text-center focus:border-green-500 outline-none text-gray-700" /></div>
                  <div className="text-gray-300 pb-4 font-bold">×</div>
                  <div className="flex-1"><label className="text-[10px] text-green-600 font-bold block mb-1 ml-1">セット</label><input type="number" value={squatInput.sets} onChange={(e) => setSquatInput({ ...squatInput, sets: Number(e.target.value) })} className="w-full p-3 rounded-xl border border-green-200 bg-white font-bold text-xl text-center focus:border-green-500 outline-none text-gray-700" /></div>
                  <button onClick={() => addSquatRecord(getTodayString())} className="bg-green-600 text-white p-4 rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 active:scale-95 transition-all"><Plus size={24} /></button>
                </div>
              </div>

              <div className="space-y-2 pb-4">
                <h3 className="text-xs font-bold text-gray-400 ml-1 mb-2">今日の履歴</h3>
                {(squatHistory[getTodayString()] || []).length === 0 && <p className="text-center text-gray-300 py-4 text-sm font-medium">まだ記録がありません</p>}
                {(squatHistory[getTodayString()] || []).map((record) => (
                  <div key={record.id} className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
                    <span className="font-bold text-gray-600"><span className="text-lg text-gray-800 mr-1">{record.reps}</span>{squatSettings.unit} × <span className="text-lg text-gray-800 mx-1">{record.sets}</span>セット</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-md">= {record.reps * record.sets}</span>
                      <button onClick={() => removeSquatRecord(getTodayString(), record.id)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col flex-1 h-full min-h-0">
              <h3 className="text-xs font-bold text-gray-500 mb-4 text-center">日別積み上げグラフ</h3>

              {/* グラフエリア（高さを固定して表示を安定させる） */}
              <div className="h-48 shrink-0 mb-4 border-b border-gray-100 pb-2">
                <div className="h-full overflow-x-auto no-scrollbar">
                  <div className="h-full flex items-end gap-2 min-w-max px-2">
                    {chartData.map((d, i) => {
                      const isToday = d.dateStr === getTodayString();
                      const heightPercent = (d.value / chartMax) * 100;
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 w-6 group relative">
                          {d.value > 0 && (
                            <div className="absolute -top-6 text-[10px] font-bold text-green-600 bg-green-50 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              {d.value}
                            </div>
                          )}
                          <div className="w-full h-full flex items-end relative">
                            <div className="absolute bottom-0 w-full bg-gray-50 h-full rounded-t-sm z-0"></div>
                            <div
                              className={`w-full rounded-t-sm transition-all duration-500 z-10 ${isToday ? 'bg-green-500' : 'bg-green-200 hover:bg-green-300'}`}
                              style={{ height: `${Math.max(4, heightPercent)}%` }}
                            ></div>
                          </div>
                          <span className={`text-[9px] ${isToday ? 'font-bold text-green-600' : 'text-gray-300'}`}>{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* リスト表示（テキストベースでの確認用） */}
              <div className="flex-1 overflow-y-auto">
                <h4 className="text-xs font-bold text-gray-400 mb-2 sticky top-0 bg-white py-1">詳細データ</h4>
                <div className="space-y-1">
                  {chartData.filter(d => d.value > 0).length === 0 && <p className="text-center text-gray-300 text-xs py-2">今月の記録はまだありません</p>}
                  {chartData.filter(d => d.value > 0).reverse().map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-gray-50 py-2">
                      <span className="text-gray-500 text-xs">{d.dateStr} ({getDayLabel(new Date(d.dateStr))})</span>
                      <span className="font-bold text-green-600">{d.value} {squatSettings.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <button onClick={() => setCurrentView('home')} className="w-full py-4 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-xl transition-all mt-auto">ホームに戻る</button>
      </div>
    );
  }

  // Home View
  const todayStr = getTodayString();
  const todayRecord = history[todayStr];
  const todayReserved = reservations[todayStr];
  const paceData = calculatePaceInfo();
  const lastMonthPace = calculateLastMonthPace();
  const todaySquat = getDailySquatTotal(todayStr);
  const isTodaySquatDone = todaySquat > 0; // 1回でもやればDone

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans max-w-md mx-auto">
      {/* Header */}
      <header className="mb-8 pt-4 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-yellow-500 tracking-[0.2em] mb-1">CHOCOZAP</p>
          <h1 className="text-3xl font-black text-gray-800 leading-none">
            運動・筋トレ記録
          </h1>
        </div>

        {/* Rank Badge Area */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-4 mb-1">
            <button onClick={() => setCurrentView('settings')} className="text-gray-300 hover:text-gray-500 p-1"><Settings size={20} /></button>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-black italic ${paceData.rankColor} drop-shadow-sm`}>{paceData.rank}</span>
              <span className="text-xs font-bold text-gray-400">rank</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <div className="text-[10px] text-gray-400 font-medium text-right">
                先月実績: <span className="font-bold text-gray-500">{lastMonthPace}</span>
              </div>
              <div className={`px-3 py-1 rounded text-[10px] font-bold ${paceData.colorClass}`}>
                予測Rate: {paceData.pace}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mb-8 space-y-4">
        {todayRecord && (
          <div className={`bg-gradient-to-r ${menus[todayRecord]?.color.replace('bg-', 'from-').replace('500', '500')} to-gray-500 rounded-2xl p-4 flex items-center gap-4 text-white shadow-lg animate-in fade-in slide-in-from-top-2`}>
            <div className="bg-white/20 p-2 rounded-full"><Check size={24} className="text-white" /></div>
            <div><p className="font-bold text-lg">メニュー{menus[todayRecord]?.title.replace('メニュー ', '')} 完了！</p><p className="text-white/80 text-xs">Nice workout!</p></div>
          </div>
        )}
        {isTodaySquatDone && (
          <div className="bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl p-4 flex items-center gap-4 text-white shadow-lg shadow-green-200 animate-in fade-in slide-in-from-top-2">
            <div className="bg-white/20 p-2 rounded-full"><Activity size={24} className="text-white" /></div>
            <div><p className="font-bold text-lg">{squatSettings.name} {todaySquat}{squatSettings.unit}</p><p className="text-green-100 text-xs">ナイス貯筋！</p></div>
          </div>
        )}

        {!todayRecord && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-gray-400 font-bold flex items-center gap-2 text-xs uppercase tracking-wider"><Activity size={14} /> 今日の運動メニュー</p>
              {todayReserved && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold flex items-center gap-1 animate-pulse"><Clock size={10} /> 予約あり</span>}
            </div>
            {/* アクティブなメニューを動的に表示 */}
            <div className="grid grid-cols-2 gap-4">
              {Object.values(menus).filter(m => m.isActive).map(menu => (
                <button key={menu.id} onClick={() => startWorkout(menu.id)} className={`relative overflow-hidden bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group text-left border-l-4 ${menu.borderColor}`}>
                  <div className={`absolute top-0 right-0 w-16 h-16 ${menu.bgColor} rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 opacity-50`}></div>
                  <span className={`block ${menu.textColor} font-black text-lg mb-1 relative z-10`}>{menu.title}</span>
                  <span className="block text-gray-500 font-medium text-xs relative z-10 line-clamp-2 leading-relaxed">{menu.items.map(i => i.name).join(' & ')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <p className="text-gray-400 font-bold flex items-center gap-2 text-xs uppercase tracking-wider mb-3 px-1"><Zap size={14} /> ジム外アクティビティ</p>
          <button onClick={() => setCurrentView('squat')} className="w-full bg-white border border-green-100 p-5 rounded-2xl shadow-sm flex items-center justify-between group hover:border-green-300 hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-xl text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors"><Zap size={22} /></div>
              <div className="text-left">
                <span className="block text-gray-800 font-bold text-lg">{squatSettings.name}</span>
                <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                  <span>今月の貯筋: <b>{paceData.monthlySquatTotal}</b>{squatSettings.unit}</span>
                </div>
              </div>
            </div>
            <ChevronRight className="text-gray-300 group-hover:text-green-500 transition-colors" />
          </button>
        </div>
      </div>

      {renderCalendar()}

      <div className="text-center text-[10px] text-gray-300 mt-8 mb-4 font-medium">
        カレンダーの日付をタップして<br />記録の修正や予定の登録ができます
      </div>

      {renderEditModal()}
    </div>
  );
}
