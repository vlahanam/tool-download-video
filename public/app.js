document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const moonIcon = document.getElementById('moonIcon');
  const sunIcon = document.getElementById('sunIcon');
  const urlInput = document.getElementById('urlInput');
  const clearBtn = document.getElementById('clearBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const submitBtn = document.getElementById('submitBtn');
  const submitArrow = document.getElementById('submitArrow');
  const submitSpinner = document.getElementById('submitSpinner');
  const platformBadge = document.getElementById('platformBadge');
  const platformIcon = document.getElementById('platformIcon');
  const platformName = document.getElementById('platformName');
  const errorBox = document.getElementById('errorBox');
  const errorMessage = document.getElementById('errorMessage');
  const previewCard = document.getElementById('previewCard');
  const previewThumbnail = document.getElementById('previewThumbnail');
  const previewDuration = document.getElementById('previewDuration');
  const previewPlatformBadge = document.getElementById('previewPlatformBadge');
  const previewAuthor = document.getElementById('previewAuthor');
  const previewTitle = document.getElementById('previewTitle');
  const videoFormatsList = document.getElementById('videoFormatsList');
  const audioFormatsList = document.getElementById('audioFormatsList');
  const videoSection = document.getElementById('videoSection');
  const audioSection = document.getElementById('audioSection');
  const transcriptSection = document.getElementById('transcriptSection');
  const transcriptsList = document.getElementById('transcriptsList');
  const tabAll = document.getElementById('tabAll');
  const tabVideo = document.getElementById('tabVideo');
  const tabAudio = document.getElementById('tabAudio');
  const tabTranscript = document.getElementById('tabTranscript');
  const photosSection = document.getElementById('photosSection');
  const photoCount = document.getElementById('photoCount');
  const photosGrid = document.getElementById('photosGrid');
  const downloadAllPhotosBtn = document.getElementById('downloadAllPhotosBtn');
  const downloadBanner = document.getElementById('downloadBanner');

  let currentMediaData = null;

  // --- Theme Toggle Logic ---
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  });

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      moonIcon.classList.remove('hidden');
      sunIcon.classList.add('hidden');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      moonIcon.classList.add('hidden');
      sunIcon.classList.remove('hidden');
    }
    localStorage.setItem('theme', theme);
  }

  // --- Option Mode Tabs Logic (Cùng cấp: Tất cả / Video / Âm thanh / Transcript) ---
  let activeTab = 'all';

  function applyTab(tab) {
    activeTab = tab;
    const tabButtons = [
      { id: 'all', el: tabAll },
      { id: 'video', el: tabVideo },
      { id: 'audio', el: tabAudio },
      { id: 'transcript', el: tabTranscript }
    ];

    tabButtons.forEach(({ id, el }) => {
      if (!el) return;
      if (id === tab) {
        el.className = 'tab-btn py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-slate-700/80';
      } else {
        el.className = 'tab-btn py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-700/50';
      }
    });

    const isAll = tab === 'all';
    if (videoSection) videoSection.classList.toggle('hidden', !isAll && tab !== 'video');
    if (audioSection) audioSection.classList.toggle('hidden', !isAll && tab !== 'audio');

    const isTranscriptSupported = currentMediaData && (currentMediaData.platform === 'youtube' || currentMediaData.platform === 'bilibili');
    if (transcriptSection) {
      transcriptSection.classList.toggle('hidden', (!isAll && tab !== 'transcript') || !isTranscriptSupported);
    }
  }

  [tabAll, tabVideo, tabAudio, tabTranscript].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        applyTab(btn.getAttribute('data-tab'));
      });
    }
  });

  // --- Platform Detection ---
  function detectPlatform(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    if (lower.includes('tiktok.com') || lower.includes('douyin.com')) {
      return { id: 'tiktok', name: 'TikTok', badgeClass: 'badge-tiktok', icon: '🎵' };
    }
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return { id: 'youtube', name: 'YouTube', badgeClass: 'badge-youtube', icon: '▶️' };
    }
    if (lower.includes('bilibili.com') || lower.includes('bilibili.tv') || lower.includes('b23.tv')) {
      return { id: 'bilibili', name: 'Bilibili', badgeClass: 'badge-bilibili', icon: '📺' };
    }
    return null;
  }

  function updatePlatformUI() {
    const val = urlInput.value.trim();
    clearBtn.classList.toggle('hidden', val.length === 0);

    const platform = detectPlatform(val);
    if (platform) {
      platformBadge.className = `flex items-center gap-1.5 text-xs font-bold rounded-lg py-1 px-2.5 transition-all ${platform.badgeClass}`;
      platformIcon.textContent = platform.icon;
      platformName.textContent = platform.name;
      platformBadge.classList.remove('hidden');
    } else {
      platformBadge.classList.add('hidden');
    }
  }

  urlInput.addEventListener('input', updatePlatformUI);

  // --- Clear Button ---
  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    updatePlatformUI();
    hideError();
    previewCard.classList.add('hidden');
    urlInput.focus();
  });

  // --- Paste Button ---
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        updatePlatformUI();
        handleSubmit();
      }
    } catch {
      urlInput.focus();
    }
  });

  // --- Submit on Enter ---
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  });

  submitBtn.addEventListener('click', handleSubmit);

  // --- Helper UI Functions ---
  function showError(msg) {
    errorMessage.textContent = msg || 'Có lỗi xảy ra khi xử lý liên kết.';
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
    errorMessage.textContent = '';
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitArrow.classList.toggle('hidden', loading);
    submitSpinner.classList.toggle('hidden', !loading);
  }

  // --- Handle Extract Info ---
  async function handleSubmit() {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      showError('Vui lòng dán liên kết video vào ô nhập.');
      urlInput.focus();
      return;
    }

    hideError();
    previewCard.classList.add('hidden');
    downloadBanner.classList.add('hidden');
    setLoading(true);

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(rawUrl)}`);
      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || 'Không thể bóc tách dữ liệu từ liên kết này.');
      }

      currentMediaData = data;
      renderPreview(data, rawUrl);
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Render Preview Card ---
  function renderPreview(data, sourceUrl) {
    previewThumbnail.src = data.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400';
    previewDuration.textContent = data.durationFormatted || '00:00';
    previewAuthor.textContent = data.author || 'Tác giả';
    previewTitle.textContent = data.title || 'Video';

    const platform = detectPlatform(sourceUrl) || { name: data.platform.toUpperCase(), badgeClass: 'badge-tiktok' };
    previewPlatformBadge.textContent = platform.name;
    previewPlatformBadge.className = `text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${platform.badgeClass}`;

    // Render Video Formats
    videoFormatsList.innerHTML = '';
    const videoFormats = data.formats.filter(f => f.type === 'video');

    if (videoFormats.length > 0) {
      videoFormats.forEach(fmt => {
        const btn = document.createElement('a');
        btn.className = 'btn-download bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80';
        btn.href = `/api/download?url=${encodeURIComponent(sourceUrl)}&format_id=${encodeURIComponent(fmt.id)}`;
        
        btn.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${fmt.id.includes('1080') || fmt.id.includes('hd') ? 'bg-cyan-400' : 'bg-slate-400'}"></span>
            <span>${fmt.label}</span>
          </div>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-normal">${fmt.filesizeFormatted ? fmt.filesizeFormatted : (fmt.needMux ? 'DASH' : 'Direct')}</span>
        `;

        btn.addEventListener('click', () => {
          showDownloadNotice();
        });

        videoFormatsList.appendChild(btn);
      });
    } else {
      videoFormatsList.innerHTML = '<p class="text-xs text-slate-500 col-span-2">Không tìm thấy định dạng video.</p>';
    }

    // Render Audio Formats
    audioFormatsList.innerHTML = '';
    const audioFormats = data.formats.filter(f => f.type === 'audio');

    if (audioFormats.length > 0) {
      audioFormats.forEach(fmt => {
        const btn = document.createElement('a');
        btn.className = 'btn-download bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50';
        btn.href = `/api/download?url=${encodeURIComponent(sourceUrl)}&format_id=${encodeURIComponent(fmt.id)}&mode=audio`;
        
        btn.innerHTML = `
          <div class="flex items-center gap-2">
            <span>🎵</span>
            <span>${fmt.label}</span>
          </div>
          <span class="text-xs text-emerald-600 dark:text-emerald-400/80 font-normal">${fmt.filesizeFormatted || 'MP3'}</span>
        `;

        btn.addEventListener('click', () => {
          showDownloadNotice();
        });

        audioFormatsList.appendChild(btn);
      });
    } else {
      audioFormatsList.innerHTML = '<p class="text-xs text-slate-500 col-span-2">Không tìm thấy định dạng âm thanh riêng.</p>';
    }

    // Render Transcript / Subtitles (YouTube & Bilibili)
    const isSupportedTranscriptPlatform = data.platform === 'youtube' || data.platform === 'bilibili';
    if (tabTranscript) {
      tabTranscript.classList.toggle('hidden', !isSupportedTranscriptPlatform);
    }

    if (isSupportedTranscriptPlatform) {
      transcriptsList.innerHTML = '';

      const targetLangs = [
        { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
        { code: 'en', label: 'Tiếng Anh', flag: '🇬🇧' },
        { code: 'zh', label: 'Tiếng Trung', flag: '🇨🇳' }
      ];

      const availableTranscripts = data.transcripts || [];

      targetLangs.forEach(lang => {
        const found = availableTranscripts.find(t => t.lang === lang.code);

        if (found) {
          // Nút tải SRT
          const srtBtn = document.createElement('a');
          srtBtn.className = 'btn-download bg-indigo-50/90 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/50';
          srtBtn.href = `/api/download?url=${encodeURIComponent(sourceUrl)}&mode=transcript&lang=${lang.code}&format=srt`;
          srtBtn.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="text-base">${lang.flag}</span>
              <span>${lang.label} (SRT)</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-medium ${found.isAuto ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300'}">
                ${found.isAuto ? 'Tự động' : 'Chính thức'}
              </span>
            </div>
            <span class="text-xs text-indigo-600 dark:text-indigo-400 font-normal">Phụ đề .SRT</span>
          `;
          srtBtn.addEventListener('click', showDownloadNotice);
          transcriptsList.appendChild(srtBtn);

          // Nút tải TXT
          const txtBtn = document.createElement('a');
          txtBtn.className = 'btn-download bg-indigo-50/90 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/50';
          txtBtn.href = `/api/download?url=${encodeURIComponent(sourceUrl)}&mode=transcript&lang=${lang.code}&format=txt`;
          txtBtn.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="text-base">${lang.flag}</span>
              <span>${lang.label} (TXT)</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-medium ${found.isAuto ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300'}">
                ${found.isAuto ? 'Tự động' : 'Chính thức'}
              </span>
            </div>
            <span class="text-xs text-indigo-600 dark:text-indigo-400 font-normal">Văn bản .TXT</span>
          `;
          txtBtn.addEventListener('click', showDownloadNotice);
          transcriptsList.appendChild(txtBtn);
        } else {
          // Trạng thái chưa có phụ đề cho ngôn ngữ này
          const disabledBtn = document.createElement('div');
          disabledBtn.className = 'btn-download bg-slate-100/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-800/50 opacity-60 cursor-not-allowed';
          disabledBtn.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="text-base">${lang.flag}</span>
              <span>${lang.label}</span>
            </div>
            <span class="text-xs text-slate-400 dark:text-slate-500 italic">Chưa có phụ đề</span>
          `;
          transcriptsList.appendChild(disabledBtn);
        }
      });
    }

    if (!isSupportedTranscriptPlatform && activeTab === 'transcript') {
      activeTab = 'all';
    }
    applyTab(activeTab);

    // Render Photo Slides (TikTok)
    if (data.isPhotoAlbum && data.photos && data.photos.length > 0) {
      photosSection.classList.remove('hidden');
      photoCount.textContent = data.photos.length;
      photosGrid.innerHTML = '';

      data.photos.forEach((imgUrl, idx) => {
        const imgItem = document.createElement('a');
        imgItem.href = imgUrl;
        imgItem.target = '_blank';
        imgItem.className = 'relative aspect-square rounded-lg overflow-hidden group border border-slate-200 dark:border-slate-700/60 block';
        imgItem.innerHTML = `
          <img src="${imgUrl}" alt="Ảnh ${idx + 1}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200">
          <span class="absolute bottom-1 right-1 bg-black/70 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">${idx + 1}</span>
        `;
        photosGrid.appendChild(imgItem);
      });

      downloadAllPhotosBtn.onclick = () => {
        showDownloadNotice();
        window.location.href = `/api/download?url=${encodeURIComponent(sourceUrl)}&mode=photos`;
      };
    } else {
      photosSection.classList.add('hidden');
    }

    previewCard.classList.remove('hidden');
    previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showDownloadNotice() {
    downloadBanner.classList.remove('hidden');
    setTimeout(() => {
      downloadBanner.classList.add('hidden');
    }, 6000);
  }
});

