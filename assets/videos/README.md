---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 9d28daf1a7d9923eabbd286698e5ff78_c67238fcb26e11f18721525400cd780f
    ReservedCode1: zv5rYuoGcn+PO+Wt5lLjPLCYyl8Xtcqb9sFB6irZjU1lC7LtCQQk0iuIY9rCjTkhI/ZI9qUef+FjVtqXeMjHZ5GbEsaQZkjlxnlht77qrV8qIAgPpzFOqU1/qqaSRdksDPcdrHTSKHEa3TndaBJtugp15nmJ5v3Ok+MUhBxX9NUJLIUN8OAQUeOvTf4=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 9d28daf1a7d9923eabbd286698e5ff78_c67238fcb26e11f18721525400cd780f
    ReservedCode2: zv5rYuoGcn+PO+Wt5lLjPLCYyl8Xtcqb9sFB6irZjU1lC7LtCQQk0iuIY9rCjTkhI/ZI9qUef+FjVtqXeMjHZ5GbEsaQZkjlxnlht77qrV8qIAgPpzFOqU1/qqaSRdksDPcdrHTSKHEa3TndaBJtugp15nmJ5v3Ok+MUhBxX9NUJLIUN8OAQUeOvTf4=
---

# 本地视频目录（assets/videos/）

用于存放需要用**本地 mp4** 方式播放的作品视频（无需联网、双击 `index.html` 即可播放）。

## 使用方式

1. 把视频文件放进本目录，例如 `my-new-work.mp4`；
2. 在 `assets/js/data.js` 对应作品中写：

```js
video: { type: "file", url: "assets/videos/my-new-work.mp4" }
```

详情页会先显示封面，点击封面后才注入播放器并开始加载视频。

## 规格建议

| 项目 | 建议值 |
| --- | --- |
| 格式 | mp4（H.264 编码，兼容性最好） |
| 分辨率 | 1920×1080 |
| 码率 | 8-12 Mbps（预览用可更低） |
| 音频 | AAC 128-192 kbps |

> 注意：仓库/托管时不宜放入体积过大的原始素材，建议只放压缩后的预览版本；完整成片建议使用在线嵌播方式（B站 / Vimeo / YouTube），在 `data.js` 中把 `type` 改为 `iframe` 并填写嵌入地址即可。

## 当前状态

数据文件中 `tech-launch-opener`、`beauty-double11-video` 两件作品使用本地播放方式作为示例，本目录暂未放入实际视频文件。放入对应 mp4 后即可正常播放；未放入时点击封面会出现播放器区域并给出提示文案，不影响其他功能。
*（内容由AI生成，仅供参考）*
