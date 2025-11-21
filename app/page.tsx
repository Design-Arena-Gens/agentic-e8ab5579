"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type VoiceOption = {
  id: string;
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice;
};

type QueueItemStatus = "pending" | "speaking" | "completed" | "error" | "cancelled";

type QueueItem = {
  id: string;
  text: string;
  voiceId: string;
  rate: number;
  pitch: number;
  volume: number;
  status: QueueItemStatus;
  error?: string;
};

const randomId = () => Math.random().toString(36).slice(2, 10);

const defaultText =
  "Never lose your ideas again. Paste anything you want to hear, dial in the perfect voice, and generate speech instantly.";

export default function Page() {
  const [text, setText] = useState(defaultText);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [supportsSpeech, setSupportsSpeech] = useState(true);

  const speechRef = useRef<typeof window.speechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSupportsSpeech(false);
      return;
    }

    speechRef.current = window.speechSynthesis;

    const mapVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const mapped: VoiceOption[] = availableVoices.map((voice) => ({
        id: voice.name + voice.lang,
        name: voice.name,
        lang: voice.lang,
        voice
      }));
      setVoices(mapped);
      if (!selectedVoice && mapped.length > 0) {
        const preferred =
          mapped.find((voice) => voice.lang.toLowerCase().startsWith("en")) ?? mapped[0];
        setSelectedVoice(preferred.id);
      }
    };

    mapVoices();
    window.speechSynthesis.onvoiceschanged = mapVoices;

    return () => {
      if (window?.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [selectedVoice]);

  const selectedVoiceInfo = useMemo(
    () => voices.find((voice) => voice.id === selectedVoice),
    [voices, selectedVoice]
  );

  const speak = useCallback((item: QueueItem) => {
    if (!speechRef.current || !supportsSpeech) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(item.text);
    currentUtteranceRef.current = utterance;
    const voice = voices.find((v) => v.id === item.voiceId)?.voice;
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = item.rate;
    utterance.pitch = item.pitch;
    utterance.volume = item.volume;

    utterance.onstart = () => {
      setQueue((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, status: "speaking" } : entry))
      );
    };

    utterance.onend = () => {
      setQueue((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: speechRef.current?.speaking ? "cancelled" : "completed" }
            : entry
        )
      );
      currentUtteranceRef.current = null;
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      setQueue((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: "error", error: event.error ?? "Unknown error" }
            : entry
        )
      );
      currentUtteranceRef.current = null;
      setIsPaused(false);
    };

    speechRef.current.cancel();
    speechRef.current.speak(utterance);
  }, [supportsSpeech, voices]);

  useEffect(() => {
    if (!speechRef.current || !supportsSpeech) {
      return;
    }

    const current = queue.find((item) => item.status === "speaking");
    if (current || isPaused) {
      return;
    }

    const next = queue.find((item) => item.status === "pending");
    if (next) {
      speak(next);
    }
  }, [queue, isPaused, speak, supportsSpeech]);

  const handleAddToQueue = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const item: QueueItem = {
      id: randomId(),
      text: trimmed,
      voiceId: selectedVoiceInfo?.id ?? "",
      rate,
      pitch,
      volume,
      status: "pending"
    };

    setQueue((prev) => [...prev, item]);
  };

  const handleSpeakNow = () => {
    handleAddToQueue();
  };

  const handleStop = () => {
    if (!speechRef.current) {
      return;
    }
    speechRef.current.cancel();
    currentUtteranceRef.current = null;
    setQueue((prev) =>
      prev.map((entry) =>
        entry.status === "speaking" ? { ...entry, status: "cancelled" } : entry
      )
    );
    setIsPaused(false);
  };

  const handlePauseResume = () => {
    if (!speechRef.current) {
      return;
    }

    if (speechRef.current.speaking && !speechRef.current.paused) {
      speechRef.current.pause();
      setIsPaused(true);
    } else if (speechRef.current.paused) {
      speechRef.current.resume();
      setIsPaused(false);
    }
  };

  const handleClearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status === "pending" || item.status === "speaking"));
  };

  const speakingStatus = useMemo(() => {
    const active = queue.find((item) => item.status === "speaking");
    if (!active) {
      return "Idle";
    }
    return isPaused ? "Paused" : "Speaking";
  }, [queue, isPaused]);

  return (
    <main>
      <h1>Agentic Speech Studio</h1>
      <p>
        Transform any thought, script, or note into lifelike audio. Tune the voice, pace, and
        delivery. Queue up ideas and let the voice agent bring them to life.
      </p>
      {!supportsSpeech ? (
        <div className="output-card">
          <h2>Speech Synthesis Not Supported</h2>
          <p>
            Your browser does not support the Web Speech API. Try using a recent version of Chrome,
            Edge, or Safari instead.
          </p>
        </div>
      ) : (
        <>
          <textarea value={text} onChange={(event) => setText(event.target.value)} />
          <div className="controls">
            <label>
              Voice
              <select
                value={selectedVoice}
                onChange={(event) => setSelectedVoice(event.target.value)}
              >
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} — {voice.lang}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rate: {rate.toFixed(2)}×
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
              />
            </label>
            <label>
              Pitch: {pitch.toFixed(2)}
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={pitch}
                onChange={(event) => setPitch(Number(event.target.value))}
              />
            </label>
            <label>
              Volume: {(volume * 100).toFixed(0)}%
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="status">
            <span>
              <span className="status-dot" />
              {speakingStatus}
            </span>
            <span>Voices available: {voices.length || "…loading"}</span>
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", flexWrap: "wrap" }}>
            <button onClick={handleSpeakNow} disabled={!text.trim()}>
              Speak &amp; Queue
            </button>
            <button
              className="secondary"
              onClick={handlePauseResume}
              disabled={!queue.some((item) => item.status === "speaking")}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button className="secondary" onClick={handleStop} disabled={!queue.length}>
              Stop
            </button>
            <button
              className="secondary"
              onClick={handleClearCompleted}
              disabled={!queue.some((item) => item.status === "completed" || item.status === "error")}
            >
              Clear Completed
            </button>
          </div>
          <div className="output-card" style={{ marginTop: "2rem" }}>
            <h2>Speech Queue</h2>
            {queue.length === 0 ? (
              <p>No speech tasks yet. Add something to the queue to get started.</p>
            ) : (
              <div className="queue">
                {queue.map((item) => (
                  <div key={item.id} className="queue-item">
                    <span>{item.text.slice(0, 120) + (item.text.length > 120 ? "…" : "")}</span>
                    <span>
                      {item.status === "pending" && "⏳ Pending"}
                      {item.status === "speaking" && (isPaused ? "⏸️ Paused" : "🔊 Playing")}
                      {item.status === "completed" && "✅ Completed"}
                      {item.status === "cancelled" && "🛑 Cancelled"}
                      {item.status === "error" && `⚠️ Error: ${item.error ?? "Unknown"}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
