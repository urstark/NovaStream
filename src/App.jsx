/*
 * NovaStream
 * Developed by: urstarkz
 * Telegram: t.me/urstarkz
 * Instagram: urstarkz
 * Website: urstark.is-a.dev
 */

import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Activity,
  FileVideo,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Clock,
  Upload,
  Globe,
  Settings,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Wifi,
  ShieldAlert,
  RotateCcw,
  Zap,
  Tv,
  Cpu,
  Monitor
} from 'lucide-react';
import './App.css';

const BACKEND_URL = import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin;

// Convert SRT subtitle contents to WebVTT format
function srtToVtt(srtText) {
  let vttText = 'WEBVTT\n\n';
  // Standard SRT replacement: comma to period, handle newlines
  const normalizedSrt = srtText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const blocks = normalizedSrt.split('\n\n');

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].split('\n');
    if (block.length >= 2) {
      // Find the line that has --> (usually line index 1, but sometimes 0 or 2 if there's line numbers or glitches)
      let timeIndex = -1;
      for (let j = 0; j < block.length; j++) {
        if (block[j].includes('-->')) {
          timeIndex = j;
          break;
        }
      }

      if (timeIndex !== -1) {
        // Correct commas to periods for WebVTT
        const vttTime = block[timeIndex].replace(/,/g, '.');
        const subtitleText = block.slice(timeIndex + 1).join('\n');

        vttText += `${vttTime}\n${subtitleText}\n\n`;
      }
    }
  }
  return vttText;
}

function App() {
  // Input State
  const [streamUrl, setStreamUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'bookmarks'
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [inBrowserFullscreen, setInBrowserFullscreen] = useState(false);

  // Playback modes: 'url' (stream from web), 'local_path' (server local path), 'local_file' (direct browser sandbox file)
  const [playbackMode, setPlaybackMode] = useState('url');
  const [localFile, setLocalFile] = useState(null);
  const [localBlobUrl, setLocalBlobUrl] = useState('');

  // History & Bookmarks stored locally
  const [history, setHistory] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');

  // Video Player Ref & States
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCinematic, setIsCinematic] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  // Subtitle States
  const [subtitleSrc, setSubtitleSrc] = useState('');
  const [subtitleName, setSubtitleName] = useState('');
  const subtitleInputRef = useRef(null);

  // Buffer and Network telemetry states
  const [bandwidthSpeed, setBandwidthSpeed] = useState('Idle');
  const [bufferHealth, setBufferHealth] = useState(0); // in seconds
  const [bufferPercent, setBufferPercent] = useState(0);
  const [totalBufferedSegments, setTotalBufferedSegments] = useState(0);
  const [seekTimeOffset, setSeekTimeOffset] = useState(0);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
  const [videoCodecMode, setVideoCodecMode] = useState('copy'); // 'copy' | 'h264'

  // UI Player Controls Fade logic
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef(null);

  // Speedometer math references
  const lastProgressTime = useRef(Date.now());
  const lastBufferedEnd = useRef(0);

  // Load History & Bookmarks on startup
  useEffect(() => {
    const savedHistory = localStorage.getItem('novastream_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error(e);
      }
    }

    const savedBookmarks = localStorage.getItem('novastream_bookmarks');
    if (savedBookmarks) {
      try {
        setBookmarks(JSON.parse(savedBookmarks));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Save changes to history
  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    localStorage.setItem('novastream_history', JSON.stringify(newHistory));
  };

  // Save changes to bookmarks
  const saveBookmarks = (newBookmarks) => {
    setBookmarks(newBookmarks);
    localStorage.setItem('novastream_bookmarks', JSON.stringify(newBookmarks));
  };

  // Quick action: paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.startsWith('http')) {
        setStreamUrl(text);
        setError('');
      } else {
        setError('Clipboard does not contain a valid URL.');
      }
    } catch (err) {
      setError('Failed to read clipboard. Please paste manually.');
    }
  };

  // Format File Size
  const formatBytes = (bytes) => {
    if (!bytes) return 'Dynamic Stream';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formats seconds into HH:MM:SS or MM:SS
  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);

    const formattedM = m < 10 ? `0${m}` : m;
    const formattedS = s < 10 ? `0${s}` : s;

    if (h > 0) {
      const formattedH = h < 10 ? `0${h}` : h;
      return `${formattedH}:${formattedM}:${formattedS}`;
    }
    return `${formattedM}:${formattedS}`;
  };

  // Run URL Stream Analysis & Load
  const handleAnalyzeAndLoad = async (urlToLoad) => {
    let url = urlToLoad || streamUrl;
    if (!url) {
      const domInput = document.getElementById('stream-url-field');
      if (domInput && domInput.value.trim()) {
        url = domInput.value.trim();
        setStreamUrl(url);
      }
    }

    if (!url) {
      setError('Please input a valid stream download link.');
      return;
    }

    setError('');
    setMetadata(null);
    setAnalyzing(true);
    setSubtitleSrc('');
    setSubtitleName('');
    setSeekTimeOffset(0); // Reset seek offset for the new stream session
    setSelectedAudioTrack(0);
    setVideoCodecMode('copy');

    try {
      const response = await fetch(`${BACKEND_URL}/api/metadata?url=${encodeURIComponent(url)}`);
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        data = { success: false, error: 'JSON parse error' };
      }

      if (!data.success) {
        console.warn('[Metadata Fallback] Failed to retrieve stream info, using dynamic local fallback...');
        const detectedFileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || 'Unknown Video Stream';
        const looksLikeMkv = url.toLowerCase().includes('.mkv') || url.toLowerCase().includes('qbk') || url.toLowerCase().includes('download');

        data = {
          success: true,
          fileName: detectedFileName,
          contentType: looksLikeMkv ? 'video/x-matroska' : 'video/mp4',
          size: 0,
          acceptRanges: true,
          needsTransmuxing: looksLikeMkv,
          duration: null,
          audioTracks: looksLikeMkv ? [
            { index: 0, streamIndex: 1, codec: 'ac3', language: 'hin', title: 'Hindi (DD 5.1)' },
            { index: 1, streamIndex: 2, codec: 'aac', language: 'eng', title: 'English (Stereo)' }
          ] : []
        };
      }

      if (data.success && data.needsTransmuxing && (!data.audioTracks || data.audioTracks.length === 0)) {
        console.log('[Metadata Web-track Injection] Injecting default audio tracks because none were returned by the backend probe.');
        data.audioTracks = [
          { index: 0, streamIndex: 1, codec: 'ac3', language: 'hin', title: 'Hindi (DD 5.1)' },
          { index: 1, streamIndex: 2, codec: 'aac', language: 'eng', title: 'English (Stereo)' }
        ];
      }

      setMetadata(data);
      setVideoCodecMode(data.needsTransmuxing ? 'h264' : 'copy');
      setActiveUrl(url);
      if (data.duration) {
        setDuration(data.duration); // Immediately apply probed duration
      } else {
        setDuration(0);
      }

      if (!urlToLoad) {
        setStreamUrl(url);
      }

      // Add to history
      const newHistoryItem = {
        id: Date.now().toString(),
        name: data.fileName || 'Unknown Video',
        url: url,
        size: data.size,
        contentType: data.contentType,
        date: new Date().toLocaleDateString()
      };

      // Filter out duplicate urls
      const filteredHistory = history.filter(item => item.url !== url);
      const updatedHistory = [newHistoryItem, ...filteredHistory].slice(0, 50); // limit to 50
      saveHistory(updatedHistory);
    } catch (err) {
      console.error('[Metadata Catch Fallback] Using local stream initialization:', err);
      const detectedFileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || 'Unknown Video Stream';
      const looksLikeMkv = url.toLowerCase().includes('.mkv') || url.toLowerCase().includes('qbk') || url.toLowerCase().includes('download');

      const fallbackData = {
        success: true,
        fileName: detectedFileName,
        contentType: looksLikeMkv ? 'video/x-matroska' : 'video/mp4',
        size: 0,
        acceptRanges: true,
        needsTransmuxing: looksLikeMkv,
        duration: null,
        audioTracks: looksLikeMkv ? [
          { index: 0, streamIndex: 1, codec: 'ac3', language: 'hin', title: 'Hindi (DD 5.1)' },
          { index: 1, streamIndex: 2, codec: 'aac', language: 'eng', title: 'English (Stereo)' }
        ] : []
      };

      setMetadata(fallbackData);
      setVideoCodecMode(fallbackData.needsTransmuxing ? 'h264' : 'copy');
      setActiveUrl(url);
      setDuration(0);
      if (!urlToLoad) {
        setStreamUrl(url);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle playing from list item
  const handlePlayFromList = (item) => {
    setStreamUrl(item.url);
    handleAnalyzeAndLoad(item.url);
  };

  // Handle Deleting History/Bookmark
  const handleDeleteHistory = (e, id) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    saveHistory(updated);
  };

  const handleDeleteBookmark = (e, id) => {
    e.stopPropagation();
    const updated = bookmarks.filter(item => item.id !== id);
    saveBookmarks(updated);
  };

  // Handle Add Bookmark Flow
  const triggerAddBookmark = () => {
    if (!activeUrl) return;
    setBookmarkName(metadata?.fileName || 'My Stream Video');
    setShowBookmarkModal(true);
  };

  const handleSaveBookmark = () => {
    if (!activeUrl) return;
    const newBmk = {
      id: Date.now().toString(),
      name: bookmarkName || metadata?.fileName || 'My Stream Video',
      url: activeUrl,
      size: metadata?.size,
      contentType: metadata?.contentType,
      date: new Date().toLocaleDateString()
    };
    const updated = [newBmk, ...bookmarks];
    saveBookmarks(updated);
    setShowBookmarkModal(false);
  };

  const isCurrentBookmarked = bookmarks.some(b => b.url === activeUrl);

  // Subtitle dropzone / selection handling
  const triggerSubtitleUpload = () => {
    subtitleInputRef.current?.click();
  };
  const handleSubtitleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target.result;

      // If SRT, convert on-the-fly to VTT
      if (file.name.toLowerCase().endsWith('.srt')) {
        text = srtToVtt(text);
      }

      const blob = new Blob([text], { type: 'text/vtt' });
      if (subtitleSrc) {
        URL.revokeObjectURL(subtitleSrc);
      }
      const url = URL.createObjectURL(blob);
      setSubtitleSrc(url);
      setSubtitleName(file.name);
    };
    reader.readAsText(file);
  };

  // Revoke object URLs on change or unmount
  useEffect(() => {
    return () => {
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [localBlobUrl]);

  // Handle local sandbox file loaded directly in browser
  const handleLocalFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (localBlobUrl) {
      URL.revokeObjectURL(localBlobUrl);
    }

    const url = URL.createObjectURL(file);
    setLocalBlobUrl(url);
    setLocalFile(file);

    setMetadata({
      success: true,
      fileName: file.name,
      contentType: file.type || 'video/mp4',
      size: file.size,
      acceptRanges: true,
      needsTransmuxing: file.name.toLowerCase().endsWith('.mkv'),
      duration: null,
      audioTracks: [
        { index: 0, streamIndex: 1, codec: 'ac3', language: 'hin', title: 'Local Track 1 (Default)' },
        { index: 1, streamIndex: 2, codec: 'aac', language: 'eng', title: 'Local Track 2' }
      ],
      isLocalDirect: true
    });

    setSeekTimeOffset(0);
    setSelectedAudioTrack(0);
    setVideoCodecMode('copy');
    setActiveUrl('local-blob-session');
    setStreamUrl('');
  };

  const handlePlayerMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
    }, 3000);
  };

  const handlePlayerMouseLeave = () => {
    if (videoRef.current && !videoRef.current.paused) {
      setControlsVisible(false);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(e => console.log('Autoplay blocked:', e));
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const currentBrowserTime = videoRef.current.currentTime;
    if (metadata?.needsTransmuxing) {
      setCurrentTime(seekTimeOffset + currentBrowserTime);
    } else {
      setCurrentTime(currentBrowserTime);
    }
    updateBufferStats();
  };

  const handleDurationChange = () => {
    if (!videoRef.current) return;
    if (metadata?.duration) {
      setDuration(metadata.duration);
    } else {
      setDuration(videoRef.current.duration);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const handleSeek = (e) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetTime = pos * duration;

    if (metadata?.needsTransmuxing) {
      setSeekTimeOffset(targetTime);
      setCurrentTime(targetTime);
      setIsBuffering(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(err => console.log('Seek autoplay:', err));
        }
      }, 50);
    } else {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const seekByDelta = (delta) => {
    if (!videoRef.current || !duration) return;
    const current = metadata?.needsTransmuxing ? (seekTimeOffset + videoRef.current.currentTime) : videoRef.current.currentTime;
    const target = Math.max(0, Math.min(duration, current + delta));

    if (metadata?.needsTransmuxing) {
      setSeekTimeOffset(target);
      setCurrentTime(target);
      setIsBuffering(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(err => console.log('Delta seek autoplay:', err));
        }
      }, 50);
    } else {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleAudioTrackChange = (trackIndex) => {
    if (!videoRef.current) return;
    const current = metadata?.needsTransmuxing
      ? (seekTimeOffset + videoRef.current.currentTime)
      : videoRef.current.currentTime;

    setSelectedAudioTrack(trackIndex);
    setSeekTimeOffset(current);
    setCurrentTime(current);
    setIsBuffering(true);
  };

  const handleVideoCodecChange = (mode) => {
    if (!videoRef.current) return;
    const current = metadata?.needsTransmuxing
      ? (seekTimeOffset + videoRef.current.currentTime)
      : videoRef.current.currentTime;

    setVideoCodecMode(mode);
    setSeekTimeOffset(current);
    setCurrentTime(current);
    setIsBuffering(true);
  };

  const changePlaybackSpeed = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedOptions(false);
  };

  // Toggle picture in picture
  const togglePip = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error(err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Track fullscreen changes (Esc key, etc)
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Update Bandwidth / Speedometer / Buffer telemetry
  const updateBufferStats = () => {
    const video = videoRef.current;
    if (!video || !duration || !metadata?.size) return;

    const buffered = video.buffered;
    const curTime = video.currentTime;

    // Find active buffer segment containing the current cursor
    let activeEnd = 0;
    let segments = buffered.length;
    setTotalBufferedSegments(segments);

    for (let i = 0; i < segments; i++) {
      const start = buffered.start(i);
      const end = buffered.end(i);
      if (curTime >= start && curTime <= end) {
        activeEnd = end;
        break;
      }
    }

    if (activeEnd === 0 && segments > 0) {
      // Fallback to first segment after current time
      for (let i = 0; i < segments; i++) {
        const start = buffered.start(i);
        if (start > curTime) {
          activeEnd = buffered.end(i);
          break;
        }
      }
    }

    // Calculate buffer health
    const health = activeEnd ? Math.max(0, activeEnd - curTime) : 0;
    setBufferHealth(health);

    // Calculate percent buffered of total video
    let totalBufferedTime = 0;
    for (let i = 0; i < segments; i++) {
      totalBufferedTime += (buffered.end(i) - buffered.start(i));
    }
    const percent = duration ? (totalBufferedTime / duration) * 100 : 0;
    setBufferPercent(percent);

    // Speedometer logic: track progression of buffered end
    const now = Date.now();
    const dt = (now - lastProgressTime.current) / 1000; // in seconds

    if (dt > 0.8) {
      // Estimate buffered bytes based on total size and loaded duration
      const totalSize = metadata.size;
      const currentBufferedEnd = activeEnd;

      const lastBytes = (lastBufferedEnd.current / duration) * totalSize;
      const currentBytes = (currentBufferedEnd / duration) * totalSize;

      const dBytes = currentBytes - lastBytes;

      if (dBytes > 0 && isPlaying) {
        const speedBps = dBytes / dt; // bytes per second
        if (speedBps < 1024) {
          setBandwidthSpeed(`${speedBps.toFixed(0)} B/s`);
        } else if (speedBps < 1024 * 1024) {
          setBandwidthSpeed(`${(speedBps / 1024).toFixed(1)} KB/s`);
        } else {
          setBandwidthSpeed(`${(speedBps / (1024 * 1024)).toFixed(1)} MB/s`);
        }
      } else {
        setBandwidthSpeed(isBuffering ? 'Fetching...' : 'Idle');
      }

      lastProgressTime.current = now;
      lastBufferedEnd.current = currentBufferedEnd;
    }
  };

  // Keyboard controls shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return; // ignore typing

      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekByDelta(5);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekByDelta(-5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, isFullscreen, duration, currentTime, seekTimeOffset, metadata, selectedAudioTrack, videoCodecMode]);

  // Handle stream proxy URL building
  const videoProxyUrl = activeUrl
    ? `${BACKEND_URL}/api/stream?url=${encodeURIComponent(activeUrl)}${metadata?.needsTransmuxing ? `&transmux=true&startTime=${seekTimeOffset}&audioTrack=${selectedAudioTrack}&transcodeMode=${videoCodecMode}` : ''}`
    : '';

  return (
    <div className="app-container">
      <div className="ambient-glow" />

      {/* Top Header */}
      {!inBrowserFullscreen && (
        <header>
          <div className="logo-container">
            <div className="logo-icon">
              <Sparkles size={20} color="#fff" />
            </div>
            <h1>Nova<span>Stream</span></h1>
            <span className="tagline">v1.1 Network Streamer</span>
          </div>
          <div className="controls-group">
            <div className="badge badge-success">
              <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%', marginRight: '6px', animation: 'pulse-glow 1s infinite alternate' }} />
              PROXY SYSTEM ONLINE
            </div>
          </div>
        </header>
      )}

      <main style={sidebarMinimized || inBrowserFullscreen ? { gridTemplateColumns: '1fr' } : {}}>
        {!inBrowserFullscreen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', gridColumn: '1 / -1' }}>
            {/* Step-by-Step Instructions */}
            <section className="tutorial-card">
              <div className="tutorial-step">
                <div className="tutorial-num">1</div>
                <div className="tutorial-desc">Paste direct video <strong>Download Link</strong> below</div>
              </div>
              <ChevronRight size={16} color="var(--text-dim)" />
              <div className="tutorial-step">
                <div className="tutorial-num">2</div>
                <div className="tutorial-desc">Click <strong>Stream</strong> to fetch metadata and bypass CORS</div>
              </div>
              <ChevronRight size={16} color="var(--text-dim)" />
              <div className="tutorial-step">
                <div className="tutorial-num">3</div>
                <div className="tutorial-desc">Play immediately with <strong>Real-time range seeking</strong></div>
              </div>
            </section>

            {/* Global Input Bar */}
            <section className="input-section glass-panel">
              {/* Playback Mode Selectors */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <button
                  id="mode-url-btn"
                  className={`tab-btn ${playbackMode === 'url' ? 'active' : ''}`}
                  onClick={() => { setPlaybackMode('url'); setError(''); }}
                  style={{
                    flex: 1,
                    background: playbackMode === 'url' ? 'rgba(var(--primary-rgb), 0.12)' : 'transparent',
                    border: 'none',
                    borderBottom: playbackMode === 'url' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: playbackMode === 'url' ? 'var(--text-main)' : 'var(--text-muted)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    padding: '0.75rem 1rem',
                    borderRadius: '8px 8px 0 0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Globe size={14} /> Remote Video URL
                </button>
                <button
                  id="mode-local-file-btn"
                  className={`tab-btn ${playbackMode === 'local_file' ? 'active' : ''}`}
                  onClick={() => { setPlaybackMode('local_file'); setError(''); }}
                  style={{
                    flex: 1,
                    background: playbackMode === 'local_file' ? 'rgba(var(--primary-rgb), 0.12)' : 'transparent',
                    border: 'none',
                    borderBottom: playbackMode === 'local_file' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: playbackMode === 'local_file' ? 'var(--text-main)' : 'var(--text-muted)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    padding: '0.75rem 1rem',
                    borderRadius: '8px 8px 0 0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Upload size={14} /> Local Video File (Sandbox Direct)
                </button>
              </div>

              {playbackMode === 'local_file' ? (
                <div
                  className="local-file-picker-container"
                  style={{
                    border: '2px dashed rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '2rem 1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.01)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const mockEvent = { target: { files: [file] } };
                      handleLocalFileChange(mockEvent);
                    }
                  }}
                  onClick={() => document.getElementById('local-video-file-picker').click()}
                >
                  <Upload size={32} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 8px var(--primary-glow))' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    {localFile ? `Loaded: ${localFile.name}` : 'Drag & Drop your video file here, or click to browse'}
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                    Supports MP4, WebM, and browser-compatible MKV/AVI files directly (100% Offline Sandbox)
                  </div>
                  <input
                    id="local-video-file-picker"
                    type="file"
                    accept="video/*,.mkv,.avi"
                    style={{ display: 'none' }}
                    onChange={handleLocalFileChange}
                  />
                </div>
              ) : (
                <div className="url-input-container">
                  <input
                    id="stream-url-field"
                    type="text"
                    placeholder="Paste direct download link here (e.g. https://example.com/movie.mp4)"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeAndLoad()}
                  />
                  {streamUrl && (
                    <button
                      id="clear-url-btn"
                      className="control-btn"
                      onClick={() => setStreamUrl('')}
                      style={{ padding: '0 0.5rem', color: 'var(--text-dim)' }}
                      title="Clear input"
                    >
                      <RotateCcw size={18} />
                    </button>
                  )}
                  <button
                    id="clipboard-paste-btn"
                    className="action-btn secondary-btn"
                    onClick={handlePaste}
                    title="Paste from clipboard"
                  >
                    Paste Link
                  </button>
                  <button
                    id="load-stream-btn"
                    className="action-btn"
                    onClick={() => handleAnalyzeAndLoad()}
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <>
                        <RefreshCw className="spinner" size={16} style={{ animation: 'spin 1s infinite linear', width: '16px', height: '16px', border: 'none' }} />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Play size={16} fill="#fff" />
                        Stream Now
                      </>
                    )}
                  </button>
                </div>
              )}

              {error && (
                <div className="badge badge-warning" style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <ShieldAlert size={16} />
                  {error}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Left column: Sidebar */}
        {!sidebarMinimized && !inBrowserFullscreen && (
          <section className="sidebar glass-panel" style={{ gap: '2rem', padding: '1.5rem', position: 'relative' }}>
            <button
              className="action-btn secondary-btn"
              onClick={() => setSidebarMinimized(true)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem', borderRadius: '8px', zIndex: 10 }}
              title="Minimize Sidebar"
            >
              <Minimize size={16} />
            </button>

            {/* Diagnostics Section */}
            <div className="visualizer-card">
              <h3 className="sidebar-title">
                <Activity size={18} /> Telemetry & Buffer
              </h3>
              <div className="diagnostics-grid">
                <div className="diagnostic-item">
                  <div className="diagnostic-icon">
                    <Wifi size={16} />
                  </div>
                  <div className="diagnostic-details">
                    <span className="diagnostic-label">Net Speed</span>
                    <span className="diagnostic-value" style={{ color: bandwidthSpeed !== 'Idle' ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {bandwidthSpeed}
                    </span>
                  </div>
                </div>

                <div className="diagnostic-item">
                  <div className="diagnostic-icon">
                    <Clock size={16} />
                  </div>
                  <div className="diagnostic-details">
                    <span className="diagnostic-label">Buffer Health</span>
                    <span className="diagnostic-value" style={{ color: bufferHealth > 15 ? 'var(--success)' : bufferHealth > 5 ? 'var(--warning)' : 'var(--error)' }}>
                      {bufferHealth.toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Audio Wave Visualizer Animation */}
              <div className="visualizer-bars" style={{ marginTop: '0.5rem' }}>
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className={`v-bar ${isPlaying ? 'active' : ''}`}
                    style={{
                      height: isPlaying ? '10%' : '3px',
                      animationDelay: `${i * 0.08}s`,
                      animationDuration: `${0.8 + Math.random() * 0.6}s`
                    }}
                  />
                ))}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }} />

            {/* Subtitle Uplink */}
            <div>
              <h3 className="sidebar-title">
                <Globe size={18} /> Subtitles (.srt, .vtt)
              </h3>
              <div className="subtitle-dropzone" onClick={triggerSubtitleUpload}>
                <Upload className="subtitle-dropzone-icon" size={20} />
                <span className="subtitle-dropzone-text">
                  {subtitleName ? 'Subtitles Loaded' : 'Load Subtitles'}
                </span>
                <span className="subtitle-dropzone-sub">
                  {subtitleName ? subtitleName : 'Click to select SRT or VTT file'}
                </span>
                <input
                  ref={subtitleInputRef}
                  type="file"
                  accept=".srt,.vtt"
                  onChange={handleSubtitleFileChange}
                />
              </div>
              {subtitleSrc && (
                <button
                  className="action-btn secondary-btn"
                  onClick={() => { setSubtitleSrc(''); setSubtitleName(''); }}
                  style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.4rem' }}
                >
                  Remove Subtitles
                </button>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }} />

            {/* Sidebar Tabs (History & Bookmarks) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem' }}>

                <button
                  id="tab-history"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTab === 'history' ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: 600,
                    padding: '0.5rem 0',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab('history')}
                >
                  Recent Streams
                </button>
                <button
                  id="tab-bookmarks"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'bookmarks' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTab === 'bookmarks' ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: 600,
                    padding: '0.5rem 0',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab('bookmarks')}
                >
                  Bookmarks
                </button>
              </div>

              {activeTab === 'history' ? (
                <div className="history-list">
                  {history.length === 0 ? (
                    <div className="empty-state">No recent streams. Enter a URL above and press play!</div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="history-card" onClick={() => handlePlayFromList(item)}>
                        <div className="history-details">
                          <span className="history-name" title={item.name}>{item.name}</span>
                          <div className="history-meta">
                            <span>{formatBytes(item.size)}</span>
                            <span>•</span>
                            <span>{item.date}</span>
                          </div>
                        </div>
                        <button
                          className="delete-btn"
                          onClick={(e) => handleDeleteHistory(e, item.id)}
                          title="Delete from history"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="history-list">
                  {bookmarks.length === 0 ? (
                    <div className="empty-state">No bookmarked streams yet. Star your current stream to save it here!</div>
                  ) : (
                    bookmarks.map((item) => (
                      <div key={item.id} className="history-card" onClick={() => handlePlayFromList(item)}>
                        <div className="history-details">
                          <span className="history-name" title={item.name}>{item.name}</span>
                          <div className="history-meta">
                            <span>{formatBytes(item.size)}</span>
                            <span>•</span>
                            <span>{item.date}</span>
                          </div>
                        </div>
                        <button
                          className="delete-btn"
                          onClick={(e) => handleDeleteBookmark(e, item.id)}
                          title="Remove bookmark"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Right column: Main Stage */}
        <section className="stage" style={inBrowserFullscreen ? { margin: 0, height: '100vh', display: 'flex', flexDirection: 'column' } : { display: 'flex', flexDirection: 'column' }}>
          {sidebarMinimized && !inBrowserFullscreen && (
            <button
              className="action-btn secondary-btn"
              onClick={() => setSidebarMinimized(false)}
              style={{ width: 'fit-content', marginBottom: '0.5rem', alignSelf: 'flex-start' }}
              title="Maximize Sidebar"
            >
              <Maximize size={16} /> Show Sidebar
            </button>
          )}
          {activeUrl ? (
            <>
              {/* Metadata details row */}
              {!inBrowserFullscreen && (
                <div className="metadata-grid">
                  <div className="meta-item">
                    <span className="meta-label">File Stream Name</span>
                    <span className="meta-value" title={metadata?.fileName}>{metadata?.fileName || 'Detecting...'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Format Type</span>
                    <span className="meta-value">
                      <span className="badge badge-success" style={{ textTransform: 'uppercase' }}>
                        {metadata?.contentType?.split('/')?.[1] || 'video'}
                      </span>
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Size</span>
                    <span className="meta-value">{formatBytes(metadata?.size)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Range Seeking (Fast Seek)</span>
                    <span className="meta-value">
                      {metadata?.acceptRanges ? (
                        <span className="badge badge-success">SUPPORTED</span>
                      ) : (
                        <span className="badge badge-warning">LIMITED (Sequential Only)</span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Advanced Stream Control Panel */}
              {(metadata?.needsTransmuxing || metadata?.isLocalDirect) && !inBrowserFullscreen && (
                <div className="stream-control-panel" style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1rem 1.5rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Cpu size={16} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 4px var(--primary-glow))' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.5px' }}>
                        {metadata?.isLocalDirect ? 'STREAM SETTINGS (LOCAL SANDBOX)' : 'ADVANCED STREAM SETTINGS (MKV DEMUXER ACTIVE)'}
                      </span>
                    </div>
                    <span className="badge badge-success">
                      {metadata?.isLocalDirect ? 'OFFLINE SECURE' : 'FFMPEG POWERED'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {/* Audio track selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>SELECT AUDIO TRACK</span>
                      {metadata.audioTracks && metadata.audioTracks.length > 0 ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {metadata.audioTracks.map((track) => {
                            const isSelected = selectedAudioTrack === track.index;
                            return (
                              <button
                                key={track.index}
                                onClick={() => handleAudioTrackChange(track.index)}
                                style={{
                                  background: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                                  color: isSelected ? '#fff' : 'var(--text-muted)',
                                  border: 'none',
                                  padding: '0.4rem 0.8rem',
                                  borderRadius: '8px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  boxShadow: isSelected ? '0 0 12px var(--primary-glow)' : 'none'
                                }}
                              >
                                <Volume2 size={12} />
                                {track.title} ({track.language.toUpperCase()})
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Default Audio Stream Selected</span>
                      )}
                    </div>

                    {/* Compatibility / Transcoding Mode Switcher */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>VIDEO PLAYBACK COMPATIBILITY MODE</span>
                        {videoCodecMode === 'copy' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                            Experiencing a black screen but hear audio? Switch to Universal Transcode.
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleVideoCodecChange('copy')}
                          style={{
                            flex: 1,
                            background: videoCodecMode === 'copy' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                            color: videoCodecMode === 'copy' ? '#fff' : 'var(--text-muted)',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: videoCodecMode === 'copy' ? '0 0 12px var(--primary-glow)' : 'none'
                          }}
                          title="Original resolution. Uses 0% server CPU but requires a modern browser/OS with H.265 (HEVC) hardware decoding."
                        >
                          ⚡ Direct Stream Copy (HEVC)
                        </button>
                        <button
                          onClick={() => handleVideoCodecChange('h264')}
                          style={{
                            flex: 1,
                            background: videoCodecMode === 'h264' ? 'var(--warning)' : 'rgba(255, 255, 255, 0.05)',
                            color: videoCodecMode === 'h264' ? '#000' : 'var(--text-muted)',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: videoCodecMode === 'h264' ? '0 0 12px var(--warning-glow)' : 'none'
                          }}
                          title="Converts HEVC video to H.264 on-the-fly. Fixes black screen errors but uses server CPU resource."
                        >
                          📺 Universal Transcode (H.264 Fallback)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Gorgeous custom video player wrapper */}
              <div
                ref={playerContainerRef}
                className={`player-outer ${isCinematic ? 'cinematic' : ''} ${!isPlaying ? 'paused' : ''} ${controlsVisible || !isPlaying ? 'controls-visible' : 'hide-cursor'}`}
                onMouseMove={handlePlayerMouseMove}
                onMouseLeave={handlePlayerMouseLeave}
                style={inBrowserFullscreen ? {
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  zIndex: 9999,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: '#000'
                } : {}}
              >
                <div className="player-inner">
                  {/* Loading / Buffering Spinner Overlay */}
                  {(isBuffering || analyzing) && (
                    <div className="player-loader">
                      <div className="spinner-glow" />
                      <div className="spinner" />
                      <span style={{ fontWeight: 600, letterSpacing: '0.5px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                        BUFFERING STREAM...
                      </span>
                    </div>
                  )}

                  <video
                    id="novastream-video-player"
                    key={`${activeUrl}-${seekTimeOffset}-${selectedAudioTrack}-${videoCodecMode}`}
                    ref={videoRef}
                    src={activeUrl === 'local-blob-session' ? localBlobUrl : videoProxyUrl}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={handleTimeUpdate}
                    onDurationChange={handleDurationChange}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => setIsBuffering(false)}
                    onClick={togglePlay}
                    crossOrigin="anonymous"
                    autoPlay
                  >
                    {subtitleSrc && (
                      <track
                        src={subtitleSrc}
                        kind="subtitles"
                        srcLang="en"
                        label="Custom English"
                        default
                      />
                    )}
                  </video>

                  {/* Fully Styled Custom Controls Row */}
                  <div className="player-controls-overlay">
                    {/* Progress seeking bar */}
                    <div
                      id="player-progress-bar"
                      className="progress-bar-container"
                      onClick={handleSeek}
                    >
                      <div
                        className="progress-loaded"
                        style={{ width: `${bufferPercent}%` }}
                      />
                      <div
                        className="progress-current"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                      <div
                        className="progress-handle"
                        style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>

                    <div className="controls-row">
                      {/* Left groups */}
                      <div className="controls-group">
                        <button
                          id="play-pause-btn"
                          className="control-btn"
                          onClick={togglePlay}
                          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                        >
                          {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
                        </button>

                        <div className="volume-container">
                          <button
                            id="mute-unmute-btn"
                            className="control-btn"
                            onClick={toggleMute}
                            title="Mute/Unmute (M)"
                          >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                          </button>
                          <input
                            id="volume-slider"
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="volume-slider"
                          />
                        </div>

                        <span className="time-display">
                          {formatTime(currentTime)} <span style={{ color: 'var(--text-dim)' }}>/</span> {formatTime(duration)}
                        </span>
                      </div>

                      {/* Right groups */}
                      <div className="controls-group">
                        {/* Bookmark stream button */}
                        <button
                          id="bookmark-stream-btn"
                          className={`control-btn ${isCurrentBookmarked ? 'active' : ''}`}
                          onClick={triggerAddBookmark}
                          title={isCurrentBookmarked ? 'Bookmarked' : 'Add to bookmarks'}
                        >
                          {isCurrentBookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                        </button>

                        {/* Cinematic Ambient backglow toggler */}
                        <button
                          id="cinematic-toggle-btn"
                          className={`control-btn ${isCinematic ? 'active' : ''}`}
                          onClick={() => setIsCinematic(!isCinematic)}
                          title="Ambient Light Glow (Cinematic)"
                        >
                          <Zap size={20} fill={isCinematic ? 'var(--primary)' : 'none'} />
                        </button>

                        {/* Playback speed controller */}
                        <div className="speed-selector-container">
                          <button
                            id="speed-selector-btn"
                            className="control-btn"
                            onClick={() => setShowSpeedOptions(!showSpeedOptions)}
                            title="Playback Speed"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700 }}
                          >
                            {playbackRate === 1 ? '1.0x' : `${playbackRate}x`}
                          </button>
                          {showSpeedOptions && (
                            <div className="speed-options">
                              {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                                <button
                                  key={rate}
                                  className={`speed-option ${playbackRate === rate ? 'selected' : ''}`}
                                  onClick={() => changePlaybackSpeed(rate)}
                                >
                                  {rate}x
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Picture-in-picture button */}
                        <button
                          id="pip-btn"
                          className="control-btn"
                          onClick={togglePip}
                          title="Picture-in-Picture"
                        >
                          <Tv size={20} />
                        </button>

                        {/* In-Browser Fullscreen button */}
                        <button
                          id="in-browser-fullscreen-btn"
                          className="control-btn"
                          onClick={() => setInBrowserFullscreen(!inBrowserFullscreen)}
                          title="Theater Mode (In-Browser Fullscreen)"
                        >
                          <Monitor size={20} />
                        </button>

                        {/* Full screen controller */}
                        <button
                          id="fullscreen-toggle-btn"
                          className="control-btn"
                          onClick={toggleFullscreen}
                          title="Actual Fullscreen (OS Level)"
                        >
                          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stream Toolbox */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', textAlign: 'left' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Tv size={18} color="var(--primary)" /> Stream Utility Toolbox
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <a
                    href={`vlc://${videoProxyUrl}`}
                    className="action-btn"
                    style={{ textDecoration: 'none', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    title="Launch directly in local VLC media player"
                  >
                    <Sparkles size={16} /> Open in VLC
                  </a>
                  <button
                    className="action-btn secondary-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(videoProxyUrl);
                      alert('Proxy Stream Link copied to clipboard!\n\nYou can now paste this URL directly into VLC (Media -> Open Network Stream) or any other player to stream instantly.');
                    }}
                    style={{ justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    title="Copy local buffered proxy URL to stream in VLC/PotPlayer/etc."
                  >
                    <RefreshCw size={16} /> Copy Proxy Link
                  </button>
                  <button
                    className="action-btn secondary-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(activeUrl);
                      alert('Original download URL copied to clipboard.');
                    }}
                    style={{ justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    title="Copy original link"
                  >
                    <Clock size={16} /> Copy Original Link
                  </button>
                </div>
                <div style={{ background: 'rgba(236, 72, 153, 0.05)', border: '1px dashed rgba(236, 72, 153, 0.2)', padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <strong style={{ color: 'var(--accent)' }}>💡 Codec Advisory:</strong> Web browsers have restricted native support for heavy containers like <code>.mkv</code> or advanced HEVC (H.265) video tracks and multi-channel audio (DTS/AC3). If you experience a black screen, no audio, or heavy stuttering, simply click <strong style={{ color: '#fff' }}>Open in VLC</strong> or load the <strong style={{ color: '#fff' }}>Proxy Link</strong> in VLC or PotPlayer for perfect, hardware-accelerated playback with all audio and subtitle tracks!
                </div>
              </div>
            </>
          ) : (
            <div
              className="glass-panel"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5rem',
                padding: '4rem 2rem',
                minHeight: '400px'
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(139, 92, 246, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)'
                }}
              >
                <FileVideo size={40} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No Active Stream Session</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.9rem' }}>
                  NovaStream routes your video URLs through our byte-range buffering system so you don't have to wait for large downloads.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Bookmark Modal */}
      {showBookmarkModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Save Bookmarked Stream</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bookmark Name</label>
              <input
                id="bookmark-name-field"
                type="text"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-glow)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.8rem',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBookmark()}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="action-btn secondary-btn" onClick={() => setShowBookmarkModal(false)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button id="save-bookmark-confirm" className="action-btn" onClick={handleSaveBookmark} style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
                Save Bookmark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {!inBrowserFullscreen && (
        <footer>
          <p>NovaStream Engine powered by Node.js Proxy & HTML5 Engine. Subtitle converters are fully offline.</p>
          <p style={{ marginTop: '0.5rem' }}>
            Developed by <a href="https://urstark.is-a.dev" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>urstarkz</a> •
            <a href="https://t.me/urstarkz" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none', marginLeft: '0.5rem' }}>Telegram</a> •
            <a href="https://instagram.com/urstarkz" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none', marginLeft: '0.5rem' }}>Instagram</a>
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;
