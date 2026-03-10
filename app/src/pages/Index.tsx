import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { StatsCards } from '@/components/StatsCards';
import { RiverMap } from '@/components/RiverMap';
import { BridgeDetailsPanel } from '@/components/BridgeDetailsPanel';
import { NotificationPanel } from '@/components/NotificationPanel';
import { TimelineSlider } from '@/components/TimelineSlider';
import { getBridgeStates, getMode, getDataTimeRange, generateNotifications, generateEventLog } from '@/data/mockData';
import { loadSensorData, dataStartMs, dataEndMs } from '@/data/dataService';
import { loadOnnxModels } from '@/data/onnxService';
import { Droplets } from 'lucide-react';
import AnalyticsPage from './AnalyticsPage';

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBridgeId, setSelectedBridgeId] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    Promise.all([loadSensorData(), loadOnnxModels()])
      .then(() => {
        if (dataStartMs && dataEndMs) {
          const mid = dataStartMs + (dataEndMs - dataStartMs) * 0.5;
          setSelectedDate(new Date(mid));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, []);

  const mode = getMode(selectedDate);
  const bridgeStates = useMemo(() => getBridgeStates(selectedDate), [selectedDate, loading]);
  const notifications = useMemo(
    () => generateNotifications(bridgeStates, selectedDate),
    [bridgeStates, selectedDate]
  );
  const events = useMemo(
    () => generateEventLog(bridgeStates, selectedDate),
    [bridgeStates, selectedDate]
  );
  const selectedBridge = useMemo(
    () => (selectedBridgeId ? bridgeStates.find((b) => b.id === selectedBridgeId) || null : null),
    [selectedBridgeId, bridgeStates]
  );

  const dataRange = getDataTimeRange();

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary animate-pulse">
          <Droplets className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">АкваНадзор Кача</p>
          <p className="text-sm text-muted-foreground mt-1">Загрузка данных сенсоров…</p>
        </div>
      </div>
    );
  }

  if (showAnalytics) {
    return (
      <AnalyticsPage
        bridgeStates={bridgeStates}
        selectedDate={selectedDate}
        onBridgeClick={(id) => {
          setSelectedBridgeId(id);
          setShowAnalytics(false);
        }}
        onBack={() => setShowAnalytics(false)}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background relative">
      <Header
        mode={mode}
        selectedDate={selectedDate}
        notifications={notifications}
        bridgeStates={bridgeStates}
        onNotificationsClick={() => setShowNotifications((v) => !v)}
        onAnalyticsClick={() => setShowAnalytics(true)}
      />
      <StatsCards states={bridgeStates} />

      <div className="relative flex-1 min-h-0">
        <RiverMap
          bridges={bridgeStates}
          selectedDate={selectedDate}
          events={events}
          onBridgeClick={(id) => {
            setSelectedBridgeId(id);
            setShowNotifications(false);
          }}
        />
        <NotificationPanel
          open={showNotifications}
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onGoToBridge={(id) => {
            setSelectedBridgeId(id);
            setShowNotifications(false);
          }}
        />
      </div>

      <TimelineSlider
        selectedDate={selectedDate}
        onChange={setSelectedDate}
        dataRange={dataRange}
      />

      <BridgeDetailsPanel
        bridge={selectedBridge}
        selectedDate={selectedDate}
        onClose={() => setSelectedBridgeId(null)}
      />
    </div>
  );
};

export default Index;
