<template>
  <Transition name="console-fade">
    <div v-if="visible" class="visual-console" :style="consoleStyle" @mousedown.stop="startDrag">
      <div class="console-header">
        <button
          class="auto-hide-btn"
          @click.stop="toggleAutoHide"
          :title="fx.fxFabAutoHide ? '取消自动隐藏' : '自动隐藏'"
        >
          {{ fx.fxFabAutoHide ? '›' : '‹' }}
        </button>
        <div class="console-title">
          <span class="title-icon">🎨</span>
          <span class="title-text">视觉控制台</span>
        </div>
        <div class="console-actions">
          <button class="icon-btn" @click.stop="toggleMinimize" :title="minimized ? '展开' : '收起'">
            {{ minimized ? '▽' : '△' }}
          </button>
          <button class="icon-btn" @click.stop="$emit('close')" title="关闭">
            ✕
          </button>
        </div>
      </div>

      <div v-if="!minimized" class="console-body">
        <div class="console-sidebar">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="sidebar-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.name }}</span>
          </div>
        </div>

        <div class="console-content">
          <div v-show="activeTab === 'preset'" class="content-panel">
            <div class="panel-title">视觉预设</div>
            <div class="preset-grid">
              <div
                v-for="preset in presets"
                :key="preset.id"
                class="preset-card"
                :class="{ active: fx.preset === preset.id }"
                @click="setPreset(preset.id)"
              >
                <div class="preset-icon">{{ preset.icon }}</div>
                <div class="preset-name">{{ preset.name }}</div>
                <div class="preset-desc">{{ preset.description }}</div>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'appearance'" class="content-panel">
            <div class="panel-title">外观调节</div>

            <div class="panel-subtitle">主控参数</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>律动强度</label>
                <input type="range" min="0" max="1" step="0.01" :value="fx.settings.intensity" @input="fx.update('intensity', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.intensity * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>立体感</label>
                <input type="range" min="0" max="2" step="0.01" :value="fx.settings.depth" @input="fx.update('depth', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.depth * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>封面清晰度</label>
                <input type="range" min="0.75" max="1.55" step="0.01" :value="fx.settings.coverResolution" @input="fx.update('coverResolution', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.coverResolution.toFixed(2) }}</span>
              </div>
              <div class="setting-item">
                <label>镜头晃动</label>
                <input type="range" min="0" max="1" step="0.01" :value="fx.settings.cinemaShake" @input="fx.update('cinemaShake', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.cinemaShake * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>泛光强度</label>
                <input type="range" min="0" max="1" step="0.01" :value="fx.settings.bloomStrength" @input="fx.update('bloomStrength', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.bloomStrength * 100).toFixed(0) }}%</span>
              </div>
            </div>

            <div class="panel-subtitle">粒子参数</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>粒子分辨率</label>
                <input type="range" min="0.75" max="1.55" step="0.01" :value="fx.particleResolution" @input="fx.update('particleResolution', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.particleCountLabel }}</span>
              </div>
              <div class="setting-item">
                <label>粒子大小</label>
                <input type="range" min="0.5" max="2" step="0.01" :value="fx.settings.particleSize" @input="fx.update('particleSize', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.particleSize * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>流速</label>
                <input type="range" min="0" max="2" step="0.01" :value="fx.settings.speed" @input="fx.update('speed', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.speed * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>扭曲</label>
                <input type="range" min="-1" max="1" step="0.01" :value="fx.settings.twist" @input="fx.update('twist', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.twist.toFixed(2) }}</span>
              </div>
              <div class="setting-item">
                <label>色彩张力</label>
                <input type="range" min="0" max="2" step="0.01" :value="fx.settings.color" @input="fx.update('color', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.color * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>离散感</label>
                <input type="range" min="0" max="1" step="0.01" :value="fx.settings.scatter" @input="fx.update('scatter', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.scatter * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>背景压缩</label>
                <input type="range" min="0" max="1" step="0.01" :value="fx.settings.bgFade" @input="fx.update('bgFade', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.bgFade * 100).toFixed(0) }}%</span>
              </div>
            </div>

            <div class="panel-subtitle">颜色设置</div>
            <div class="color-row">
              <div class="color-item">
                <label>高亮色</label>
                <div class="color-swatch-wrapper">
                  <div
                    class="color-swatch"
                    :style="{ backgroundColor: fx.accentColor }"
                    @click="openColorLab('accent', $event)"
                  ></div>
                  <div class="color-actions">
                    <button class="color-action-btn" @click="openCoverPicker('accent')" title="封面取色">🖼️</button>
                    <button class="color-action-btn" @click="openColorLab('accent', $event)" title="颜色实验室">🎨</button>
                  </div>
                </div>
              </div>
              <div class="color-item">
                <label>发光色</label>
                <div class="color-swatch-wrapper">
                  <div
                    class="color-swatch"
                    :style="{ backgroundColor: fx.glowColor }"
                    @click="openColorLab('glow', $event)"
                  ></div>
                  <div class="color-actions">
                    <button class="color-action-btn" @click="openCoverPicker('glow')" title="封面取色">🖼️</button>
                    <button class="color-action-btn" @click="openColorLab('glow', $event)" title="颜色实验室">🎨</button>
                  </div>
                </div>
              </div>
              <div class="color-item">
                <label>背景色</label>
                <div class="color-swatch-wrapper">
                  <div
                    class="color-swatch"
                    :style="{ backgroundColor: fx.settings.bgColor }"
                    @click="openColorLab('bg', $event)"
                  ></div>
                  <div class="color-actions">
                    <button class="color-action-btn" @click="openCoverPicker('bg')" title="封面取色">🖼️</button>
                    <button class="color-action-btn" @click="openColorLab('bg', $event)" title="颜色实验室">🎨</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="setting-item">
              <label>封面取色</label>
              <div class="toggle-switch" :class="{ active: fx.settings.coverColorEnabled }" @click="toggleCoverColor">
                <div class="toggle-dot"></div>
              </div>
            </div>

            <div class="panel-subtitle">背景控制</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>背景模式</label>
                <div class="select-group">
                  <button v-for="m in bgModeOptions" :key="m.id" class="select-btn" :class="{ active: fx.settings.backgroundColorMode === m.id }" @click="fx.update('backgroundColorMode', m.id)">{{ m.name }}</button>
                </div>
              </div>
              <div class="setting-item">
                <label>背景透明度</label>
                <input type="range" min="0" max="1" step="0.01" :value="fx.settings.backgroundOpacity" @input="fx.update('backgroundOpacity', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.backgroundOpacity * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>玻璃色差</label>
                <input type="range" min="0" max="180" step="1" :value="fx.settings.controlGlassChromaticOffset" @input="fx.update('controlGlassChromaticOffset', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.controlGlassChromaticOffset }}</span>
              </div>
            </div>

            <div class="panel-subtitle">叠加效果</div>
            <div class="overlay-grid">
              <div class="overlay-item" v-for="toggle in overlayToggles" :key="toggle.key" @click="fx.update(toggle.key as any, !fx.settings[toggle.key as keyof typeof fx.settings])">
                <div class="toggle-switch mini" :class="{ active: fx.settings[toggle.key as keyof typeof fx.settings] }"><div class="toggle-dot"></div></div>
                <span class="overlay-label">{{ toggle.label }}</span>
              </div>
            </div>

            <div class="panel-subtitle">桌面歌词</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>开启</label>
                <div class="toggle-switch" :class="{ active: fx.settings.desktopLyrics }" @click="fx.update('desktopLyrics', !fx.settings.desktopLyrics)"><div class="toggle-dot"></div></div>
              </div>
              <div class="setting-item">
                <label>大小</label>
                <input type="range" min="0.5" max="2" step="0.01" :value="fx.settings.desktopLyricsSize" @input="fx.update('desktopLyricsSize', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.desktopLyricsSize * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>透明度</label>
                <input type="range" min="0" max="1" step="0.01" :value="fx.settings.desktopLyricsOpacity" @input="fx.update('desktopLyricsOpacity', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.desktopLyricsOpacity * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>高度</label>
                <input type="range" min="0" max="1" step="0.01" :value="fx.settings.desktopLyricsY" @input="fx.update('desktopLyricsY', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.desktopLyricsY * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>帧数</label>
                <div class="select-group">
                  <button v-for="fps in [24,30,60,120,0]" :key="fps" class="select-btn" :class="{ active: fx.settings.desktopLyricsFps === fps }" @click="fx.update('desktopLyricsFps', fps)">{{ fps === 0 ? '无限' : fps }}</button>
                </div>
              </div>
              <div class="setting-item">
                <label>点击穿透</label>
                <div class="toggle-switch" :class="{ active: fx.settings.desktopLyricsClickThrough }" @click="fx.update('desktopLyricsClickThrough', !fx.settings.desktopLyricsClickThrough)"><div class="toggle-dot"></div></div>
              </div>
              <div class="setting-item">
                <label>电影震动</label>
                <div class="toggle-switch" :class="{ active: fx.settings.desktopLyricsCinema }" @click="fx.update('desktopLyricsCinema', !fx.settings.desktopLyricsCinema)"><div class="toggle-dot"></div></div>
              </div>
              <div class="setting-item">
                <label>高亮跟随</label>
                <div class="toggle-switch" :class="{ active: fx.settings.desktopLyricsHighlight }" @click="fx.update('desktopLyricsHighlight', !fx.settings.desktopLyricsHighlight)"><div class="toggle-dot"></div></div>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'lyrics'" class="content-panel">
            <div class="panel-title">歌词设置</div>
            <div class="setting-item">
              <label>舞台歌词</label>
              <div class="toggle-switch" :class="{ active: lyrics.stageEnabled }" @click="toggleStageLyrics">
                <div class="toggle-dot"></div>
              </div>
            </div>
            <div class="setting-item">
              <label>歌词发光</label>
              <input type="range" min="0" max="1" step="0.01" :value="lyrics.glow.strength" @input="lyrics.setGlow({ strength: parseFloat(($event.target as HTMLInputElement).value) })" />
              <span class="value">{{ (lyrics.glow.strength * 100).toFixed(0) }}%</span>
            </div>

            <div class="panel-subtitle">歌词颜色</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>颜色模式</label>
                <div class="select-group">
                  <button class="select-btn" :class="{ active: fx.settings.lyricColorMode === 'auto' }" @click="fx.update('lyricColorMode', 'auto')">封面</button>
                  <button class="select-btn" :class="{ active: fx.settings.lyricColorMode === 'custom' }" @click="fx.update('lyricColorMode', 'custom')">自定义</button>
                </div>
              </div>
              <div class="setting-item">
                <label>歌词颜色</label>
                <input type="color" :value="fx.settings.lyricColor" @input="fx.update('lyricColor', ($event.target as HTMLInputElement).value)" class="inline-color" />
              </div>
              <div class="setting-item">
                <label>高亮模式</label>
                <div class="select-group">
                  <button class="select-btn" :class="{ active: fx.settings.lyricHighlightMode === 'auto' }" @click="fx.update('lyricHighlightMode', 'auto')">跟随</button>
                  <button class="select-btn" :class="{ active: fx.settings.lyricHighlightMode === 'custom' }" @click="fx.update('lyricHighlightMode', 'custom')">自定义</button>
                </div>
              </div>
              <div class="setting-item">
                <label>高亮颜色</label>
                <input type="color" :value="fx.settings.lyricHighlightColor" @input="fx.update('lyricHighlightColor', ($event.target as HTMLInputElement).value)" class="inline-color" />
              </div>
              <div class="setting-item">
                <label>溢光颜色</label>
                <input type="color" :value="fx.settings.lyricGlowColor" @input="fx.update('lyricGlowColor', ($event.target as HTMLInputElement).value)" class="inline-color" />
                <div class="toggle-switch mini" :class="{ active: fx.settings.lyricGlowLinked }" @click="fx.update('lyricGlowLinked', !fx.settings.lyricGlowLinked)" style="margin-left:4px"><div class="toggle-dot"></div></div>
                <span style="font-size:10px;color:var(--color-text-secondary)">链接</span>
              </div>
            </div>

            <div class="panel-subtitle">歌词源</div>
            <div class="select-group">
              <button class="select-btn" :class="{ active: lyrics.lyricSourceMode === 'original' }" @click="lyrics.setLyricSourceMode('original')">原词</button>
              <button class="select-btn" :class="{ active: lyrics.lyricSourceMode === 'custom' }" @click="lyrics.setLyricSourceMode('custom')">自定义</button>
            </div>

            <div class="panel-subtitle">歌词字体</div>
            <div class="font-grid">
              <button v-for="f in fontOptions" :key="f.id" class="font-btn" :class="{ active: fx.settings.lyricFont === f.id }" @click="fx.update('lyricFont', f.id)">{{ f.name }}</button>
            </div>
            <div class="setting-group" style="margin-top:10px">
              <div class="setting-item">
                <label>字间距</label>
                <input type="range" min="-0.04" max="0.18" step="0.005" :value="fx.settings.lyricLetterSpacing" @input="fx.update('lyricLetterSpacing', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.lyricLetterSpacing.toFixed(3) }}</span>
              </div>
              <div class="setting-item">
                <label>行距</label>
                <input type="range" min="0.86" max="1.35" step="0.01" :value="fx.settings.lyricLineHeight" @input="fx.update('lyricLineHeight', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.lyricLineHeight.toFixed(2) }}</span>
              </div>
              <div class="setting-item">
                <label>字重</label>
                <input type="range" min="500" max="900" step="50" :value="fx.settings.lyricWeight" @input="fx.update('lyricWeight', parseInt(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.lyricWeight }}</span>
              </div>
            </div>

            <div class="panel-subtitle">歌词布局</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>歌词大小</label>
                <input type="range" min="0.35" max="1.65" step="0.01" :value="fx.settings.lyricScale" @input="fx.update('lyricScale', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.lyricScale * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>水平位置</label>
                <input type="range" min="-2" max="2" step="0.01" :value="fx.settings.lyricOffsetX" @input="fx.update('lyricOffsetX', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.lyricOffsetX.toFixed(2) }}</span>
              </div>
              <div class="setting-item">
                <label>垂直位置</label>
                <input type="range" min="-1.2" max="1.35" step="0.01" :value="fx.settings.lyricOffsetY" @input="fx.update('lyricOffsetY', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.lyricOffsetY.toFixed(2) }}</span>
              </div>
              <div class="setting-item">
                <label>景深位置</label>
                <input type="range" min="-1.6" max="1.6" step="0.01" :value="fx.settings.lyricOffsetZ" @input="fx.update('lyricOffsetZ', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.lyricOffsetZ.toFixed(2) }}</span>
              </div>
              <div class="setting-item">
                <label>上下角度</label>
                <input type="range" min="-42" max="42" step="1" :value="fx.settings.lyricTiltX" @input="fx.update('lyricTiltX', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.lyricTiltX }}°</span>
              </div>
              <div class="setting-item">
                <label>左右角度</label>
                <input type="range" min="-42" max="42" step="1" :value="fx.settings.lyricTiltY" @input="fx.update('lyricTiltY', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.lyricTiltY }}°</span>
              </div>
              <div class="setting-item">
                <label>镜头锁定</label>
                <div class="toggle-switch" :class="{ active: fx.settings.lyricCameraLock }" @click="fx.update('lyricCameraLock', !fx.settings.lyricCameraLock)"><div class="toggle-dot"></div></div>
              </div>
            </div>

            <div class="panel-subtitle">歌词预设</div>
            <div class="lyric-preset-row">
              <button v-for="preset in lyrics.builtinPresets" :key="preset.id" class="lyric-preset-btn" @click="lyrics.applyPreset(preset.id)">{{ preset.name }}</button>
            </div>
          </div>

          <div v-show="activeTab === 'dynamic'" class="content-panel">
            <div class="panel-title">动态效果</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>镜头模式</label>
                <div class="select-group">
                  <button
                    v-for="mode in cinemaModes"
                    :key="mode.id"
                    class="select-btn"
                    :class="{ active: fx.cinemaMode === mode.id }"
                    @click="fx.update('cinemaMode', mode.id)"
                  >
                    {{ mode.name }}
                  </button>
                </div>
              </div>
              <div class="setting-item">
                <label>镜头强度</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="fx.cinemaIntensity"
                  @input="fx.update('cinemaIntensity', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.cinemaIntensity * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>节拍响应</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="fx.settings.beatResponseStrength"
                  @input="fx.update('beatResponseStrength', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.settings.beatResponseStrength * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>粒子运动速度</label>
                <input
                  type="range"
                  min="0.2"
                  max="2"
                  step="0.01"
                  :value="fx.settings.particleMotionSpeed"
                  @input="fx.update('particleMotionSpeed', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.settings.particleMotionSpeed * 100).toFixed(0) }}%</span>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'advanced'" class="content-panel">
            <div class="panel-title">高级设置</div>

            <div class="panel-subtitle">自由相机</div>
            <div class="setting-item">
              <label>自由相机模式</label>
              <div class="toggle-switch" :class="{ active: fx.freeCameraEnabled }" @click="toggleFreeCamera"><div class="toggle-dot"></div></div>
            </div>
            <div class="setting-hint">快捷键：<kbd>F</kbd> 切换 · 右键拖拽旋转 · 滚轮缩放 · WASD 移动 · 空格重置</div>

            <div class="panel-subtitle">性能档位</div>
            <div class="select-group">
              <button v-for="quality in qualityLevels" :key="quality.id" class="select-btn" :class="{ active: fx.performanceQuality === quality.id }" @click="setPerformanceQuality(quality.id)">{{ quality.name }}</button>
            </div>

            <div class="panel-subtitle">后台策略</div>
            <div class="select-group">
              <button v-for="mode in bgModes" :key="mode.id" class="select-btn" :class="{ active: fx.performanceBackground === mode.id }" @click="setBackgroundMode(mode.id)">{{ mode.name }}</button>
            </div>
            <div class="setting-item" style="margin-top:8px">
              <label>直播后台保持</label>
              <div class="toggle-switch" :class="{ active: fx.settings.liveBackgroundKeep }" @click="fx.update('liveBackgroundKeep', !fx.settings.liveBackgroundKeep)"><div class="toggle-dot"></div></div>
            </div>

            <div class="panel-subtitle">3D 歌单架</div>
            <div class="setting-item">
              <label>歌单架模式</label>
              <div class="select-group">
                <button v-for="mode in shelfModes" :key="mode.id" class="select-btn" :class="{ active: fx.shelfMode === mode.id }" @click="fx.update('shelfMode', mode.id)">{{ mode.name }}</button>
              </div>
            </div>
            <div class="setting-item">
              <label>镜头</label>
              <div class="select-group">
                <button v-for="cm in shelfCameraModes" :key="cm.id" class="select-btn" :class="{ active: fx.settings.shelfCameraMode === cm.id }" @click="fx.update('shelfCameraMode', cm.id as any)">{{ cm.name }}</button>
              </div>
            </div>
            <div class="setting-item">
              <label>显示</label>
              <div class="select-group">
                <button v-for="sp in shelfPresenceModes" :key="sp.id" class="select-btn" :class="{ active: fx.settings.shelfPresence === sp.id }" @click="fx.update('shelfPresence', sp.id as any)">{{ sp.name }}</button>
              </div>
            </div>
            <div class="setting-item">
              <label>显示播客歌单</label>
              <div class="toggle-switch" :class="{ active: fx.settings.shelfShowPodcasts }" @click="fx.update('shelfShowPodcasts', !fx.settings.shelfShowPodcasts)"><div class="toggle-dot"></div></div>
            </div>
            <div class="setting-item">
              <label>合并收藏歌单</label>
              <div class="toggle-switch" :class="{ active: fx.settings.shelfMergeCollections }" @click="fx.update('shelfMergeCollections', !fx.settings.shelfMergeCollections)"><div class="toggle-dot"></div></div>
            </div>
            <div class="setting-item">
              <label>歌单架颜色</label>
              <input type="color" :value="fx.settings.shelfAccentColor" @input="fx.update('shelfAccentColor', ($event.target as HTMLInputElement).value)" class="inline-color" />
            </div>
            <div class="setting-item">
              <label>歌单架大小</label>
              <input type="range" min="0.65" max="1.45" step="0.01" :value="fx.settings.shelfSize" @input="fx.update('shelfSize', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ (fx.settings.shelfSize * 100).toFixed(0) }}%</span>
            </div>
            <div class="setting-item">
              <label>左右位置</label>
              <input type="range" min="-1.2" max="1.2" step="0.01" :value="fx.settings.shelfOffsetX" @input="fx.update('shelfOffsetX', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ fx.settings.shelfOffsetX.toFixed(2) }}</span>
            </div>
            <div class="setting-item">
              <label>上下位置</label>
              <input type="range" min="-0.9" max="0.9" step="0.01" :value="fx.settings.shelfOffsetY" @input="fx.update('shelfOffsetY', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ fx.settings.shelfOffsetY.toFixed(2) }}</span>
            </div>
            <div class="setting-item">
              <label>前后景深</label>
              <input type="range" min="-0.9" max="0.9" step="0.01" :value="fx.settings.shelfOffsetZ" @input="fx.update('shelfOffsetZ', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ fx.settings.shelfOffsetZ.toFixed(2) }}</span>
            </div>
            <div class="setting-item">
              <label>侧向角度</label>
              <input type="range" min="-30" max="30" step="1" :value="fx.settings.shelfAngleY" @input="fx.update('shelfAngleY', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ fx.settings.shelfAngleY }}°</span>
            </div>
            <div class="setting-item">
              <label>整体透明度</label>
              <input type="range" min="0.25" max="1" step="0.01" :value="fx.settings.shelfOpacity" @input="fx.update('shelfOpacity', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ (fx.settings.shelfOpacity * 100).toFixed(0) }}%</span>
            </div>
            <div class="setting-item">
              <label>背景透明度</label>
              <input type="range" min="0.25" max="0.98" step="0.01" :value="fx.settings.shelfBgOpacity" @input="fx.update('shelfBgOpacity', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ (fx.settings.shelfBgOpacity * 100).toFixed(0) }}%</span>
            </div>

            <div class="panel-subtitle">摄像头交互</div>
            <div class="select-group">
              <button v-for="cm in camModes" :key="cm.id" class="select-btn" :class="{ active: fx.settings.cam === cm.id }" @click="fx.update('cam', cm.id)">{{ cm.name }}</button>
            </div>

            <div class="panel-subtitle">高级粒子参数</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>粒子尺寸</label>
                <input type="range" min="0.5" max="2.2" step="0.01" :value="fx.settings.point" @input="fx.update('point', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.point * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>流速</label>
                <input type="range" min="0.2" max="2.5" step="0.01" :value="fx.settings.speed" @input="fx.update('speed', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.speed * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>扭曲</label>
                <input type="range" min="0" max="0.6" step="0.01" :value="fx.settings.twist" @input="fx.update('twist', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ fx.settings.twist.toFixed(2) }}</span>
              </div>
              <div class="setting-item">
                <label>色彩张力</label>
                <input type="range" min="0.5" max="2" step="0.01" :value="fx.settings.color" @input="fx.update('color', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.color * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>溢光强度</label>
                <input type="range" min="0" max="1.6" step="0.01" :value="fx.settings.bloomStrength" @input="fx.update('bloomStrength', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.bloomStrength * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>离散感</label>
                <input type="range" min="0" max="0.5" step="0.01" :value="fx.settings.scatter" @input="fx.update('scatter', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.scatter * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>背景压缩</label>
                <input type="range" min="0" max="1.2" step="0.01" :value="fx.settings.bgFade" @input="fx.update('bgFade', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="value">{{ (fx.settings.bgFade * 100).toFixed(0) }}%</span>
              </div>
            </div>

            <div class="panel-subtitle">控制台玻璃</div>
            <div class="setting-item">
              <label>色调</label>
              <input type="range" min="0" max="1" step="0.01" :value="fx.settings.consoleTint" @input="fx.update('consoleTint', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ (fx.settings.consoleTint * 100).toFixed(0) }}%</span>
            </div>
            <div class="setting-item">
              <label>透明度</label>
              <input type="range" min="0.3" max="1" step="0.01" :value="fx.settings.consoleOpacity" @input="fx.update('consoleOpacity', parseFloat(($event.target as HTMLInputElement).value))" />
              <span class="value">{{ (fx.settings.consoleOpacity * 100).toFixed(0) }}%</span>
            </div>

            <div class="panel-subtitle">存档槽位</div>
            <div class="archive-slots">
              <button v-for="i in 4" :key="i" class="archive-slot" @click="handleArchiveSlot(i)" @contextmenu.prevent="saveToSlot(i)">槽位 {{ i }}</button>
            </div>
            <div class="setting-actions">
              <button class="btn btn-reset" @click="resetSettings">重置为默认</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="minimized" class="console-minimized" @click.stop="toggleMinimize">
        <span>🎨 视觉控制台</span>
        <span class="expand-hint">点击展开</span>
      </div>
    </div>
  </Transition>

  <ColorLab
    v-if="colorLabVisible"
    v-model="currentColorLabColor"
    :visible="colorLabVisible"
    :style="{ top: colorLabPosition.top + 'px', left: colorLabPosition.left + 'px', position: 'fixed' }"
    @update:model-value="handleColorLabUpdate"
    @confirm="handleColorLabConfirm"
    @cancel="handleColorLabCancel"
  />

  <CoverColorPicker
    :visible="coverPickerVisible"
    :target-color="coverPickerTarget"
    @confirm="handleCoverPickerConfirm"
    @cancel="handleCoverPickerCancel"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useFxStore } from '@/stores/fx'
import { useLyricsStore } from '@/stores/lyrics'
import { usePerformanceStore } from '@/stores/performance'
import ColorLab from '@/components/color/ColorLab.vue'
import CoverColorPicker from '@/components/color/CoverColorPicker.vue'
import type { VisualPreset, PerformanceQuality, PerformanceBackgroundMode, CinemaMode, ShelfMode } from '@/types'

interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const fx = useFxStore()
const lyrics = useLyricsStore()
const performance = usePerformanceStore()

const activeTab = ref<'preset' | 'appearance' | 'lyrics' | 'dynamic' | 'advanced'>('preset')
const minimized = ref(false)
const position = ref({ x: 20, y: 80 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const colorLabVisible = ref(false)
const colorLabTarget = ref<'accent' | 'glow' | 'bg'>('accent')
const colorLabPosition = ref({ top: 0, left: 0 })
const coverPickerVisible = ref(false)
const coverPickerTarget = ref<'accent' | 'glow' | 'bg'>('accent')

const currentColorLabColor = computed(() => {
  switch (colorLabTarget.value) {
    case 'accent': return fx.accentColor
    case 'glow': return fx.glowColor
    case 'bg': return fx.settings.bgColor
    default: return fx.accentColor
  }
})

function toggleAutoHide() {
  fx.fxFabAutoHide = !fx.fxFabAutoHide
}

const tabs = [
  { id: 'preset' as const, name: '预设', icon: '✨' },
  { id: 'appearance' as const, name: '外观', icon: '🎨' },
  { id: 'lyrics' as const, name: '歌词', icon: '🎤' },
  { id: 'dynamic' as const, name: '动态', icon: '💫' },
  { id: 'advanced' as const, name: '高级', icon: '⚙️' },
]

const presets = [
  { id: 'emily', name: 'Emily', icon: '🌸', description: '经典粒子效果' },
  { id: 'galaxy', name: '星河', icon: '🌌', description: '旋转的星系' },
  { id: 'vinyl', name: '黑胶', icon: '💿', description: '复古黑胶唱片' },
  { id: 'planet', name: '星球', icon: '🪐', description: '行星轨道' },
  { id: 'skull', name: '安魂', icon: '💀', description: '骷髅效果' },
  { id: 'aurora', name: '极光', icon: '🌈', description: '流动彩色光带' },
  { id: 'starry', name: '星空', icon: '⭐', description: '深邃星空闪烁' },
  { id: 'ocean', name: '海洋', icon: '🌊', description: '波浪起伏海底' },
  { id: 'flame', name: '火焰', icon: '🔥', description: '燃烧的火焰' },
  { id: 'matrix', name: '矩阵', icon: '💻', description: '数字雨效果' },
  { id: 'void', name: '虚空', icon: '🕳️', description: '极简虚空' },
  { id: 'podcast', name: '播客', icon: '🎙️', description: '舒缓长时聆听' },
]

const cinemaModes = [
  { id: 'static' as CinemaMode, name: '静态' },
  { id: 'breathing' as CinemaMode, name: '呼吸' },
  { id: 'cinema' as CinemaMode, name: '电影' },
  { id: 'dynamic' as CinemaMode, name: '动态' },
]

const qualityLevels = [
  { id: 'eco' as PerformanceQuality, name: '省电' },
  { id: 'balanced' as PerformanceQuality, name: '平衡' },
  { id: 'high' as PerformanceQuality, name: '高性能' },
  { id: 'ultra' as PerformanceQuality, name: '极致' },
]

const bgModes = [
  { id: 'auto' as PerformanceBackgroundMode, name: '自动' },
  { id: 'keep' as PerformanceBackgroundMode, name: '保持' },
  { id: 'release' as PerformanceBackgroundMode, name: '释放' },
]

const shelfModes = [
  { id: 'off' as ShelfMode, name: '关闭' },
  { id: 'sidebar' as ShelfMode, name: '侧边' },
  { id: 'stage' as ShelfMode, name: '舞台' },
]

const bgModeOptions = [
  { id: 'cover', name: '封面' },
  { id: 'custom', name: '自定义' },
  { id: 'black', name: '纯黑' },
]

const overlayToggles = [
  { key: 'floatLayer', label: '浮空粒子层' },
  { key: 'cinema', label: '电影镜头' },
  { key: 'lyricGlowEnabled', label: '歌词溢光' },
  { key: 'lyricGlowBeat', label: '鼓点溢光' },
  { key: 'lyricGlowParticles', label: '歌词光粒' },
  { key: 'lyricCameraLock', label: '歌词镜头绑定' },
  { key: 'bloom', label: '粒子溢光' },
  { key: 'edge', label: '轮廓高亮' },
  { key: 'desktopLyrics', label: '桌面歌词' },
  { key: 'desktopLyricsClickThrough', label: '桌面歌词锁定' },
  { key: 'desktopLyricsCinema', label: '桌面歌词电影震动' },
  { key: 'desktopLyricsHighlight', label: '桌面歌词高亮跟随' },
  { key: 'wallpaperMode', label: '壁纸模式' },
]

const fontOptions = [
  { id: 'sans', name: '默认' },
  { id: 'hei', name: '黑体' },
  { id: 'song', name: '宋体' },
  { id: 'bold-song', name: '粗宋' },
  { id: 'stone-song', name: '石印宋' },
  { id: 'kai-song', name: '楷宋' },
  { id: 'serif-en', name: 'Serif' },
  { id: 'gothic', name: 'Gothic' },
  { id: 'editorial', name: 'Editorial' },
  { id: 'humanist', name: 'Humanist' },
  { id: 'mono', name: '等宽' },
  { id: 'display', name: '标题' },
]

const shelfCameraModes = [
  { id: 'dynamic' as const, name: '动态镜头' },
  { id: 'static' as const, name: '静态镜头' },
]

const shelfPresenceModes = [
  { id: 'auto' as const, name: '自动隐藏' },
  { id: 'always' as const, name: '常驻' },
]

const camModes = [
  { id: 'off', name: '关闭' },
  { id: 'gesture', name: '手势触碰' },
]

const consoleStyle = computed(() => {
  const tint = fx.settings.consoleTint
  const opacity = fx.settings.consoleOpacity
  const hue = tint * 240
  return {
    top: `${position.value.y}px`,
    left: `${position.value.x}px`,
    '--console-bg': `hsla(${hue}, 30%, 8%, ${opacity})`,
    '--console-border': `hsla(${hue}, 40%, 30%, ${opacity * 0.5})`,
  }
})

function setPreset(preset: VisualPreset) {
  fx.update('preset', preset)
}

function setPerformanceQuality(quality: PerformanceQuality) {
  fx.setPerformanceQuality(quality)
  performance.setQuality(quality)
}

function setBackgroundMode(mode: PerformanceBackgroundMode) {
  fx.setPerformanceBackgroundMode(mode)
  performance.setBackgroundMode(mode, fx.settings.liveBackgroundKeep)
}

function toggleStageLyrics() {
  lyrics.toggleStageLyrics()
}

function toggleCameraBind() {
  lyrics.setCameraBind(!lyrics.cameraBind)
}

function toggleCoverColor() {
  fx.update('coverColorEnabled', !fx.settings.coverColorEnabled)
}

function toggleFreeCamera() {
  fx.toggleFreeCamera()
}

function openColorLab(target: 'accent' | 'glow' | 'bg', event: MouseEvent) {
  colorLabTarget.value = target
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  colorLabPosition.value = {
    top: rect.bottom + 8,
    left: Math.max(8, rect.left - 100),
  }
  colorLabVisible.value = true
}

function handleColorLabUpdate(color: string) {
  switch (colorLabTarget.value) {
    case 'accent':
      fx.update('accentColor', color)
      break
    case 'glow':
      fx.update('glowColor', color)
      break
    case 'bg':
      fx.update('bgColor', color)
      break
  }
}

function handleColorLabConfirm(color: string) {
  handleColorLabUpdate(color)
  colorLabVisible.value = false
}

function handleColorLabCancel() {
  colorLabVisible.value = false
}

function openCoverPicker(target: 'accent' | 'glow' | 'bg') {
  coverPickerTarget.value = target
  coverPickerVisible.value = true
}

function handleCoverPickerConfirm(color: string) {
  switch (coverPickerTarget.value) {
    case 'accent':
      fx.update('accentColor', color)
      break
    case 'glow':
      fx.update('glowColor', color)
      break
    case 'bg':
      fx.update('bgColor', color)
      break
  }
  coverPickerVisible.value = false
}

function handleCoverPickerCancel() {
  coverPickerVisible.value = false
}

function toggleMinimize() {
  minimized.value = !minimized.value
}

function resetSettings() {
  if (confirm('确定要重置所有视觉设置为默认值吗？')) {
    fx.reset()
    lyrics.resetToDefault()
  }
}

function handleArchiveSlot(slot: number) {
  const saved = localStorage.getItem(`mineradio_archive_${slot}`)
  if (saved) {
    if (confirm(`加载存档槽位 ${slot}？`)) {
      try {
        const data = JSON.parse(saved)
        if (data.fx) {
          Object.keys(data.fx).forEach(key => {
            if (key in fx.settings) {
              fx.update(key as keyof typeof fx.settings, data.fx[key])
            }
          })
        }
      } catch (e) {
        console.error('Load archive failed:', e)
      }
    }
  } else {
    saveToSlot(slot)
  }
}

function saveToSlot(slot: number) {
  const data = {
    fx: { ...fx.settings },
    savedAt: Date.now(),
  }
  localStorage.setItem(`mineradio_archive_${slot}`, JSON.stringify(data))
  alert(`已保存到槽位 ${slot}`)
}

function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.icon-btn, .sidebar-tab, .console-content, .console-minimized')) {
    return
  }
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y,
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  position.value = {
    x: Math.max(0, Math.min(window.innerWidth - 360, e.clientX - dragOffset.value.x)),
    y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.value.y)),
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

onMounted(() => {
  const saved = localStorage.getItem('mineradio_visual_console_pos')
  if (saved) {
    try {
      position.value = JSON.parse(saved)
    } catch (_) {}
  }
})

onUnmounted(() => {
  localStorage.setItem('mineradio_visual_console_pos', JSON.stringify(position.value))
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.visual-console {
  position: fixed;
  z-index: 1000;
  width: min(444px, calc(100vw - 48px));
  max-height: min(650px, calc(100vh - 132px));
  background: var(--glass-bg);
  backdrop-filter: blur(44px) saturate(1.34);
  -webkit-backdrop-filter: blur(44px) saturate(1.34);
  border: 1px solid rgba(0,245,212,0.16);
  border-radius: 20px;
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  user-select: none;
  color: var(--color-text);
  transition: transform 0.3s ease, opacity 0.3s ease;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,245,212,.22) transparent;
}

.auto-hide-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  margin-right: 8px;
}

.auto-hide-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

:global(body.fx-fab-auto-hide) .visual-console {
  transform: translateX(-20px);
  opacity: 0.7;
}

:global(body.fx-fab-auto-hide) .visual-console:hover {
  transform: translateX(0);
  opacity: 1;
}

.console-fade-enter-active {
  transition: opacity 0.55s cubic-bezier(.16,1,.3,1), transform 0.55s cubic-bezier(.16,1,.3,1), filter 0.55s cubic-bezier(.16,1,.3,1);
}
.console-fade-leave-active {
  transition: opacity 0.26s cubic-bezier(.5,0,.7,1), transform 0.26s cubic-bezier(.5,0,.7,1), filter 0.26s cubic-bezier(.5,0,.7,1);
}

.console-fade-enter-from {
  opacity: 0;
  transform: translateX(32px) translateY(18px) scale(0.96);
  filter: blur(8px);
}
.console-fade-leave-to {
  opacity: 0;
  transform: translateX(24px) translateY(12px) scale(0.97);
  filter: blur(6px);
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin-bottom: 0;
  border-bottom: 1px solid rgba(255,255,255,.065);
  cursor: move;
}

.console-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.title-icon {
  font-size: 16px;
}

.console-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.console-body {
  display: flex;
  max-height: calc(min(650px, calc(100vh - 132px)) - 52px);
}

.console-sidebar {
  width: 80px;
  padding: 12px 0;
  border-right: 1px solid rgba(255,255,255,.065);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 2px solid transparent;
}

.sidebar-tab:hover {
  background: rgba(255, 255, 255, 0.05);
}

.sidebar-tab.active {
  background: rgba(255, 255, 255, 0.08);
  border-left-color: var(--fc-accent, #00f5d4);
}

.tab-icon {
  font-size: 20px;
}

.tab-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.sidebar-tab.active .tab-label {
  color: var(--color-text);
}

.console-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  max-height: calc(min(650px, calc(100vh - 132px)) - 52px);
}

/* FX 面板品牌色滚动条 */
.visual-console::-webkit-scrollbar,
.console-content::-webkit-scrollbar {
  width: 3px;
}

.visual-console::-webkit-scrollbar-track,
.console-content::-webkit-scrollbar-track {
  background: transparent;
}

.visual-console::-webkit-scrollbar-thumb,
.console-content::-webkit-scrollbar-thumb {
  background: rgba(0,245,212,.24);
  border-radius: 3px;
}

.visual-console::-webkit-scrollbar-thumb:hover,
.console-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0,245,212,.4);
}

.console-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 245, 212, 0.24) transparent;
}

.content-panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: .6px;
  color: rgba(255,255,255,.95);
  margin-bottom: 16px;
}

.panel-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: rgba(0,245,212,.56);
  letter-spacing: 1.2px;
  text-transform: uppercase;
  margin: 18px 0 9px;
  font-weight: 700;
}

.panel-subtitle::after {
  content: '';
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg,rgba(0,245,212,.16),transparent);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-item label {
  width: 80px;
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.setting-item input[type="range"] {
  flex: 1;
  height: 3px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  cursor: pointer;
}

.setting-item input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--fc-accent, #00f5d4);
  border-radius: 50%;
  cursor: pointer;
}

.setting-item .value {
  width: 50px;
  text-align: right;
  font-size: 11px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.setting-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  margin-left: 90px;
  line-height: 1.5;
}

.setting-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.preset-card {
  position: relative;
  min-height: 94px;
  padding: 10px;
  text-align: left;
  border-radius: 11px;
  border: 1.5px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.025);
  cursor: pointer;
  transition: all .25s;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}

.preset-card:hover {
  border-color: rgba(255,255,255,.2);
  background: rgba(255,255,255,.05);
  transform: translateY(-1px);
}

.preset-card.active {
  border-color: rgba(0,245,212,.54);
  background: rgba(0,245,212,.075);
  box-shadow: 0 0 0 1px rgba(0,245,212,.22), 0 16px 46px rgba(0,245,212,.055);
  animation: preset-card-pulse 0.6s ease-out;
}

.preset-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 20px;
  color: rgba(255,255,255,.45);
}

.preset-card.active .preset-icon {
  color: var(--fc-accent, #00f5d4);
}

.preset-name {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255,255,255,.92);
  letter-spacing: .3px;
  margin-bottom: 2px;
}

.preset-card.active .preset-name {
  color: #fff;
}

.preset-desc {
  font-size: 10px;
  color: rgba(255,255,255,.44);
  letter-spacing: .3px;
  line-height: 1.35;
  margin-top: 4px;
}

.color-row {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.color-item label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.color-swatch-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid var(--console-border);
  transition: transform 0.15s;
}

.color-swatch:hover {
  transform: scale(1.05);
}

.color-actions {
  display: flex;
  gap: 2px;
}

.color-action-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.15s;
}

.color-action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(1.1);
}

.select-group {
  display: flex;
  gap: 4px;
  flex: 1;
  flex-wrap: wrap;
}

.select-btn {
  padding: 6px 10px;
  font-size: 11px;
  border: 1px solid var(--console-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.select-btn:hover {
  border-color: var(--fc-accent, #00f5d4);
  color: var(--color-text);
}

.select-btn.active {
  background: rgba(0,245,212,.12);
  border-color: rgba(0,245,212,.54);
  color: #fff;
}

.toggle-switch {
  width: 36px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-switch.active {
  background: var(--fc-accent, #00f5d4);
}

.toggle-dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-dot {
  transform: translateX(16px);
}

.toggle-switch.mini {
  width: 26px;
  height: 14px;
  border-radius: 7px;
}

.toggle-switch.mini .toggle-dot {
  width: 10px;
  height: 10px;
  top: 2px;
  left: 2px;
}

.toggle-switch.mini.active .toggle-dot {
  transform: translateX(12px);
}

.overlay-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.overlay-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 0;
}

.overlay-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overlay-item:hover .overlay-label {
  color: var(--color-text);
}

.font-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.font-btn {
  padding: 6px 4px;
  font-size: 11px;
  border: 1px solid var(--console-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.font-btn:hover {
  border-color: var(--fc-accent, #00f5d4);
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.08);
}

.font-btn.active {
  background: rgba(0,245,212,.12);
  border-color: rgba(0,245,212,.54);
  color: #fff;
}

.inline-color {
  width: 32px;
  height: 24px;
  border: 1px solid var(--console-border);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  padding: 0;
  -webkit-appearance: none;
}

.inline-color::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.inline-color::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}

.lyric-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.lyric-preset-btn {
  padding: 6px 12px;
  font-size: 11px;
  border: 1px solid var(--console-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.lyric-preset-btn:hover {
  background: rgba(255,255,255,.1);
  border-color: var(--fc-accent, #00f5d4);
}

.archive-slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.archive-slot {
  padding: 10px 4px;
  font-size: 11px;
  border: 1px solid var(--console-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.archive-slot:hover {
  background: rgba(var(--fc-accent-rgb, 0,245,212),.04);
  border-color: rgba(var(--fc-accent-rgb, 0,245,212),.24);
  color: var(--color-text);
}

.setting-actions {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--console-border);
}

.btn-reset {
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  border: 1px solid var(--console-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: rgba(255, 82, 82, 0.1);
  border-color: #ff5252;
  color: #ff5252;
}

.console-minimized {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 13px;
}

.expand-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* --- Responsive (aligned with original) --- */

@media (max-width: 1180px) {
  .visual-console {
    width: min(380px, calc(100vw - 48px));
  }
}

@media (max-width: 840px) {
  .visual-console {
    width: min(340px, calc(100vw - 36px));
    max-height: min(520px, calc(100vh - 120px));
  }
}

@media (max-width: 720px) {
  .visual-console {
    display: none;
  }
}

@media (max-height: 700px) {
  .visual-console {
    max-height: 400px;
  }
}
</style>
