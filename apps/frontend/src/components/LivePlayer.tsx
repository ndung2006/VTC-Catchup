'use client';
//=============================================================================
// LivePlayer — Trình phát HLS Live (PRD §4.3/4.7).
//  - hls.js khi browser không native (mọi Chrome/Firefox), gán src trực tiếp
//    khi Safari phát được application/vnd.apple.mpegurl.
//  - CỰC KỲ QUAN TRỌNG: cleanup hls.destroy() + xóa src video tag mỗi khi
//    streamUrl đổi hoặc unmount — nếu không, chuyển ~10 kênh là tab Chrome
//    cắn hàng GB RAM và văng "Aw, Snap!".
//  - Controls tự làm (Play/Pause, Mute, Fullscreen), KHÔNG seekbar vì là Live.
//=============================================================================
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export function LivePlayer({ streamUrl }: { streamUrl: string }): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true); // autoplay chỉ được khi mute
  const [error, setError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;
    setError('');
    let hls: Hls | null = null;

    if (video.canPlayType('application/vnd.apple.mpegurl') !== '') {
      // Safari native.
      video.src = streamUrl;
      void video.play().catch(() => setPlaying(false));
    } else if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 15 }); // buffer ngắn cho live trễ thấp
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        if (data.fatal) setError(`HLS lỗi: ${data.type}/${data.details}`);
      });
      // Chỉ play khi đã có manifest — play sớm hơn dễ báo lỗi giả + sai nút.
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
    } else {
      setError('Trình duyệt không hỗ trợ HLS');
    }

    // Cleanup khi đổi kênh/unmount: hủy instance + xả buffer RAM browser.
    return () => {
      hls?.destroy();
      hls = null;
      video.removeAttribute('src');
      video.load(); // ép browser nhả buffer chunk .ts cũ
    };
  }, [streamUrl]);

  const togglePlay = (): void => {
    const v = videoRef.current;
    if (v === null) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = (): void => {
    const v = videoRef.current;
    if (v === null) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const goFullscreen = (): void => {
    const wrap = videoRef.current?.parentElement;
    if (wrap === null || wrap === undefined) return;
    if (document.fullscreenElement !== null) void document.exitFullscreen();
    else void wrap.requestFullscreen();
  };

  return (
    <div>
      <div className="vtc-video-wrap">
        <video ref={videoRef} muted={muted} playsInline />
      </div>
      {error !== '' && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button onClick={togglePlay} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={toggleMute} className="rounded bg-slate-200 px-4 py-2 text-sm">
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={goFullscreen} className="rounded bg-slate-200 px-4 py-2 text-sm">
          Fullscreen
        </button>
      </div>
    </div>
  );
}
