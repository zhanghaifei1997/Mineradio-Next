# Mineradio Next — 矢量图标库

## 完成内容
为 Mineradio Next 沉浸式音乐播放器创建了一套完整的矢量按钮图标组件库。

## 产出物

### 图标组件 (36 个 Vue SFC)
`src/components/icons/` — 按功能分为 7 个类别：

| 分类 | 图标数 | 组件 |
|------|--------|------|
| 播放控制 | 6 | IconPlay, IconPause, IconSkipBack, IconSkipForward, IconMusic, IconEdit |
| 播放模式 | 4 | IconListOrdered, IconRepeat, IconRepeat1, IconShuffle |
| 音量控制 | 2 | IconVolume, IconVolumeX |
| 队列列表 | 5 | IconList, IconTrash, IconPlus, IconGripVertical, IconGripHorizontal |
| 面板窗口 | 11 | IconSettings, IconSearch, IconX, IconMinimize, IconMaximize, IconCompact, IconChevronDown/Up/Left/Right, IconArrowDown |
| 功能特性 | 8 | IconMic, IconEqualizer, IconKeyboard, IconClock, IconFolder, IconDownload, IconInfo, IconUser |
| 唱片架视图 | 2 | IconLayers (2D), IconBox (3D) |

### 统一入口
- `index.ts` — barrel export 所有组件
- `Icon.vue` — 动态图标组件，通过 `name` prop 切换
- `preview.html` — 可视化图标库预览与集成指南

### 设计规范
- **画布**: 24×24 viewBox
- **描边**: stroke-width="2", stroke-linecap="round", stroke-linejoin="round"
- **填色**: fill="none", stroke="currentColor"（继承父元素颜色）
- **风格**: Lucide 风格，与项目现有 PlaylistShelf.vue 的 SVG 图标完全一致

## 集成方式
```vue
<!-- 方式一：直接导入 -->
import { IconPlay, IconPause } from '@/components/icons'
<IconPlay :size="24" />

<!-- 方式二：动态切换 -->
import Icon from '@/components/icons/Icon.vue'
<Icon name="play" :size="24" />
```

## 待跟进
- 在各 Vue 组件中将 Emoji 替换为图标组件引用
- 调整部分图标尺寸以匹配现有 UI 布局
